// ══════════════════════════════════════════════════════
//   RTX SMART MONEY DETECTOR
//   CRT + ICT + TBS + VSA + ATR
//   দুনিয়ার সবচেয়ে Powerful TP/SL Calculator
//   বিসমিল্লাহির রাহমানির রাহিম
// ══════════════════════════════════════════════════════

// ══════════════════════════════════════════
//   HELPER FUNCTIONS
// ══════════════════════════════════════════
const trueRange = (h, l, pc) => Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))

const calcATR = (candles, period = 14) => {
  if (!candles || candles.length < period + 1) return null
  const trs = []
  for (let i = 1; i < candles.length; i++) {
    trs.push(trueRange(candles[i].h, candles[i].l, candles[i - 1].c))
  }
  if (trs.length < period) return null
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period
}

const findSwingHighs = (candles, lookback = 3) => {
  const swings = []
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].h <= candles[i - j].h || candles[i].h <= candles[i + j].h) {
        isHigh = false
        break
      }
    }
    if (isHigh) swings.push({ idx: i, price: candles[i].h, type: 'H' })
  }
  return swings
}

const findSwingLows = (candles, lookback = 3) => {
  const swings = []
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isLow = true
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].l >= candles[i - j].l || candles[i].l >= candles[i + j].l) {
        isLow = false
        break
      }
    }
    if (isLow) swings.push({ idx: i, price: candles[i].l, type: 'L' })
  }
  return swings
}

// ══════════════════════════════════════════
//   1. ICT — ORDER BLOCK DETECTION
//   Smart Money এর Entry Zone
// ══════════════════════════════════════════
export function detectICT_OrderBlocks(candles) {
  if (!candles || candles.length < 20) return { signal: 'N', zone: null }

  const close = candles[candles.length - 1].c
  let bullishOB = null
  let bearishOB = null

  // Scan last 30 candles for Order Blocks
  for (let i = Math.max(2, candles.length - 30); i < candles.length - 3; i++) {
    const ob = candles[i]
    const next1 = candles[i + 1]
    const next2 = candles[i + 2]
    const next3 = candles[i + 3]

    // BULLISH OB: Last bearish candle before strong bullish move
    if (
      ob.c < ob.o &&                    // Bearish candle
      next1.c > next1.o &&              // Next bullish
      next2.c > next2.o &&              // Continued bullish
      next3.c > ob.h                    // Strong move above OB high
    ) {
      const obStrength = (next3.c - ob.l) / ob.l
      if (obStrength > 0.005) {
        bullishOB = {
          high: ob.o,
          low: ob.l,
          mid: (ob.o + ob.l) / 2,
          idx: i,
          strength: obStrength,
        }
      }
    }

    // BEARISH OB: Last bullish candle before strong bearish move
    if (
      ob.c > ob.o &&                    // Bullish candle
      next1.c < next1.o &&              // Next bearish
      next2.c < next2.o &&              // Continued bearish
      next3.c < ob.l                    // Strong move below OB low
    ) {
      const obStrength = (ob.h - next3.c) / next3.c
      if (obStrength > 0.005) {
        bearishOB = {
          high: ob.h,
          low: ob.o,
          mid: (ob.h + ob.o) / 2,
          idx: i,
          strength: obStrength,
        }
      }
    }
  }

  // Check if price is reacting to OB
  if (bullishOB && close >= bullishOB.low * 0.998 && close <= bullishOB.high * 1.005) {
    return { signal: 'B', zone: bullishOB, type: 'BULLISH_OB' }
  }
  if (bearishOB && close <= bearishOB.high * 1.002 && close >= bearishOB.low * 0.995) {
    return { signal: 'S', zone: bearishOB, type: 'BEARISH_OB' }
  }

  // Return latest OB even if not at price (for TP/SL targets)
  return {
    signal: 'N',
    bullishOB,
    bearishOB,
  }
}

