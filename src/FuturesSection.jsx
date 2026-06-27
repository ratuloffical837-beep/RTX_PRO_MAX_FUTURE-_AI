import { useState, useEffect, useRef, useCallback } from 'react'
import SignalCard from './SignalCard'
import { C } from './App'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''

// ── TOP 20 FUTURES COINS ──
const TOP_FUTURES = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
  'MATICUSDT', '1000PEPEUSDT', 'WIFUSDT', 'INJUSDT', 'SUIUSDT',
  'ARBUSDT', 'OPUSDT', 'APTUSDT', 'NEARUSDT', 'TIAUSDT',
]

export default function FuturesSection({ isTrial, tgUser, refreshCount, setRefreshCount }) {
  const [selectedCoin, setSelectedCoin] = useState(
    localStorage.getItem('rtx_futures_coin') || 'BTCUSDT'
  )
  const [favorites, setFavorites] = useState(
    JSON.parse(localStorage.getItem('rtx_futures_favs') || '["BTCUSDT","ETHUSDT"]')
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [signal, setSignal] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMsg, setProgressMsg] = useState('')
  const [error, setError] = useState(null)
  const [livePrices, setLivePrices] = useState({})
  const [fundingRates, setFundingRates] = useState({})
  const [soundOn, setSoundOn] = useState(localStorage.getItem('rtx_sound') !== 'off')
  const [blocked, setBlocked] = useState(false)

  const wsRef = useRef(null)
  const audioRef = useRef(null)
  const progressTimer = useRef(null)

  // ── Sound Setup ──
  useEffect(() => {
    audioRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg')
    audioRef.current.volume = 0.6
  }, [])

  // ── Live Price WebSocket (Futures) ──
  useEffect(() => {
    const streams = TOP_FUTURES.map(s => `${s.toLowerCase()}@miniTicker`).join('/')
    const ws = new WebSocket(`wss://fstream.binance.com/stream?streams=${streams}`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.data) {
          setLivePrices(prev => ({
            ...prev,
            [msg.data.s]: {
              price: parseFloat(msg.data.c),
              change: parseFloat(msg.data.P || 0),
            },
          }))
        }
      } catch (_) {}
    }

    ws.onerror = () => console.log('Futures WS error')

    return () => {
      try { ws.close() } catch (_) {}
    }
  }, [])

  // ── Fetch Funding Rates (every 5 min) ──
  useEffect(() => {
    const fetchFunding = async () => {
      try {
        const res = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex')
        const data = await res.json()
        if (Array.isArray(data)) {
          const rates = {}
          data.forEach(item => {
            if (TOP_FUTURES.includes(item.symbol)) {
              rates[item.symbol] = parseFloat(item.lastFundingRate || 0)
            }
          })
          setFundingRates(rates)
        }
      } catch (e) {
        console.error('Funding fetch error:', e)
      }
    }
    fetchFunding()
    const iv = setInterval(fetchFunding, 300000)
    return () => clearInterval(iv)
  }, [])

  // ── Save coin selection ──
  useEffect(() => {
    localStorage.setItem('rtx_futures_coin', selectedCoin)
    setSignal(null)
    setError(null)
  }, [selectedCoin])

  // ── Generate Signal ──
  const generateSignal = useCallback(async () => {
    if (generating) return

    setGenerating(true)
    setSignal(null)
    setError(null)
    setProgress(0)
    setProgressMsg('🔍 Connecting to RTX Engine...')

    let prog = 0
    const messages = [
      '🔍 Fetching futures data...',
      '📊 Analyzing 4H timeframe...',
      '📊 Analyzing 1H timeframe...',
      '📊 Analyzing 30m timeframe...',
      '📊 Analyzing 15m + 5m...',
      '🏦 Detecting Order Blocks (ICT)...',
      '💎 Finding Fair Value Gaps...',
      '🔥 Checking Liquidity Sweeps...',
      '⚡ Running CRT Pattern Analysis...',
      '📈 VSA Volume Analysis...',
      '💰 Checking Funding Rate...',
      '🎯 Calculating Smart TP/SL...',
      '✨ Running 200 Indicators...',
      '🤖 Voting System Processing...',
      '✅ Finalizing signal...',
    ]
    let msgIdx = 0
    progressTimer.current = setInterval(() => {
      prog = Math.min(prog + Math.random() * 7, 95)
      setProgress(prog)
      if (msgIdx < messages.length && prog > (msgIdx + 1) * 6) {
        setProgressMsg(messages[msgIdx])
        msgIdx++
      }
    }, 900)

    try {
      const res = await fetch(`${BACKEND_URL}/api/generate-signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coin: selectedCoin,
          market: 'futures',
          userId: String(tgUser.id),
        }),
      })

      const data = await res.json()

      clearInterval(progressTimer.current)
      setProgress(100)

      if (!data.ok) {
        if (data.blocked) {
          setBlocked(true)
          setError(data.message || 'Trial limit শেষ!')
        } else if (data.noSignal) {
          setError(data.message || '❌ এই coin এ এখন strong signal নেই')
        } else {
          setError(data.error || 'কিছু সমস্যা হয়েছে')
        }
        setGenerating(false)
        return
      }

      setSignal(data.signal)
      if (isTrial && typeof data.remaining === 'number') {
        setRefreshCount(data.remaining)
      }

      if (soundOn && audioRef.current) {
        try {
          audioRef.current.currentTime = 0
          audioRef.current.play().catch(() => {})
        } catch (_) {}
      }

      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success')
      }

    } catch (e) {
      clearInterval(progressTimer.current)
      console.error('Generate error:', e)
      setError('🔌 Server এ সমস্যা — কিছুক্ষণ পর try করুন')
    } finally {
      setGenerating(false)
      setTimeout(() => setProgress(0), 1000)
    }
  }, [selectedCoin, tgUser.id, generating, soundOn, isTrial, setRefreshCount])

  const toggleFavorite = (coin) => {
    const newFavs = favorites.includes(coin)
      ? favorites.filter(c => c !== coin)
      : [...favorites, coin]
    setFavorites(newFavs)
    localStorage.setItem('rtx_futures_favs', JSON.stringify(newFavs))
  }

  const filteredCoins = TOP_FUTURES.filter(c =>
    !searchQuery || c.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const favCoins = filteredCoins.filter(c => favorites.includes(c))
  const otherCoins = filteredCoins.filter(c => !favorites.includes(c))

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── TRIAL COUNTER ── */}
      {isTrial && (
        <div style={{
          background: `linear-gradient(135deg, ${C.gold}11, ${C.orange}11)`,
          border: `1px solid ${C.gold}33`,
          borderRadius: 10, padding: '10px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, color: C.gold, fontWeight: 700 }}>
              🎁 Trial Refreshes Left
            </div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>
              আজকের জন্য বাকি
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.gold }}>
            {refreshCount}<span style={{ fontSize: 12, color: C.muted }}>/5</span>
          </div>
        </div>
      )}

      {/* ── TRADINGVIEW CHART ── */}
      <div style={{
        height: '32vh', minHeight: 240,
        background: '#0d1117', borderRadius: 12,
        overflow: 'hidden', border: `1px solid ${C.border}`,
      }}>
        <iframe
          key={selectedCoin}
          src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE:${selectedCoin}.P&theme=dark&hide_top_toolbar=1&interval=15`}
          width="100%" height="100%" style={{ border: 'none' }}
          title="chart"
        />
      </div>

      {/* ── COIN INFO + FUNDING ── */}
      <div style={{
        background: C.card, borderRadius: 12, padding: 14,
        border: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 700 }}>
            ⚡ SELECTED COIN
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.orange, marginTop: 4 }}>
            {selectedCoin.replace('USDT', '').replace('1000', '')}/USDT
          </div>
          {fundingRates[selectedCoin] !== undefined && (
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
              Funding:{' '}
              <span style={{
                color: fundingRates[selectedCoin] > 0 ? C.green : C.red,
                fontWeight: 700,
              }}>
                {(fundingRates[selectedCoin] * 100).toFixed(4)}%
              </span>
            </div>
          )}
        </div>
        {livePrices[selectedCoin] && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
              ${livePrices[selectedCoin].price.toFixed(
                livePrices[selectedCoin].price < 1 ? 6 :
                livePrices[selectedCoin].price < 100 ? 4 : 2
              )}
            </div>
            <div style={{
              fontSize: 11, fontWeight: 700, marginTop: 2,
              color: livePrices[selectedCoin].change >= 0 ? C.green : C.red,
            }}>
              {livePrices[selectedCoin].change >= 0 ? '↑' : '↓'} {Math.abs(livePrices[selectedCoin].change).toFixed(2)}%
            </div>
          </div>
        )}
      </div>

      {/* ── GENERATE SIGNAL BUTTON ── */}
      <button
        onClick={generateSignal}
        disabled={generating || blocked}
        style={{
          width: '100%', padding: '16px',
          borderRadius: 12,
          background: generating
            ? C.panel
            : blocked
            ? `linear-gradient(135deg, ${C.red}, ${C.pink})`
            : `linear-gradient(135deg, ${C.orange}, ${C.pink})`,
          color: generating ? C.muted : '#000',
          fontWeight: 900, fontSize: 14,
          border: 'none', cursor: generating || blocked ? 'not-allowed' : 'pointer',
          boxShadow: generating ? 'none' : `0 4px 20px ${blocked ? C.red : C.orange}66`,
          letterSpacing: '0.08em',
          transition: '0.3s',
        }}>
        {generating ? '⚙️ DEEP ANALYZING...' :
         blocked ? '🔒 PREMIUM REQUIRED' :
         '⚡ GENERATE FUTURES SIGNAL'}
      </button>

      {/* ── PROGRESS BAR ── */}
      {generating && (
        <div style={{
          background: C.card, borderRadius: 12, padding: 16,
          border: `1px solid ${C.orange}55`,
        }}>
          <div style={{
            fontSize: 11, color: C.orange, fontWeight: 700,
            marginBottom: 10, textAlign: 'center',
          }}>
            {progressMsg}
          </div>
          <div style={{
            height: 6, background: C.panel, borderRadius: 3, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: `linear-gradient(90deg, ${C.orange}, ${C.pink})`,
              borderRadius: 3, transition: 'width 0.5s',
              boxShadow: `0 0 10px ${C.orange}`,
            }} />
          </div>
          <div style={{
            textAlign: 'center', fontSize: 10, color: C.muted,
            marginTop: 8, letterSpacing: '0.05em',
          }}>
            {Math.round(progress)}% • CRT + ICT + VSA Analysis
          </div>
        </div>
      )}

      {/* ── ERROR/NO SIGNAL ── */}
      {error && !generating && (
        <div style={{
          background: blocked ? `${C.red}11` : `${C.gold}11`,
          border: `1px solid ${blocked ? C.red : C.gold}55`,
          borderRadius: 12, padding: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>
            {blocked ? '🔒' : '⚠️'}
          </div>
          <div style={{
            fontSize: 13, color: blocked ? C.red : C.gold,
            fontWeight: 700, marginBottom: 8,
          }}>
            {error}
          </div>
          {blocked && (
            <button
              onClick={() => window.scrollTo(0, document.body.scrollHeight)}
              style={{
                marginTop: 8, padding: '10px 20px',
                background: `linear-gradient(135deg, ${C.gold}, ${C.orange})`,
                color: '#000', fontWeight: 800, fontSize: 12,
                border: 'none', borderRadius: 8, cursor: 'pointer',
              }}>
              💎 Premium নিন এখনই
            </button>
          )}
        </div>
      )}

      {/* ── SIGNAL DISPLAY ── */}
      {signal && !generating && (
        <SignalCard
          signal={signal}
          coin={selectedCoin}
          market="futures"
          isTrial={isTrial}
          livePrice={livePrices[selectedCoin]?.price}
        />
      )}

      {/* ── COIN SELECTOR ── */}
      <div style={{
        background: C.card, borderRadius: 12, padding: 14,
        border: `1px solid ${C.border}`,
      }}>
        <input
          type="text"
          placeholder="🔍 Search coin..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px',
            borderRadius: 8, background: C.bg,
            color: C.text, border: `1px solid ${C.border}`,
            fontSize: 12, outline: 'none',
            marginBottom: 12, boxSizing: 'border-box',
          }}
        />

        {favCoins.length > 0 && (
          <>
            <div style={{
              fontSize: 10, color: C.gold, fontWeight: 700,
              marginBottom: 8, letterSpacing: '0.1em',
            }}>
              ⭐ FAVORITES
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {favCoins.map(coin => (
                <CoinChip
                  key={coin}
                  coin={coin}
                  selected={coin === selectedCoin}
                  onClick={() => setSelectedCoin(coin)}
                  onFav={() => toggleFavorite(coin)}
                  isFav={true}
                  price={livePrices[coin]}
                  funding={fundingRates[coin]}
                />
              ))}
            </div>
          </>
        )}

        <div style={{
          fontSize: 10, color: C.muted, fontWeight: 700,
          marginBottom: 8, letterSpacing: '0.1em',
        }}>
          ⚡ TOP 20 BINANCE FUTURES
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {otherCoins.map(coin => (
            <CoinChip
              key={coin}
              coin={coin}
              selected={coin === selectedCoin}
              onClick={() => setSelectedCoin(coin)}
              onFav={() => toggleFavorite(coin)}
              isFav={false}
              price={livePrices[coin]}
              funding={fundingRates[coin]}
            />
          ))}
        </div>
      </div>

      {/* ── SOUND TOGGLE ── */}
      <button
        onClick={() => {
          const next = !soundOn
          setSoundOn(next)
          localStorage.setItem('rtx_sound', next ? 'on' : 'off')
        }}
        style={{
          padding: '10px',
          borderRadius: 10, background: C.panel,
          color: soundOn ? C.gold : C.muted,
          fontWeight: 700, fontSize: 12,
          border: `1px solid ${soundOn ? C.gold : C.border}`,
          cursor: 'pointer',
        }}>
        🔔 Signal Sound: {soundOn ? 'ON' : 'OFF'}
      </button>
    </div>
  )
}

