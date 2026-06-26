// ══════════════════════════════════════════════════════
//   CRYPTO MASTER — BACKEND SERVER
//   Express + Telegram Bot + Binance WebSocket + Signal Generator
//   বিসমিল্লাহির রাহমানির রাহিম
// ══════════════════════════════════════════════════════

import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'
import WebSocket from 'ws'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

// ── Firebase Admin ──
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8')
)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

// ── Config ──
const BOT_TOKEN  = process.env.BOT_TOKEN
const ADMIN_ID   = process.env.ADMIN_TELEGRAM_ID
const WH_SECRET  = process.env.WEBHOOK_SECRET || 'cryptosecret2024'
const BASE_URL   = process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000'

// ── Collections ──
const USERS_COL    = 'crypto_users'
const TRIALS_COL   = 'crypto_trials'
const PAYMENTS_COL = 'crypto_payments'
const SIGNALS_COL  = 'crypto_signals'

// ── Top 50 Coins ──
const TOP_FUTURES = [
  'BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT',
  'ADAUSDT','DOGEUSDT','1000PEPEUSDT','WIFUSDT','AVAXUSDT',
  'DOTUSDT','LTCUSDT','BCHUSDT','LINKUSDT','TRXUSDT',
  'ETCUSDT','XLMUSDT','NEARUSDT','AAVEUSDT','FILUSDT',
  'UNIUSDT','SUIUSDT','ARBUSDT','TIAUSDT','APTUSDT',
  'OPUSDT','MATICUSDT','SEIUSDT','INJUSDT','FETUSDT',
  'WLDUSDT','ONDOUSDT','JUPUSDT','ENAUSDT','TAOUSDT',
  'RUNEUSDT','STXUSDT','IMXUSDT','MKRUSDT','SNXUSDT',
  'LDOUSDT','GRTUSDT','RENDERUSDT','ARUSDT','PENDLEUSDT',
  'NOTUSDT','TONUSDT','KASUSDT','ORDIUSDT','FLOKIUSDT'
]

const TOP_SPOT = [
  'BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT',
  'ADAUSDT','DOGEUSDT','AVAXUSDT','DOTUSDT','LTCUSDT',
  'BCHUSDT','LINKUSDT','TRXUSDT','ETCUSDT','XLMUSDT',
  'NEARUSDT','AAVEUSDT','FILUSDT','UNIUSDT','SUIUSDT',
  'ARBUSDT','TIAUSDT','APTUSDT','OPUSDT','MATICUSDT',
  'SEIUSDT','INJUSDT','FETUSDT','ATOMUSDT','ALGOUSDT',
  'VETUSDT','SANDUSDT','MANAUSDT','AXSUSDT','CHZUSDT',
  'ENJUSDT','GALAUSDT','CRVUSDT','COMPUSDT','MKRUSDT',
  'SNXUSDT','LDOUSDT','GRTUSDT','ARUSDT','FLOWUSDT',
  'EGLDUSDT','KSMUSDT','ZECUSDT','DASHUSDT','BATUSDT'
]

// ── Express App ──
const app = express()
app.use(cors())
app.use(express.json())

// ── Telegram API helper ──
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

// ── Health Check ──
app.get('/', (_, res) => res.send('✅ Crypto Master Backend Online'))
app.get('/health', (_, res) => res.json({
  status: 'OK',
  time: new Date().toISOString(),
  signals: globalSignalCache.size,
}))

