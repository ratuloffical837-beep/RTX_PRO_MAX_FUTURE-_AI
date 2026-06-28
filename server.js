// ══════════════════════════════════════════════════════
//   RTX Pro Max — Backend Server (v4.1 - Fixed)
//   বিসমিল্লাহির রাহমানির রাহিম
// ══════════════════════════════════════════════════════

import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { generateSignal } from './signalEngine.js'
import { fetchAllTimeframes, fetchFundingRate } from './binanceData.js'

// ── Firebase Admin Init ──
let db = null
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8')
    )
    initializeApp({ credential: cert(serviceAccount) })
    db = getFirestore()
    console.log('✅ Firebase Admin initialized')
  }
} catch (e) {
  console.error('❌ Firebase init failed:', e.message)
}

// ── Config ──
const BOT_TOKEN = process.env.BOT_TOKEN
const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID
const WH_SECRET = process.env.WEBHOOK_SECRET || 'cryptosecret2024strong'
const BASE_URL = process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000'
const FRONTEND_URL = process.env.FRONTEND_URL || BASE_URL
const PORT = process.env.PORT || 5000

const USERS_COL = 'crypto_users'
const TRIALS_COL = 'crypto_trials'
const PAYMENTS_COL = 'crypto_payments'

const app = express()
app.use(cors())
app.use(express.json())

// ── Telegram Helper ──
const tgAPI = async (method, body) => {
  if (!BOT_TOKEN) return null
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.json()
  } catch (e) {
    return null
  }
}

// ══════════════════════════════════════════
//   HEALTH
// ══════════════════════════════════════════
app.get('/', (_, res) => res.send('✅ RTX Pro Max Backend Online'))
app.get('/health', (_, res) => res.json({
  status: 'OK',
  version: '4.1',
  firebase: db ? 'connected' : 'disconnected',
  time: new Date().toISOString(),
}))

// ══════════════════════════════════════════
//   🔥 GENERATE SIGNAL
// ══════════════════════════════════════════
app.post('/api/generate-signal', async (req, res) => {
  try {
    const { coin, market, userId, mode = 'hybrid' } = req.body

    if (!coin || !market || !userId) {
      return res.status(400).json({ ok: false, error: 'Missing parameters' })
    }

    // Check trial limit
    if (db) {
      const trial = await checkTrialLimit(userId)
      if (trial.blocked) {
        return res.json({
          ok: false,
          blocked: true,
          message: '🔒 Trial limit শেষ! Premium নিন — ৳5000',
          remaining: 0,
        })
      }
    }

    console.log(`🔍 RTX [${mode.toUpperCase()}]: ${coin} (${market})`)

    const candleData = await fetchAllTimeframes(coin, market)
    if (Object.keys(candleData).length < 3) {
      return res.json({ ok: false, noSignal: true, message: '❌ পর্যাপ্ত ডাটা পাওয়া যায়নি' })
    }

    let fundingRate = null
    if (market === 'futures') {
      fundingRate = await fetchFundingRate(coin)
    }

    const signal = generateSignal(candleData, { coin, market, mode, fundingRate })

    if (!signal || !signal.direction) {
      return res.json({ ok: false, noSignal: true, message: '❌ এই coin এ এখন strong signal নেই' })
    }

    // Increment trial count
    let remaining = null
    if (db) {
      await incrementTrialCount(userId)
      const updated = await checkTrialLimit(userId)
      remaining = updated.remaining
    }

    return res.json({
      ok: true,
      signal: {
        ...signal,
        coin,
        market,
        timestamp: Date.now(),
      },
      remaining,
    })

  } catch (e) {
    console.error('Signal error:', e.message)
    res.status(500).json({ ok: false, error: 'Server error' })
  }
})

// ══════════════════════════════════════════
//   TRIAL MANAGEMENT (Improved)
// ══════════════════════════════════════════
async function checkTrialLimit(userId) {
  if (!db) return { blocked: false, remaining: 2 }

  const uid = String(userId)
  const userSnap = await db.collection(USERS_COL).doc(uid).get()

  if (userSnap.exists) {
    const d = userSnap.data()
    if (d.status === 'approved') {
      const exp = d.expiresAt?.toDate?.()
      if (exp && exp > new Date()) {
        return { blocked: false, isPremium: true, remaining: 999 }
      }
    }
  }

  const trialSnap = await db.collection(TRIALS_COL).doc(uid).get()
  if (!trialSnap.exists) {
    return { blocked: false, remaining: 2 }
  }

  const trial = trialSnap.data()
  const trialEnd = trial.trialEnd?.toDate?.()
  if (trialEnd && trialEnd < new Date()) {
    return { blocked: true }
  }

  const today = new Date().toISOString().split('T')[0]
  const count = trial.dailyCounts?.[today] || 0

  return { blocked: count >= 2, remaining: Math.max(0, 2 - count) }
}

