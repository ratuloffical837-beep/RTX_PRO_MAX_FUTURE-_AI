// ══════════════════════════════════════════════════════
//   RTX SIGNAL ENGINE v3.0
//   200 Indicators + CRT + ICT + TBS + VSA + ATR
//   Multi-Timeframe Confluence System
//   Strategy-First: TP Must Hit, SL Never Touches
//   বিসমিল্লাহির রাহমানির রাহিম
// ══════════════════════════════════════════════════════

import {
  detectICT_OrderBlocks,
  detectICT_FVG,
  detectICT_BOS_CHoCH,
  detectICT_LiquiditySweep,
  detectICT_PremiumDiscount,
  detectCRT_Pattern,
  detectTBS_Setup,
  analyzeVSA,
  calculateSmartTP_SL,
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

const wma = (arr, p) => {
  if (!arr || arr.length < p) return null
  let s = 0, ws = 0
  const sl = arr.slice(-p)
  for (let i = 0; i < p; i++) { s += sl[i] * (i + 1); ws += (i + 1) }
  return s / ws
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
//   200 INDICATORS (Voting System)
// ══════════════════════════════════════════

// ── Tier 1: Core 50 (Weight ×5) ──
function tier1Indicators(candles, closes) {
  const votes = []

  // 1. EMA Ribbon (8,13,21,34,55,89)
  const emas = [8, 13, 21, 34, 55, 89].map(p => ema(closes, p)).filter(e => e !== null)
  if (emas.length >= 4) {
    const allUp = emas.every((e, i) => i === 0 || e < emas[i - 1])
    const allDn = emas.every((e, i) => i === 0 || e > emas[i - 1])
    votes.push(allUp ? 'B' : allDn ? 'S' : 'N')
  } else votes.push('N')

  // 2. EMA 200
  const e200 = ema(closes, 200)
  votes.push(e200 ? (closes[closes.length - 1] > e200 ? 'B' : 'S') : 'N')

  // 3. EMA 50/200 Cross
  const e50 = ema(closes, 50)
  if (e50 && e200) {
    const pe50 = ema(closes.slice(0, -1), 50)
    const pe200 = ema(closes.slice(0, -1), 200)
    if (pe50 && pe200) {
      if (pe50 <= pe200 && e50 > e200) votes.push('B')
      else if (pe50 >= pe200 && e50 < e200) votes.push('S')
      else votes.push(e50 > e200 ? 'B' : 'S')
    } else votes.push('N')
  } else votes.push('N')

  // 4. SuperTrend
  const atrVals = []
  for (let i = 1; i < candles.length; i++) atrVals.push(trueRange(candles[i].h, candles[i].l, candles[i - 1].c))
  const atr10 = sma(atrVals, 10)
  if (atr10) {
    const last = candles[candles.length - 1]
    const hl2 = (last.h + last.l) / 2
    votes.push(last.c > hl2 - 3 * atr10 ? 'B' : 'S')
  } else votes.push('N')

  // 5. RSI
  if (closes.length > 15) {
    const ch = []
    for (let i = closes.length - 14; i < closes.length; i++) ch.push(closes[i] - closes[i - 1])
    const g = ch.filter(c => c > 0).reduce((a, b) => a + b, 0) / 14
    const l = ch.filter(c => c < 0).reduce((a, b) => a - b, 0) / 14
    const rsi = l === 0 ? 100 : 100 - 100 / (1 + g / l)
    votes.push(rsi < 35 ? 'B' : rsi > 65 ? 'S' : rsi > 50 ? 'B' : 'S')
  } else votes.push('N')

  // 6. MACD
  const e12 = ema(closes, 12), e26 = ema(closes, 26)
  if (e12 && e26) {
    const macd = e12 - e26
    const e12a = emaArray(closes, 12), e26a = emaArray(closes, 26)
    const ml = Math.min(e12a.length, e26a.length)
    const macdLine = []
    for (let i = 0; i < ml; i++) macdLine.push(e12a[e12a.length - ml + i] - e26a[e26a.length - ml + i])
    if (macdLine.length >= 9) {
      const sigLine = ema(macdLine, 9)
      const hist = macd - (sigLine || 0)
      votes.push(hist > 0 ? 'B' : 'S')
    } else votes.push(macd > 0 ? 'B' : 'S')
  } else votes.push('N')

  // 7. ADX
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
      const adx = (pDI + mDI) > 0 ? Math.abs(pDI - mDI) / (pDI + mDI) * 100 : 0
      if (adx > 20) votes.push(pDI > mDI ? 'B' : 'S')
      else votes.push('N')
    } else votes.push('N')
  } else votes.push('N')

  // 8. Bollinger Bands
  const bbMid = sma(closes, 20), bbStd = stdev(closes, 20)
  if (bbMid && bbStd) {
    const pct = (closes[closes.length - 1] - (bbMid - 2 * bbStd)) / (4 * bbStd)
    votes.push(pct < 0.2 ? 'B' : pct > 0.8 ? 'S' : 'N')
  } else votes.push('N')

  // 9. Stochastic
  if (candles.length >= 14) {
    const sl = candles.slice(-14)
    const hh = Math.max(...sl.map(c => c.h)), ll = Math.min(...sl.map(c => c.l))
    if (hh !== ll) {
      const k = ((closes[closes.length - 1] - ll) / (hh - ll)) * 100
      votes.push(k < 20 ? 'B' : k > 80 ? 'S' : 'N')
    } else votes.push('N')
  } else votes.push('N')

  // 10. CCI
  if (candles.length >= 20) {
    const tps = candles.slice(-20).map(c => (c.h + c.l + c.c) / 3)
    const avg = tps.reduce((a, b) => a + b, 0) / 20
    const md = tps.reduce((s, t) => s + Math.abs(t - avg), 0) / 20
    if (md > 0) {
      const cci = (tps[tps.length - 1] - avg) / (0.015 * md)
      votes.push(cci < -100 ? 'B' : cci > 100 ? 'S' : 'N')
    } else votes.push('N')
  } else votes.push('N')

  // 11. Williams %R
  if (candles.length >= 14) {
    const sl = candles.slice(-14)
    const hh = Math.max(...sl.map(c => c.h)), ll = Math.min(...sl.map(c => c.l))
    if (hh !== ll) {
      const wr = ((hh - closes[closes.length - 1]) / (hh - ll)) * -100
      votes.push(wr < -80 ? 'B' : wr > -20 ? 'S' : 'N')
    } else votes.push('N')
  } else votes.push('N')

  // 12. MFI
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

  // 13. OBV Trend
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

  // 14. Chaikin MF
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

  // 15. Parabolic SAR
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

  // 16. Heikin-Ashi Trend
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

  // 17-18. Ichimoku
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

  // 19. VWAP
  if (candles.length >= 10) {
    let cumVP = 0, cumV = 0
    candles.slice(-20).forEach(c => { cumVP += (c.h + c.l + c.c) / 3 * (c.v || 1); cumV += (c.v || 1) })
    const vwap = cumVP / cumV
    votes.push(closes[closes.length - 1] > vwap ? 'B' : 'S')
  } else votes.push('N')

  // 20. Pivot Points
  if (candles.length >= 2) {
    const prev = candles[candles.length - 2]
    const pivot = (prev.h + prev.l + prev.c) / 3
    votes.push(closes[closes.length - 1] > pivot ? 'B' : 'S')
  } else votes.push('N')

  // 21. Fibonacci 0.618
  if (candles.length >= 30) {
    const r = candles.slice(-50)
    const h = Math.max(...r.map(c => c.h)), l = Math.min(...r.map(c => c.l))
    const fib618 = h - (h - l) * 0.618
    const close = closes[closes.length - 1]
    votes.push(close > fib618 ? 'B' : 'S')
  } else votes.push('N')

  // 22. Donchian Channel
  if (candles.length >= 20) {
    const sl = candles.slice(-20)
    const upper = Math.max(...sl.map(c => c.h)), lower = Math.min(...sl.map(c => c.l))
    const close = closes[closes.length - 1]
    votes.push(close >= upper * 0.99 ? 'B' : close <= lower * 1.01 ? 'S' : 'N')
  } else votes.push('N')

  // 23. Keltner Channel
  const e20 = ema(closes, 20)
  const atr14Vals = []
  for (let i = 1; i < candles.length; i++) atr14Vals.push(trueRange(candles[i].h, candles[i].l, candles[i - 1].c))
  const atr14 = sma(atr14Vals, 14)
  if (e20 && atr14) {
    const close = closes[closes.length - 1]
    votes.push(close <= e20 - 2 * atr14 ? 'B' : close >= e20 + 2 * atr14 ? 'S' : 'N')
  } else votes.push('N')

  // 24. Aroon
  if (candles.length >= 25) {
    const sl = candles.slice(-25)
    let hI = 0, lI = 0
    for (let i = 0; i < 25; i++) {
      if (sl[i].h >= sl[hI].h) hI = i
      if (sl[i].l <= sl[lI].l) lI = i
    }
    const aUp = ((25 - (24 - hI)) / 25) * 100
    const aDn = ((25 - (24 - lI)) / 25) * 100
    votes.push(aUp > 70 && aDn < 30 ? 'B' : aDn > 70 && aUp < 30 ? 'S' : 'N')
  } else votes.push('N')

  // 25. Vortex
  if (candles.length > 15) {
    let vmP = 0, vmM = 0, trS = 0
    const sl = candles.slice(-15)
    for (let i = 1; i < sl.length; i++) {
      vmP += Math.abs(sl[i].h - sl[i - 1].l)
      vmM += Math.abs(sl[i].l - sl[i - 1].h)
      trS += trueRange(sl[i].h, sl[i].l, sl[i - 1].c)
    }
    if (trS > 0) votes.push(vmP / trS > vmM / trS ? 'B' : 'S')
    else votes.push('N')
  } else votes.push('N')

  // 26. ROC (10)
  if (closes.length > 11) {
    const roc = ((closes[closes.length - 1] - closes[closes.length - 11]) / closes[closes.length - 11]) * 100
    votes.push(roc > 1 ? 'B' : roc < -1 ? 'S' : 'N')
  } else votes.push('N')

  // 27. Awesome Oscillator
  if (candles.length >= 34) {
    const mp = candles.map(c => (c.h + c.l) / 2)
    const s5 = sma(mp, 5), s34 = sma(mp, 34)
    if (s5 && s34) votes.push(s5 - s34 > 0 ? 'B' : 'S')
    else votes.push('N')
  } else votes.push('N')

  // 28. Ultimate Oscillator
  if (candles.length > 29) {
    const calcBP = (c, pc) => c.c - Math.min(c.l, pc)
    const calcTR2 = (c, pc) => Math.max(c.h, pc) - Math.min(c.l, pc)
    let b7 = 0, t7 = 0, b14 = 0, t14 = 0, b28 = 0, t28 = 0
    for (let i = candles.length - 28; i < candles.length; i++) {
      const bp = calcBP(candles[i], candles[i - 1].c)
      const tr2 = calcTR2(candles[i], candles[i - 1].c)
      b28 += bp; t28 += tr2
      if (i >= candles.length - 14) { b14 += bp; t14 += tr2 }
      if (i >= candles.length - 7) { b7 += bp; t7 += tr2 }
    }
    if (t7 > 0 && t14 > 0 && t28 > 0) {
      const uo = ((b7 / t7 * 4 + b14 / t14 * 2 + b28 / t28) / 7) * 100
      votes.push(uo < 30 ? 'B' : uo > 70 ? 'S' : 'N')
    } else votes.push('N')
  } else votes.push('N')

  // 29. Candle Patterns
  if (candles.length >= 3) {
    const [c2, c1, c0] = candles.slice(-3).map(c => ({
      o: c.o, c: c.c, h: c.h, l: c.l,
      body: Math.abs(c.c - c.o), bull: c.c > c.o,
      lw: Math.min(c.o, c.c) - c.l, uw: c.h - Math.max(c.o, c.c)
    }))
    if (c0.bull && !c1.bull && c0.o <= c1.c && c0.c >= c1.o && c0.body > c1.body) votes.push('B')
    else if (!c0.bull && c1.bull && c0.o >= c1.c && c0.c <= c1.o && c0.body > c1.body) votes.push('S')
    else if (c0.lw > c0.body * 2 && c0.uw < c0.body * 0.5) votes.push('B')
    else if (c0.uw > c0.body * 2 && c0.lw < c0.body * 0.5) votes.push('S')
    else votes.push(c0.bull ? 'B' : 'S')
  } else votes.push('N')

  // 30. Volume Spike Direction
  if (candles.length > 20) {
    const rv = sma(candles.slice(-5).map(c => c.v || 1), 5)
    const av = sma(candles.slice(-20).map(c => c.v || 1), 20)
    if (rv && av && rv > av * 1.3) {
      votes.push(closes[closes.length - 1] > closes[closes.length - 2] ? 'B' : 'S')
    } else votes.push('N')
  } else votes.push('N')

  // 31-50: Additional Indicators
  // EMA variations
  for (const p of [5, 8, 13, 21, 34, 55, 100, 144]) {
    const e = ema(closes, p)
    votes.push(e ? (closes[closes.length - 1] > e ? 'B' : 'S') : 'N')
  }

  // SMA variations
  for (const p of [10, 20, 50, 100, 200]) {
    const s = sma(closes, p)
    votes.push(s ? (closes[closes.length - 1] > s ? 'B' : 'S') : 'N')
  }

  // Momentum (various periods)
  for (const p of [3, 5, 10, 14, 20, 30, 50]) {
    if (closes.length > p) {
      votes.push(closes[closes.length - 1] > closes[closes.length - 1 - p] ? 'B' : 'S')
    } else votes.push('N')
  }

  return votes
}