function CoinChip({ coin, selected, onClick, onFav, isFav, price, funding }) {
  const symbol = coin.replace('USDT', '').replace('1000', '')
  const change = price?.change || 0
  const changeColor = change > 0 ? C.green : change < 0 ? C.red : C.muted

  return (
    <div style={{
      background: selected
        ? `linear-gradient(135deg, ${C.orange}33, ${C.pink}33)`
        : C.panel,
      border: `1.5px solid ${selected ? C.orange : C.border}`,
      borderRadius: 10, padding: '8px 12px',
      cursor: 'pointer', minWidth: 78,
      display: 'flex', alignItems: 'center', gap: 6,
      transition: '0.2s',
    }}>
      <div onClick={onClick} style={{ flex: 1 }}>
        <div style={{
          fontSize: 12, fontWeight: 800,
          color: selected ? C.orange : C.text,
        }}>
          {symbol}
        </div>
        {price && (
          <div style={{ fontSize: 9, color: changeColor, fontWeight: 600, marginTop: 1 }}>
            {change > 0 ? '+' : ''}{change.toFixed(2)}%
          </div>
        )}
        {funding !== undefined && (
          <div style={{
            fontSize: 8, fontWeight: 600,
            color: funding > 0 ? C.green : C.red,
            marginTop: 1,
          }}>
            F: {(funding * 100).toFixed(3)}%
          </div>
        )}
      </div>
      <div
        onClick={(e) => { e.stopPropagation(); onFav() }}
        style={{ cursor: 'pointer', fontSize: 13 }}>
        {isFav ? '⭐' : '☆'}
      </div>
    </div>
  )
  }
