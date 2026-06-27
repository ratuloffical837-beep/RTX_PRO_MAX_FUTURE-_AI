// ══════════════════════════════════════════════════════
//   RTX — SMART MONEY DETECTOR
//   CRT + ICT + TBS + VSA + ATR
//   বিসমিল্লাহির রাহমানির রাহিম
// ══════════════════════════════════════════════════════

const trueRange = (h, l, pc) => Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))

export function calcATR(candles, period = 14) {
  if (!candles || candles.length < period + 1) return null
  const trs = []
  for (let i = 1; i < candles.length; i++) {
    trs.push(trueRange(candles[i].h, candles[i].l, candles[i - 1].c))
  }
  if (trs.length < period) return null
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period
}

function findSwingHighs(candles, lookback = 3) {
  const swings = []
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].h <= candles[i - j].h || candles[i].h <= candles[i + j].h) {
        isHigh = false
        break
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
        isLow = false
        break
      }
    }
    if (isLow) swings.push({ idx: i, price: candles[i].l })
  }
  return swings
}

// ── ICT Order Blocks ──
export function detectICT_OrderBlocks(candles) {
  if (!candles || candles.length < 20) return { signal: 'N', zone: null }
  const close = candles[candles.length - 1].c
  let bullishOB = null, bearishOB = null

  for (let i = Math.max(2, candles.length - 30); i < candles.length - 3; i++) {
    const ob = candles[i]
    const n1 = candles[i + 1]
    const n2 = candles[i + 2]
    const n3 = candles[i + 3]
    if (!ob || !n1 || !n2 || !n3) continue

    if (ob.c < ob.o && n1.c > n1.o && n2.c > n2.o && n3.c > ob.h) {
      bullishOB = { high: ob.o, low: ob.l, mid: (ob.o + ob.l) / 2, idx: i }
    }
    if (ob.c > ob.o && n1.c < n1.o && n2.c < n2.o && n3.c < ob.l) {
      bearishOB = { high: ob.h, low: ob.o, mid: (ob.h + ob.o) / 2, idx: i }
    }
  }

  if (bullishOB && close >= bullishOB.low * 0.998 && close <= bullishOB.high * 1.005) {
    return { signal: 'B', zone: bullishOB, type: 'BULLISH_OB', bullishOB, bearishOB }
  }
  if (bearishOB && close <= bearishOB.high * 1.002 && close >= bearishOB.low * 0.995) {
    return { signal: 'S', zone: bearishOB, type: 'BEARISH_OB', bullishOB, bearishOB }
  }
  return { signal: 'N', bullishOB, bearishOB }
}

// ── ICT FVG ──
export function detectICT_FVG(candles) {
  if (!candles || candles.length < 10) return { signal: 'N' }
  const close = candles[candles.length - 1].c
  const fvgs = []

  for (let i = candles.length - 15; i < candles.length - 1; i++) {
    if (i < 1) continue
    const c1 = candles[i - 1], c2 = candles[i], c3 = candles[i + 1]
    if (!c1 || !c2 || !c3) continue

    if (c3.l > c1.h) {
      fvgs.push({ type: 'BULL', high: c3.l, low: c1.h, mid: (c3.l + c1.h) / 2 })
    }
    if (c3.h < c1.l) {
      fvgs.push({ type: 'BEAR', high: c1.l, low: c3.h, mid: (c1.l + c3.h) / 2 })
    }
  }

  if (fvgs.length === 0) return { signal: 'N' }
  const latestBull = fvgs.filter(f => f.type === 'BULL').pop()
  const latestBear = fvgs.filter(f => f.type === 'BEAR').pop()

  if (latestBull && close >= latestBull.low * 0.998 && close <= latestBull.high * 1.005) {
    return { signal: 'B', gap: latestBull, bullishFVG: latestBull, bearishFVG: latestBear }
  }
  if (latestBear && close <= latestBear.high * 1.002 && close >= latestBear.low * 0.995) {
    return { signal: 'S', gap: latestBear, bullishFVG: latestBull, bearishFVG: latestBear }
  }
  return { signal: 'N', bullishFVG: latestBull, bearishFVG: latestBear }
}