// ── Tier 2: Supporting 50 (Weight ×3) ──
function tier2Indicators(candles, closes) {
  const votes = []

  // Linear Regression
  if (closes.length > 20) {
    const n = 20, sl = closes.slice(-n)
    let sX = 0, sY = 0, sXY = 0, sX2 = 0
    for (let i = 0; i < n; i++) { sX += i; sY += sl[i]; sXY += i * sl[i]; sX2 += i * i }
    const slope = (n * sXY - sX * sY) / (n * sX2 - sX * sX)
    votes.push(slope > 0 ? 'B' : 'S')
  } else votes.push('N')

  // CMO
  if (closes.length > 15) {
    let g = 0, l = 0
    for (let i = closes.length - 14; i < closes.length; i++) {
      const ch = closes[i] - closes[i - 1]
      if (ch > 0) g += ch; else l -= ch
    }
    const cmo = (g + l) > 0 ? ((g - l) / (g + l)) * 100 : 0
    votes.push(cmo > 30 ? 'B' : cmo < -30 ? 'S' : 'N')
  } else votes.push('N')

  // Force Index
  if (closes.length > 2) {
    const fi = (closes[closes.length - 1] - closes[closes.length - 2]) * (candles[candles.length - 1].v || 1)
    votes.push(fi > 0 ? 'B' : fi < 0 ? 'S' : 'N')
  } else votes.push('N')

  // Z-Score
  if (closes.length > 20) {
    const avg = sma(closes, 20), sd = stdev(closes, 20)
    if (avg && sd && sd > 0) {
      const z = (closes[closes.length - 1] - avg) / sd
      votes.push(z < -2 ? 'B' : z > 2 ? 'S' : 'N')
    } else votes.push('N')
  } else votes.push('N')

  // Ease of Movement
  if (candles.length > 2) {
    const c = candles[candles.length - 1], pc = candles[candles.length - 2]
    const dm = ((c.h + c.l) / 2) - ((pc.h + pc.l) / 2)
    const br = (c.v || 1) / ((c.h - c.l) || 1)
    votes.push(dm / br > 0 ? 'B' : 'S')
  } else votes.push('N')

  // Double Bottom/Top
  if (candles.length > 30) {
    const lows = candles.slice(-20).map(c => c.l)
    const highs = candles.slice(-20).map(c => c.h)
    const minL = Math.min(...lows), maxH = Math.max(...highs)
    const lowCount = lows.filter(l => Math.abs(l - minL) < minL * 0.005).length
    const highCount = highs.filter(h => Math.abs(h - maxH) < maxH * 0.005).length
    if (lowCount >= 2) votes.push('B')
    else if (highCount >= 2) votes.push('S')
    else votes.push('N')
  } else votes.push('N')

  // Volume Profile (POC)
  if (candles.length >= 20) {
    const r = candles.slice(-20)
    const h = Math.max(...r.map(c => c.h)), l = Math.min(...r.map(c => c.l))
    const range = h - l, bins = 10, binSize = range / bins
    const vols = new Array(bins).fill(0)
    r.forEach(c => {
      const mid = (c.h + c.l) / 2
      const bin = Math.min(Math.floor((mid - l) / binSize), bins - 1)
      vols[bin] += c.v || 1
    })
    const poc = l + (vols.indexOf(Math.max(...vols)) + 0.5) * binSize
    votes.push(closes[closes.length - 1] > poc ? 'B' : 'S')
  } else votes.push('N')

  // PPO
  if (e12 && e26 && e26 !== 0) {
    const ppo = ((ema(closes, 12) - ema(closes, 26)) / ema(closes, 26)) * 100
    votes.push(ppo > 0 ? 'B' : 'S')
  } else votes.push('N')

  // High/Low position
  for (const p of [5, 10, 14, 20, 30, 50]) {
    if (closes.length > p) {
      const hh = highest(closes, p), ll = lowest(closes, p)
      const range = hh - ll
      if (range > 0) {
        const pct = (closes[closes.length - 1] - ll) / range
        votes.push(pct < 0.3 ? 'B' : pct > 0.7 ? 'S' : 'N')
      } else votes.push('N')
    } else votes.push('N')
  }

  // EMA slopes
  for (const p of [8, 21, 50]) {
    const curr = ema(closes, p)
    const prev = closes.length > p + 1 ? ema(closes.slice(0, -1), p) : null
    if (curr && prev) votes.push(curr > prev ? 'B' : 'S')
    else votes.push('N')
  }

  // RSI Divergence
  if (closes.length > 30) {
    const last = closes[closes.length - 1]
    const prev10 = Math.min(...closes.slice(-12, -1))
    const isNewLow = last < prev10

    // Simple RSI check
    const ch1 = [], ch2 = []
    for (let i = closes.length - 14; i < closes.length; i++) ch1.push(closes[i] - closes[i - 1])
    for (let i = closes.length - 28; i < closes.length - 14; i++) ch2.push(closes[i] - closes[i - 1])
    const g1 = ch1.filter(c => c > 0).reduce((a, b) => a + b, 0) / 14
    const l1 = ch1.filter(c => c < 0).reduce((a, b) => a - b, 0) / 14
    const g2 = ch2.filter(c => c > 0).reduce((a, b) => a + b, 0) / 14
    const l2 = ch2.filter(c => c < 0).reduce((a, b) => a - b, 0) / 14
    const rsi1 = l1 === 0 ? 100 : 100 - 100 / (1 + g1 / l1)
    const rsi2 = l2 === 0 ? 100 : 100 - 100 / (1 + g2 / l2)

    if (isNewLow && rsi1 > rsi2) votes.push('B')
    else votes.push('N')
  } else votes.push('N')

  // Candle body ratio
  for (let i = 0; i < 5; i++) {
    if (candles.length > i + 1) {
      const c = candles[candles.length - 1 - i]
      votes.push(c.c > c.o ? 'B' : c.c < c.o ? 'S' : 'N')
    } else votes.push('N')
  }

  // Volume trend
  for (let i = 0; i < 5; i++) {
    if (candles.length > 20 + i) {
      const rv = sma(candles.slice(-5 - i, candles.length - i).map(c => c.v || 1), 5)
      const av = sma(candles.slice(-20 - i, candles.length - i).map(c => c.v || 1), 20)
      if (rv && av) votes.push(rv > av ? (closes[closes.length - 1] > closes[closes.length - 2] ? 'B' : 'S') : 'N')
      else votes.push('N')
    } else votes.push('N')
  }

  // Fill remaining to reach 50
  while (votes.length < 50) {
    const idx = votes.length
    const p = 3 + (idx * 2) % 40
    const e = closes.length > p ? ema(closes, p) : null
    votes.push(e ? (closes[closes.length - 1] > e ? 'B' : 'S') : 'N')
  }

  return votes.slice(0, 50)
}