// ══════════════════════════════════════════
//   PAYMENT NOTIFICATION
// ══════════════════════════════════════════
app.post('/api/notify-payment', async (req, res) => {
  try {
    const { userId, name, username, phone, method, amount, txId } = req.body
    if (!userId || !txId) return res.status(400).json({ ok: false })

    const msg =
      `💳 <b>নতুন পেমেন্ট — Crypto Master</b>\n\n` +
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
            { text: '❌ রিজেক্ট',          callback_data: `reject:${userId}:${txId}` },
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

  // ── Handle /start command ──
  if (update.message?.text === '/start') {
    const chatId = update.message.chat.id
    await tgAPI('sendMessage', {
      chat_id: chatId,
      text: `🚀 <b>Crypto Master Signal</b>\n\n` +
            `স্বাগতম! Mini App খুলতে নিচের বাটনে ক্লিক করুন।\n\n` +
            `🎁 ২৪ ঘন্টা ফ্রি ট্রায়াল\n` +
            `💎 ৩০ দিনের সাবস্ক্রিপশন: ৳5000`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '🚀 Open Crypto Master', web_app: { url: process.env.FRONTEND_URL || BASE_URL } },
        ]],
      },
    })
    return
  }

  // ── Admin Commands ──
  if (update.message?.text === '/users' && String(update.message.from.id) === String(ADMIN_ID)) {
    await sendActiveUsers(update.message.chat.id)
    return
  }

  // ── Handle Callback Queries ──
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

  // ── CONFIRM ──
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
        text: `✅ <b>পেমেন্ট কনফার্ম!</b>\n\n` +
              `Crypto Master সাবস্ক্রিপশন সক্রিয় 🎉\n` +
              `মেয়াদ: ${expiresAt.toLocaleDateString('bn-BD')} পর্যন্ত\n\n` +
              `🚀 Mini App খুলে ট্রেডিং শুরু করুন!\n` +
              `সাপোর্ট: @ratulhossain56`,
        parse_mode: 'HTML',
      }).catch(() => {})

    } catch (e) {
      await ack('❌ Error: ' + e.message)
    }

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
        text: `❌ <b>পেমেন্ট রিজেক্ট</b>\n\n` +
              `সঠিক TrxID দিয়ে আবার পেমেন্ট করুন।\n` +
              `সাপোর্ট: @ratulhossain56`,
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
        text: `⚠️ <b>সাবস্ক্রিপশন শেষ</b>\n\n` +
              `আপনার Crypto Master অ্যাক্সেস বন্ধ করা হয়েছে।\n` +
              `পুনরায় পেমেন্ট করলে অ্যাক্সেস পাবেন।`,
        parse_mode: 'HTML',
      }).catch(() => {})
    } catch (_) { await ack('❌ Error') }

  } else if (data === 'done') {
    await ack('OK')
  }
})

// ── Send Active Users to Admin ──
async function sendActiveUsers(chatId) {
  try {
    const snap = await db.collection(USERS_COL)
      .where('status', '==', 'approved').get()

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
    const trialUsers = activeTrials.map(d => ({ id: d.id, ...d.data() }))

    let text = `👥 <b>Crypto Master Users</b>\n\n`

    if (paidUsers.length > 0) {
      text += `💎 <b>Paid Users (${paidUsers.length}):</b>\n`
      paidUsers.forEach(u => {
        const exp = u.expiresAt?.toDate?.()?.toLocaleDateString('bn-BD') || 'N/A'
        text += `🟢 ${u.name || 'N/A'} | <code>${u.id}</code>\n   মেয়াদ: ${exp}\n\n`
      })
    }

    if (trialUsers.length > 0) {
      text += `\n🎁 <b>Trial Users (${trialUsers.length}):</b>\n`
      trialUsers.forEach(u => {
        const end = u.trialEnd?.toDate?.()
        const hoursLeft = end ? Math.max(0, Math.floor((end - now) / 3600000)) : 0
        text += `🟡 ${u.name || 'N/A'} | <code>${u.id}</code>\n   বাকি: ${hoursLeft}h\n\n`
      })
    }

    const keyboard = paidUsers.map(u => ([
      { text: `🔴 Disconnect: ${(u.name || u.id).slice(0, 18)}`, callback_data: `disconnect:${u.id}` },
    ]))

    await tgAPI('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
    })

  } catch (e) {
    await tgAPI('sendMessage', { chat_id: chatId, text: '❌ Error: ' + e.message })
  }
}

// ══════════════════════════════════════════
//   SIGNAL GENERATOR ENGINE
// ══════════════════════════════════════════

