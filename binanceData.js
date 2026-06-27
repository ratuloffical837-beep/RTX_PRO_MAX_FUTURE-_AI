// ══════════════════════════════════════════════════════
//   RTX — BINANCE DATA FETCHER
//   Safe data fetch with retry + rate limit protection
//   বিসমিল্লাহির রাহমানির রাহিম
// ══════════════════════════════════════════════════════

import fetch from 'node-fetch'

// ── Rate Limiter ──
let lastFetchTime = 0
const MIN_FETCH_GAP = 100 // 100ms between requests

async function rateLimitedFetch(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Rate limit gap
      const now = Date.now()
      const gap = now - lastFetchTime
      if (gap < MIN_FETCH_GAP) {
        await new Promise(r => setTimeout(r, MIN_FETCH_GAP - gap))
      }
      lastFetchTime = Date.now()

      const res = await fetch(url, { timeout: 15000 })

      if (res.status === 429) {
        // Rate limited — wait and retry
        const wait = Math.pow(2, attempt) * 1000
        console.log(`⚠️ Rate limited, waiting ${wait}ms (attempt ${attempt})`)
        await new Promise(r => setTimeout(r, wait))
        continue
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      return data

    } catch (e) {
      if (attempt === retries) {
        console.error(`❌ Fetch failed after ${retries} attempts: ${url}`, e.message)
        return null
      }
      const wait = Math.pow(2, attempt) * 500
      console.log(`🔄 Retry ${attempt}/${retries} in ${wait}ms`)
      await new Promise(r => setTimeout(r, wait))
    }
  }
  return null
}

// ══════════════════════════════════════════
//   FETCH KLINES (Candle Data)
// ══════════════════════════════════════════
export async function fetchKlines(symbol, interval, limit, market = 'spot') {
  const baseURL = market === 'futures'
    ? 'https://fapi.binance.com/fapi/v1/klines'
    : 'https://api.binance.com/api/v3/klines'

  const url = `${baseURL}?symbol=${symbol}&interval=${interval}&limit=${limit}`
  const data = await rateLimitedFetch(url)

  if (!data || !Array.isArray(data)) return null

  return data.map(k => ({
    t: k[0],
    o: parseFloat(k[1]),
    h: parseFloat(k[2]),
    l: parseFloat(k[3]),
    c: parseFloat(k[4]),
    v: parseFloat(k[5]),
  }))
}

// ══════════════════════════════════════════
//   FETCH ALL TIMEFRAMES
// ══════════════════════════════════════════
export async function fetchAllTimeframes(symbol, market = 'spot') {
  const timeframes = ['4h', '1h', '30m', '15m', '5m', '1m']
  const candleData = {}

  const results = await Promise.allSettled(
    timeframes.map(async (tf) => {
      const candles = await fetchKlines(symbol, tf, 200, market)
      return { tf, candles }
    })
  )

  results.forEach(result => {
    if (result.status === 'fulfilled' && result.value.candles && result.value.candles.length > 30) {
      candleData[result.value.tf] = result.value.candles
    }
  })

  return candleData
}

// ══════════════════════════════════════════
//   FETCH FUNDING RATE (Futures Only)
// ══════════════════════════════════════════
export async function fetchFundingRate(symbol) {
  try {
    const data = await rateLimitedFetch(
      `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`
    )
    if (data && data.lastFundingRate) {
      return parseFloat(data.lastFundingRate)
    }
    return null
  } catch (e) {
    return null
  }
}

// ══════════════════════════════════════════
//   FETCH CURRENT PRICE
// ══════════════════════════════════════════
export async function fetchCurrentPrice(symbol, market = 'spot') {
  const url = market === 'futures'
    ? `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`
    : `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`

  const data = await rateLimitedFetch(url)
  if (data && data.price) {
    return parseFloat(data.price)
  }
  return null
}

export default {
  fetchKlines,
  fetchAllTimeframes,
  fetchFundingRate,
  fetchCurrentPrice,
       }