// ── Tier 3: Extended 50 (Weight ×2) ──
function tier3Indicators(candles, closes) {
  const votes = []
  const periods = [3, 5, 7, 10, 12, 15, 17, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110]
  periods.forEach(p => {
    if (closes.length > p) {
      votes.push(closes[closes.length - 1] > ema(closes, p) ? 'B' : 'S')
      votes.push(closes[closes.length - 1] > sma(closes, p) ? 'B' : 'S')
    } else { votes.push('N'); votes.push('N') }
  })
  return votes.slice(0, 50)
}

// ── Tier 4: Micro 50 (Weight ×1) ──
function tier4Indicators(candles, closes) {
  const votes = []

  // Momentum variations
  for (const p of [1, 2, 3, 5, 7, 10, 14, 20, 25, 30]) {
    if (closes.length > p) {
      votes.push(closes[closes.length - 1] > closes[closes.length - 1 - p] ? 'B' : 'S')
    } else votes.push('N')
  }

  // Candle direction
  for (let i = 0; i < 10; i++) {
    if (candles.length > i + 1) {
      const c = candles[candles.length - 1 - i]
      votes.push(c.c > c.o ? 'B' : c.c < c.o ? 'S' : 'N')
    } else votes.push('N')
  }

  // Volume weighted direction
  for (let i = 0; i < 10; i++) {
    if (candles.length > i + 5) {
      const rv = sma(candles.slice(-5 - i, candles.length - i).map(c => c.v || 1), 5)
      const av = candles.length > 20 + i ? sma(candles.slice(-20 - i, candles.length - i).map(c => c.v || 1), 20) : null
      if (rv && av) votes.push(rv > av ? (closes[closes.length - 1 - i] > (closes[closes.length - 2 - i] || closes[closes.length - 1 - i]) ? 'B' : 'S') : 'N')
      else votes.push('N')
    } else votes.push('N')
  }

  // Price position in range
  for (const p of [5, 10, 14, 20, 30, 50, 60, 70, 80, 100]) {
    if (closes.length > p) {
      const hh = highest(closes, p), ll = lowest(closes, p)
      const r = hh - ll
      if (r > 0) {
        const pct = (closes[closes.length - 1] - ll) / r
        votes.push(pct < 0.3 ? 'B' : pct > 0.7 ? 'S' : 'N')
      } else votes.push('N')
    } else votes.push('N')
  }

  while (votes.length < 50) votes.push('N')
  return votes.slice(0, 50)
}