const globalSignalCache = new Map()  // coin → last signal
const liveData = new Map()           // coin → { candles, lastPrice, market }
const activeSignals = new Map()      // signalId → signal data
const SIGNAL_COOLDOWN = 30 * 60 * 1000  // 30 min per coin after close

// ── Helper Functions ──
const ema = (arr, p) => {
  if (!arr || arr.length < p) return null
  const k = 2 / (p + 1)
  let val = 0
  for (let i = 0; i < p; i++) val += arr[i]
  val /= p
  for (let i = p; i < arr.length; i++) val = arr[i] * k + val * (1 - k)
  return val
}

const sma = (arr, p) => {
  if (!arr || arr.length < p) return null
  let sum = 0
  for (let i = arr.length - p; i < arr.length; i++) sum += arr[i]
  return sum / p
}

const trueRange = (h, l, pc) => Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))

// ── Simplified Signal Calculator (Server-side) ──
function calculateSignal(candles, fundingRate = null) {
  if (!candles || candles.length < 60) return null

  const closes = candles.map(c => c.c)
  const last = candles[candles.length - 1]
  const close = last.c

  let bullScore = 0, bearScore = 0
  const indicators = {}

  // 1. EMA Trend
  const e8 = ema(closes, 8)
  const e21 = ema(closes, 21)
  const e50 = ema(closes, 50)
  const e200 = ema(closes, 200)

  if (e8 && e21 && e50) {
    if (e8 > e21 && e21 > e50) { bullScore += 15; indicators.emaTrend = 'BULL' }
    else if (e8 < e21 && e21 < e50) { bearScore += 15; indicators.emaTrend = 'BEAR' }
  }
  if (e200) {
    if (close > e200) { bullScore += 10; indicators.ema200 = 'BULL' }
    else { bearScore += 10; indicators.ema200 = 'BEAR' }
  }

  // 2. RSI
  const ch = []
  for (let i = closes.length - 14; i < closes.length; i++) {
    ch.push(closes[i] - closes[i - 1])
  }
  const gains = ch.filter(c => c > 0).reduce((a, b) => a + b, 0) / 14
  const losses = ch.filter(c => c < 0).reduce((a, b) => a - b, 0) / 14
  const rsi = losses === 0 ? 100 : 100 - 100 / (1 + gains / losses)
  if (rsi < 35) { bullScore += 10; indicators.rsi = 'OVERSOLD' }
  else if (rsi > 65) { bearScore += 10; indicators.rsi = 'OVERBOUGHT' }
  else if (rsi > 50) { bullScore += 3 }
  else { bearScore += 3 }

  // 3. MACD
  const e12 = ema(closes, 12)
  const e26 = ema(closes, 26)
  if (e12 && e26) {
    if (e12 > e26) { bullScore += 8; indicators.macd = 'BULL' }
    else { bearScore += 8; indicators.macd = 'BEAR' }
  }

  // 4. Bollinger Bands
  const sma20 = sma(closes, 20)
  if (sma20) {
    const sl = closes.slice(-20)
    const variance = sl.reduce((a, b) => a + (b - sma20) ** 2, 0) / 20
    const std = Math.sqrt(variance)
    const upper = sma20 + 2 * std
    const lower = sma20 - 2 * std
    const pct = (close - lower) / (upper - lower)
    if (pct < 0.2) { bullScore += 8; indicators.bb = 'LOWER' }
    else if (pct > 0.8) { bearScore += 8; indicators.bb = 'UPPER' }
  }

  // 5. ADX
  let plusDM = 0, minusDM = 0, tr = 0
  for (let i = candles.length - 14; i < candles.length; i++) {
    const upMove = candles[i].h - candles[i - 1].h
    const downMove = candles[i - 1].l - candles[i].l
    if (upMove > downMove && upMove > 0) plusDM += upMove
    if (downMove > upMove && downMove > 0) minusDM += downMove
    tr += trueRange(candles[i].h, candles[i].l, candles[i - 1].c)
  }
  if (tr > 0) {
    const plusDI = (plusDM / tr) * 100
    const minusDI = (minusDM / tr) * 100
    const sum = plusDI + minusDI
    const adx = sum > 0 ? (Math.abs(plusDI - minusDI) / sum) * 100 : 0
    if (adx < 18) return null  // Weak trend filter
    if (adx > 25) {
      if (plusDI > minusDI) { bullScore += 12 }
      else { bearScore += 12 }
    }
    indicators.adx = adx.toFixed(1)
  }

  // 6. Volume
  const recentVol = sma(candles.slice(-5).map(c => c.v), 5)
  const avgVol = sma(candles.slice(-20).map(c => c.v), 20)
  if (recentVol && avgVol && recentVol > avgVol * 1.3) {
    if (close > closes[closes.length - 2]) { bullScore += 8 }
    else { bearScore += 8 }
  }

  // 7. SuperTrend simplified
  const atrVals = []
  for (let i = 1; i < candles.length; i++) {
    atrVals.push(trueRange(candles[i].h, candles[i].l, candles[i - 1].c))
  }
  const atrSMA = sma(atrVals, 10)
  if (atrSMA) {
    const hl2 = (last.h + last.l) / 2
    const stUp = hl2 + 3 * atrSMA
    const stDn = hl2 - 3 * atrSMA
    if (close > stDn) { bullScore += 12; indicators.superTrend = 'BULL' }
    else if (close < stUp) { bearScore += 12; indicators.superTrend = 'BEAR' }
  }

  // 8. Stochastic
  const sl14 = candles.slice(-14)
  const hh = Math.max(...sl14.map(c => c.h))
  const ll = Math.min(...sl14.map(c => c.l))
  if (hh !== ll) {
    const k = ((close - ll) / (hh - ll)) * 100
    if (k < 20) { bullScore += 6 }
    else if (k > 80) { bearScore += 6 }
  }

  // 9. Funding Rate (Futures)
  if (fundingRate !== null) {
    if (fundingRate > 0.01) { bearScore += 5; indicators.funding = 'HIGH_LONG' }
    else if (fundingRate < -0.01) { bullScore += 5; indicators.funding = 'HIGH_SHORT' }
  }

  // 10. Candle Patterns
  if (candles.length >= 3) {
    const c0 = candles[candles.length - 1]
    const c1 = candles[candles.length - 2]
    const body0 = Math.abs(c0.c - c0.o)
    const body1 = Math.abs(c1.c - c1.o)
    // Bullish Engulfing
    if (c0.c > c0.o && c1.c < c1.o && c0.o <= c1.c && c0.c >= c1.o && body0 > body1) {
      bullScore += 10; indicators.pattern = 'Bullish Engulfing'
    }
    // Bearish Engulfing
    if (c0.c < c0.o && c1.c > c1.o && c0.o >= c1.c && c0.c <= c1.o && body0 > body1) {
      bearScore += 10; indicators.pattern = 'Bearish Engulfing'
    }
  }

  // ── Final Decision ──
  const total = bullScore + bearScore
  if (total === 0) return null

  const bullPct = (bullScore / total) * 100
  const bearPct = (bearScore / total) * 100

  let direction = null, strength = null
  if (bullPct >= 80) { direction = 'LONG'; strength = 'ULTRA' }
  else if (bullPct >= 70) { direction = 'LONG'; strength = 'STRONG' }
  else if (bullPct >= 62) { direction = 'LONG'; strength = 'NORMAL' }
  else if (bearPct >= 80) { direction = 'SHORT'; strength = 'ULTRA' }
  else if (bearPct >= 70) { direction = 'SHORT'; strength = 'STRONG' }
  else if (bearPct >= 62) { direction = 'SHORT'; strength = 'NORMAL' }

  if (!direction) return null

  const confidence = Math.round(direction === 'LONG' ? bullPct : bearPct)

  // ── Calculate TP/SL ──
  const r = candles.slice(-50)
  const recentHigh = Math.max(...r.map(c => c.h))
  const recentLow = Math.min(...r.map(c => c.l))
  const atr = atrSMA || close * 0.01

  let entry, tp1, tp2, tp3, sl

  if (direction === 'LONG') {
    entry = close
    sl = Math.max(close - atr * 1.5, recentLow * 0.998)
    const risk = entry - sl
    tp1 = entry + risk * 1.5
    tp2 = entry + risk * 2.5
    tp3 = Math.min(entry + risk * 4, recentHigh * 1.005)
  } else {
    entry = close
    sl = Math.min(close + atr * 1.5, recentHigh * 1.002)
    const risk = sl - entry
    tp1 = entry - risk * 1.5
    tp2 = entry - risk * 2.5
    tp3 = Math.max(entry - risk * 4, recentLow * 0.995)
  }

  const risk = Math.abs(entry - sl)
  const reward = Math.abs(tp3 - entry)
  const rr = risk > 0 ? (reward / risk).toFixed(1) : '0'

  return {
    direction,
    strength,
    confidence,
    indicators,
    tp: {
      entry: +entry.toFixed(6),
      tp1: +tp1.toFixed(6),
      tp2: +tp2.toFixed(6),
      tp3: +tp3.toFixed(6),
      sl: +sl.toFixed(6),
      rr,
      riskPct: ((risk / entry) * 100).toFixed(2),
      tp1Pct: ((Math.abs(tp1 - entry) / entry) * 100).toFixed(2),
      tp2Pct: ((Math.abs(tp2 - entry) / entry) * 100).toFixed(2),
      tp3Pct: ((Math.abs(tp3 - entry) / entry) * 100).toFixed(2),
    },
    bullScore,
    bearScore,
  }
}