// ══════════════════════════════════════════
//   2. ICT — FAIR VALUE GAP (FVG)
//   Price Imbalance Zone — ৮০% fill হয়
// ══════════════════════════════════════════
export function detectICT_FVG(candles) {
  if (!candles || candles.length < 10) return { signal: 'N', gap: null }

  const close = candles[candles.length - 1].c
  const fvgs = []

  // Scan for FVG (3-candle pattern)
  for (let i = candles.length - 15; i < candles.length - 1; i++) {
    if (i < 1) continue
    const c1 = candles[i - 1]
    const c2 = candles[i]
    const c3 = candles[i + 1]
    if (!c1 || !c2 || !c3) continue

    // BULLISH FVG: candle[i+1] low > candle[i-1] high
    if (c3.l > c1.h) {
      fvgs.push({
        type: 'BULLISH',
        high: c3.l,
        low: c1.h,
        mid: (c3.l + c1.h) / 2,
        idx: i,
        size: ((c3.l - c1.h) / c1.h) * 100,
      })
    }

    // BEARISH FVG: candle[i+1] high < candle[i-1] low
    if (c3.h < c1.l) {
      fvgs.push({
        type: 'BEARISH',
        high: c1.l,
        low: c3.h,
        mid: (c1.l + c3.h) / 2,
        idx: i,
        size: ((c1.l - c3.h) / c3.h) * 100,
      })
    }
  }

  if (fvgs.length === 0) return { signal: 'N', gap: null }

  // Find most recent unfilled FVG
  const latestBull = fvgs.filter(f => f.type === 'BULLISH').pop()
  const latestBear = fvgs.filter(f => f.type === 'BEARISH').pop()

  // Check if price is in FVG zone (reaction expected)
  if (latestBull && close >= latestBull.low * 0.998 && close <= latestBull.high * 1.005) {
    return { signal: 'B', gap: latestBull, type: 'BULLISH_FVG' }
  }
  if (latestBear && close <= latestBear.high * 1.002 && close >= latestBear.low * 0.995) {
    return { signal: 'S', gap: latestBear, type: 'BEARISH_FVG' }
  }

  return {
    signal: 'N',
    bullishFVG: latestBull,
    bearishFVG: latestBear,
  }
}

// ══════════════════════════════════════════
//   3. ICT — BOS (Break of Structure) & CHoCH
// ══════════════════════════════════════════
export function detectICT_BOS_CHoCH(candles) {
  if (!candles || candles.length < 30) return { signal: 'N' }

  const swingHighs = findSwingHighs(candles, 3)
  const swingLows = findSwingLows(candles, 3)

  if (swingHighs.length < 2 || swingLows.length < 2) return { signal: 'N' }

  const lastHigh = swingHighs[swingHighs.length - 1]
  const prevHigh = swingHighs[swingHighs.length - 2]
  const lastLow = swingLows[swingLows.length - 1]
  const prevLow = swingLows[swingLows.length - 2]

  const close = candles[candles.length - 1].c

  // BULLISH BOS: New HH (price breaks above last swing high)
  if (close > lastHigh.price && lastHigh.price > prevHigh.price) {
    return {
      signal: 'B',
      type: 'BULLISH_BOS',
      breakLevel: lastHigh.price,
      structure: 'HH-HL',
    }
  }

  // BEARISH BOS: New LL (price breaks below last swing low)
  if (close < lastLow.price && lastLow.price < prevLow.price) {
    return {
      signal: 'S',
      type: 'BEARISH_BOS',
      breakLevel: lastLow.price,
      structure: 'LH-LL',
    }
  }

  // CHoCH: Change of Character (trend reversal)
  // From bearish to bullish: HL formed after LL
  if (prevHigh.price < lastHigh.price && prevLow.price < lastLow.price && close > lastHigh.price) {
    return {
      signal: 'B',
      type: 'BULLISH_CHOCH',
      breakLevel: lastHigh.price,
    }
  }
  // From bullish to bearish: LH formed after HH
  if (prevHigh.price > lastHigh.price && prevLow.price > lastLow.price && close < lastLow.price) {
    return {
      signal: 'S',
      type: 'BEARISH_CHOCH',
      breakLevel: lastLow.price,
    }
  }

  return { signal: 'N' }
}

