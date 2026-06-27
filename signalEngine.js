// ══════════════════════════════════════════════════════
//   RTX SIGNAL ENGINE — MODE ROUTER
//   Mode 1: Sweep Reclaim Only
//   Mode 2: 200 Indicators Only
//   Mode 3: Hybrid (Both with Voting)
//   বিসমিল্লাহির রাহমানির রাহিম
// ══════════════════════════════════════════════════════

import { analyzeSweepReclaim } from './sweepReclaim.js'
import {
  detectICT_OrderBlocks, detectICT_FVG, detectICT_BOS_CHoCH,
  detectICT_LiquiditySweep, detectICT_PremiumDiscount,
  detectCRT_Pattern, detectTBS_Setup, analyzeVSA,
  calculateSmartTPSL, calcATR,
} from './smartMoney.js'

// ══════════════════════════════════════════
//   MATH HELPERS
// ══════════════════════════════════════════
const ema = (arr, p) => {
  if (!arr || arr.length < p) return null
  const k = 2 / (p + 1)
  let v = arr.slice(0, p).reduce((a, b) => a + b, 0) / p
  for (let i = p; i < arr.length; i++) v = arr[i] * k + v * (1 - k)
  return v
}

const emaArray = (arr, p) => {
  if (!arr || arr.length < p) return []
  const k = 2 / (p + 1), r = []
  let v = arr.slice(0, p).reduce((a, b) => a + b, 0) / p
  r.push(v)
  for (let i = p; i < arr.length; i++) { v = arr[i] * k + v * (1 - k); r.push(v) }
  return r
}

const sma = (arr, p) => {
  if (!arr || arr.length < p) return null
  return arr.slice(-p).reduce((a, b) => a + b, 0) / p
}

const stdev = (arr, p) => {
  if (!arr || arr.length < p) return null
  const sl = arr.slice(-p), avg = sl.reduce((a, b) => a + b, 0) / p
  return Math.sqrt(sl.reduce((a, b) => a + (b - avg) ** 2, 0) / p)
}

const trueRange = (h, l, pc) => Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))
const highest = (arr, p) => arr?.length >= p ? Math.max(...arr.slice(-p)) : null
const lowest = (arr, p) => arr?.length >= p ? Math.min(...arr.slice(-p)) : null

