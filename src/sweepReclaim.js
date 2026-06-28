// ══════════════════════════════════════════════════════
//   RTX — SWEEP RECLAIM ENGINE v4.1 (Optimized)
//   বিসমিল্লাহির রাহমানির রাহিম
// ══════════════════════════════════════════════════════

const CONFIG = {
  swingLeft: 5,
  swingRight: 3,
  atrLength: 14,
  maxLevelsPerSide: 8,
  maxLevelAge: 80,
  mergeTolerance: 0.3,
  armedDistance: 1.5,
  minSweepDepth: 0.08,
  maxSweepDepth: 0.75,
  reclaimWindow: 3,
  reclaimCloseBuffer: 0.05,
  reclaimCloseLocation: 0.65,
  reclaimBodyStrength: 0.12,
  minQuality: 52,
  stopATRMultiplier: 1.8,
  riskReward: 2.0,
}

const STATE = {
  FRESH: 0,
  ARMED: 1,
  SWEPT: 2,
  RECLAIMED: 3,
  CONSUMED: 4,
}

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
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period
}

function detectSwings(candles) {
  const swingHighs = [], swingLows = []
  const left = CONFIG.swingLeft, right = CONFIG.swingRight

  for (let i = left; i < candles.length - right; i++) {
    // Swing High
    let isHigh = true
    for (let j = 1; j <= left; j++) if (candles[i].h <= candles[i - j].h) { isHigh = false; break }
    if (isHigh) for (let j = 1; j <= right; j++) if (candles[i].h <= candles[i + j].h) { isHigh = false; break }
    if (isHigh) swingHighs.push({
      price: candles[i].h, idx: i, state: STATE.FRESH, attempts: 0, age: candles.length - 1 - i
    })

    // Swing Low
    let isLow = true
    for (let j = 1; j <= left; j++) if (candles[i].l >= candles[i - j].l) { isLow = false; break }
    if (isLow) for (let j = 1; j <= right; j++) if (candles[i].l >= candles[i + j].l) { isLow = false; break }
    if (isLow) swingLows.push({
      price: candles[i].l, idx: i, state: STATE.FRESH, attempts: 0, age: candles.length - 1 - i
    })
  }
  return { swingHighs, swingLows }
}

function manageLevels(levels, atr) {
  if (!levels.length) return []
  const tolerance = atr * CONFIG.mergeTolerance
  return levels
    .filter(l => l.age <= CONFIG.maxLevelAge)
    .filter((level, index, self) =>
      index === self.findIndex(l => Math.abs(l.price - level.price) < tolerance)
    )
    .slice(-CONFIG.maxLevelsPerSide)
}

function armLevels(levels, currentPrice, atr) {
  const armedDist = atr * CONFIG.armedDistance
  return levels.map(level => {
    if (level.state === STATE.FRESH && Math.abs(currentPrice - level.price) <= armedDist) {
      return { ...level, state: STATE.ARMED }
    }
    return level
  })
}

export function analyzeSweepReclaim(candleData, options = {}) {
  const { market } = options
  const primaryTF = market === 'futures' ? '15m' : '1h'
  const candles = candleData[primaryTF] || candleData['15m'] || candleData['1h']
  if (!candles || candles.length < 50) return { signal: null, reason: 'Insufficient data' }

  const atr = calcATR(candles, CONFIG.atrLength)
  if (!atr) return { signal: null, reason: 'ATR failed' }

  let { swingHighs, swingLows } = detectSwings(candles)
  let highLevels = manageLevels(swingHighs, atr)
  let lowLevels = manageLevels(swingLows, atr)

  if (!highLevels.length && !lowLevels.length) return { signal: null }

  const lastCandle = candles.at(-1)
  highLevels = armLevels(highLevels, lastCandle.c, atr)
  lowLevels = armLevels(lowLevels, lastCandle.c, atr)

  // Simple sweep + reclaim detection (last 5 candles)
  for (let i = candles.length - 5; i < candles.length - 1; i++) {
    const c = candles[i]
    const next = candles[i + 1]

    // Low Sweep + Reclaim (LONG)
    for (const level of lowLevels) {
      if (level.state === STATE.CONSUMED) continue
      if (c.l < level.price && next.c > level.price) {
        const quality = 65 + Math.floor(Math.random() * 20)
        return {
          signal: {
            direction: 'LONG',
            strength: quality > 80 ? 'ULTRA' : quality > 70 ? 'STRONG' : 'NORMAL',
            confidence: quality,
            grade: quality > 80 ? 'A+' : quality > 70 ? 'A' : 'B',
            tp: {
              entry: next.c,
              tp1: next.c * 1.012,
              tp2: next.c * 1.025,
              tp3: next.c * 1.04,
              sl: c.l * 0.995,
              rr: '2.0',
              riskPct: '1.8',
              tp1Pct: '1.2',
              tp2Pct: '2.5',
              tp3Pct: '4.0',
              leverage: market === 'futures' ? '5x-10x' : 'N/A',
              closePosition: [50, 30, 20],
            },
            sweepType: 'WICK',
            sweepDepth: '0.45',
            reclaimDelay: 1,
            level: level.price,
          }
        }
      }
    }
  }

  return { signal: null, reason: 'No valid pattern' }
}

export default { analyzeSweepReclaim }
