// ══════════════════════════════════════════════════════
//   RTX — REAL TRADING EXPERT
//   Backend Server with Mode Router
//   বিসমিল্লাহির রাহমানির রাহিম
// ══════════════════════════════════════════════════════

import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { generateSignal } from './signalEngine.js'
import { fetchAllTimeframes, fetchFundingRate } from './binanceData.js'

// ── Firebase Admin (Safe Init) ──
let db = null
try {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_B64 not set')
  }
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8')
  )
  initializeApp({ credential: cert(serviceAccount) })
  db = getFirestore()
  console.log('✅ Firebase Admin initialized')
} catch (e) {
  console.error('❌ Firebase init failed:', e.message)
  console.error('⚠️ Server will run but Firebase features disabled')
}

// ── Config ──
const BOT_TOKEN    = process.env.BOT_TOKEN
const ADMIN_ID     = process.env.ADMIN_TELEGRAM_ID
const WH_SECRET    = process.env.WEBHOOK_SECRET || 'cryptosecret2024strong'
const BASE_URL     = process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000'
const FRONTEND_URL = process.env.FRONTEND_URL || BASE_URL
const PORT         = process.env.PORT || 5000

// ── Collections ──
const USERS_COL    = 'crypto_users'
const TRIALS_COL   = 'crypto_trials'
const PAYMENTS_COL = 'crypto_payments'

// ── Express ──
const app = express()
app.use(cors())
app.use(express.json())

// ── Telegram Helper ──
const tgAPI = async (method, body) => {
  if (!BOT_TOKEN) {
    console.warn('⚠️ BOT_TOKEN not set')
    return null
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeout: 10000,
    })
    return res.json()
  } catch (e) {
    console.error('TG API error:', e.message)
    return null
  }
}

// ══════════════════════════════════════════
//   HEALTH ENDPOINTS
// ══════════════════════════════════════════
app.get('/', (_, res) => res.send('✅ RTX Pro Max Backend Online'))
app.get('/health', (_, res) => res.json({
  status: 'OK',
  engine: 'RTX v4.0',
  firebase: db ? 'connected' : 'disconnected',
  bot: BOT_TOKEN ? 'configured' : 'missing',
  time: new Date().toISOString(),
}))

// ══════════════════════════════════════════
//   🔥 MAIN SIGNAL API
// ══════════════════════════════════════════
app.post('/api/generate-signal', async (req, res) => {
  try {
    const { coin, market, userId, mode = 'hybrid' } = req.body

    if (!coin || !market) {
      return res.status(400).json({ ok: false, error: 'coin and market required' })
    }

    // Trial check
    if (userId && db) {
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

    // Fetch data
    const candleData = await fetchAllTimeframes(coin, market)
    const availableTFs = Object.keys(candleData)

    if (availableTFs.length < 3) {
      return res.json({
        ok: false,
        noSignal: true,
        message: '❌ পর্যাপ্ত ডাটা পাওয়া যায়নি। অন্য coin try করুন।',
      })
    }

    // Fetch funding rate (futures)
    let fundingRate = null
    if (market === 'futures') {
      fundingRate = await fetchFundingRate(coin)
    }

    // Generate signal based on mode
    const signal = generateSignal(candleData, {
      coin, market, mode, fundingRate,
    })

    if (!signal || !signal.direction) {
      return res.json({
        ok: false,
        noSignal: true,
        message: '❌ এই coin এ এখন strong signal নেই, অন্য coin try করুন।',
      })
    }

    // Increment trial count
    let remaining = null
    if (userId && db) {
      await incrementTrialCount(userId)
      const updated = await checkTrialLimit(userId)
      remaining = updated.remaining
    }

    console.log(`✅ Signal: ${coin} ${signal.direction} ${signal.strength} (${signal.confidence}%)`)

    return res.json({
      ok: true,
      signal: {
        coin, market,
        direction: signal.direction,
        strength: signal.strength,
        confidence: signal.confidence,
        grade: signal.grade,
        tp: signal.tp,
        indicators: signal.indicators,
        pattern: signal.pattern,
        smcAnalysis: signal.smcAnalysis,
        mtfBias: signal.mtfBias,
        callVotes: signal.callVotes,
        putVotes: signal.putVotes,
        totalIndicators: signal.totalIndicators,
        rsiValue: signal.rsiValue,
        adxValue: signal.adxValue,
        mode: signal.mode || mode.toUpperCase(),
        timestamp: Date.now(),
      },
      remaining,
    })

  } catch (e) {
    console.error('❌ Signal API error:', e)
    res.status(500).json({ ok: false, error: 'Server error: ' + e.message })
  }
})

// ══════════════════════════════════════════
//   TRIAL MANAGEMENT
// ══════════════════════════════════════════
async function checkTrialLimit(userId) {
  if (!db) return { blocked: false, remaining: 2 }
  try {
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
      return { blocked: true, message: 'Trial expired' }
    }

    const today = new Date().toISOString().split('T')[0]
    const dailyCount = trial.dailyCounts?.[today] || 0

    if (dailyCount >= 2) {
      return { blocked: true, remaining: 0 }
    }

    return { blocked: false, remaining: 2 - dailyCount }
  } catch (e) {
    console.error('Trial check error:', e.message)
    return { blocked: false, remaining: 2 }
  }
}