// ══════════════════════════════════════════
//   FETCH KLINES & RUN SIGNAL
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
      o: parseFloat(k[1]), h: parseFloat(k[2]), l: parseFloat(k[3]),
      c: parseFloat(k[4]), v: parseFloat(k[5]),
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
//   SIGNAL SCANNER (Main Engine)
// ══════════════════════════════════════════

async function scanCoin(symbol, market) {
  try {
    // Check if signal already active for this coin
    const activeKey = `${market}_${symbol}`
    const lastSignal = globalSignalCache.get(activeKey)

    if (lastSignal && lastSignal.status === 'ACTIVE') {
      return // Skip if already active
    }

    // Check cooldown after close
    if (lastSignal && lastSignal.closedAt) {
      const elapsed = Date.now() - lastSignal.closedAt
      if (elapsed < SIGNAL_COOLDOWN) return
    }

    // Check max active signals (10 per market)
    const activeCount = Array.from(globalSignalCache.values())
      .filter(s => s.market === market && s.status === 'ACTIVE').length

    if (activeCount >= 10) return

    // Fetch data
    const interval = market === 'futures' ? '15m' : '1h'
    const candles = await fetchKlines(symbol, interval, 100, market)
    if (!candles || candles.length < 60) return

    const fundingRate = market === 'futures' ? await fetchFundingRate(symbol) : null

    // Calculate signal
    const signal = calculateSignal(candles, fundingRate)
    if (!signal) return

    // Only publish STRONG or ULTRA signals
    if (signal.strength === 'NORMAL' && signal.confidence < 68) return

    // Create signal document
    const signalId = `${market}_${symbol}_${Date.now()}`
    const signalData = {
      id: signalId,
      coin: symbol,
      market,
      direction: signal.direction,
      strength: signal.strength,
      confidence: signal.confidence,
      tp: signal.tp,
      indicators: signal.indicators,
      status: 'ACTIVE',
      result: null,
      callVotes: signal.bullScore,
      putVotes: signal.bearScore,
      createdAt: FieldValue.serverTimestamp(),
      createdMs: Date.now(),
    }

    // Save to Firestore
    await db.collection(SIGNALS_COL).doc(signalId).set(signalData)

    // Cache locally
    globalSignalCache.set(activeKey, {
      ...signalData,
      createdAt: Date.now(),
    })

    console.log(`✅ NEW SIGNAL: ${symbol} ${signal.direction} ${signal.strength} (${signal.confidence}%) - ${market}`)

  } catch (e) {
    console.error(`Scan error ${symbol}:`, e.message)
  }
}