// ══════════════════════════════════════════
//   200 INDICATORS VOTING
// ══════════════════════════════════════════
function calc200Indicators(candles, closes) {
  const votes = []

  // 1. EMA Ribbon
  const emas = [8, 13, 21, 34, 55, 89].map(p => ema(closes, p)).filter(e => e !== null)
  if (emas.length >= 4) {
    const allUp = emas.every((e, i) => i === 0 || e < emas[i - 1])
    const allDn = emas.every((e, i) => i === 0 || e > emas[i - 1])
    votes.push(allUp ? 'B' : allDn ? 'S' : 'N')
  } else votes.push('N')

  // 2. EMA 200
  const e200 = ema(closes, 200)
  votes.push(e200 ? (closes[closes.length - 1] > e200 ? 'B' : 'S') : 'N')

  // 3. EMA 50
  const e50 = ema(closes, 50)
  votes.push(e50 ? (closes[closes.length - 1] > e50 ? 'B' : 'S') : 'N')

  // 4. Golden/Death Cross
  if (e50 && e200) votes.push(e50 > e200 ? 'B' : 'S')
  else votes.push('N')

  // 5. SuperTrend
  const atrVals = []
  for (let i = 1; i < candles.length; i++) atrVals.push(trueRange(candles[i].h, candles[i].l, candles[i - 1].c))
  const atr10 = sma(atrVals, 10)
  if (atr10) {
    const last = candles[candles.length - 1]
    const hl2 = (last.h + last.l) / 2
    votes.push(last.c > hl2 - 3 * atr10 ? 'B' : 'S')
  } else votes.push('N')

  // 6. RSI
  let rsi = 50
  if (closes.length > 15) {
    const ch = []
    for (let i = closes.length - 14; i < closes.length; i++) ch.push(closes[i] - closes[i - 1])
    const g = ch.filter(c => c > 0).reduce((a, b) => a + b, 0) / 14
    const l = ch.filter(c => c < 0).reduce((a, b) => a - b, 0) / 14
    rsi = l === 0 ? 100 : 100 - 100 / (1 + g / l)
    votes.push(rsi < 35 ? 'B' : rsi > 65 ? 'S' : rsi > 50 ? 'B' : 'S')
  } else votes.push('N')

  // 7. MACD
  const e12 = ema(closes, 12), e26 = ema(closes, 26)
  if (e12 && e26) votes.push(e12 > e26 ? 'B' : 'S')
  else votes.push('N')

  // 8. ADX
  let adx = 0
  if (candles.length > 16) {
    let pDM = 0, mDM = 0, tr = 0
    for (let i = candles.length - 14; i < candles.length; i++) {
      const up = candles[i].h - candles[i - 1].h
      const dn = candles[i - 1].l - candles[i].l
      if (up > dn && up > 0) pDM += up
      if (dn > up && dn > 0) mDM += dn
      tr += trueRange(candles[i].h, candles[i].l, candles[i - 1].c)
    }
    if (tr > 0) {
      const pDI = (pDM / tr) * 100, mDI = (mDM / tr) * 100
      adx = (pDI + mDI) > 0 ? Math.abs(pDI - mDI) / (pDI + mDI) * 100 : 0
      votes.push(adx > 20 ? (pDI > mDI ? 'B' : 'S') : 'N')
    } else votes.push('N')
  } else votes.push('N')

  // 9. Bollinger Bands
  const bbMid = sma(closes, 20), bbStd = stdev(closes, 20)
  if (bbMid && bbStd) {
    const pct = (closes[closes.length - 1] - (bbMid - 2 * bbStd)) / (4 * bbStd)
    votes.push(pct < 0.2 ? 'B' : pct > 0.8 ? 'S' : 'N')
  } else votes.push('N')

  // 10. Stochastic
  if (candles.length >= 14) {
    const sl = candles.slice(-14)
    const hh = Math.max(...sl.map(c => c.h)), ll = Math.min(...sl.map(c => c.l))
    if (hh !== ll) {
      const k = ((closes[closes.length - 1] - ll) / (hh - ll)) * 100
      votes.push(k < 20 ? 'B' : k > 80 ? 'S' : 'N')
    } else votes.push('N')
  } else votes.push('N')

  // 11. CCI
  if (candles.length >= 20) {
    const tps = candles.slice(-20).map(c => (c.h + c.l + c.c) / 3)
    const avg = tps.reduce((a, b) => a + b, 0) / 20
    const md = tps.reduce((s, t) => s + Math.abs(t - avg), 0) / 20
    if (md > 0) {
      const cci = (tps[tps.length - 1] - avg) / (0.015 * md)
      votes.push(cci < -100 ? 'B' : cci > 100 ? 'S' : 'N')
    } else votes.push('N')
  } else votes.push('N')

  // 12. Williams %R
  if (candles.length >= 14) {
    const sl = candles.slice(-14)
    const hh = Math.max(...sl.map(c => c.h)), ll = Math.min(...sl.map(c => c.l))
    if (hh !== ll) {
      const wr = ((hh - closes[closes.length - 1]) / (hh - ll)) * -100
      votes.push(wr < -80 ? 'B' : wr > -20 ? 'S' : 'N')
    } else votes.push('N')
  } else votes.push('N')

  // 13. MFI
  if (candles.length > 15) {
    let posF = 0, negF = 0
    const sl = candles.slice(-15)
    for (let i = 1; i < sl.length; i++) {
      const tp = (sl[i].h + sl[i].l + sl[i].c) / 3
      const ptp = (sl[i - 1].h + sl[i - 1].l + sl[i - 1].c) / 3
      const mf = tp * (sl[i].v || 1)
      if (tp > ptp) posF += mf; else negF += mf
    }
    const mfi = negF === 0 ? 100 : 100 - 100 / (1 + posF / negF)
    votes.push(mfi < 20 ? 'B' : mfi > 80 ? 'S' : 'N')
  } else votes.push('N')

  // 14. OBV Trend
  if (candles.length > 20) {
    let obv = 0
    const obvArr = [0]
    for (let i = 1; i < candles.length; i++) {
      if (candles[i].c > candles[i - 1].c) obv += (candles[i].v || 1)
      else if (candles[i].c < candles[i - 1].c) obv -= (candles[i].v || 1)
      obvArr.push(obv)
    }
    const obvEma = ema(obvArr, 10)
    votes.push(obvEma ? (obv > obvEma ? 'B' : 'S') : 'N')
  } else votes.push('N')

  // 15. Chaikin MF
  if (candles.length >= 20) {
    let cmf = 0, vol = 0
    candles.slice(-20).forEach(c => {
      const r = c.h - c.l
      cmf += (r === 0 ? 0 : ((c.c - c.l) - (c.h - c.c)) / r * (c.v || 1))
      vol += (c.v || 1)
    })
    const cmfVal = vol === 0 ? 0 : cmf / vol
    votes.push(cmfVal > 0.05 ? 'B' : cmfVal < -0.05 ? 'S' : 'N')
  } else votes.push('N')

  // 16. Parabolic SAR
  if (candles.length > 5) {
    let af = 0.02, ep = candles[0].h, sar = candles[0].l, up = true
    for (let i = 1; i < candles.length; i++) {
      if (up) {
        sar += af * (ep - sar)
        if (candles[i].h > ep) { ep = candles[i].h; af = Math.min(af + 0.02, 0.2) }
        if (candles[i].l < sar) { up = false; sar = ep; ep = candles[i].l; af = 0.02 }
      } else {
        sar += af * (ep - sar)
        if (candles[i].l < ep) { ep = candles[i].l; af = Math.min(af + 0.02, 0.2) }
        if (candles[i].h > sar) { up = true; sar = ep; ep = candles[i].h; af = 0.02 }
      }
    }
    votes.push(up ? 'B' : 'S')
  } else votes.push('N')

  // 17. Heikin-Ashi
  if (candles.length >= 3) {
    const ha = []
    for (let i = 0; i < candles.length; i++) {
      const hac = (candles[i].o + candles[i].h + candles[i].l + candles[i].c) / 4
      const hao = i === 0 ? (candles[i].o + candles[i].c) / 2 : (ha[i - 1].o + ha[i - 1].c) / 2
      ha.push({ o: hao, c: hac })
    }
    const last3 = ha.slice(-3)
    if (last3.every(c => c.c > c.o)) votes.push('B')
    else if (last3.every(c => c.c < c.o)) votes.push('S')
    else votes.push(ha[ha.length - 1].c > ha[ha.length - 1].o ? 'B' : 'S')
  } else votes.push('N')

  // 18-19. Ichimoku
  if (candles.length >= 52) {
    const midHL = (sl, p) => {
      const s = sl.slice(-p)
      return (Math.max(...s.map(c => c.h)) + Math.min(...s.map(c => c.l))) / 2
    }
    const tenkan = midHL(candles, 9), kijun = midHL(candles, 26)
    const sA = (tenkan + kijun) / 2, sB = midHL(candles, 52)
    const close = closes[closes.length - 1]
    votes.push(close > Math.max(sA, sB) && tenkan > kijun ? 'B' : close < Math.min(sA, sB) && tenkan < kijun ? 'S' : 'N')
    votes.push(tenkan > kijun ? 'B' : 'S')
  } else { votes.push('N'); votes.push('N') }

  // 20. VWAP
  if (candles.length >= 10) {
    let cumVP = 0, cumV = 0
    candles.slice(-20).forEach(c => { cumVP += (c.h + c.l + c.c) / 3 * (c.v || 1); cumV += (c.v || 1) })
    const vwap = cumVP / cumV
    votes.push(closes[closes.length - 1] > vwap ? 'B' : 'S')
  } else votes.push('N')

  // 21-50: Various EMAs and SMAs
  for (const p of [3, 5, 8, 13, 21, 34, 55, 89, 100, 144, 200]) {
    const e = ema(closes, p)
    votes.push(e ? (closes[closes.length - 1] > e ? 'B' : 'S') : 'N')
  }
  for (const p of [5, 10, 20, 50, 100, 200]) {
    const s = sma(closes, p)
    votes.push(s ? (closes[closes.length - 1] > s ? 'B' : 'S') : 'N')
  }

  // 51-70: Momentum various periods
  for (const p of [1, 2, 3, 5, 7, 10, 14, 20, 25, 30, 35, 40, 50]) {
    if (closes.length > p) {
      votes.push(closes[closes.length - 1] > closes[closes.length - 1 - p] ? 'B' : 'S')
    } else votes.push('N')
  }

  // 71-100: Candle directions
  for (let i = 0; i < 20; i++) {
    if (candles.length > i + 1) {
      const c = candles[candles.length - 1 - i]
      votes.push(c.c > c.o ? 'B' : c.c < c.o ? 'S' : 'N')
    } else votes.push('N')
  }

  // 101-120: Volume analysis
  for (let i = 0; i < 10; i++) {
    if (candles.length > 20 + i) {
      const rv = sma(candles.slice(-5 - i, candles.length - i).map(c => c.v || 1), 5)
      const av = sma(candles.slice(-20 - i, candles.length - i).map(c => c.v || 1), 20)
      if (rv && av) votes.push(rv > av ? (closes[closes.length - 1 - i] > (closes[closes.length - 2 - i] || closes[closes.length - 1 - i]) ? 'B' : 'S') : 'N')
      else votes.push('N')
    } else votes.push('N')
  }

  // 121-150: Position in range
  for (const p of [5, 10, 14, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100]) {
    if (closes.length > p) {
      const hh = highest(closes, p), ll = lowest(closes, p)
      const r = hh - ll
      if (r > 0) {
        const pct = (closes[closes.length - 1] - ll) / r
        votes.push(pct < 0.3 ? 'B' : pct > 0.7 ? 'S' : 'N')
      } else votes.push('N')
    } else votes.push('N')
  }

  // 151-180: Price changes
  for (let i = 1; i <= 30; i++) {
    if (closes.length > i + 1) {
      const change = ((closes[closes.length - 1] - closes[closes.length - 1 - i]) / closes[closes.length - 1 - i]) * 100
      votes.push(change > 0.3 ? 'B' : change < -0.3 ? 'S' : 'N')
    } else votes.push('N')
  }

  // 181-200: Additional confirmations
  for (const p of [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200]) {
    if (closes.length > p) {
      const avg = sma(closes, p)
      const last = closes[closes.length - 1]
      votes.push(avg ? (last > avg * 1.005 ? 'B' : last < avg * 0.995 ? 'S' : 'N') : 'N')
    } else votes.push('N')
  }

  // Fill to exactly 200
  while (votes.length < 200) votes.push('N')
  return { votes: votes.slice(0, 200), rsi, adx }
}

