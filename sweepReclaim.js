// ══════════════════════════════════════════════════════
//   RTX — SWEEP RECLAIM ENGINE
//   Exact JS Implementation of TradingView Strategy
//   "Sweep Reclaim Entry Engine" by trade_w_samet
//   
//   Stages:
//   1. Confirmed Swing → 2. Armed → 3. Swept
//   4. Reclaimed → 5. Quality Score → 6. Entry
//
//   বিসমিল্লাহির রাহমানির রাহিম
// ══════════════════════════════════════════════════════

// ══════════════════════════════════════════
//   CONFIG
// ══════════════════════════════════════════
const CONFIG = {
  // Swing Detection
  swingLeft: 5,
  swingRight: 3,

  // ATR
  atrLength: 14,

  // Level Management
  maxLevelsPerSide: 10,
  maxLevelAge: 100,
  mergeTolerance: 0.3,    // ATR units
  armedDistance: 1.5,      // ATR units
  breakoutInvalidation: 2.0, // ATR units

  // Sweep Detection
  minSweepDepth: 0.05,    // ATR units
  maxSweepDepth: 0.80,    // ATR units
  firstPenetrationOnly: true,

  // Reclaim
  reclaimWindow: 3,       // candles
  reclaimCloseBuffer: 0.05, // ATR units
  reclaimCloseLocation: 0.70,
  reclaimBodyStrength: 0.15, // ATR units
  reclaimWickThreshold: 0.28,
  requireDirectionalCandle: true,

  // Quality
  minQuality: 55,         // 0-100

  // TP/SL
  stopATRMultiplier: 2.0,
  stopBufferATR: 0.10,
  riskReward: 2.0,
  useEntryATRStop: false,  // false = use sweep extreme
}

// ══════════════════════════════════════════
//   LEVEL STATES
// ══════════════════════════════════════════
const STATE = {
  FRESH: 0,
  ARMED: 1,
  SWEPT: 2,
  RECLAIMED: 3,
  CONSUMED: 4,
}

// ══════════════════════════════════════════
//   ATR CALCULATOR
// ══════════════════════════════════════════
function calcATR(candles, period = 14) {
  if (!candles || candles.length < period + 1) return null
  const trs = []
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].h - candles[i].l,
      Math.abs(candles[i].h - candles[i - 1].c),
      Math.abs(candles[i].l - candles[i - 1].c)
    )
    trs.push(tr)
  }
  if (trs.length < period) return null
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period
}

// ══════════════════════════════════════════
//   SWING DETECTION (Pivot High/Low)
// ══════════════════════════════════════════
function detectSwings(candles) {
  const swingHighs = []
  const swingLows = []
  const left = CONFIG.swingLeft
  const right = CONFIG.swingRight

  for (let i = left; i < candles.length - right; i++) {
    // Check Swing High
    let isHigh = true
    for (let j = 1; j <= left; j++) {
      if (candles[i].h <= candles[i - j].h) { isHigh = false; break }
    }
    if (isHigh) {
      for (let j = 1; j <= right; j++) {
        if (candles[i].h <= candles[i + j].h) { isHigh = false; break }
      }
    }
    if (isHigh) {
      swingHighs.push({
        price: candles[i].h,
        idx: i,
        bar: candles[i].t || i,
        state: STATE.FRESH,
        attempts: 0,
        sweepBar: -1,
        sweepDepth: 0,
        sweepExtreme: 0,
        sweepType: null,
        reclaimBar: -1,
        age: candles.length - 1 - i,
      })
    }

    // Check Swing Low
    let isLow = true
    for (let j = 1; j <= left; j++) {
      if (candles[i].l >= candles[i - j].l) { isLow = false; break }
    }
    if (isLow) {
      for (let j = 1; j <= right; j++) {
        if (candles[i].l >= candles[i + j].l) { isLow = false; break }
      }
    }
    if (isLow) {
      swingLows.push({
        price: candles[i].l,
        idx: i,
        bar: candles[i].t || i,
        state: STATE.FRESH,
        attempts: 0,
        sweepBar: -1,
        sweepDepth: 0,
        sweepExtreme: 0,
        sweepType: null,
        reclaimBar: -1,
        age: candles.length - 1 - i,
      })
    }
  }

  return { swingHighs, swingLows }
}