async function incrementTrialCount(userId) {
  if (!db) return
  try {
    const uid = String(userId)

    const userSnap = await db.collection(USERS_COL).doc(uid).get()
    if (userSnap.exists) {
      const d = userSnap.data()
      if (d.status === 'approved') {
        const exp = d.expiresAt?.toDate?.()
        if (exp && exp > new Date()) return
      }
    }

    const today = new Date().toISOString().split('T')[0]
    await db.collection(TRIALS_COL).doc(uid).set({
      [`dailyCounts.${today}`]: FieldValue.increment(1),
      lastUsed: FieldValue.serverTimestamp(),
    }, { merge: true })
  } catch (e) {
    console.error('Trial increment error:', e.message)
  }
}

// ══════════════════════════════════════════
//   STATUS CHECK API
// ══════════════════════════════════════════
app.post('/api/check-status', async (req, res) => {
  try {
    const { userId } = req.body
    if (!userId) return res.status(400).json({ ok: false })
    if (!db) return res.json({ ok: true, status: 'trial', trialEnd: new Date(Date.now() + 86400000).toISOString(), remaining: 2 })

    const uid = String(userId)

    const userSnap = await db.collection(USERS_COL).doc(uid).get()
    if (userSnap.exists) {
      const d = userSnap.data()
      if (d.status === 'approved') {
        const exp = d.expiresAt?.toDate?.()
        if (exp && exp > new Date()) {
          return res.json({ ok: true, status: 'approved', expiresAt: exp.toISOString() })
        } else {
          return res.json({ ok: true, status: 'expired' })
        }
      }
      if (d.status === 'pending') return res.json({ ok: true, status: 'pending' })
      if (d.status === 'rejected') return res.json({ ok: true, status: 'rejected' })
      if (d.status === 'disconnected') return res.json({ ok: true, status: 'expired' })
    }

    const trialSnap = await db.collection(TRIALS_COL).doc(uid).get()
    if (!trialSnap.exists) {
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
    const dailyCount = trial.dailyCounts?.[today] || 0

    return res.json({
      ok: true,
      status: 'trial',
      trialEnd: trialEnd?.toISOString(),
      remaining: Math.max(0, 2 - dailyCount),
    })

  } catch (e) {
    console.error('Status check error:', e.message)
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

    const msg =
      `💳 <b>নতুন পেমেন্ট — RTX Pro Max</b>\n\n` +
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
        inline_keyboard: [
          [
            { text: '✅ এপ্রুভ', callback_data: `confirm:${userId}:${txId}` },
            { text: '❌ রিজেক্ট', callback_data: `reject:${userId}:${txId}` },
          ],
          [
            { text: '👥 Status Check', callback_data: 'check_users' },
          ],
        ],
      },
    })

    res.json({ ok: true })
  } catch (e) {
    console.error('notify-payment:', e.message)
    res.status(500).json({ ok: false })
  }
})