async function incrementTrialCount(userId) {
  if (!db) return
  const uid = String(userId)
  const today = new Date().toISOString().split('T')[0]

  await db.collection(TRIALS_COL).doc(uid).set({
    [`dailyCounts.${today}`]: FieldValue.increment(1),
    lastUsed: FieldValue.serverTimestamp(),
  }, { merge: true })
}

// ══════════════════════════════════════════
//   CHECK STATUS (Fixed - Creates new user)
// ══════════════════════════════════════════
app.post('/api/check-status', async (req, res) => {
  try {
    const { userId } = req.body
    if (!userId || !db) return res.json({ ok: true, status: 'trial' })

    const uid = String(userId)

    // Check Premium User
    const userSnap = await db.collection(USERS_COL).doc(uid).get()
    if (userSnap.exists) {
      const d = userSnap.data()
      if (d.status === 'approved') {
        const exp = d.expiresAt?.toDate?.()
        if (exp && exp > new Date()) {
          return res.json({ ok: true, status: 'approved', expiresAt: exp.toISOString() })
        }
      }
      if (d.status === 'pending') return res.json({ ok: true, status: 'pending' })
      if (d.status === 'rejected') return res.json({ ok: true, status: 'rejected' })
    }

    // Check Trial
    const trialSnap = await db.collection(TRIALS_COL).doc(uid).get()

    if (!trialSnap.exists) {
      // Create new trial user
      const trialEnd = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await db.collection(TRIALS_COL).doc(uid).set({
        userId: uid,
        trialStart: FieldValue.serverTimestamp(),
        trialEnd,
        dailyCounts: {},
        createdAt: FieldValue.serverTimestamp(),
      })
      return res.json({ ok: true, status: 'trial', trialEnd: trialEnd.toISOString(), remaining: 2 })
    }

    const trial = trialSnap.data()
    const trialEnd = trial.trialEnd?.toDate?.()

    if (trialEnd && trialEnd < new Date()) {
      return res.json({ ok: true, status: 'trial_expired' })
    }

    const today = new Date().toISOString().split('T')[0]
    const count = trial.dailyCounts?.[today] || 0

    return res.json({
      ok: true,
      status: 'trial',
      trialEnd: trialEnd?.toISOString(),
      remaining: Math.max(0, 2 - count),
    })

  } catch (e) {
    console.error('check-status error:', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ══════════════════════════════════════════
//   PAYMENT NOTIFICATION
// ══════════════════════════════════════════
app.post('/api/notify-payment', async (req, res) => {
  try {
    const { userId, name, username, phone, method, amount, txId } = req.body
    if (!userId || !txId) return res.status(400).json({ ok: false })

    const msg = `💳 <b>নতুন পেমেন্ট — RTX Pro Max</b>\n\n` +
      `👤 নাম: <b>${name}</b>\n` +
      `🆔 TG ID: <code>${userId}</code>\n` +
      (username ? `📎 @${username}\n` : '') +
      `📱 ফোন: <code>${phone}</code>\n` +
      `💰 পরিমাণ: <b>৳${amount}</b>\n` +
      `📲 মেথড: <b>${method}</b>\n` +
      `🔑 TrxID: <code>${txId}</code>`

    await tgAPI('sendMessage', {
      chat_id: ADMIN_ID,
      text: msg,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ এপ্রুভ', callback_data: `confirm:${userId}:${txId}` },
          { text: '❌ রিজেক্ট', callback_data: `reject:${userId}:${txId}` },
        ]],
      },
    })

    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false })
  }
})

// ══════════════════════════════════════════
//   WEBHOOK
// ══════════════════════════════════════════
app.post(`/webhook/${WH_SECRET}`, async (req, res) => {
  res.sendStatus(200)
  // Webhook logic same as before (Approve/Reject)
  // (আমি পরবর্তীতে পুরো webhook লজিক দিব)
})

app.listen(PORT, () => {
  console.log(`✅ RTX Backend running on port ${PORT}`)
})