// ══════════════════════════════════════════
//   LEVEL MANAGEMENT (Merge + Filter)
// ══════════════════════════════════════════
function manageLevels(levels, atr) {
  if (!levels || levels.length === 0) return []
  const tolerance = atr * CONFIG.mergeTolerance

  // Remove old levels
  const active = levels.filter(l => l.age <= CONFIG.maxLevelAge)

  // Merge close levels (keep stronger/newer)
  const merged = []
  for (const level of active) {
    const duplicate = merged.find(m =>
      Math.abs(m.price - level.price) < tolerance
    )
    if (!duplicate) {
      merged.push({ ...level })
    }
    // Keep newer one if duplicate
  }

  // Keep max levels
  return merged.slice(-CONFIG.maxLevelsPerSide)
}

// ══════════════════════════════════════════
//   ARM LEVELS (Price approaching)
// ══════════════════════════════════════════
function armLevels(levels, currentPrice, atr) {
  const armedDist = atr * CONFIG.armedDistance

  return levels.map(level => {
    if (level.state === STATE.FRESH) {
      const dist = Math.abs(currentPrice - level.price)
      if (dist <= armedDist) {
        return { ...level, state: STATE.ARMED }
      }
    }
    return level
  })
}

// ══════════════════════════════════════════
//   SWEEP DETECTION
// ══════════════════════════════════════════
function detectSweeps(levels, candle, atr, side) {
  const minDepth = atr * CONFIG.minSweepDepth
  const maxDepth = atr * CONFIG.maxSweepDepth

  return levels.map(level => {
    if (level.state !== STATE.FRESH && level.state !== STATE.ARMED) {
      return level
    }

    // First penetration check
    if (CONFIG.firstPenetrationOnly && level.attempts > 0) {
      return { ...level, state: STATE.CONSUMED }
    }

    let swept = false
    let sweepDepth = 0
    let sweepExtreme = 0
    let sweepType = null

    if (side === 'high') {
      // HIGH SWEEP: price goes ABOVE swing high
      if (candle.h > level.price) {
        sweepDepth = candle.h - level.price
        sweepExtreme = candle.h

        // Wick only check (close stays below level)
        if (candle.c <= level.price) {
          sweepType = 'WICK'
          swept = true
        }
        // Body penetration (close goes above too)
        else if (candle.c > level.price) {
          sweepType = 'BODY'
          swept = true
        }
      }
    } else {
      // LOW SWEEP: price goes BELOW swing low
      if (candle.l < level.price) {
        sweepDepth = level.price - candle.l
        sweepExtreme = candle.l

        // Wick only check (close stays above level)
        if (candle.c >= level.price) {
          sweepType = 'WICK'
          swept = true
        }
        // Body penetration
        else if (candle.c < level.price) {
          sweepType = 'BODY'
          swept = true
        }
      }
    }

    if (swept && sweepDepth >= minDepth && sweepDepth <= maxDepth) {
      return {
        ...level,
        state: STATE.SWEPT,
        attempts: level.attempts + 1,
        sweepBar: 0, // current candle
        sweepDepth: sweepDepth / atr,
        sweepExtreme,
        sweepType,
      }
    }

    // Track attempt even if not valid sweep
    if (side === 'high' && candle.h > level.price) {
      return { ...level, attempts: level.attempts + 1 }
    }
    if (side === 'low' && candle.l < level.price) {
      return { ...level, attempts: level.attempts + 1 }
    }

    return level
  })
}