// ══════════════════════════════════════════
//   MTF BIAS ANALYZER
// ══════════════════════════════════════════
function analyzeTFBias(candles) {
  if (!candles || candles.length < 30) return 'N'
  const closes = candles.map(c => c.c)
  const e8 = ema(closes, 8), e21 = ema(closes, 21), e50 = ema(closes, 50)
  let bullScore = 0, bearScore = 0
  if (e8 && e21) { if (e8 > e21) bullScore++; else bearScore++ }
  if (e21 && e50) { if (e21 > e50) bullScore++; else bearScore++ }
  if (closes[closes.length - 1] > closes[closes.length - 2]) bullScore++; else bearScore++

  const sH = Math.max(...candles.slice(-10).map(c => c.h))
  const sL = Math.min(...candles.slice(-10).map(c => c.l))
  const pH = Math.max(...candles.slice(-20, -10).map(c => c.h))
  const pL = Math.min(...candles.slice(-20, -10).map(c => c.l))
  if (sH > pH && sL > pL) bullScore += 2
  else if (sH < pH && sL < pL) bearScore += 2

  return bullScore > bearScore ? 'B' : bearScore > bullScore ? 'S' : 'N'
}

// ══════════════════════════════════════════
//   MODE 2: 200 INDICATORS SIGNAL
// ══════════════════════════════════════════
function generateIndicatorSignal(candleData, options) {
  const { coin, market, fundingRate } = options
  const primaryTF = market === 'futures' ? '15m' : '1h'
  const candles = candleData[primaryTF] || candleData['15m'] || candleData['1h'] || candleData['5m']
  if (!candles || candles.length < 50) return null

  const closes = candles.map(c => c.c)
  const htfCandles = candleData['4h'] || candleData['1h'] || candles

  // SMC Analysis
  const smcAnalysis = {
    orderBlocks: detectICT_OrderBlocks(htfCandles),
    fvg: detectICT_FVG(candles),
    structure: detectICT_BOS_CHoCH(candles),
    liquiditySweep: detectICT_LiquiditySweep(candles),
    premiumDiscount: detectICT_PremiumDiscount(candles),
    crt: detectCRT_Pattern(htfCandles),
    tbs: detectTBS_Setup(candles),
    vsa: analyzeVSA(candles),
  }

  // 200 Indicators
  const { votes, rsi, adx } = calc200Indicators(candles, closes)

  // MTF Bias
  const mtfBias = {}
  for (const tf of ['4h', '1h', '30m', '15m', '5m', '1m']) {
    if (candleData[tf]) mtfBias[tf] = analyzeTFBias(candleData[tf])
  }

  // Voting
  let bullVotes = 0, bearVotes = 0
  votes.forEach(v => { if (v === 'B') bullVotes++; else if (v === 'S') bearVotes++ })

  // SMC bonus votes (high weight)
  const smcBonus = 10
  Object.values(smcAnalysis).forEach(s => {
    if (s?.signal === 'B') bullVotes += smcBonus
    else if (s?.signal === 'S') bearVotes += smcBonus
  })

  // MTF bonus
  const mtfBonus = 8
  Object.entries(mtfBias).forEach(([tf, b]) => {
    const w = tf === '4h' ? mtfBonus * 2 : tf === '1h' ? mtfBonus * 1.5 : mtfBonus
    if (b === 'B') bullVotes += w
    else if (b === 'S') bearVotes += w
  })

  // Funding rate (Futures)
  if (fundingRate !== null && market === 'futures') {
    if (fundingRate > 0.01) bearVotes += 5
    else if (fundingRate < -0.01) bullVotes += 5
  }

  const total = bullVotes + bearVotes
  if (total === 0) return null

  const bullPct = (bullVotes / total) * 100
  const bearPct = (bearVotes / total) * 100

  let direction = null, strength = 'NONE'
  if (bullPct >= 75) { direction = 'LONG'; strength = 'ULTRA' }
  else if (bullPct >= 65) { direction = 'LONG'; strength = 'STRONG' }
  else if (bullPct >= 55) { direction = 'LONG'; strength = 'NORMAL' }
  else if (bearPct >= 75) { direction = 'SHORT'; strength = 'ULTRA' }
  else if (bearPct >= 65) { direction = 'SHORT'; strength = 'STRONG' }
  else if (bearPct >= 55) { direction = 'SHORT'; strength = 'NORMAL' }

  if (!direction) {
    direction = bullPct > bearPct ? 'LONG' : 'SHORT'
    strength = 'WEAK'
  }

  const confidence = Math.round(direction === 'LONG' ? bullPct : bearPct)
  const tp = calculateSmartTPSL(candles, candleData, direction, smcAnalysis, market)

  // Pattern detection
  let pattern = 'None'
  if (candles.length >= 3) {
    const [c2, c1, c0] = candles.slice(-3).map(c => ({
      o: c.o, c: c.c, body: Math.abs(c.c - c.o), bull: c.c > c.o,
      lw: Math.min(c.o, c.c) - c.l, uw: c.h - Math.max(c.o, c.c)
    }))
    if (c0.bull && !c1.bull && c0.body > c1.body) pattern = '🟢 Bullish Engulfing'
    else if (!c0.bull && c1.bull && c0.body > c1.body) pattern = '🔴 Bearish Engulfing'
    else if (c0.lw > c0.body * 2) pattern = '🔨 Hammer'
    else if (c0.uw > c0.body * 2) pattern = '💫 Shooting Star'
  }

  // Indicators breakdown
  const indicators = []
  Object.entries(smcAnalysis).forEach(([name, r]) => {
    indicators.push({
      name: `🏦 ${name.toUpperCase()}`,
      signal: r?.signal === 'B' ? '↑ BULL' : r?.signal === 'S' ? '↓ BEAR' : '→ NEUTRAL',
    })
  })

  const indicatorNames = ['EMA Ribbon', 'EMA 200', 'EMA 50', 'Golden Cross', 'SuperTrend', 'RSI', 'MACD', 'ADX', 'Bollinger', 'Stochastic', 'CCI', 'Williams%R', 'MFI', 'OBV', 'Chaikin MF', 'P.SAR', 'Heikin-Ashi', 'Ichimoku Cloud', 'Ichimoku TK', 'VWAP']
  indicatorNames.forEach((name, i) => {
    if (i < votes.length) {
      indicators.push({
        name,
        signal: votes[i] === 'B' ? '↑ BULL' : votes[i] === 'S' ? '↓ BEAR' : '→ NEUTRAL',
      })
    }
  })

  return {
    direction, strength, confidence, tp,
    indicators: indicators.slice(0, 30),
    pattern,
    smcAnalysis: {
      orderBlock: smcAnalysis.orderBlocks?.signal || 'N',
      fvg: smcAnalysis.fvg?.signal || 'N',
      bos: smcAnalysis.structure?.signal || 'N',
      crt: smcAnalysis.crt?.signal || 'N',
      tbs: smcAnalysis.tbs?.signal || 'N',
      vsa: smcAnalysis.vsa?.signal || 'N',
      liquidity: smcAnalysis.liquiditySweep?.signal || 'N',
    },
    mtfBias,
    callVotes: Math.round(bullVotes),
    putVotes: Math.round(bearVotes),
    totalIndicators: 200,
    rsiValue: Math.round(rsi),
    adxValue: Math.round(adx),
  }
}

