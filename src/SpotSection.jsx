import { useState, useEffect, useRef, useCallback } from 'react'
import SignalCard from './SignalCard'
import { C } from './App'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''

const TOP_SPOT = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'LTCUSDT',
  'LINKUSDT', 'TRXUSDT', 'NEARUSDT', 'UNIUSDT', 'ATOMUSDT',
  'BCHUSDT', 'XLMUSDT', 'FILUSDT', 'APTUSDT', 'ARBUSDT',
]

export default function SpotSection({ isTrial, tgUser, refreshCount, setRefreshCount, signalMode }) {
  const [selectedCoin, setSelectedCoin] = useState(
    localStorage.getItem('rtx_spot_coin') || 'BTCUSDT'
  )
  const [favorites, setFavorites] = useState(
    JSON.parse(localStorage.getItem('rtx_spot_favs') || '["BTCUSDT","ETHUSDT"]')
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [signal, setSignal] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMsg, setProgressMsg] = useState('')
  const [error, setError] = useState(null)
  const [livePrices, setLivePrices] = useState({})
  const [soundOn, setSoundOn] = useState(localStorage.getItem('rtx_sound') !== 'off')
  const [blocked, setBlocked] = useState(false)

  const wsRef = useRef(null)
  const audioRef = useRef(null)
  const progressTimer = useRef(null)

  useEffect(() => {
    audioRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg')
    audioRef.current.volume = 0.6
  }, [])

  // ── Live Price WebSocket ──
  useEffect(() => {
    const streams = TOP_SPOT.map(s => `${s.toLowerCase()}@miniTicker`).join('/')
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`)
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

    ws.onerror = () => console.log('Spot WS error')

    return () => {
      try { ws.close() } catch (_) {}
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('rtx_spot_coin', selectedCoin)
    setSignal(null)
    setError(null)
  }, [selectedCoin])

  // Reset signal when mode changes
  useEffect(() => {
    setSignal(null)
    setError(null)
  }, [signalMode])

  const generateSignal = useCallback(async () => {
    if (generating) return

    setGenerating(true)
    setSignal(null)
    setError(null)
    setProgress(0)
    setProgressMsg('🔍 Connecting to RTX Engine...')

    let prog = 0
    const messages = signalMode === 'sweep' ? [
      '🔍 Fetching market data...',
      '📊 Detecting Swing Points...',
      '🎯 Finding Liquidity Levels...',
      '⚡ Checking Sweep Patterns...',
      '🏦 Reclaim Window Analysis...',
      '💎 Quality Scoring (0-100)...',
      '🏆 Assigning Grade (A+/A/B)...',
      '🎯 Calculating Smart TP/SL...',
      '✅ Finalizing signal...',
    ] : signalMode === 'indicator' ? [
      '🔍 Fetching market data...',
      '📊 Analyzing 6 timeframes...',
      '🏦 ICT Order Blocks...',
      '💎 FVG Detection...',
      '⚡ CRT + TBS Patterns...',
      '📈 VSA Volume Analysis...',
      '✨ Running 200 Indicators...',
      '🤖 Voting System...',
      '🎯 Smart TP/SL...',
      '✅ Finalizing...',
    ] : [
      '🔍 Fetching market data...',
      '🔵 Sweep Reclaim Analysis...',
      '🟢 200 Indicators Voting...',
      '🏦 Smart Money Detection...',
      '⚡ Multi-Timeframe Bias...',
      '🔥 Hybrid Confirmation...',
      '💎 Quality Scoring...',
      '🎯 Smart TP/SL Calculation...',
      '✅ Finalizing signal...',
    ]

    let msgIdx = 0
    progressTimer.current = setInterval(() => {
      prog = Math.min(prog + Math.random() * 6, 95)
      setProgress(prog)
      if (msgIdx < messages.length && prog > (msgIdx + 1) * (100 / messages.length)) {
        setProgressMsg(messages[msgIdx])
        msgIdx++
      }
    }, 1000)

    try {
      const res = await fetch(`${BACKEND_URL}/api/generate-signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coin: selectedCoin,
          market: 'spot',
          userId: String(tgUser.id),
          mode: signalMode,
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
  }, [selectedCoin, tgUser.id, generating, soundOn, isTrial, setRefreshCount, signalMode])

  const toggleFavorite = (coin) => {
    const newFavs = favorites.includes(coin)
      ? favorites.filter(c => c !== coin)
      : [...favorites, coin]
    setFavorites(newFavs)
    localStorage.setItem('rtx_spot_favs', JSON.stringify(newFavs))
  }

  const filteredCoins = TOP_SPOT.filter(c =>
    !searchQuery || c.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const favCoins = filteredCoins.filter(c => favorites.includes(c))
  const otherCoins = filteredCoins.filter(c => !favorites.includes(c))

  const modeColor = signalMode === 'sweep' ? C.cyan : signalMode === 'indicator' ? C.green : C.orange
  const modeName = signalMode === 'sweep' ? 'SWEEP' : signalMode === 'indicator' ? 'INDICATOR' : 'HYBRID'

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Trial Counter */}
      {isTrial && (
        <div style={{
          background: `linear-gradient(135deg, ${C.gold}11, ${C.orange}11)`,
          border: `1px solid ${C.gold}33`,
          borderRadius: 10, padding: '10px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, color: C.gold, fontWeight: 700 }}>
              🎁 Trial Signals Left Today
            </div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>
              দিনে 2টি signal (Spot + Futures একসাথে)
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.gold }}>
            {refreshCount}<span style={{ fontSize: 12, color: C.muted }}>/2</span>
          </div>
        </div>
      )}

      {/* TradingView Chart */}
      <div style={{
        height: '32vh', minHeight: 240,
        background: '#0d1117', borderRadius: 12,
        overflow: 'hidden', border: `1px solid ${C.border}`,
      }}>
        <iframe
          key={selectedCoin}
          src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE:${selectedCoin}&theme=dark&hide_top_toolbar=1&interval=60`}
          width="100%" height="100%" style={{ border: 'none' }}
          title="chart"
        />
      </div>

      {/* Selected Coin Info */}
      <div style={{
        background: C.card, borderRadius: 12, padding: 14,
        border: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 700 }}>
            📊 SELECTED COIN
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.cyan, marginTop: 4 }}>
            {selectedCoin.replace('USDT', '')}/USDT
          </div>
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

      {/* Generate Button */}
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
            : `linear-gradient(135deg, ${C.cyan}, ${C.blue})`,
          color: generating ? C.muted : '#000',
          fontWeight: 900, fontSize: 14,
          border: 'none', cursor: generating || blocked ? 'not-allowed' : 'pointer',
          boxShadow: generating ? 'none' : `0 4px 20px ${blocked ? C.red : C.cyan}44`,
          letterSpacing: '0.08em',
          transition: '0.3s',
        }}>
        {generating ? '⚙️ ANALYZING MARKET...' :
         blocked ? '🔒 PREMIUM REQUIRED' :
         `🚀 GENERATE ${modeName} SIGNAL`}
      </button>

      {/* Progress Bar */}
      {generating && (
        <div style={{
          background: C.card, borderRadius: 12, padding: 16,
          border: `1px solid ${modeColor}55`,
        }}>
          <div style={{
            fontSize: 11, color: modeColor, fontWeight: 700,
            marginBottom: 10, textAlign: 'center',
          }}>
            {progressMsg}
          </div>
          <div style={{
            height: 6, background: C.panel, borderRadius: 3, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: `linear-gradient(90deg, ${modeColor}, ${C.blue})`,
              borderRadius: 3, transition: 'width 0.5s',
              boxShadow: `0 0 10px ${modeColor}`,
            }} />
          </div>
          <div style={{
            textAlign: 'center', fontSize: 10, color: C.muted,
            marginTop: 8, letterSpacing: '0.05em',
          }}>
            {Math.round(progress)}% • Deep Analysis Running
          </div>
        </div>
      )}

      {/* Error / No Signal */}
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
        </div>
      )}

      {/* Signal Display */}
      {signal && !generating && (
        <SignalCard
          signal={signal}
          coin={selectedCoin}
          market="spot"
          isTrial={isTrial}
          livePrice={livePrices[selectedCoin]?.price}
        />
      )}

      {/* Coin Selector */}
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
                />
              ))}
            </div>
          </>
        )}

        <div style={{
          fontSize: 10, color: C.muted, fontWeight: 700,
          marginBottom: 8, letterSpacing: '0.1em',
        }}>
          📊 TOP 20 BINANCE SPOT
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
            />
          ))}
        </div>
      </div>

      {/* Sound Toggle */}
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

function CoinChip({ coin, selected, onClick, onFav, isFav, price }) {
  const symbol = coin.replace('USDT', '')
  const change = price?.change || 0
  const changeColor = change > 0 ? C.green : change < 0 ? C.red : C.muted

  return (
    <div style={{
      background: selected
        ? `linear-gradient(135deg, ${C.cyan}33, ${C.blue}33)`
        : C.panel,
      border: `1.5px solid ${selected ? C.cyan : C.border}`,
      borderRadius: 10, padding: '8px 12px',
      cursor: 'pointer', minWidth: 78,
      display: 'flex', alignItems: 'center', gap: 6,
      transition: '0.2s',
    }}>
      <div onClick={onClick} style={{ flex: 1 }}>
        <div style={{
          fontSize: 12, fontWeight: 800,
          color: selected ? C.cyan : C.text,
        }}>
          {symbol}
        </div>
        {price && (
          <div style={{ fontSize: 9, color: changeColor, fontWeight: 600, marginTop: 1 }}>
            {change > 0 ? '+' : ''}{change.toFixed(2)}%
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
