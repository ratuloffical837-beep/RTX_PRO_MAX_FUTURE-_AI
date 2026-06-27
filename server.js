// ══════════════════════════════════════════════════════
//   RTX — REAL TRADING EXPERT
//   Ultra Pro Max Signal System
//   CRT + ICT + TBS + VSA + ATR + 200 Indicators
//   Strategy-First Approach — TP Always Hits
//   বিসমিল্লাহির রাহমানির রাহিম
// ══════════════════════════════════════════════════════

import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { generateSignal } from './signalEngine.js'

// ── Firebase Admin ──
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8')
)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

// ── Config ──
const BOT_TOKEN   = process.env.BOT_TOKEN
const ADMIN_ID    = process.env.ADMIN_TELEGRAM_ID
const WH_SECRET   = process.env.WEBHOOK_SECRET || 'cryptosecret2024strong'
const BASE_URL    = process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000'
const FRONTEND_URL = process.env.FRONTEND_URL || BASE_URL

// ── Collections ──
const USERS_COL    = 'crypto_users'
const TRIALS_COL   = 'crypto_trials'
const PAYMENTS_COL = 'crypto_payments'

// ── Express App ──
const app = express()
app.use(cors())
app.use(express.json())

// ── Telegram API Helper ──
const tgAPI = async (method, body) => {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.json()
  } catch (e) {
    console.error('TG API error:', e.message)
    return null
  }
}

// ══════════════════════════════════════════
//   HEALTH CHECK
// ══════════════════════════════════════════
app.get('/', (_, res) => res.send('✅ RTX Signal Engine Online'))
app.get('/health', (_, res) => res.json({
  status: 'OK',
  engine: 'RTX v3.0',
  time: new Date().toISOString(),
}))

// ══════════════════════════════════════════
//   🔥 MAIN SIGNAL GENERATION API
//   Frontend থেকে button click এ call হবে
// ══════════════════════════════════════════
app.post('/api/generate-signal', async (req, res) => {
  try {
    const { coin, market, userId } = req.body

    if (!coin || !market) {
      return res.status(400).json({ ok: false, error: 'coin and market required' })
    }

    // ── Trial Check ──
    if (userId) {
      const trialCheck = await checkTrialLimit(userId)
      if (trialCheck.blocked) {
        return res.json({
          ok: false,
          blocked: true,
          message: '🔒 Trial limit শেষ! Premium নিন — ৳5000',
          remaining: 0,
        })
      }
    }

    console.log(`🔍 RTX Signal Request: ${coin} (${market})`)

    // ── Fetch All Timeframe Data ──
    const timeframes = market === 'futures'
      ? ['4h', '1h', '30m', '15m', '5m', '1m']
      : ['4h', '1h', '30m', '15m', '5m', '1m']

    const candleData = {}
    const fetchPromises = timeframes.map(async (tf) => {
      const candles = await fetchKlines(coin, tf, 200, market)
      if (candles && candles.length > 50) {
        candleData[tf] = candles
      }
    })

    await Promise.all(fetchPromises)

    // ── Check if enough data ──
    const availableTFs = Object.keys(candleData)
    if (availableTFs.length < 3) {
      return res.json({
        ok: false,
        noSignal: true,
        message: '❌ পর্যাপ্ত ডাটা পাওয়া যায়নি। অন্য coin try করুন।',
      })
    }

    // ── Fetch Funding Rate (Futures Only) ──
    let fundingRate = null
    if (market === 'futures') {
      fundingRate = await fetchFundingRate(coin)
    }

    // ── Generate Signal Using RTX Engine ──
    const signal = generateSignal(candleData, {
      coin,
      market,
      fundingRate,
    })

    if (!signal || !signal.direction) {
      return res.json({
        ok: false,
        noSignal: true,
        message: '❌ এই coin এ এখন strong signal নেই, অন্য coin try করুন।',
      })
    }

    // ── Update Trial Count ──
    if (userId) {
      await incrementTrialCount(userId)
    }

    console.log(`✅ RTX Signal: ${coin} ${signal.direction} ${signal.strength} (${signal.confidence}%)`)

    return res.json({
      ok: true,
      signal: {
        coin,
        market,
        direction: signal.direction,
        strength: signal.strength,
        confidence: signal.confidence,
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
        timestamp: Date.now(),
      },
    })

  } catch (e) {
    console.error('Signal generation error:', e)
    res.status(500).json({ ok: false, error: 'Server error' })
  }
})