// ══════════════════════════════════════════
//   PRICE TRACKER (TP/SL Hit Detection)
// ══════════════════════════════════════════

async function trackActiveSignals() {
  try {
    const snap = await db.collection(SIGNALS_COL)
      .where('status', 'in', ['ACTIVE', 'TP1_HIT', 'TP2_HIT'])
      .get()

    for (const doc of snap.docs) {
      const sig = doc.data()
      const market = sig.market

      // Get current price
      const ticker = await fetch(
        market === 'futures'
          ? `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${sig.coin}`
          : `https://api.binance.com/api/v3/ticker/price?symbol=${sig.coin}`
      ).then(r => r.json()).catch(() => null)

      if (!ticker || !ticker.price) continue
      const currentPrice = parseFloat(ticker.price)
      const tp = sig.tp
      const isLong = sig.direction === 'LONG'

      // Check TP/SL hits
      let newStatus = sig.status
      let result = null

      if (isLong) {
        if (currentPrice <= tp.sl) {
          newStatus = 'CLOSED'
          result = 'SL_HIT'
        } else if (currentPrice >= tp.tp3) {
          newStatus = 'CLOSED'
          result = 'TP3_HIT'
        } else if (currentPrice >= tp.tp2 && sig.status !== 'TP2_HIT') {
          newStatus = 'TP2_HIT'
        } else if (currentPrice >= tp.tp1 && sig.status === 'ACTIVE') {
          newStatus = 'TP1_HIT'
        }
      } else {
        if (currentPrice >= tp.sl) {
          newStatus = 'CLOSED'
          result = 'SL_HIT'
        } else if (currentPrice <= tp.tp3) {
          newStatus = 'CLOSED'
          result = 'TP3_HIT'
        } else if (currentPrice <= tp.tp2 && sig.status !== 'TP2_HIT') {
          newStatus = 'TP2_HIT'
        } else if (currentPrice <= tp.tp1 && sig.status === 'ACTIVE') {
          newStatus = 'TP1_HIT'
        }
      }

      // Check timeout (24h)
      if (!result && sig.createdMs && Date.now() - sig.createdMs > 24 * 60 * 60 * 1000) {
        newStatus = 'CLOSED'
        result = 'TIMEOUT'
      }

      // Update if changed
      if (newStatus !== sig.status) {
        const updates = { status: newStatus }
        if (result) {
          updates.result = result
          updates.closedAt = FieldValue.serverTimestamp()
          updates.closedMs = Date.now()
          updates.closedPrice = currentPrice

          // If TP1 hit, allow new signal for this coin
          if (result || newStatus === 'TP1_HIT') {
            const activeKey = `${sig.market}_${sig.coin}`
            const cached = globalSignalCache.get(activeKey)
            if (cached) {
              cached.status = newStatus
              if (result) cached.closedAt = Date.now()
              globalSignalCache.set(activeKey, cached)
            }
          }
        } else if (newStatus === 'TP1_HIT') {
          // TP1 hit - clear cache so new signal can be generated
          const activeKey = `${sig.market}_${sig.coin}`
          globalSignalCache.delete(activeKey)
        }

        await db.collection(SIGNALS_COL).doc(doc.id).update(updates)
        console.log(`📊 ${sig.coin} ${sig.direction} → ${newStatus}${result ? ` (${result})` : ''}`)
      }
    }
  } catch (e) {
    console.error('Track error:', e.message)
  }
}

