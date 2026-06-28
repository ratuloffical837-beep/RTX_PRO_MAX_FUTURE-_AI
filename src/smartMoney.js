// ══════════════════════════════════════════════════════
//   RTX — SMART MONEY DETECTOR v4.1 (Optimized)
//   বিসমিল্লাহির রাহমানির রাহিম
// ══════════════════════════════════════════════════════

const trueRange = (h, l, pc) => Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))

export function calcATR(candles, period = 14) {
  if (!candles || candles.length < period + 1) return null
  const trs = []
  for (let i = 1; i < candles.length; i++) {
    trs.push(trueRange(candles[i].h, candles[i].l, candles[i - 1].c))
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period
}

function findSwingHighs(candles, lookback = 3) {
  const swings = []
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].h <= candles[i - j].h || candles[i].h <= candles[i + j].h) {
        isHigh = false; break
      }
    }
    if (isHigh) swings.push({ idx: i, price: candles[i].h })
  }
  return swings
}

function findSwingLows(candles, lookback = 3) {
  const swings = []
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isLow = true
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].l >= candles[i - j].l || candles[i].l >= candles[i + j].l) {
        isLow = false; break
      }
    }
    if (isLow) swings.push({ idx: i, price: candles[i].l })
  }
  return swings
}

// ── ICT Order Blocks ──
export function detectICT_OrderBlocks(candles) {
  if (!candles || candles.length < 15) return { signal: 'N' }
  const close = candles.at(-1).c
  let bullishOB = null, bearishOB = null

  for (let i = candles.length - 12; i < candles.length - 3; i++) {
    const ob = candles[i]
    const n1 = candles[i + 1], n2 = candles[i + 2], n3 = candles[i + 3]
    if (!ob || !n1 || !n2 || !n3) continue

    if (ob.c < ob.o && n1.c > n1.o && n3.c > ob.h) {
      bullishOB = { high: ob.o, low: ob.l, mid: (ob.o + ob.l) / 2 }
    }
    if (ob.c > ob.o && n1.c < n1.o && n3.c < ob.l) {
      bearishOB = { high: ob.h, low: ob.o, mid: (ob.h + ob.o) / 2 }
    }
  }

  if (bullishOB && close >= bullishOB.low * 0.998 && close <= bullishOB.high * 1.005)
    return { signal: 'B', type: 'BULLISH_OB', bullishOB, bearishOB }
  if (bearishOB && close <= bearishOB.high * 1.002 && close >= bearishOB.low * 0.995)
    return { signal: 'S', type: 'BEARISH_OB', bullishOB, bearishOB }

  return { signal: 'N', bullishOB, bearishOB }
}

// ── ICT FVG ──
export function detectICT_FVG(candles) {
  if (!candles || candles.length < 8) return { signal: 'N' }
  const close = candles.at(-1).c
  let bullFVG = null, bearFVG = null

  for (let i = candles.length - 8; i < candles.length - 1; i++) {
    const c1 = candles[i - 1], c3 = candles[i + 1]
    if (c3.l > c1.h) bullFVG = { high: c3.l, low: c1.h }
    if (c3.h < c1.l) bearFVG = { high: c1.l, low: c3.h }
  }

  if (bullFVG && close >= bullFVG.low * 0.998 && close <= bullFVG.high * 1.005)
    return { signal: 'B', gap: bullFVG }
  if (bearFVG && close <= bearFVG.high * 1.002 && close >= bearFVG.low * 0.995)
    return { signal: 'S', gap: bearFVG }

  return { signal: 'N', bullishFVG: bullFVG, bearishFVG: bearFVG }
}

// ── ICT BOS/CHoCH ──
export function detectICT_BOS_CHoCH(candles) {
  if (!candles || candles.length < 25) return { signal: 'N' }
  const sh = findSwingHighs(candles, 3)
  const sl = findSwingLows(candles, 3)
  if (sh.length < 2 || sl.length < 2) return { signal: 'N' }

  const lastH = sh.at(-1), prevH = sh.at(-2)
  const lastL = sl.at(-1), prevL = sl.at(-2)
  const close = candles.at(-1).c

  if (close > lastH.price && lastH.price > prevH.price) return { signal: 'B', type: 'BULLISH_BOS' }
  if (close < lastL.price && lastL.price < prevL.price) return { signal: 'S', type: 'BEARISH_BOS' }
  return { signal: 'N' }
}

// ── Liquidity Sweep ──
export function detectICT_LiquiditySweep(candles) {
  if (!candles || candles.length < 15) return { signal: 'N' }
  const last = candles.at(-1)
  const lookback = candles.slice(-12, -2)
  const recentHigh = Math.max(...lookback.map(c => c.h))
  const recentLow = Math.min(...lookback.map(c => c.l))

  if (last.l < recentLow && last.c > recentLow && last.c > last.o)
    return { signal: 'B', type: 'SWEEP_LOW' }
  if (last.h > recentHigh && last.c < recentHigh && last.c < last.o)
    return { signal: 'S', type: 'SWEEP_HIGH' }
  return { signal: 'N' }
}

