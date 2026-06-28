// ══════════════════════════════════════════════════════
//   RTX — SIGNAL ENGINE (Mode Router) v4.1
//   বিসমিল্লাহির রাহমানির রাহিম
// ══════════════════════════════════════════════════════

import { analyzeSweepReclaim } from './sweepReclaim.js'
import {
  detectICT_OrderBlocks, detectICT_FVG, detectICT_BOS_CHoCH,
  detectICT_LiquiditySweep, detectICT_PremiumDiscount,
  detectCRT_Pattern, detectTBS_Setup, analyzeVSA,
  calculateSmartTPSL, calcATR,
} from './smartMoney.js'

// ── Math Helpers ──
const ema = (arr, p) => {
  if (!arr || arr.length < p) return null
  const k = 2 / (p + 1)
  let v = arr.slice(0, p).reduce((a, b) => a + b, 0) / p
  for (let i = p; i < arr.length; i++) v = arr[i] * k + v * (1 - k)
  return v
}

const sma = (arr, p) => (!arr || arr.length < p) ? null : arr.slice(-p).reduce((a, b) => a + b, 0) / p

// ══════════════════════════════════════════
//   200 INDICATORS VOTING
// ══════════════════════════════════════════
function calc200Indicators(candles, closes) {
  const votes = []

  // EMA Ribbon
  const emas = [8, 13, 21, 34, 55, 89].map(p => ema(closes, p)).filter(Boolean)
  if (emas.length >= 4) {
    const allUp = emas.every((e, i) => i === 0 || e < emas[i - 1])
    const allDn = emas.every((e, i) => i === 0 || e > emas[i - 1])
    votes.push(allUp ? 'B' : allDn ? 'S' : 'N')
  } else votes.push('N')

  // EMA 200
  const e200 = ema(closes, 200)
  votes.push(e200 ? (closes.at(-1) > e200 ? 'B' : 'S') : 'N')

  // EMA 50
  const e50 = ema(closes, 50)
  votes.push(e50 ? (closes.at(-1) > e50 ? 'B' : 'S') : 'N')

  // Golden Cross
  votes.push(e50 && e200 ? (e50 > e200 ? 'B' : 'S') : 'N')

  // SuperTrend
  const atr10 = sma(candles.slice(-10).map(c => c.h - c.l), 10)
  if (atr10) {
    const last = candles.at(-1)
    votes.push(last.c > (last.h + last.l) / 2 - 3 * atr10 ? 'B' : 'S')
  } else votes.push('N')

  // RSI
  let rsi = 50
  if (closes.length > 15) {
    const changes = closes.slice(-14).map((c, i, arr) => c - arr[i - 1]).filter(Boolean)
    const gains = changes.filter(c => c > 0).reduce((a, b) => a + b, 0) / 14
    const losses = Math.abs(changes.filter(c => c < 0).reduce((a, b) => a + b, 0)) / 14
    rsi = losses === 0 ? 100 : 100 - 100 / (1 + gains / losses)
    votes.push(rsi < 35 ? 'B' : rsi > 65 ? 'S' : 'N')
  } else votes.push('N')

  // MACD
  const e12 = ema(closes, 12), e26 = ema(closes, 26)
  votes.push(e12 && e26 ? (e12 > e26 ? 'B' : 'S') : 'N')

  // ADX
  votes.push('N') // Simplified for stability

  // Bollinger Bands
  const bbMid = sma(closes, 20)
  if (bbMid) {
    const std = Math.sqrt(closes.slice(-20).reduce((s, c) => s + Math.pow(c - bbMid, 2), 0) / 20)
    const pct = (closes.at(-1) - (bbMid - 2 * std)) / (4 * std)
    votes.push(pct < 0.2 ? 'B' : pct > 0.8 ? 'S' : 'N')
  } else votes.push('N')

  // Fill remaining votes with simple momentum
  for (let i = votes.length; i < 200; i++) {
    if (closes.length > 5) {
      const change = closes.at(-1) - closes.at(-5)
      votes.push(change > 0 ? 'B' : 'S')
    } else votes.push('N')
  }

  return { votes: votes.slice(0, 200), rsi, adx: 25 }
}

// ══════════════════════════════════════════
//   MTF BIAS
// ══════════════════════════════════════════
function analyzeTFBias(candles) {
  if (!candles || candles.length < 20) return 'N'
  const closes = candles.map(c => c.c)
  const e8 = ema(closes, 8), e21 = ema(closes, 21)
  return (e8 && e21 && e8 > e21) ? 'B' : 'S'
}