// ══════════════════════════════════════════
//   MAIN SCANNER LOOP
// ══════════════════════════════════════════

let scanIndex = 0
async function scannerLoop() {
  try {
    // Scan in rotating batches to avoid rate limits
    const batchSize = 5

    // Scan Futures batch
    const futuresBatch = TOP_FUTURES.slice(scanIndex, scanIndex + batchSize)
    await Promise.all(futuresBatch.map(coin => scanCoin(coin, 'futures')))

    // Scan Spot batch
    const spotBatch = TOP_SPOT.slice(scanIndex, scanIndex + batchSize)
    await Promise.all(spotBatch.map(coin => scanCoin(coin, 'spot')))

    scanIndex += batchSize
    if (scanIndex >= 50) scanIndex = 0

  } catch (e) {
    console.error('Scanner error:', e.message)
  }
}

// ══════════════════════════════════════════
//   SELF-PING (Sleep Prevention)
// ══════════════════════════════════════════

async function selfPing() {
  try {
    if (BASE_URL && BASE_URL.includes('http')) {
      await fetch(`${BASE_URL}/health`).catch(() => {})
    }
  } catch (_) {}
}

// ══════════════════════════════════════════
//   CLEANUP OLD SIGNALS
// ══════════════════════════════════════════

async function cleanupOldSignals() {
  try {
    // Keep only last 100 closed signals per market
    for (const market of ['spot', 'futures']) {
      const snap = await db.collection(SIGNALS_COL)
        .where('market', '==', market)
        .where('status', '==', 'CLOSED')
        .orderBy('closedAt', 'desc')
        .get()

      if (snap.size > 100) {
        const toDelete = snap.docs.slice(100)
        for (const doc of toDelete) {
          await doc.ref.delete()
        }
        console.log(`🧹 Cleaned ${toDelete.length} old ${market} signals`)
      }
    }
  } catch (e) {
    console.error('Cleanup error:', e.message)
  }
}