// ══════════════════════════════════════════
//   RECLAIM DETECTION
// ══════════════════════════════════════════
function detectReclaims(levels, candle, atr, side, barsAfterSweep) {
  const buffer = atr * CONFIG.reclaimCloseBuffer
  const minBody = atr * CONFIG.reclaimBodyStrength

  return levels.map(level => {
    if (level.state !== STATE.SWEPT) return level

    // Check reclaim window
    const barsSince = barsAfterSweep || 0
    if (barsSince > CONFIG.reclaimWindow) {
      return { ...level, state: STATE.CONSUMED } // Timeout
    }

    let reclaimed = false
    const body = Math.abs(candle.c - candle.o)
    const range = candle.h - candle.l || 0.00001

    if (side === 'low') {
      // BULLISH RECLAIM: price closes back ABOVE swing low
      const closeAbove = candle.c >= level.price + buffer
      const closeLocation = range > 0 ? (candle.c - candle.l) / range : 0
      const bodyStrong = body >= minBody
      const isBullish = candle.c > candle.o
      const directionOk = !CONFIG.requireDirectionalCandle || isBullish

      // Wick rejection (for same-candle reclaims)
      const lowerWick = Math.min(candle.o, candle.c) - candle.l
      const wickRatio = range > 0 ? lowerWick / range : 0
      const sameCandle = barsSince === 0
      const wickOk = !sameCandle || wickRatio >= CONFIG.reclaimWickThreshold

      if (closeAbove && closeLocation >= CONFIG.reclaimCloseLocation &&
          bodyStrong && directionOk && wickOk) {
        reclaimed = true
      }
    } else {
      // BEARISH RECLAIM: price closes back BELOW swing high
      const closeBelow = candle.c <= level.price - buffer
      const closeLocation = range > 0 ? (candle.h - candle.c) / range : 0
      const bodyStrong = body >= minBody
      const isBearish = candle.c < candle.o
      const directionOk = !CONFIG.requireDirectionalCandle || isBearish

      // Wick rejection
      const upperWick = candle.h - Math.max(candle.o, candle.c)
      const wickRatio = range > 0 ? upperWick / range : 0
      const sameCandle = barsSince === 0
      const wickOk = !sameCandle || wickRatio >= CONFIG.reclaimWickThreshold

      if (closeBelow && closeLocation >= CONFIG.reclaimCloseLocation &&
          bodyStrong && directionOk && wickOk) {
        reclaimed = true
      }
    }

    if (reclaimed) {
      return { ...level, state: STATE.RECLAIMED, reclaimBar: 0 }
    }

    return level
  })
}