// ══════════════════════════════════════════
//   4. ICT — LIQUIDITY SWEEP (Stop Hunt)
//   Big Players retail traders দের stop hunt করে
// ══════════════════════════════════════════
export function detectICT_LiquiditySweep(candles) {
  if (!candles || candles.length < 20) return { signal: 'N' }

  const last = candles[candles.length - 1]
  const prev = candles[candles.length - 2]
  const lookback = candles.slice(-20, -2)

  const recentHigh = Math.max(...lookback.map(c => c.h))
  const recentLow = Math.min(...lookback.map(c => c.l))

  // BULLISH SWEEP: Price wicks below recent low then closes above
  if (last.l < recentLow && last.c > recentLow && last.c > last.o) {
    return {
      signal: 'B',
      type: 'SWEEP_LOW',
      sweepLevel: recentLow,
      reversalCandle: last,
    }
  }

  // BEARISH SWEEP: Price wicks above recent high then closes below
  if (last.h > recentHigh && last.c < recentHigh && last.c < last.o) {
    return {
      signal: 'S',
      type: 'SWEEP_HIGH',
      sweepLevel: recentHigh,
      reversalCandle: last,
    }
  }

  return { signal: 'N', recentHigh, recentLow }
}

// ══════════════════════════════════════════
//   5. ICT — PREMIUM/DISCOUNT ZONE
//   Fibonacci based — Discount = Buy zone, Premium = Sell zone
// ══════════════════════════════════════════
export function detectICT_PremiumDiscount(candles) {
  if (!candles || candles.length < 50) return { signal: 'N' }

  const range = candles.slice(-50)
  const high = Math.max(...range.map(c => c.h))
  const low = Math.min(...range.map(c => c.l))
  const equilibrium = (high + low) / 2
  const close = candles[candles.length - 1].c

  // Discount zone (below equilibrium) = Bullish opportunity
  const discountZone = low + (equilibrium - low) * 0.5  // 25-50% of range
  // Premium zone (above equilibrium) = Bearish opportunity
  const premiumZone = high - (high - equilibrium) * 0.5  // 75-100% of range

  if (close < discountZone) {
    return { signal: 'B', zone: 'DISCOUNT', level: discountZone, equilibrium }
  }
  if (close > premiumZone) {
    return { signal: 'S', zone: 'PREMIUM', level: premiumZone, equilibrium }
  }

  return { signal: 'N', zone: 'EQUILIBRIUM', equilibrium }
}

// ══════════════════════════════════════════
//   6. CRT — CANDLE RANGE THEORY
//   Modern Smart Money method
//   Range → Manipulation → Distribution
// ══════════════════════════════════════════
export function detectCRT_Pattern(htfCandles, ltfCandles) {
  if (!htfCandles || htfCandles.length < 10) return { signal: 'N' }

  // Step 1: Find Range candle (mother candle) on HTF
  const last3HTF = htfCandles.slice(-3)
  if (last3HTF.length < 3) return { signal: 'N' }

  const [rangeCandle, manipCandle, distCandle] = last3HTF
  if (!rangeCandle || !manipCandle || !distCandle) return { signal: 'N' }

  const rangeHigh = rangeCandle.h
  const rangeLow = rangeCandle.l
  const rangeSize = rangeHigh - rangeLow

  if (rangeSize === 0) return { signal: 'N' }

  // Step 2: Check Manipulation (sweep one side)
  // BULLISH CRT: Manipulation candle sweeps LOW, then closes back inside range
  const sweepedLow = manipCandle.l < rangeLow && manipCandle.c > rangeLow
  // BEARISH CRT: Manipulation candle sweeps HIGH, then closes back inside range
  const sweepedHigh = manipCandle.h > rangeHigh && manipCandle.c < rangeHigh

  // Step 3: Confirmation candle direction
  if (sweepedLow && distCandle.c > distCandle.o && distCandle.c > rangeLow) {
    return {
      signal: 'B',
      type: 'BULLISH_CRT',
      rangeHigh,
      rangeLow,
      sweepLevel: manipCandle.l,
      target: rangeHigh,
    }
  }

  if (sweepedHigh && distCandle.c < distCandle.o && distCandle.c < rangeHigh) {
    return {
      signal: 'S',
      type: 'BEARISH_CRT',
      rangeHigh,
      rangeLow,
      sweepLevel: manipCandle.h,
      target: rangeLow,
    }
  }

  return { signal: 'N', rangeHigh, rangeLow }
}