// ══════════════════════════════════════════
//   TELEGRAM WEBHOOK
// ══════════════════════════════════════════
app.post(`/webhook/${WH_SECRET}`, async (req, res) => {
  res.sendStatus(200)
  const update = req.body

  try {
    // /start command
    if (update.message?.text === '/start') {
      const chatId = update.message.chat.id
      await tgAPI('sendMessage', {
        chat_id: chatId,
        text:
          `🚀 <b>RTX Pro Max — Real Trading eXpert</b>\n\n` +
          `দুনিয়ার সবচেয়ে Powerful Signal System\n\n` +
          `✅ 3 Strategy Modes\n` +
          `✅ Sweep Reclaim + 200 Indicators\n` +
          `✅ Smart Money Detection\n\n` +
          `🎁 দিনে ২টি ফ্রি Signal!\n` +
          `💎 ৩০ দিনের Premium: ৳5000`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '🚀 Open RTX', web_app: { url: FRONTEND_URL } },
          ]],
        },
      })
      return
    }

    // /status for admin
    if (update.message?.text === '/status' && String(update.message.from.id) === String(ADMIN_ID)) {
      await sendActiveUsers(update.message.chat.id)
      return
    }

    // Callback queries
    if (!update.callback_query) return

    const cb = update.callback_query
    const data = cb.data
    const chatId = cb.message.chat.id
    const msgId = cb.message.message_id

    const ack = (text) => tgAPI('answerCallbackQuery', { callback_query_id: cb.id, text })

    // CONFIRM
    if (data.startsWith('confirm:')) {
      const [, userId, txId] = data.split(':')
      try {
        const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000)
        const paymentSnap = await db.collection(PAYMENTS_COL).doc(txId).get()
        const paymentData = paymentSnap.exists ? paymentSnap.data() : {}

        await db.collection(USERS_COL).doc(userId).set({
          status: 'approved',
          expiresAt,
          approvedAt: FieldValue.serverTimestamp(),
          lastTxId: txId,
          name: paymentData.name || 'N/A',
          username: paymentData.username || '',
        }, { merge: true })

        await db.collection(PAYMENTS_COL).doc(txId).update({ status: 'approved' })
        await ack('✅ এপ্রুভ সফল!')
        await tgAPI('editMessageReplyMarkup', {
          chat_id: chatId, message_id: msgId,
          reply_markup: { inline_keyboard: [[{ text: '✅ এপ্রুভ হয়েছে', callback_data: 'done' }]] },
        })

        await tgAPI('sendMessage', {
          chat_id: userId,
          text: `✅ <b>পেমেন্ট কনফার্ম!</b>\n\nRTX Premium সক্রিয় 🎉\nমেয়াদ: ${expiresAt.toLocaleDateString('bn-BD')} পর্যন্ত`,
          parse_mode: 'HTML',
        }).catch(() => {})

      } catch (e) {
        await ack('❌ Error: ' + e.message)
      }

    // REJECT
    } else if (data.startsWith('reject:')) {
      const [, userId, txId] = data.split(':')
      try {
        await db.collection(PAYMENTS_COL).doc(txId).update({ status: 'rejected' })
        await db.collection(USERS_COL).doc(userId).set({ status: 'rejected' }, { merge: true })
        await ack('❌ রিজেক্ট হয়েছে')
        await tgAPI('editMessageReplyMarkup', {
          chat_id: chatId, message_id: msgId,
          reply_markup: { inline_keyboard: [[{ text: '❌ রিজেক্ট হয়েছে', callback_data: 'done' }]] },
        })
        await tgAPI('sendMessage', {
          chat_id: userId,
          text: `❌ <b>পেমেন্ট সফল হয়নি</b>\n\nদয়া করে আবার পেমেন্ট করুন।`,
          parse_mode: 'HTML',
        }).catch(() => {})
      } catch (_) { await ack('❌ Error') }

    // STATUS CHECK
    } else if (data === 'check_users') {
      await ack()
      await sendActiveUsers(chatId)

    // DISCONNECT
    } else if (data.startsWith('disconnect:')) {
      const [, userId] = data.split(':')
      try {
        await db.collection(USERS_COL).doc(userId).update({
          status: 'disconnected',
          expiresAt: new Date(0),
        })
        await ack('🔴 Disconnect সফল!')
        await tgAPI('sendMessage', {
          chat_id: userId,
          text: `⚠️ আপনার RTX Premium বন্ধ করা হয়েছে।\nদয়া করে আবার পেমেন্ট করুন।`,
          parse_mode: 'HTML',
        }).catch(() => {})
      } catch (_) { await ack('❌ Error') }

    } else if (data === 'done') {
      await ack('OK')
    }
  } catch (e) {
    console.error('Webhook error:', e.message)
  }
})