// ── ICT BOS/CHoCH ──
export function detectICT_BOS_CHoCH(candles) {
  if (!candles || candles.length < 30) return { signal: 'N' }
  const sh = findSwingHighs(candles, 3)
  const sl = findSwingLows(candles, 3)
  if (sh.length < 2 || sl.length < 2) return { signal: 'N' }

  const lastH = sh[sh.length - 1], prevH = sh[sh.length - 2]
  const lastL = sl[sl.length - 1], prevL = sl[sl.length - 2]
  const close = candles[candles.length - 1].c

  if (close > lastH.price && lastH.price > prevH.price)
    return { signal: 'B', type: 'BULLISH_BOS', level: lastH.price }
  if (close < lastL.price && lastL.price < prevL.price)
    return { signal: 'S', type: 'BEARISH_BOS', level: lastL.price }

  return { signal: 'N' }
}

// ── ICT Liquidity Sweep ──
export function detectICT_LiquiditySweep(candles) {
  if (!candles || candles.length < 20) return { signal: 'N' }
  const last = candles[candles.length - 1]
  const lookback = candles.slice(-20, -2)
  const recentHigh = Math.max(...lookback.map(c => c.h))
  const recentLow = Math.min(...lookback.map(c => c.l))

  if (last.l < recentLow && last.c > recentLow && last.c > last.o) {
    return { signal: 'B', type: 'SWEEP_LOW', recentLow, recentHigh }
  }
  if (last.h > recentHigh && last.c < recentHigh && last.c < last.o) {
    return { signal: 'S', type: 'SWEEP_HIGH', recentLow, recentHigh }
  }
  return { signal: 'N', recentLow, recentHigh }
}

// ── ICT Premium/Discount ──
export function detectICT_PremiumDiscount(candles) {
  if (!candles || candles.length < 50) return { signal: 'N' }
  const range = candles.slice(-50)
  const high = Math.max(...range.map(c => c.h))
  const low = Math.min(...range.map(c => c.l))
  const eq = (high + low) / 2
  const close = candles[candles.length - 1].c
  const discount = low + (eq - low) * 0.5
  const premium = high - (high - eq) * 0.5

  if (close < discount) return { signal: 'B', zone: 'DISCOUNT' }
  if (close > premium) return { signal: 'S', zone: 'PREMIUM' }
  return { signal: 'N' }
}

// ── CRT (Candle Range Theory) ──
export function detectCRT_Pattern(htfCandles) {
  if (!htfCandles || htfCandles.length < 3) return { signal: 'N' }
  const last3 = htfCandles.slice(-3)
  const [range, manip, dist] = last3
  if (!range || !manip || !dist) return { signal: 'N' }

  const rH = range.h, rL = range.l
  if ((rH - rL) === 0) return { signal: 'N' }

  const sweepedLow = manip.l < rL && manip.c > rL
  const sweepedHigh = manip.h > rH && manip.c < rH

  if (sweepedLow && dist.c > dist.o && dist.c > rL)
    return { signal: 'B', type: 'BULLISH_CRT', rangeHigh: rH, rangeLow: rL }
  if (sweepedHigh && dist.c < dist.o && dist.c < rH)
    return { signal: 'S', type: 'BEARISH_CRT', rangeHigh: rH, rangeLow: rL }
  return { signal: 'N' }
}

// ── TBS (Three Bar Setup) ──
export function detectTBS_Setup(candles) {
  if (!candles || candles.length < 5) return { signal: 'N' }
  const c1 = candles[candles.length - 3]
  const c2 = candles[candles.length - 2]
  const c3 = candles[candles.length - 1]
  if (!c1 || !c2 || !c3) return { signal: 'N' }

  if (c1.c < c1.o && c2.l < c1.l && c3.c > c2.h && c3.c > c3.o)
    return { signal: 'B', type: 'BULLISH_TBS' }
  if (c1.c > c1.o && c2.h > c1.h && c3.c < c2.l && c3.c < c3.o)
    return { signal: 'S', type: 'BEARISH_TBS' }
  return { signal: 'N' }
}