// ══════════════════════════════════════════
//   7. TBS — THREE BAR SETUP
//   Reversal Entry Confirmation
// ══════════════════════════════════════════
export function detectTBS_Setup(candles) {
  if (!candles || candles.length < 5) return { signal: 'N' }

  const c1 = candles[candles.length - 3]
  const c2 = candles[candles.length - 2]
  const c3 = candles[candles.length - 1]

  if (!c1 || !c2 || !c3) return { signal: 'N' }

  // BULLISH TBS:
  // Bar 1: Bearish (down candle)
  // Bar 2: Lower low than bar 1, can be bull or bear
  // Bar 3: Closes above bar 2 high (reversal)
  if (
    c1.c < c1.o &&                  // Bar 1 bearish
    c2.l < c1.l &&                  // Bar 2 makes lower low
    c3.c > c2.h &&                  // Bar 3 closes above Bar 2 high
    c3.c > c3.o                     // Bar 3 bullish
  ) {
    return {
      signal: 'B',
      type: 'BULLISH_TBS',
      entry: c3.c,
      stopLoss: c2.l,
    }
  }

  // BEARISH TBS:
  // Bar 1: Bullish (up candle)
  // Bar 2: Higher high
  // Bar 3: Closes below bar 2 low
  if (
    c1.c > c1.o &&                  // Bar 1 bullish
    c2.h > c1.h &&                  // Bar 2 makes higher high
    c3.c < c2.l &&                  // Bar 3 closes below Bar 2 low
    c3.c < c3.o                     // Bar 3 bearish
  ) {
    return {
      signal: 'S',
      type: 'BEARISH_TBS',
      entry: c3.c,
      stopLoss: c2.h,
    }
  }

  return { signal: 'N' }
}

// ══════════════════════════════════════════
//   8. VSA — VOLUME SPREAD ANALYSIS
//   Tom Williams Method — Smart Money footprint
// ══════════════════════════════════════════
export function analyzeVSA(candles) {
  if (!candles || candles.length < 20) return { signal: 'N' }

  const last = candles[candles.length - 1]
  const prev = candles[candles.length - 2]
  const volumes = candles.slice(-20).map(c => c.v || 1)
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / 20
  const spreads = candles.slice(-20).map(c => c.h - c.l)
  const avgSpread = spreads.reduce((a, b) => a + b, 0) / 20

  const lastVolume = last.v || 1
  const lastSpread = last.h - last.l
  const isBullCandle = last.c > last.o
  const closePosition = lastSpread > 0 ? (last.c - last.l) / lastSpread : 0.5

  const highVolume = lastVolume > avgVolume * 1.5
  const ultraHighVolume = lastVolume > avgVolume * 2
  const lowVolume = lastVolume < avgVolume * 0.7
  const wideSpread = lastSpread > avgSpread * 1.5
  const narrowSpread = lastSpread < avgSpread * 0.7

  // ── BULLISH SIGNALS ──

  // 1. STOPPING VOLUME (Smart Money buying)
  // High volume + wide spread + close in upper half + after downtrend
  if (highVolume && wideSpread && closePosition > 0.6 && prev.c < prev.o) {
    return { signal: 'B', type: 'STOPPING_VOLUME', strength: 'STRONG' }
  }

  // 2. NO SUPPLY (Bearish move but low volume = weak)
  if (!isBullCandle && lowVolume && narrowSpread) {
    return { signal: 'B', type: 'NO_SUPPLY', strength: 'NORMAL' }
  }

  // 3. SHAKEOUT (Smart Money buying after sweep)
  if (
    last.l < Math.min(...candles.slice(-10, -1).map(c => c.l)) &&
    ultraHighVolume &&
    closePosition > 0.5
  ) {
    return { signal: 'B', type: 'SHAKEOUT', strength: 'ULTRA' }
  }

  // ── BEARISH SIGNALS ──

  // 4. CLIMACTIC VOLUME (Distribution at top)
  if (ultraHighVolume && wideSpread && closePosition < 0.4 && prev.c > prev.o) {
    return { signal: 'S', type: 'CLIMACTIC_VOLUME', strength: 'STRONG' }
  }

  // 5. NO DEMAND (Bullish move but low volume = weak)
  if (isBullCandle && lowVolume && narrowSpread) {
    return { signal: 'S', type: 'NO_DEMAND', strength: 'NORMAL' }
  }

  // 6. UPTHRUST (Stop hunt at top)
  if (
    last.h > Math.max(...candles.slice(-10, -1).map(c => c.h)) &&
    ultraHighVolume &&
    closePosition < 0.5
  ) {
    return { signal: 'S', type: 'UPTHRUST', strength: 'ULTRA' }
  }

  // ── NEUTRAL CHECK ──
  // Volume trend confirmation
  if (highVolume && isBullCandle && closePosition > 0.7) {
    return { signal: 'B', type: 'VOLUME_BULL', strength: 'NORMAL' }
  }
  if (highVolume && !isBullCandle && closePosition < 0.3) {
    return { signal: 'S', type: 'VOLUME_BEAR', strength: 'NORMAL' }
  }

  return { signal: 'N', type: 'NORMAL', avgVolume, lastVolume }
}