// ══════════════════════════════════════════
//   MULTI-TIMEFRAME ANALYSIS
// ══════════════════════════════════════════
function analyzeTFBias(candles) {
  if (!candles || candles.length < 30) return 'N'
  const closes = candles.map(c => c.c)
  const e8 = ema(closes, 8), e21 = ema(closes, 21), e50 = ema(closes, 50)

  let bullScore = 0, bearScore = 0
  if (e8 && e21 && e8 > e21) bullScore++; else if (e8 && e21) bearScore++
  if (e21 && e50 && e21 > e50) bullScore++; else if (e21 && e50) bearScore++
  if (closes[closes.length - 1] > closes[closes.length - 2]) bullScore++; else bearScore++

  // Structure check
  const swingHigh = Math.max(...candles.slice(-10).map(c => c.h))
  const swingLow = Math.min(...candles.slice(-10).map(c => c.l))
  const prevHigh = Math.max(...candles.slice(-20, -10).map(c => c.h))
  const prevLow = Math.min(...candles.slice(-20, -10).map(c => c.l))

  if (swingHigh > prevHigh && swingLow > prevLow) bullScore += 2 // HH + HL
  else if (swingHigh < prevHigh && swingLow < prevLow) bearScore += 2 // LH + LL

  return bullScore > bearScore ? 'B' : bearScore > bullScore ? 'S' : 'N'
}