// ── VSA (Volume Spread Analysis) ──
export function analyzeVSA(candles) {
  if (!candles || candles.length < 20) return { signal: 'N' }
  const last = candles[candles.length - 1]
  const prev = candles[candles.length - 2]
  const volumes = candles.slice(-20).map(c => c.v || 1)
  const avgVol = volumes.reduce((a, b) => a + b, 0) / 20
  const spreads = candles.slice(-20).map(c => c.h - c.l)
  const avgSpread = spreads.reduce((a, b) => a + b, 0) / 20

  const lastVol = last.v || 1
  const lastSpread = last.h - last.l
  const bull = last.c > last.o
  const closePos = lastSpread > 0 ? (last.c - last.l) / lastSpread : 0.5

  const highVol = lastVol > avgVol * 1.5
  const ultraVol = lastVol > avgVol * 2
  const lowVol = lastVol < avgVol * 0.7
  const wide = lastSpread > avgSpread * 1.5
  const narrow = lastSpread < avgSpread * 0.7

  if (highVol && wide && closePos > 0.6 && prev.c < prev.o)
    return { signal: 'B', type: 'STOPPING_VOLUME' }
  if (!bull && lowVol && narrow)
    return { signal: 'B', type: 'NO_SUPPLY' }
  if (last.l < Math.min(...candles.slice(-10, -1).map(c => c.l)) && ultraVol && closePos > 0.5)
    return { signal: 'B', type: 'SHAKEOUT' }
  if (ultraVol && wide && closePos < 0.4 && prev.c > prev.o)
    return { signal: 'S', type: 'CLIMACTIC_VOLUME' }
  if (bull && lowVol && narrow)
    return { signal: 'S', type: 'NO_DEMAND' }
  if (last.h > Math.max(...candles.slice(-10, -1).map(c => c.h)) && ultraVol && closePos < 0.5)
    return { signal: 'S', type: 'UPTHRUST' }
  if (highVol && bull && closePos > 0.7) return { signal: 'B', type: 'VOLUME_BULL' }
  if (highVol && !bull && closePos < 0.3) return { signal: 'S', type: 'VOLUME_BEAR' }
  return { signal: 'N' }
}