// ══════════════════════════════════════════
//   QUALITY SCORING (0-100)
// ══════════════════════════════════════════
function calcQualityScore(level, candle, atr, side, volume, avgVolume) {
  let score = 0

  // 1. Sweep Depth (max 15)
  const depthATR = level.sweepDepth || 0
  const depthRange = CONFIG.maxSweepDepth - CONFIG.minSweepDepth
  if (depthRange > 0) {
    // Best score at 40-60% of range (controlled sweep)
    const depthPct = (depthATR - CONFIG.minSweepDepth) / depthRange
    const depthScore = depthPct < 0.5
      ? depthPct * 2 * 15
      : (1 - (depthPct - 0.5) * 1.5) * 15
    score += Math.max(0, Math.min(15, depthScore))
  }

  // 2. Reclaim Close (max 20)
  const range = candle.h - candle.l || 0.00001
  if (side === 'low') {
    const closePos = (candle.c - candle.l) / range
    score += Math.min(20, closePos * 25)
  } else {
    const closePos = (candle.h - candle.c) / range
    score += Math.min(20, closePos * 25)
  }

  // 3. Wick Rejection (max 15)
  if (side === 'low') {
    const lowerWick = Math.min(candle.o, candle.c) - candle.l
    const wickPct = range > 0 ? lowerWick / range : 0
    score += Math.min(15, wickPct * 40)
  } else {
    const upperWick = candle.h - Math.max(candle.o, candle.c)
    const wickPct = range > 0 ? upperWick / range : 0
    score += Math.min(15, wickPct * 40)
  }

  // 4. Level Freshness (max 10)
  const agePct = Math.max(0, 1 - (level.age || 0) / CONFIG.maxLevelAge)
  score += agePct * 10

  // 5. Relative Volume (max 10)
  if (volume && avgVolume && avgVolume > 0) {
    const relVol = volume / avgVolume
    score += Math.min(10, (relVol - 0.5) * 10)
  } else {
    score += 5 // neutral if no volume
  }

  // 6. Displacement (max 15)
  const body = Math.abs(candle.c - candle.o)
  const bodyATR = atr > 0 ? body / atr : 0
  const distBeyond = side === 'low'
    ? Math.max(0, candle.c - level.price) / atr
    : Math.max(0, level.price - candle.c) / atr
  score += Math.min(15, (bodyATR * 8) + (distBeyond * 7))

  // 7. Market Condition (max 10)
  const rangeATR = atr > 0 ? range / atr : 0
  if (rangeATR > 0.5 && rangeATR < 3) {
    score += 10 // Good volatility
  } else if (rangeATR >= 0.3) {
    score += 6
  } else {
    score += 3
  }

  // 8. Level Cleanliness (max 5)
  const attempts = level.attempts || 1
  score += Math.max(0, 5 - (attempts - 1) * 2)

  return Math.round(Math.max(0, Math.min(100, score)))
}

// ══════════════════════════════════════════
//   GRADE ASSIGNMENT
// ══════════════════════════════════════════
function assignGrade(quality) {
  if (quality >= 85) return 'A+'
  if (quality >= 70) return 'A'
  if (quality >= 55) return 'B'
  return 'C'
}

// ══════════════════════════════════════════
//   TP/SL CALCULATOR (Sweep Extreme based)
// ══════════════════════════════════════════
function calcTPSL(entry, sweepExtreme, direction, atr, market) {
  let sl, tp, risk

  if (direction === 'LONG') {
    if (CONFIG.useEntryATRStop) {
      sl = entry - atr * CONFIG.stopATRMultiplier
    } else {
      sl = sweepExtreme - atr * CONFIG.stopBufferATR
    }

    // Minimum SL distance
    const minSL = market === 'futures' ? entry * 0.003 : entry * 0.005
    if (entry - sl < minSL) sl = entry - minSL

    risk = entry - sl
    tp = entry + risk * CONFIG.riskReward

  } else {
    if (CONFIG.useEntryATRStop) {
      sl = entry + atr * CONFIG.stopATRMultiplier
    } else {
      sl = sweepExtreme + atr * CONFIG.stopBufferATR
    }

    const minSL = market === 'futures' ? entry * 0.003 : entry * 0.005
    if (sl - entry < minSL) sl = entry + minSL

    risk = sl - entry
    tp = entry - risk * CONFIG.riskReward
  }

  // TP2 and TP3
  const tp2 = direction === 'LONG'
    ? entry + risk * (CONFIG.riskReward * 1.5)
    : entry - risk * (CONFIG.riskReward * 1.5)

  const tp3 = direction === 'LONG'
    ? entry + risk * (CONFIG.riskReward * 2.5)
    : entry - risk * (CONFIG.riskReward * 2.5)

  const precision = entry < 0.01 ? 8 : entry < 1 ? 6 : entry < 100 ? 4 : 2

  return {
    entry: +entry.toFixed(precision),
    tp1: +tp.toFixed(precision),
    tp2: +tp2.toFixed(precision),
    tp3: +tp3.toFixed(precision),
    sl: +sl.toFixed(precision),
    rr: CONFIG.riskReward.toFixed(1),
    riskPct: ((risk / entry) * 100).toFixed(2),
    tp1Pct: ((Math.abs(tp - entry) / entry) * 100).toFixed(2),
    tp2Pct: ((Math.abs(tp2 - entry) / entry) * 100).toFixed(2),
    tp3Pct: ((Math.abs(tp3 - entry) / entry) * 100).toFixed(2),
    leverage: market === 'futures'
      ? (risk / entry * 100 < 1 ? '10x-20x' : risk / entry * 100 < 2 ? '5x-10x' : '3x-5x')
      : 'N/A',
    closePosition: [50, 30, 20],
    sweepExtreme: +sweepExtreme.toFixed(precision),
  }
}