// ══════════════════════════════════════════
//   🎯 SMART TP/SL CALCULATOR
//   ICT + ATR + Liquidity Pool based
//   এটাই সবচেয়ে IMPORTANT FUNCTION
//   "TP must hit, SL never touches"
// ══════════════════════════════════════════
export function calculateSmartTP_SL(candles, candleData, direction, smcAnalysis, market) {
  if (!candles || candles.length < 30 || !direction) return null

  const close = candles[candles.length - 1].c
  const atr = calcATR(candles, 14) || close * 0.01

  // ── HTF Data for Major Liquidity Pools ──
  const htfCandles = candleData['4h'] || candleData['1h'] || candles
  const mtfCandles = candleData['1h'] || candleData['30m'] || candles

  // ── Find Swing Points ──
  const swingHighs = findSwingHighs(candles, 3)
  const swingLows = findSwingLows(candles, 3)
  const htfSwingHighs = findSwingHighs(htfCandles, 5)
  const htfSwingLows = findSwingLows(htfCandles, 5)

  // ── Recent Range (for TP3) ──
  const recent50 = candles.slice(-50)
  const recentHigh = Math.max(...recent50.map(c => c.h))
  const recentLow = Math.min(...recent50.map(c => c.l))

  const htfRange = htfCandles.slice(-30)
  const htfHigh = Math.max(...htfRange.map(c => c.h))
  const htfLow = Math.min(...htfRange.map(c => c.l))

  let entry, sl, tp1, tp2, tp3

  if (direction === 'LONG') {
    // ══════════════════════════════════════
    //   LONG SETUP (BUY)
    // ══════════════════════════════════════

    // ── ENTRY ──
    entry = close

    // ── STOP LOSS (Smart Money Logic) ──
    // Priority:
    // 1. Below latest Order Block low
    // 2. Below latest swing low - ATR buffer
    // 3. Below liquidity sweep level - ATR buffer
    // 4. Default: Entry - ATR × 1.5

    const slCandidates = []

    // Option 1: Bullish Order Block low
    if (smcAnalysis?.orderBlocks?.bullishOB?.low) {
      slCandidates.push(smcAnalysis.orderBlocks.bullishOB.low - atr * 0.3)
    }

    // Option 2: Recent swing low
    const recentLows = swingLows.slice(-3).map(s => s.price)
    if (recentLows.length > 0) {
      const nearestLow = Math.max(...recentLows.filter(l => l < entry))
      if (nearestLow && isFinite(nearestLow)) {
        slCandidates.push(nearestLow - atr * 0.5)
      }
    }

    // Option 3: Liquidity sweep level
    if (smcAnalysis?.liquiditySweep?.recentLow) {
      slCandidates.push(smcAnalysis.liquiditySweep.recentLow - atr * 0.3)
    }

    // Option 4: ATR-based safety net
    slCandidates.push(entry - atr * 1.5)

    // Choose HIGHEST SL (closest to entry, smallest risk)
    // But must be below entry
    const validSLs = slCandidates.filter(s => s < entry && s > entry * 0.92)
    sl = validSLs.length > 0 ? Math.max(...validSLs) : entry - atr * 1.5

    // Ensure minimum SL distance (0.5% for futures, 1% for spot)
    const minSLDistance = market === 'futures' ? entry * 0.005 : entry * 0.01
    if (entry - sl < minSLDistance) {
      sl = entry - minSLDistance
    }

    const risk = entry - sl

    // ── TAKE PROFITS (Liquidity Pool based) ──
    // TP1: Nearest resistance / FVG fill / swing high (Quick profit, 50% close)
    // TP2: Major swing high / Premium zone (Medium profit, 30% close)
    // TP3: HTF Range high / Major liquidity (Big profit, 20% close)

    const tpCandidates1 = []
    const tpCandidates2 = []
    const tpCandidates3 = []

    // Nearest swing highs above entry
    const highsAboveEntry = swingHighs
      .map(s => s.price)
      .filter(p => p > entry * 1.003)
      .sort((a, b) => a - b)

    if (highsAboveEntry[0]) tpCandidates1.push(highsAboveEntry[0])
    if (highsAboveEntry[1]) tpCandidates2.push(highsAboveEntry[1])
    if (highsAboveEntry[2]) tpCandidates3.push(highsAboveEntry[2])

    // FVG fill target
    if (smcAnalysis?.fvg?.bearishFVG?.low && smcAnalysis.fvg.bearishFVG.low > entry) {
      tpCandidates1.push(smcAnalysis.fvg.bearishFVG.low)
      tpCandidates2.push(smcAnalysis.fvg.bearishFVG.high)
    }

    // Bearish Order Block (resistance)
    if (smcAnalysis?.orderBlocks?.bearishOB?.low && smcAnalysis.orderBlocks.bearishOB.low > entry) {
      tpCandidates2.push(smcAnalysis.orderBlocks.bearishOB.low)
    }

    // HTF Swing Highs
    const htfHighsAbove = htfSwingHighs
      .map(s => s.price)
      .filter(p => p > entry)
      .sort((a, b) => a - b)
    if (htfHighsAbove[0]) tpCandidates2.push(htfHighsAbove[0])
    if (htfHighsAbove[1]) tpCandidates3.push(htfHighsAbove[1])

    // Range high
    tpCandidates3.push(recentHigh * 0.998)
    if (htfHigh > recentHigh) tpCandidates3.push(htfHigh * 0.995)

    // Risk:Reward based fallback (minimum 1:2)
    const minTP1 = entry + risk * 1.5
    const minTP2 = entry + risk * 2.5
    const minTP3 = entry + risk * 4

    tp1 = tpCandidates1.length > 0 ? Math.min(...tpCandidates1.filter(t => t > entry)) : minTP1
    tp2 = tpCandidates2.length > 0 ? Math.min(...tpCandidates2.filter(t => t > tp1)) : minTP2
    tp3 = tpCandidates3.length > 0 ? Math.max(...tpCandidates3.filter(t => t > tp2)) : minTP3

    // Safety: Ensure TPs progress
    if (tp1 <= entry) tp1 = entry + risk * 1.5
    if (tp2 <= tp1) tp2 = tp1 + risk * 1
    if (tp3 <= tp2) tp3 = tp2 + risk * 1.5

    // Cap maximum TP3 (don't go too far)
    const maxTP3 = entry + risk * 6
    if (tp3 > maxTP3) tp3 = maxTP3

  } else {
    // ══════════════════════════════════════
    //   SHORT SETUP (SELL)
    // ══════════════════════════════════════

    entry = close

    const slCandidates = []

    // Option 1: Bearish Order Block high
    if (smcAnalysis?.orderBlocks?.bearishOB?.high) {
      slCandidates.push(smcAnalysis.orderBlocks.bearishOB.high + atr * 0.3)
    }

    // Option 2: Recent swing high
    const recentHighs = swingHighs.slice(-3).map(s => s.price)
    if (recentHighs.length > 0) {
      const nearestHigh = Math.min(...recentHighs.filter(h => h > entry))
      if (nearestHigh && isFinite(nearestHigh)) {
        slCandidates.push(nearestHigh + atr * 0.5)
      }
    }

    // Option 3: Liquidity sweep level
    if (smcAnalysis?.liquiditySweep?.recentHigh) {
      slCandidates.push(smcAnalysis.liquiditySweep.recentHigh + atr * 0.3)
    }

    // Option 4: ATR-based safety
    slCandidates.push(entry + atr * 1.5)

    // Choose LOWEST SL (closest to entry, smallest risk)
    const validSLs = slCandidates.filter(s => s > entry && s < entry * 1.08)
    sl = validSLs.length > 0 ? Math.min(...validSLs) : entry + atr * 1.5

    // Minimum SL distance
    const minSLDistance = market === 'futures' ? entry * 0.005 : entry * 0.01
    if (sl - entry < minSLDistance) {
      sl = entry + minSLDistance
    }

    const risk = sl - entry

    // ── TAKE PROFITS ──
    const tpCandidates1 = []
    const tpCandidates2 = []
    const tpCandidates3 = []

    // Nearest swing lows below entry
    const lowsBelowEntry = swingLows
      .map(s => s.price)
      .filter(p => p < entry * 0.997)
      .sort((a, b) => b - a)

    if (lowsBelowEntry[0]) tpCandidates1.push(lowsBelowEntry[0])
    if (lowsBelowEntry[1]) tpCandidates2.push(lowsBelowEntry[1])
    if (lowsBelowEntry[2]) tpCandidates3.push(lowsBelowEntry[2])

    // Bullish FVG fill
    if (smcAnalysis?.fvg?.bullishFVG?.high && smcAnalysis.fvg.bullishFVG.high < entry) {
      tpCandidates1.push(smcAnalysis.fvg.bullishFVG.high)
      tpCandidates2.push(smcAnalysis.fvg.bullishFVG.low)
    }

    // Bullish Order Block (support)
    if (smcAnalysis?.orderBlocks?.bullishOB?.high && smcAnalysis.orderBlocks.bullishOB.high < entry) {
      tpCandidates2.push(smcAnalysis.orderBlocks.bullishOB.high)
    }

    // HTF Swing Lows
    const htfLowsBelow = htfSwingLows
      .map(s => s.price)
      .filter(p => p < entry)
      .sort((a, b) => b - a)
    if (htfLowsBelow[0]) tpCandidates2.push(htfLowsBelow[0])
    if (htfLowsBelow[1]) tpCandidates3.push(htfLowsBelow[1])

    // Range low
    tpCandidates3.push(recentLow * 1.002)
    if (htfLow < recentLow) tpCandidates3.push(htfLow * 1.005)

    const minTP1 = entry - risk * 1.5
    const minTP2 = entry - risk * 2.5
    const minTP3 = entry - risk * 4

    tp1 = tpCandidates1.length > 0 ? Math.max(...tpCandidates1.filter(t => t < entry)) : minTP1
    tp2 = tpCandidates2.length > 0 ? Math.max(...tpCandidates2.filter(t => t < tp1)) : minTP2
    tp3 = tpCandidates3.length > 0 ? Math.min(...tpCandidates3.filter(t => t < tp2)) : minTP3

    if (tp1 >= entry) tp1 = entry - risk * 1.5
    if (tp2 >= tp1) tp2 = tp1 - risk * 1
    if (tp3 >= tp2) tp3 = tp2 - risk * 1.5

    const maxTP3 = entry - risk * 6
    if (tp3 < maxTP3) tp3 = maxTP3
  }

  // ══════════════════════════════════════
  //   Format Output
  // ══════════════════════════════════════
  const risk = Math.abs(entry - sl)
  const reward = Math.abs(tp3 - entry)
  const rr = risk > 0 ? (reward / risk).toFixed(2) : '0'

  // Recommended Leverage (Futures)
  let leverage = '3x-5x'
  if (market === 'futures') {
    const riskPct = (risk / entry) * 100
    if (riskPct < 1) leverage = '10x-20x'
    else if (riskPct < 2) leverage = '5x-10x'
    else if (riskPct < 3) leverage = '3x-5x'
    else leverage = '2x-3x'
  }

  // Decimal precision based on price
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
    atrValue: +atr.toFixed(precision),
    closePosition: market === 'futures' ? [50, 30, 20] : [40, 35, 25],
  }
}

// ══════════════════════════════════════════
//   EXPORT ALL FUNCTIONS
// ══════════════════════════════════════════
export default {
  detectICT_OrderBlocks,
  detectICT_FVG,
  detectICT_BOS_CHoCH,
  detectICT_LiquiditySweep,
  detectICT_PremiumDiscount,
  detectCRT_Pattern,
  detectTBS_Setup,
  analyzeVSA,
  calculateSmartTP_SL,
                       }