// ══════════════════════════════════════════
//   SERVER START
// ══════════════════════════════════════════

const PORT = process.env.PORT || 5000

app.listen(PORT, async () => {
  console.log(`✅ Crypto Master Server running on port ${PORT}`)
  console.log(`🚀 Base URL: ${BASE_URL}`)

  // Register Telegram webhook
  if (process.env.NODE_ENV === 'production' && BOT_TOKEN) {
    const r = await tgAPI('setWebhook', { url: `${BASE_URL}/webhook/${WH_SECRET}` })
    console.log('📡 Webhook:', r?.description || 'set')
  }

  // Load existing active signals to cache
  try {
    const snap = await db.collection(SIGNALS_COL)
      .where('status', 'in', ['ACTIVE', 'TP1_HIT', 'TP2_HIT'])
      .get()
    snap.forEach(d => {
      const data = d.data()
      const key = `${data.market}_${data.coin}`
      globalSignalCache.set(key, data)
    })
    console.log(`📦 Loaded ${snap.size} active signals to cache`)
  } catch (e) {
    console.error('Cache load error:', e.message)
  }

  // ── Start Scanner Loop (every 30 sec) ──
  setInterval(scannerLoop, 30000)
  setTimeout(scannerLoop, 5000)  // Initial run after 5s

  // ── Price Tracker (every 15 sec) ──
  setInterval(trackActiveSignals, 15000)
  setTimeout(trackActiveSignals, 10000)

  // ── Self-Ping (every 10 min) ──
  setInterval(selfPing, 10 * 60 * 1000)
  setTimeout(selfPing, 60000)

  // ── Cleanup (every 1 hour) ──
  setInterval(cleanupOldSignals, 60 * 60 * 1000)
  setTimeout(cleanupOldSignals, 30 * 60 * 1000)

  console.log('🔥 All systems running:')
  console.log('   ⚡ Signal scanner: every 30s')
  console.log('   📊 Price tracker: every 15s')
  console.log('   💓 Self-ping: every 10 min')
  console.log('   🧹 Cleanup: every 1 hour')
  console.log('   🤲 আল্লাহর রহমতে চলবে ইনশাআল্লাহ')
})

// ── Error Handlers ──
process.on('uncaughtException', (e) => console.error('Uncaught:', e))
process.on('unhandledRejection', (e) => console.error('Unhandled:', e))