// ══════════════════════════════════════════
//   MAIN SWEEP RECLAIM ANALYZER
// ══════════════════════════════════════════
export function analyzeSweepReclaim(candleData, options = {}) {
  const { coin, market } = options

  // Get primary timeframe candles
  const primaryTF = market === 'futures' ? '15m' : '1h'
  const candles = candleData[primaryTF] || candleData['15m'] || candleData['1h'] || candleData['5m']

  if (!candles || candles.length < 50) {
    return { signal: null, reason: 'Insufficient data' }
  }

  const atr = calcATR(candles, CONFIG.atrLength)
  if (!atr || atr === 0) {
    return { signal: null, reason: 'ATR calculation failed' }
  }

  // Step 1: Detect Swings
  const { swingHighs, swingLows } = detectSwings(candles)

  // Step 2: Manage Levels
  let highLevels = manageLevels(swingHighs, atr)
  let lowLevels = manageLevels(swingLows, atr)

  if (highLevels.length === 0 && lowLevels.length === 0) {
    return { signal: null, reason: 'No swing levels found' }
  }

  // Step 3: Process each candle for sweep + reclaim
  const lastCandle = candles[candles.length - 1]
  const currentPrice = lastCandle.c

  // Arm levels
  highLevels = armLevels(highLevels, currentPrice, atr)
  lowLevels = armLevels(lowLevels, currentPrice, atr)

  // Check last few candles for sweep + reclaim pattern
  let bestSignal = null
  let bestQuality = 0

  for (let lookback = 0; lookback < Math.min(CONFIG.reclaimWindow + 1, 5); lookback++) {
    const sweepIdx = candles.length - 1 - lookback

    if (sweepIdx < 1) continue

    const sweepCandle = candles[sweepIdx]

    // Try LOW sweeps (bullish setup)
    for (const level of lowLevels) {
      if (level.state === STATE.CONSUMED) continue

      // Check sweep on this candle
      const sweepDepth = level.price - sweepCandle.l
      const sweepDepthATR = sweepDepth / atr

      if (sweepCandle.l < level.price &&
          sweepDepthATR >= CONFIG.minSweepDepth &&
          sweepDepthATR <= CONFIG.maxSweepDepth) {

        // Check reclaim on later candles
        for (let reclaimOffset = 0; reclaimOffset <= CONFIG.reclaimWindow; reclaimOffset++) {
          const reclaimIdx = sweepIdx + reclaimOffset
          if (reclaimIdx >= candles.length) break

          const reclaimCandle = candles[reclaimIdx]
          const body = Math.abs(reclaimCandle.c - reclaimCandle.o)
          const range = reclaimCandle.h - reclaimCandle.l || 0.00001
          const buffer = atr * CONFIG.reclaimCloseBuffer
          const minBody = atr * CONFIG.reclaimBodyStrength

          const closeAbove = reclaimCandle.c >= level.price + buffer
          const closePos = (reclaimCandle.c - reclaimCandle.l) / range
          const bodyOk = body >= minBody
          const bullish = reclaimCandle.c > reclaimCandle.o
          const dirOk = !CONFIG.requireDirectionalCandle || bullish

          if (closeAbove && closePos >= CONFIG.reclaimCloseLocation && bodyOk && dirOk) {
            // Calculate volume
            const volumes = candles.slice(-20).map(c => c.v || 1)
            const avgVol = volumes.reduce((a, b) => a + b, 0) / 20

            const sweepLevel = {
              ...level,
              sweepDepth: sweepDepthATR,
              sweepExtreme: sweepCandle.l,
              age: candles.length - 1 - level.idx,
            }

            const quality = calcQualityScore(sweepLevel, reclaimCandle, atr, 'low', reclaimCandle.v, avgVol)
            const grade = assignGrade(quality)

            if (quality >= CONFIG.minQuality && quality > bestQuality) {
              bestQuality = quality
              bestSignal = {
                direction: 'LONG',
                strength: grade === 'A+' ? 'ULTRA' : grade === 'A' ? 'STRONG' : 'NORMAL',
                confidence: quality,
                grade,
                sweepType: sweepCandle.c >= level.price ? 'WICK' : 'BODY',
                sweepDepth: sweepDepthATR.toFixed(2),
                reclaimDelay: reclaimOffset,
                level: level.price,
                tp: calcTPSL(reclaimCandle.c, sweepCandle.l, 'LONG', atr, market),
              }
            }
          }
        }
      }
    }

    // Try HIGH sweeps (bearish setup)
    for (const level of highLevels) {
      if (level.state === STATE.CONSUMED) continue

      const sweepDepth = sweepCandle.h - level.price
      const sweepDepthATR = sweepDepth / atr

      if (sweepCandle.h > level.price &&
          sweepDepthATR >= CONFIG.minSweepDepth &&
          sweepDepthATR <= CONFIG.maxSweepDepth) {

        for (let reclaimOffset = 0; reclaimOffset <= CONFIG.reclaimWindow; reclaimOffset++) {
          const reclaimIdx = sweepIdx + reclaimOffset
          if (reclaimIdx >= candles.length) break

          const reclaimCandle = candles[reclaimIdx]
          const body = Math.abs(reclaimCandle.c - reclaimCandle.o)
          const range = reclaimCandle.h - reclaimCandle.l || 0.00001
          const buffer = atr * CONFIG.reclaimCloseBuffer
          const minBody = atr * CONFIG.reclaimBodyStrength

          const closeBelow = reclaimCandle.c <= level.price - buffer
          const closePos = (reclaimCandle.h - reclaimCandle.c) / range
          const bodyOk = body >= minBody
          const bearish = reclaimCandle.c < reclaimCandle.o
          const dirOk = !CONFIG.requireDirectionalCandle || bearish

          if (closeBelow && closePos >= CONFIG.reclaimCloseLocation && bodyOk && dirOk) {
            const volumes = candles.slice(-20).map(c => c.v || 1)
            const avgVol = volumes.reduce((a, b) => a + b, 0) / 20

            const sweepLevel = {
              ...level,
              sweepDepth: sweepDepthATR,
              sweepExtreme: sweepCandle.h,
              age: candles.length - 1 - level.idx,
            }

            const quality = calcQualityScore(sweepLevel, reclaimCandle, atr, 'high', reclaimCandle.v, avgVol)
            const grade = assignGrade(quality)

            if (quality >= CONFIG.minQuality && quality > bestQuality) {
              bestQuality = quality
              bestSignal = {
                direction: 'SHORT',
                strength: grade === 'A+' ? 'ULTRA' : grade === 'A' ? 'STRONG' : 'NORMAL',
                confidence: quality,
                grade,
                sweepType: sweepCandle.c <= level.price ? 'WICK' : 'BODY',
                sweepDepth: sweepDepthATR.toFixed(2),
                reclaimDelay: reclaimOffset,
                level: level.price,
                tp: calcTPSL(reclaimCandle.c, sweepCandle.h, 'SHORT', atr, market),
              }
            }
          }
        }
      }
    }
  }

  if (!bestSignal) {
    return { signal: null, reason: 'No sweep reclaim pattern found' }
  }

  return {
    signal: bestSignal,
    swingHighs: highLevels.length,
    swingLows: lowLevels.length,
    atr: atr.toFixed(6),
  }
}

export default { analyzeSweepReclaim }
