// ══════════════════════════════════════════════════════
//   RTX — BINANCE DATA FETCHER (Optimized)
//   বিসমিল্লাহির রাহমানির রাহিম
// ══════════════════════════════════════════════════════

import fetch from 'node-fetch'

let lastFetchTime = 0
const MIN_GAP = 120

async function safeFetch(url, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const now = Date.now()
      if (now - lastFetchTime < MIN_GAP) {
        await new Promise(r => setTimeout(r, MIN_GAP))
      }
      lastFetchTime = Date.now()

      const res = await fetch(url, { timeout: 12000 })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (e) {
      if (i === retries - 1) return null
      await new Promise(r => setTimeout(r, 800))
    }
  }
  return null
}

// ── Fetch Klines ──
export async function fetchKlines(symbol, interval, limit = 200, market = 'spot') {
  const base = market === 'futures'
    ? 'https://fapi.binance.com/fapi/v1/klines'
    : 'https://api.binance.com/api/v3/klines'

  const url = `${base}?symbol=${symbol}&interval=${interval}&limit=${limit}`
  const data = await safeFetch(url)

  if (!Array.isArray(data)) return null

  return data.map(k => ({
    t: k[0],
    o: parseFloat(k[1]),
    h: parseFloat(k[2]),
    l: parseFloat(k[3]),
    c: parseFloat(k[4]),
    v: parseFloat(k[5]),
  }))
}

// ── Fetch All Timeframes ──
export async function fetchAllTimeframes(symbol, market = 'spot') {
  const tfs = ['4h', '1h', '30m', '15m', '5m']
  const results = await Promise.allSettled(
    tfs.map(async tf => {
      const candles = await fetchKlines(symbol, tf, 200, market)
      return { tf, candles }
    })
  )

  const candleData = {}
  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value.candles?.length > 40) {
      candleData[r.value.tf] = r.value.candles
    }
  })

  return candleData
}

// ── Fetch Funding Rate ──
export async function fetchFundingRate(symbol) {
  const data = await safeFetch(
    `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`
  )
  return data?.lastFundingRate ? parseFloat(data.lastFundingRate) : null
}

// ── Fetch Current Price ──
export async function fetchCurrentPrice(symbol, market = 'spot') {
  const base = market === 'futures'
    ? 'https://fapi.binance.com/fapi/v1/ticker/price'
    : 'https://api.binance.com/api/v3/ticker/price'

  const data = await safeFetch(`${base}?symbol=${symbol}`)
  return data?.price ? parseFloat(data.price) : null
}

export default {
  fetchKlines,
  fetchAllTimeframes,
  fetchFundingRate,
  fetchCurrentPrice,
          }