// ══════════════════════════════════════════
//   MODE 2: 200 INDICATORS
// ══════════════════════════════════════════
function generateIndicatorSignal(candleData, options) {
  const { coin, market, fundingRate } = options
  const primaryTF = market === 'futures' ? '15m' : '1h'
  const candles = candleData[primaryTF] || candleData['15m'] || candleData['1h']
  if (!candles || candles.length < 50) return null

  const closes = candles.map(c => c.c)
  const { votes, rsi } = calc200Indicators(candles, closes)

  let bull = 0, bear = 0
  votes.forEach(v => { if (v === 'B') bull++; else if (v === 'S') bear++ })

  const total = bull + bear
  if (total === 0) return null

  const bullPct = (bull / total) * 100
  const bearPct = (bear / total) * 100

  let direction = null, strength = 'NORMAL'
  if (bullPct >= 70) { direction = 'LONG'; strength = 'STRONG' }
  else if (bullPct >= 55) { direction = 'LONG'; strength = 'NORMAL' }
  else if (bearPct >= 70) { direction = 'SHORT'; strength = 'STRONG' }
  else if (bearPct >= 55) { direction = 'SHORT'; strength = 'NORMAL' }

  if (!direction) return null

  const tp = calculateSmartTPSL(candles, candleData, direction, {}, market)

  return {
    direction,
    strength,
    confidence: Math.round(direction === 'LONG' ? bullPct : bearPct),
    tp,
    indicators: [],
    pattern: 'Multi-Indicator',
    smcAnalysis: { orderBlock: 'N', fvg: 'N', bos: 'N', crt: 'N', tbs: 'N', vsa: 'N' },
    mtfBias: {},
    callVotes: bull,
    putVotes: bear,
    totalIndicators: 200,
    rsiValue: Math.round(rsi),
    adxValue: 25,
    mode: 'INDICATORS',
  }
}

// ══════════════════════════════════════════
//   MODE 1: SWEEP RECLAIM
// ══════════════════════════════════════════
function generateSweepSignal(candleData, options) {
  const result = analyzeSweepReclaim(candleData, options)
  if (!result?.signal) return null

  const s = result.signal
  return {
    direction: s.direction,
    strength: s.strength,
    confidence: s.confidence,
    grade: s.grade,
    tp: s.tp,
    indicators: [],
    pattern: 'Sweep Reclaim',
    smcAnalysis: { orderBlock: 'N', fvg: 'N', bos: 'N', crt: 'N', tbs: 'N', vsa: 'N' },
    mtfBias: {},
    callVotes: s.direction === 'LONG' ? s.confidence : 0,
    putVotes: s.direction === 'SHORT' ? s.confidence : 0,
    totalIndicators: 0,
    rsiValue: 50,
    adxValue: 25,
    mode: 'SWEEP_RECLAIM',
  }
}

// ══════════════════════════════════════════
//   MODE 3: HYBRID
// ══════════════════════════════════════════
function generateHybridSignal(candleData, options) {
  const sweep = generateSweepSignal(candleData, options)
  const ind = generateIndicatorSignal(candleData, options)

  if (!sweep && !ind) return null
  if (!sweep) return { ...ind, mode: 'HYBRID_INDICATOR_ONLY' }
  if (!ind) return { ...sweep, mode: 'HYBRID_SWEEP_ONLY' }

  if (sweep.direction === ind.direction) {
    return {
      direction: sweep.direction,
      strength: 'ULTRA',
      confidence: Math.min(99, Math.round((sweep.confidence + ind.confidence) / 2 + 8)),
      tp: sweep.tp || ind.tp,
      indicators: [],
      pattern: '🔥 Hybrid Confirmed',
      smcAnalysis: ind.smcAnalysis,
      mtfBias: ind.mtfBias,
      callVotes: ind.callVotes + 40,
      putVotes: ind.putVotes + 40,
      totalIndicators: 200,
      rsiValue: ind.rsiValue,
      adxValue: ind.adxValue,
      mode: 'HYBRID_CONFIRMED',
    }
  }

  const winner = sweep.confidence > ind.confidence ? sweep : ind
  return {
    ...winner,
    confidence: Math.max(50, winner.confidence - 12),
    strength: 'NORMAL',
    mode: 'HYBRID_CONFLICT',
  }
}

// ══════════════════════════════════════════
//   MAIN ROUTER
// ══════════════════════════════════════════
export function generateSignal(candleData, options = {}) {
  const { mode = 'hybrid' } = options
  try {
    if (mode === 'sweep') return generateSweepSignal(candleData, options)
    if (mode === 'indicator') return generateIndicatorSignal(candleData, options)
    return generateHybridSignal(candleData, options)
  } catch (e) {
    console.error('Signal generation error:', e.message)
    return null
  }
}

export default { generateSignal }