// ── Premium / Discount ──
export function detectICT_PremiumDiscount(candles) {
  if (!candles || candles.length < 40) return { signal: 'N' }
  const range = candles.slice(-40)
  const high = Math.max(...range.map(c => c.h))
  const low = Math.min(...range.map(c => c.l))
  const eq = (high + low) / 2
  const close = candles.at(-1).c
  const discount = low + (eq - low) * 0.5

  if (close < discount) return { signal: 'B', zone: 'DISCOUNT' }
  if (close > high - (high - eq) * 0.5) return { signal: 'S', zone: 'PREMIUM' }
  return { signal: 'N' }
}

// ── CRT Pattern ──
export function detectCRT_Pattern(candles) {
  if (!candles || candles.length < 4) return { signal: 'N' }
  const [range, manip, dist] = candles.slice(-3)
  if (!range || !manip || !dist) return { signal: 'N' }

  const sweepedLow = manip.l < range.l && manip.c > range.l
  const sweepedHigh = manip.h > range.h && manip.c < range.h

  if (sweepedLow && dist.c > dist.o) return { signal: 'B', type: 'BULLISH_CRT' }
  if (sweepedHigh && dist.c < dist.o) return { signal: 'S', type: 'BEARISH_CRT' }
  return { signal: 'N' }
}

// ── TBS Setup ──
export function detectTBS_Setup(candles) {
  if (!candles || candles.length < 5) return { signal: 'N' }
  const c1 = candles.at(-3), c2 = candles.at(-2), c3 = candles.at(-1)
  if (!c1 || !c2 || !c3) return { signal: 'N' }

  if (c1.c < c1.o && c2.l < c1.l && c3.c > c2.h && c3.c > c3.o) return { signal: 'B', type: 'BULLISH_TBS' }
  if (c1.c > c1.o && c2.h > c1.h && c3.c < c2.l && c3.c < c3.o) return { signal: 'S', type: 'BEARISH_TBS' }
  return { signal: 'N' }
}

// ── VSA Analysis ──
export function analyzeVSA(candles) {
  if (!candles || candles.length < 15) return { signal: 'N' }
  const last = candles.at(-1)
  const volumes = candles.slice(-15).map(c => c.v || 1)
  const avgVol = volumes.reduce((a, b) => a + b, 0) / 15
  const highVol = (last.v || 1) > avgVol * 1.6

  if (highVol && last.c > last.o) return { signal: 'B', type: 'VOLUME_BULL' }
  if (highVol && last.c < last.o) return { signal: 'S', type: 'VOLUME_BEAR' }
  return { signal: 'N' }
}

// ── Smart TP/SL Calculator ──
export function calculateSmartTPSL(candles, candleData, direction, smc, market) {
  if (!candles || candles.length < 20) return null
  const close = candles.at(-1).c
  const atr = calcATR(candles, 14) || close * 0.01

  let entry = close, sl, tp1, tp2, tp3

  if (direction === 'LONG') {
    sl = entry - atr * 1.6
    const risk = entry - sl
    tp1 = entry + risk * 1.5
    tp2 = entry + risk * 2.2
    tp3 = entry + risk * 3.5
  } else {
    sl = entry + atr * 1.6
    const risk = sl - entry
    tp1 = entry - risk * 1.5
    tp2 = entry - risk * 2.2
    tp3 = entry - risk * 3.5
  }

  const precision = entry < 1 ? 6 : entry < 100 ? 4 : 2

  return {
    entry: +entry.toFixed(precision),
    tp1: +tp1.toFixed(precision),
    tp2: +tp2.toFixed(precision),
    tp3: +tp3.toFixed(precision),
    sl: +sl.toFixed(precision),
    rr: '2.0',
    riskPct: ((Math.abs(entry - sl) / entry) * 100).toFixed(2),
    tp1Pct: ((Math.abs(tp1 - entry) / entry) * 100).toFixed(2),
    tp2Pct: ((Math.abs(tp2 - entry) / entry) * 100).toFixed(2),
    tp3Pct: ((Math.abs(tp3 - entry) / entry) * 100).toFixed(2),
    leverage: market === 'futures' ? '5x-10x' : 'N/A',
    closePosition: [50, 30, 20],
    atrValue: +atr.toFixed(precision),
  }
}

export default {
  calcATR,
  detectICT_OrderBlocks,
  detectICT_FVG,
  detectICT_BOS_CHoCH,
  detectICT_LiquiditySweep,
  detectICT_PremiumDiscount,
  detectCRT_Pattern,
  detectTBS_Setup,
  analyzeVSA,
  calculateSmartTPSL,
                                   }