// ── Smart TP/SL Calculator ──
export function calculateSmartTPSL(candles, candleData, direction, smcAnalysis, market) {
  if (!candles || candles.length < 30 || !direction) return null
  const close = candles[candles.length - 1].c
  const atr = calcATR(candles, 14) || close * 0.01

  const htfCandles = candleData['4h'] || candleData['1h'] || candles
  const swingHighs = findSwingHighs(candles, 3)
  const swingLows = findSwingLows(candles, 3)
  const htfHighs = findSwingHighs(htfCandles, 5)
  const htfLows = findSwingLows(htfCandles, 5)

  const recent50 = candles.slice(-50)
  const recentHigh = Math.max(...recent50.map(c => c.h))
  const recentLow = Math.min(...recent50.map(c => c.l))

  let entry = close, sl, tp1, tp2, tp3

  if (direction === 'LONG') {
    const slCandidates = []
    if (smcAnalysis?.orderBlocks?.bullishOB?.low)
      slCandidates.push(smcAnalysis.orderBlocks.bullishOB.low - atr * 0.3)
    const recentLowsArr = swingLows.slice(-3).map(s => s.price).filter(l => l < entry)
    if (recentLowsArr.length > 0) slCandidates.push(Math.max(...recentLowsArr) - atr * 0.5)
    if (smcAnalysis?.liquiditySweep?.recentLow)
      slCandidates.push(smcAnalysis.liquiditySweep.recentLow - atr * 0.3)
    slCandidates.push(entry - atr * 1.5)

    const validSLs = slCandidates.filter(s => s < entry && s > entry * 0.92)
    sl = validSLs.length > 0 ? Math.max(...validSLs) : entry - atr * 1.5
    const minSL = market === 'futures' ? entry * 0.005 : entry * 0.01
    if (entry - sl < minSL) sl = entry - minSL

    const risk = entry - sl
    const tpC1 = [], tpC2 = [], tpC3 = []
    const highsAbove = swingHighs.map(s => s.price).filter(p => p > entry * 1.003).sort((a, b) => a - b)
    if (highsAbove[0]) tpC1.push(highsAbove[0])
    if (highsAbove[1]) tpC2.push(highsAbove[1])
    if (highsAbove[2]) tpC3.push(highsAbove[2])

    if (smcAnalysis?.fvg?.bearishFVG?.low && smcAnalysis.fvg.bearishFVG.low > entry) {
      tpC1.push(smcAnalysis.fvg.bearishFVG.low)
      tpC2.push(smcAnalysis.fvg.bearishFVG.high)
    }
    const htfHighsAbove = htfHighs.map(s => s.price).filter(p => p > entry).sort((a, b) => a - b)
    if (htfHighsAbove[0]) tpC2.push(htfHighsAbove[0])
    if (htfHighsAbove[1]) tpC3.push(htfHighsAbove[1])
    tpC3.push(recentHigh * 0.998)

    tp1 = tpC1.length > 0 ? Math.min(...tpC1.filter(t => t > entry)) : entry + risk * 1.5
    tp2 = tpC2.length > 0 ? Math.min(...tpC2.filter(t => t > tp1)) : entry + risk * 2.5
    tp3 = tpC3.length > 0 ? Math.max(...tpC3.filter(t => t > tp2)) : entry + risk * 4

    if (tp1 <= entry) tp1 = entry + risk * 1.5
    if (tp2 <= tp1) tp2 = tp1 + risk * 1
    if (tp3 <= tp2) tp3 = tp2 + risk * 1.5
    if (tp3 > entry + risk * 6) tp3 = entry + risk * 6

  } else {
    const slCandidates = []
    if (smcAnalysis?.orderBlocks?.bearishOB?.high)
      slCandidates.push(smcAnalysis.orderBlocks.bearishOB.high + atr * 0.3)
    const recentHighsArr = swingHighs.slice(-3).map(s => s.price).filter(h => h > entry)
    if (recentHighsArr.length > 0) slCandidates.push(Math.min(...recentHighsArr) + atr * 0.5)
    if (smcAnalysis?.liquiditySweep?.recentHigh)
      slCandidates.push(smcAnalysis.liquiditySweep.recentHigh + atr * 0.3)
    slCandidates.push(entry + atr * 1.5)

    const validSLs = slCandidates.filter(s => s > entry && s < entry * 1.08)
    sl = validSLs.length > 0 ? Math.min(...validSLs) : entry + atr * 1.5
    const minSL = market === 'futures' ? entry * 0.005 : entry * 0.01
    if (sl - entry < minSL) sl = entry + minSL

    const risk = sl - entry
    const tpC1 = [], tpC2 = [], tpC3 = []
    const lowsBelow = swingLows.map(s => s.price).filter(p => p < entry * 0.997).sort((a, b) => b - a)
    if (lowsBelow[0]) tpC1.push(lowsBelow[0])
    if (lowsBelow[1]) tpC2.push(lowsBelow[1])
    if (lowsBelow[2]) tpC3.push(lowsBelow[2])

    if (smcAnalysis?.fvg?.bullishFVG?.high && smcAnalysis.fvg.bullishFVG.high < entry) {
      tpC1.push(smcAnalysis.fvg.bullishFVG.high)
      tpC2.push(smcAnalysis.fvg.bullishFVG.low)
    }
    const htfLowsBelow = htfLows.map(s => s.price).filter(p => p < entry).sort((a, b) => b - a)
    if (htfLowsBelow[0]) tpC2.push(htfLowsBelow[0])
    if (htfLowsBelow[1]) tpC3.push(htfLowsBelow[1])
    tpC3.push(recentLow * 1.002)

    tp1 = tpC1.length > 0 ? Math.max(...tpC1.filter(t => t < entry)) : entry - risk * 1.5
    tp2 = tpC2.length > 0 ? Math.max(...tpC2.filter(t => t < tp1)) : entry - risk * 2.5
    tp3 = tpC3.length > 0 ? Math.min(...tpC3.filter(t => t < tp2)) : entry - risk * 4

    if (tp1 >= entry) tp1 = entry - risk * 1.5
    if (tp2 >= tp1) tp2 = tp1 - risk * 1
    if (tp3 >= tp2) tp3 = tp2 - risk * 1.5
    if (tp3 < entry - risk * 6) tp3 = entry - risk * 6
  }

  const risk = Math.abs(entry - sl)
  const reward = Math.abs(tp3 - entry)
  const rr = risk > 0 ? (reward / risk).toFixed(2) : '0'

  let leverage = '3x-5x'
  if (market === 'futures') {
    const riskPct = (risk / entry) * 100
    if (riskPct < 1) leverage = '10x-20x'
    else if (riskPct < 2) leverage = '5x-10x'
    else if (riskPct < 3) leverage = '3x-5x'
    else leverage = '2x-3x'
  }

  const precision = entry < 0.01 ? 8 : entry < 1 ? 6 : entry < 100 ? 4 : 2

  return {
    entry: +entry.toFixed(precision),
    tp1: +tp1.toFixed(precision),
    tp2: +tp2.toFixed(precision),
    tp3: +tp3.toFixed(precision),
    sl: +sl.toFixed(precision),
    rr,
    riskPct: ((risk / entry) * 100).toFixed(2),
    tp1Pct: ((Math.abs(tp1 - entry) / entry) * 100).toFixed(2),
    tp2Pct: ((Math.abs(tp2 - entry) / entry) * 100).toFixed(2),
    tp3Pct: ((Math.abs(tp3 - entry) / entry) * 100).toFixed(2),
    leverage,
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