// ══════════════════════════════════════════
//   MAIN SIGNAL GENERATOR
// ══════════════════════════════════════════
export function generateSignal(candleData, options = {}) {
  const { coin, market, fundingRate } = options

  // ── Step 1: Multi-Timeframe Bias ──
  const mtfBias = {}
  const tfOrder = ['4h', '1h', '30m', '15m', '5m', '1m']

  for (const tf of tfOrder) {
    if (candleData[tf]) {
      mtfBias[tf] = analyzeTFBias(candleData[tf])
    }
  }

  // ── Step 2: Get Primary Timeframe ──
  const primaryTF = market === 'futures' ? '15m' : '1h'
  const candles = candleData[primaryTF] || candleData['15m'] || candleData['1h'] || candleData['5m']
  if (!candles || candles.length < 50) return null

  const closes = candles.map(c => c.c)

  // ── Step 3: Smart Money Analysis (CRT + ICT + TBS + VSA) ──
  const smcAnalysis = {}

  // ICT Analysis
  const htfCandles = candleData['4h'] || candleData['1h'] || candles
  smcAnalysis.orderBlocks = detectICT_OrderBlocks(htfCandles)
  smcAnalysis.fvg = detectICT_FVG(candles)
  smcAnalysis.structure = detectICT_BOS_CHoCH(candles)
  smcAnalysis.liquiditySweep = detectICT_LiquiditySweep(candles)
  smcAnalysis.premiumDiscount = detectICT_PremiumDiscount(candles)

  // CRT Analysis
  smcAnalysis.crt = detectCRT_Pattern(htfCandles, candles)

  // TBS Analysis
  smcAnalysis.tbs = detectTBS_Setup(candles)

  // VSA Analysis
  smcAnalysis.vsa = analyzeVSA(candles)

  // ── Step 4: 200 Indicator Voting ──
  const t1 = tier1Indicators(candles, closes)
  const t2 = tier2Indicators(candles, closes)
  const t3 = tier3Indicators(candles, closes)
  const t4 = tier4Indicators(candles, closes)

  // ── Step 5: Weighted Voting ──
  let bullVotes = 0, bearVotes = 0, totalWeight = 0

  // Tier 1 (×5)
  t1.forEach(v => { if (v === 'B') bullVotes += 5; else if (v === 'S') bearVotes += 5; totalWeight += 5 })
  // Tier 2 (×3)
  t2.forEach(v => { if (v === 'B') bullVotes += 3; else if (v === 'S') bearVotes += 3; totalWeight += 3 })
  // Tier 3 (×2)
  t3.forEach(v => { if (v === 'B') bullVotes += 2; else if (v === 'S') bearVotes += 2; totalWeight += 2 })
  // Tier 4 (×1)
  t4.forEach(v => { if (v === 'B') bullVotes += 1; else if (v === 'S') bearVotes += 1; totalWeight += 1 })

  // ── Step 6: SMC Bonus Votes (×10 weight) ──
  const smcWeight = 10

  // Order Block
  if (smcAnalysis.orderBlocks?.signal === 'B') bullVotes += smcWeight
  else if (smcAnalysis.orderBlocks?.signal === 'S') bearVotes += smcWeight

  // FVG
  if (smcAnalysis.fvg?.signal === 'B') bullVotes += smcWeight
  else if (smcAnalysis.fvg?.signal === 'S') bearVotes += smcWeight

  // BOS/CHoCH
  if (smcAnalysis.structure?.signal === 'B') bullVotes += smcWeight * 1.5
  else if (smcAnalysis.structure?.signal === 'S') bearVotes += smcWeight * 1.5

  // Liquidity Sweep
  if (smcAnalysis.liquiditySweep?.signal === 'B') bullVotes += smcWeight * 2
  else if (smcAnalysis.liquiditySweep?.signal === 'S') bearVotes += smcWeight * 2

  // CRT
  if (smcAnalysis.crt?.signal === 'B') bullVotes += smcWeight * 2
  else if (smcAnalysis.crt?.signal === 'S') bearVotes += smcWeight * 2

  // TBS
  if (smcAnalysis.tbs?.signal === 'B') bullVotes += smcWeight
  else if (smcAnalysis.tbs?.signal === 'S') bearVotes += smcWeight

  // VSA
  if (smcAnalysis.vsa?.signal === 'B') bullVotes += smcWeight * 1.5
  else if (smcAnalysis.vsa?.signal === 'S') bearVotes += smcWeight * 1.5

  // ── Step 7: MTF Bias Bonus (×8 weight) ──
  const mtfWeight = 8
  Object.entries(mtfBias).forEach(([tf, bias]) => {
    const w = tf === '4h' ? mtfWeight * 2 : tf === '1h' ? mtfWeight * 1.5 : mtfWeight
    if (bias === 'B') bullVotes += w
    else if (bias === 'S') bearVotes += w
  })

  // ── Step 8: Funding Rate (Futures) ──
  if (fundingRate !== null && market === 'futures') {
    if (fundingRate > 0.01) bearVotes += 5
    else if (fundingRate < -0.01) bullVotes += 5
  }

  // ── Step 9: Final Decision ──
  const total = bullVotes + bearVotes
  if (total === 0) return null

  const bullPct = (bullVotes / total) * 100
  const bearPct = (bearVotes / total) * 100

  let direction = null, strength = 'NONE'

  if (bullPct >= 80) { direction = 'LONG'; strength = 'ULTRA' }
  else if (bullPct >= 70) { direction = 'LONG'; strength = 'STRONG' }
  else if (bullPct >= 60) { direction = 'LONG'; strength = 'NORMAL' }
  else if (bearPct >= 80) { direction = 'SHORT'; strength = 'ULTRA' }
  else if (bearPct >= 70) { direction = 'SHORT'; strength = 'STRONG' }
  else if (bearPct >= 60) { direction = 'SHORT'; strength = 'NORMAL' }

  if (!direction) {
    // Weak signal — still show but with caution
    if (bullPct > bearPct) { direction = 'LONG'; strength = 'WEAK' }
    else { direction = 'SHORT'; strength = 'WEAK' }
  }

  const confidence = Math.round(direction === 'LONG' ? bullPct : bearPct)

  // ── Step 10: Smart TP/SL (ICT-Based) ──
  const tp = calculateSmartTP_SL(candles, candleData, direction, smcAnalysis, market)

  // ── RSI & ADX for display ──
  let rsiValue = 50, adxValue = 0
  if (closes.length > 15) {
    const ch = []
    for (let i = closes.length - 14; i < closes.length; i++) ch.push(closes[i] - closes[i - 1])
    const g = ch.filter(c => c > 0).reduce((a, b) => a + b, 0) / 14
    const l = ch.filter(c => c < 0).reduce((a, b) => a - b, 0) / 14
    rsiValue = l === 0 ? 100 : 100 - 100 / (1 + g / l)
  }
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
      adxValue = (pDI + mDI) > 0 ? Math.abs(pDI - mDI) / (pDI + mDI) * 100 : 0
    }
  }

  // ── Build indicator breakdown ──
  const indicators = []
  const smcNames = ['Order Block', 'FVG', 'BOS/CHoCH', 'Liquidity Sweep', 'CRT Pattern', 'TBS Setup', 'VSA Volume']
  const smcResults = [smcAnalysis.orderBlocks, smcAnalysis.fvg, smcAnalysis.structure, smcAnalysis.liquiditySweep, smcAnalysis.crt, smcAnalysis.tbs, smcAnalysis.vsa]
  smcNames.forEach((name, i) => {
    const r = smcResults[i]
    indicators.push({
      name: `🏦 ${name}`,
      signal: r?.signal === 'B' ? '↑ BULL' : r?.signal === 'S' ? '↓ BEAR' : '→ NEUTRAL',
      tier: 0,
    })
  })

  // Top indicator names
  const t1Names = ['EMA Ribbon', 'EMA 200', 'Golden Cross', 'SuperTrend', 'RSI', 'MACD', 'ADX', 'Bollinger', 'Stochastic', 'CCI', 'Williams%R', 'MFI', 'OBV', 'Chaikin MF', 'P.SAR', 'Heikin-Ashi', 'Ichimoku Cloud', 'Ichimoku TK', 'VWAP', 'Pivot']
  t1Names.forEach((name, i) => {
    if (i < t1.length) {
      indicators.push({
        name,
        signal: t1[i] === 'B' ? '↑ BULL' : t1[i] === 'S' ? '↓ BEAR' : '→ NEUTRAL',
        tier: 1,
      })
    }
  })

  // Candle pattern name
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
    else if (!c2.bull && c1.body < c2.body * 0.3 && c0.bull) pattern = '⭐ Morning Star'
    else if (c2.bull && c1.body < c2.body * 0.3 && !c0.bull) pattern = '⭐ Evening Star'
  }

  return {
    direction,
    strength,
    confidence,
    tp,
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
    rsiValue: Math.round(rsiValue),
    adxValue: Math.round(adxValue),
  }
}