// ══════════════════════════════════════════
//   TRIAL MANAGEMENT
// ══════════════════════════════════════════
async function checkTrialLimit(userId) {
  try {
    const uid = String(userId)

    // Check if premium user
    const userSnap = await db.collection(USERS_COL).doc(uid).get()
    if (userSnap.exists) {
      const d = userSnap.data()
      if (d.status === 'approved') {
        const exp = d.expiresAt?.toDate?.()
        if (exp && exp > new Date()) {
          return { blocked: false, isPremium: true }
        }
      }
    }

    // Check trial
    const trialSnap = await db.collection(TRIALS_COL).doc(uid).get()
    if (!trialSnap.exists) {
      return { blocked: false, remaining: 5 }
    }

    const trial = trialSnap.data()
    const trialEnd = trial.trialEnd?.toDate?.()

    // Trial expired
    if (trialEnd && trialEnd < new Date()) {
      return { blocked: true, message: 'Trial expired' }
    }

    // Check daily refresh count
    const today = new Date().toISOString().split('T')[0]
    const dailyCount = trial.dailyCounts?.[today] || 0

    if (dailyCount >= 5) {
      return { blocked: true, remaining: 0 }
    }

    return { blocked: false, remaining: 5 - dailyCount }
  } catch (e) {
    console.error('Trial check error:', e)
    return { blocked: false, remaining: 5 }
  }
}

async function incrementTrialCount(userId) {
  try {
    const uid = String(userId)

    // Check if premium — don't count for premium
    const userSnap = await db.collection(USERS_COL).doc(uid).get()
    if (userSnap.exists) {
      const d = userSnap.data()
      if (d.status === 'approved') {
        const exp = d.expiresAt?.toDate?.()
        if (exp && exp > new Date()) return
      }
    }

    const today = new Date().toISOString().split('T')[0]
    const trialRef = db.collection(TRIALS_COL).doc(uid)

    await trialRef.set({
      [`dailyCounts.${today}`]: FieldValue.increment(1),
      lastUsed: FieldValue.serverTimestamp(),
    }, { merge: true })
  } catch (e) {
    console.error('Trial increment error:', e)
  }
}

// ══════════════════════════════════════════
//   TRIAL STATUS API
// ══════════════════════════════════════════
app.post('/api/check-status', async (req, res) => {
  try {
    const { userId } = req.body
    if (!userId) return res.status(400).json({ ok: false })

    const uid = String(userId)

    // Check premium user
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

    // Check trial
    const trialSnap = await db.collection(TRIALS_COL).doc(uid).get()
    if (!trialSnap.exists) {
      // Create new trial
      const trialEnd = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await db.collection(TRIALS_COL).doc(uid).set({
        userId: uid,
        trialStart: FieldValue.serverTimestamp(),
        trialEnd,
        dailyCounts: {},
        createdAt: FieldValue.serverTimestamp(),
      })
      return res.json({ ok: true, status: 'trial', trialEnd: trialEnd.toISOString(), remaining: 5 })
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
      remaining: Math.max(0, 5 - dailyCount),
    })

  } catch (e) {
    console.error('Status check error:', e)
    res.status(500).json({ ok: false })
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
      `💳 <b>নতুন পেমেন্ট — RTX Signal</b>\n\n` +
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
            { text: '✅ এপ্রুভ (৩০ দিন)', callback_data: `confirm:${userId}:${txId}` },
            { text: '❌ রিজেক্ট', callback_data: `reject:${userId}:${txId}` },
          ],
          [
            { text: '👥 Active Users', callback_data: 'check_users' },
          ],
        ],
      },
    })

    res.json({ ok: true })
  } catch (e) {
    console.error('notify-payment:', e)
    res.status(500).json({ ok: false })
  }
})