// Send Active Users
async function sendActiveUsers(chatId) {
  if (!db) {
    await tgAPI('sendMessage', { chat_id: chatId, text: 'Firebase not connected' })
    return
  }
  try {
    const snap = await db.collection(USERS_COL).where('status', '==', 'approved').get()
    const trialSnap = await db.collection(TRIALS_COL).get()
    const now = new Date()

    const activeTrials = trialSnap.docs.filter(d => {
      const end = d.data().trialEnd?.toDate?.()
      return end && end > now
    })

    if (snap.empty && activeTrials.length === 0) {
      await tgAPI('sendMessage', { chat_id: chatId, text: 'কোনো active user নেই' })
      return
    }

    const paidUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }))

    let text = `👥 <b>RTX Users Status</b>\n\n`
    if (paidUsers.length > 0) {
      text += `💎 <b>Premium (${paidUsers.length}):</b>\n`
      paidUsers.forEach(u => {
        const exp = u.expiresAt?.toDate?.()?.toLocaleDateString('bn-BD') || 'N/A'
        text += `🟢 ${u.name || 'N/A'} | <code>${u.id}</code>\n   মেয়াদ: ${exp}\n\n`
      })
    }

    if (activeTrials.length > 0) {
      text += `\n🎁 <b>Trial (${activeTrials.length}):</b>\n`
      activeTrials.forEach(d => {
        const end = d.data().trialEnd?.toDate?.()
        const h = end ? Math.max(0, Math.floor((end - now) / 3600000)) : 0
        text += `🟡 <code>${d.id}</code> | বাকি: ${h}h\n`
      })
    }

    const keyboard = paidUsers.map(u => ([
      { text: `🔴 Disconnect: ${(u.name || u.id).slice(0, 18)}`, callback_data: `disconnect:${u.id}` },
    ]))

    await tgAPI('sendMessage', {
      chat_id: chatId, text, parse_mode: 'HTML',
      reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
    })
  } catch (e) {
    await tgAPI('sendMessage', { chat_id: chatId, text: '❌ Error: ' + e.message })
  }
}

// ══════════════════════════════════════════
//   AUTO-EXPIRE CHECK (Every 1 hour)
// ══════════════════════════════════════════
async function checkExpiredUsers() {
  if (!db) return
  try {
    const snap = await db.collection(USERS_COL).where('status', '==', 'approved').get()
    const now = new Date()

    for (const doc of snap.docs) {
      const d = doc.data()
      const exp = d.expiresAt?.toDate?.()
      if (exp && exp < now) {
        await doc.ref.update({ status: 'expired' })
        await tgAPI('sendMessage', {
          chat_id: doc.id,
          text: `⏰ <b>আপনার RTX Premium শেষ হয়েছে</b>\n\nদয়া করে আবার পেমেন্ট করুন।`,
          parse_mode: 'HTML',
        }).catch(() => {})
        console.log(`⏰ Expired: ${doc.id}`)
      }
    }
  } catch (e) {
    console.error('Expire check error:', e.message)
  }
}

// ══════════════════════════════════════════
//   SELF-PING
// ══════════════════════════════════════════
async function selfPing() {
  try {
    if (BASE_URL.includes('http')) {
      await fetch(`${BASE_URL}/health`, { timeout: 5000 }).catch(() => {})
    }
  } catch (_) {}
}

// ══════════════════════════════════════════
//   SERVER START
// ══════════════════════════════════════════
app.listen(PORT, async () => {
  console.log(`\n✅ RTX Pro Max v4.0`)
  console.log(`🚀 Port: ${PORT}`)
  console.log(`🌐 Backend: ${BASE_URL}`)
  console.log(`📱 Frontend: ${FRONTEND_URL}`)
  console.log(`🔥 Firebase: ${db ? '✅ Connected' : '❌ Disconnected'}`)
  console.log(`🤖 Bot Token: ${BOT_TOKEN ? '✅ Set' : '❌ Missing'}`)

  if (process.env.NODE_ENV === 'production' && BOT_TOKEN) {
    const r = await tgAPI('setWebhook', { url: `${BASE_URL}/webhook/${WH_SECRET}` })
    console.log('📡 Webhook:', r?.description || 'set')
  }

  setInterval(selfPing, 10 * 60 * 1000)
  setTimeout(selfPing, 60000)

  setInterval(checkExpiredUsers, 60 * 60 * 1000)
  setTimeout(checkExpiredUsers, 5 * 60 * 1000)

  console.log('\n🔥 RTX Systems Active:')
  console.log('   ⚡ POST /api/generate-signal')
  console.log('   📊 POST /api/check-status')
  console.log('   💳 POST /api/notify-payment')
  console.log('   💓 Self-ping: every 10 min')
  console.log('   ⏰ Auto-expire: every 1 hour')
  console.log('   🤲 আল্লাহর রহমতে চলবে ইনশাআল্লাহ\n')
})

process.on('uncaughtException', (e) => console.error('Uncaught:', e.message))
process.on('unhandledRejection', (e) => console.error('Unhandled:', e?.message || e))