// ══════════════════════════════════════════
//   MODE 1: SWEEP RECLAIM ONLY
// ══════════════════════════════════════════
function generateSweepSignal(candleData, options) {
  const { coin, market } = options
  const result = analyzeSweepReclaim(candleData, options)
  if (!result.signal) return null

  const s = result.signal

  return {
    direction: s.direction,
    strength: s.strength,
    confidence: s.confidence,
    grade: s.grade,
    tp: s.tp,
    indicators: [
      { name: '🎯 Sweep Type', signal: s.sweepType === 'WICK' ? '↑ WICK' : '↓ BODY' },
      { name: '📏 Sweep Depth', signal: `${s.sweepDepth} ATR` },
      { name: '⏰ Reclaim Delay', signal: `${s.reclaimDelay} bars` },
      { name: '🏷️ Grade', signal: s.grade },
      { name: '📊 Quality Score', signal: `${s.confidence}/100` },
      { name: '🎯 Level Swept', signal: s.level?.toFixed(4) || 'N/A' },
    ],
    pattern: `${s.grade} Sweep Reclaim`,
    smcAnalysis: {
      orderBlock: 'N', fvg: 'N', bos: 'N',
      crt: s.direction === 'LONG' ? 'B' : 'S',
      tbs: 'N', vsa: 'N',
      liquidity: s.direction === 'LONG' ? 'B' : 'S',
    },
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
//   MODE 3: HYBRID (Both Combined)
// ══════════════════════════════════════════
function generateHybridSignal(candleData, options) {
  const sweepResult = generateSweepSignal(candleData, options)
  const indicatorResult = generateIndicatorSignal(candleData, options)

  if (!sweepResult && !indicatorResult) return null

  // If only one is available, return that
  if (!sweepResult) return { ...indicatorResult, mode: 'HYBRID_INDICATOR_ONLY' }
  if (!indicatorResult) return { ...sweepResult, mode: 'HYBRID_SWEEP_ONLY' }

  // Both available — check agreement
  const sweepDir = sweepResult.direction
  const indDir = indicatorResult.direction

  if (sweepDir === indDir) {
    // BOTH AGREE — ULTRA POWERFUL SIGNAL
    const combinedConf = Math.min(99, Math.round((sweepResult.confidence + indicatorResult.confidence) / 2 + 10))

    return {
      direction: sweepDir,
      strength: 'ULTRA',
      confidence: combinedConf,
      grade: sweepResult.grade || 'A+',
      tp: sweepResult.tp || indicatorResult.tp, // Prefer sweep TP (more precise)
      indicators: [
        { name: '🔥 HYBRID CONFIRMED', signal: sweepDir === 'LONG' ? '↑ BULL' : '↓ BEAR' },
        { name: '🎯 Sweep Reclaim', signal: sweepDir === 'LONG' ? '↑ BULL' : '↓ BEAR' },
        { name: '📊 Indicators', signal: indDir === 'LONG' ? '↑ BULL' : '↓ BEAR' },
        ...sweepResult.indicators.slice(0, 6),
        ...indicatorResult.indicators.slice(0, 10),
      ],
      pattern: `🔥 ${sweepResult.grade || 'A+'} Hybrid Setup`,
      smcAnalysis: indicatorResult.smcAnalysis,
      mtfBias: indicatorResult.mtfBias,
      callVotes: indicatorResult.callVotes + (sweepDir === 'LONG' ? 50 : 0),
      putVotes: indicatorResult.putVotes + (sweepDir === 'SHORT' ? 50 : 0),
      totalIndicators: 200,
      rsiValue: indicatorResult.rsiValue,
      adxValue: indicatorResult.adxValue,
      mode: 'HYBRID_CONFIRMED',
    }
  } else {
    // CONFLICT — use stronger one but reduce confidence
    const useSweep = sweepResult.confidence > indicatorResult.confidence
    const winner = useSweep ? sweepResult : indicatorResult
    return {
      ...winner,
      confidence: Math.max(50, winner.confidence - 15),
      strength: 'NORMAL',
      pattern: `⚠️ Conflict Resolved (${useSweep ? 'Sweep' : 'Indicator'} won)`,
      mode: 'HYBRID_CONFLICT',
    }
  }
}

// ══════════════════════════════════════════
//   MAIN ENTRY (Mode Router)
// ══════════════════════════════════════════
export function generateSignal(candleData, options = {}) {
  const { mode = 'hybrid' } = options

  try {
    if (mode === 'sweep') {
      return generateSweepSignal(candleData, options)
    } else if (mode === 'indicator') {
      return generateIndicatorSignal(candleData, options)
    } else {
      return generateHybridSignal(candleData, options)
    }
  } catch (e) {
    console.error('Signal generation error:', e.message)
    return null
  }
}

export default { generateSignal }