// ══════════════════════════════════════════
//   TELEGRAM WEBHOOK
// ══════════════════════════════════════════
app.post(`/webhook/${WH_SECRET}`, async (req, res) => {
  res.sendStatus(200)
  const update = req.body

  // ── /start Command ──
  if (update.message?.text === '/start') {
    const chatId = update.message.chat.id
    await tgAPI('sendMessage', {
      chat_id: chatId,
      text:
        `🚀 <b>RTX — Real Trading eXpert</b>\n\n` +
        `দুনিয়ার সবচেয়ে Powerful Signal System\n\n` +
        `✅ CRT + ICT + VSA + TBS + ATR\n` +
        `✅ 200+ Indicators\n` +
        `✅ 6 Timeframe Analysis\n` +
        `✅ Smart Money Detection\n\n` +
        `🎁 ৫ বার ফ্রি Signal!\n` +
        `💎 ৩০ দিনের Premium: ৳5000`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '🚀 Open RTX Signal', web_app: { url: FRONTEND_URL } },
        ]],
      },
    })
    return
  }

  // ── /users Command (Admin) ──
  if (update.message?.text === '/users' && String(update.message.from.id) === String(ADMIN_ID)) {
    await sendActiveUsers(update.message.chat.id)
    return
  }

  // ── Callback Queries ──
  if (!update.callback_query) return

  const cb = update.callback_query
  const data = cb.data
  const chatId = cb.message.chat.id
  const msgId = cb.message.message_id

  const ack = (text) => tgAPI('answerCallbackQuery', { callback_query_id: cb.id, text })
  const editBtn = (label) => tgAPI('editMessageReplyMarkup', {
    chat_id: chatId, message_id: msgId,
    reply_markup: { inline_keyboard: [[{ text: label, callback_data: 'done' }]] },
  })

  // ── CONFIRM Payment ──
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
      await editBtn('✅ এপ্রুভ হয়েছে')

      await tgAPI('sendMessage', {
        chat_id: userId,
        text:
          `✅ <b>পেমেন্ট কনফার্ম!</b>\n\n` +
          `RTX Premium সক্রিয় 🎉\n` +
          `মেয়াদ: ${expiresAt.toLocaleDateString('bn-BD')} পর্যন্ত\n\n` +
          `🚀 Mini App খুলে ট্রেডিং শুরু করুন!`,
        parse_mode: 'HTML',
      }).catch(() => {})

    } catch (e) { await ack('❌ Error: ' + e.message) }

  // ── REJECT ──
  } else if (data.startsWith('reject:')) {
    const [, userId, txId] = data.split(':')
    try {
      await db.collection(PAYMENTS_COL).doc(txId).update({ status: 'rejected' })
      await db.collection(USERS_COL).doc(userId).set({ status: 'rejected' }, { merge: true })
      await ack('❌ রিজেক্ট হয়েছে')
      await editBtn('❌ রিজেক্ট হয়েছে')
      await tgAPI('sendMessage', {
        chat_id: userId,
        text: `❌ <b>পেমেন্ট রিজেক্ট</b>\nসঠিক TrxID দিয়ে আবার চেষ্টা করুন।`,
        parse_mode: 'HTML',
      }).catch(() => {})
    } catch (_) { await ack('❌ Error') }

  // ── CHECK USERS ──
  } else if (data === 'check_users') {
    await ack()
    await sendActiveUsers(chatId)

  // ── DISCONNECT ──
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
        text: `⚠️ আপনার RTX Premium বন্ধ করা হয়েছে।`,
        parse_mode: 'HTML',
      }).catch(() => {})
    } catch (_) { await ack('❌ Error') }

  } else if (data === 'done') { await ack('OK') }
})

// ── Active Users ──
async function sendActiveUsers(chatId) {
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

    let text = `👥 <b>RTX Users</b>\n\n`
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
        const u = d.data()
        const end = u.trialEnd?.toDate?.()
        const hoursLeft = end ? Math.max(0, Math.floor((end - now) / 3600000)) : 0
        text += `🟡 <code>${d.id}</code> | বাকি: ${hoursLeft}h\n`
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
//   BINANCE DATA FETCHERS
// ══════════════════════════════════════════
async function fetchKlines(symbol, interval, limit, market = 'spot') {
  const baseURL = market === 'futures'
    ? 'https://fapi.binance.com/fapi/v1/klines'
    : 'https://api.binance.com/api/v3/klines'
  try {
    const res = await fetch(`${baseURL}?symbol=${symbol}&interval=${interval}&limit=${limit}`)
    const data = await res.json()
    if (!Array.isArray(data)) return null
    return data.map(k => ({
      t: k[0],
      o: parseFloat(k[1]),
      h: parseFloat(k[2]),
      l: parseFloat(k[3]),
      c: parseFloat(k[4]),
      v: parseFloat(k[5]),
    }))
  } catch (e) {
    return null
  }
}

async function fetchFundingRate(symbol) {
  try {
    const res = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`)
    const data = await res.json()
    return parseFloat(data.lastFundingRate || 0)
  } catch (_) {
    return null
  }
}

// ══════════════════════════════════════════
//   SELF-PING (Render Free Sleep Prevention)
// ══════════════════════════════════════════
async function selfPing() {
  try {
    if (BASE_URL.includes('http')) {
      await fetch(`${BASE_URL}/health`).catch(() => {})
    }
  } catch (_) {}
}

// ══════════════════════════════════════════
//   SERVER START
// ══════════════════════════════════════════
const PORT = process.env.PORT || 5000

app.listen(PORT, async () => {
  console.log(`\n✅ RTX Signal Engine v3.0`)
  console.log(`🚀 Port: ${PORT}`)
  console.log(`🌐 URL: ${BASE_URL}`)
  console.log(`📱 Frontend: ${FRONTEND_URL}`)

  // Register Telegram Webhook
  if (process.env.NODE_ENV === 'production' && BOT_TOKEN) {
    const r = await tgAPI('setWebhook', { url: `${BASE_URL}/webhook/${WH_SECRET}` })
    console.log('📡 Webhook:', r?.description || 'set')
  }

  // Self-Ping (every 10 min)
  setInterval(selfPing, 10 * 60 * 1000)
  setTimeout(selfPing, 60000)

  console.log('\n🔥 RTX Systems:')
  console.log('   ⚡ Signal API: /api/generate-signal')
  console.log('   📊 Status API: /api/check-status')
  console.log('   💳 Payment API: /api/notify-payment')
  console.log('   💓 Self-ping: every 10 min')
  console.log('   🤲 আল্লাহর রহমতে চলবে ইনশাআল্লাহ\n')
})

// ── Error Handlers ──
process.on('uncaughtException', (e) => console.error('Uncaught:', e))
process.on('unhandledRejection', (e) => console.error('Unhandled:', e))
