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
  const [selectedCoin, setSelectedCoin] = useState(localStorage.getItem('rtx_spot_coin') || 'BTCUSDT')
  const [favorites, setFavorites] = useState(JSON.parse(localStorage.getItem('rtx_spot_favs') || '["BTCUSDT","ETHUSDT"]'))
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

  // Live WebSocket
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

    return () => {
      try { ws.close() } catch (_) {}
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('rtx_spot_coin', selectedCoin)
    setSignal(null)
    setError(null)
  }, [selectedCoin])

  useEffect(() => {
    setSignal(null)
    setError(null)
  }, [signalMode])

  const generateSignal = useCallback(async () => {
    if (generating) return

    setGenerating(true)
    setSignal(null)
    setError(null)
    setBlocked(false)
    setProgress(0)
    setProgressMsg('🔍 Connecting to RTX Engine...')

    let prog = 0
    progressTimer.current = setInterval(() => {
      prog = Math.min(prog + Math.random() * 6, 92)
      setProgress(prog)
    }, 1200)

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
          setError('🔌 Server এ সমস্যা — কিছুক্ষণ পর try করুন')
        }
        setGenerating(false)
        return
      }

      setSignal(data.signal)
      if (isTrial && typeof data.remaining === 'number') {
        setRefreshCount(data.remaining)
      }

      if (soundOn && audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => {})
      }

    } catch (e) {
      clearInterval(progressTimer.current)
      setError('🔌 Server এ সমস্যা — কিছুক্ষণ পর try করুন')
    } finally {
      setGenerating(false)
      setTimeout(() => setProgress(0), 800)
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

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {isTrial && (
        <div style={{
          background: `linear-gradient(135deg, ${C.gold}11, ${C.orange}11)`,
          border: `1px solid ${C.gold}33`,
          borderRadius: 10, padding: '10px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, color: C.gold, fontWeight: 700 }}>🎁 Free Signals Today</div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>আজকের জন্য বাকি</div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.gold }}>
            {refreshCount}<span style={{ fontSize: 12, color: C.muted }}>/2</span>
          </div>
        </div>
      )}

      {/* Chart */}
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

      {/* Coin Info */}
      <div style={{
        background: C.card, borderRadius: 12, padding: 14,
        border: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 700 }}>📊 SELECTED COIN</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.cyan, marginTop: 4 }}>
            {selectedCoin.replace('USDT', '')}/USDT
          </div>
        </div>
        {livePrices[selectedCoin] && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
              ${livePrices[selectedCoin].price.toFixed(
                livePrices[selectedCoin].price < 1 ? 6 : livePrices[selectedCoin].price < 100 ? 4 : 2
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
          border: 'none',
          cursor: generating || blocked ? 'not-allowed' : 'pointer',
        }}>
        {generating ? '⚙️ DEEP ANALYZING...' :
         blocked ? '🔒 PREMIUM REQUIRED' :
         `🚀 GENERATE SPOT SIGNAL`}
      </button>

      {/* Progress Bar */}
      {generating && (
        <div style={{ background: C.card, borderRadius: 12, padding: 16, border: `1px solid ${C.cyan}55` }}>
          <div style={{ fontSize: 11, color: C.cyan, fontWeight: 700, marginBottom: 10, textAlign: 'center' }}>
            {progressMsg || 'Analyzing...'}
          </div>
          <div style={{ height: 6, background: C.panel, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${C.cyan}, ${C.blue})`,
              transition: 'width 0.5s',
            }} />
          </div>
        </div>
      )}

      {/* Error */}
      {error && !generating && (
        <div style={{
          background: blocked ? `${C.red}11` : `${C.gold}11`,
          border: `1px solid ${blocked ? C.red : C.gold}55`,
          borderRadius: 12, padding: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 13, color: blocked ? C.red : C.gold, fontWeight: 700 }}>{error}</div>
        </div>
      )}

      {/* Signal */}
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
      <div style={{ background: C.card, borderRadius: 12, padding: 14, border: `1px solid ${C.border}` }}>
        <input
          type="text"
          placeholder="🔍 Search coin..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px',
            borderRadius: 8, background: C.bg,
            color: C.text, border: `1px solid ${C.border}`,
            fontSize: 12, marginBottom: 12,
          }}
        />

        {favCoins.length > 0 && (
          <>
            <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, marginBottom: 8 }}>⭐ FAVORITES</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {favCoins.map(coin => (
                <CoinChip key={coin} coin={coin} selected={coin === selectedCoin}
                  onClick={() => setSelectedCoin(coin)} onFav={() => toggleFavorite(coin)} isFav={true}
                  price={livePrices[coin]} />
              ))}
            </div>
          </>
        )}

        <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginBottom: 8 }}>📊 TOP 20 BINANCE SPOT</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {otherCoins.map(coin => (
            <CoinChip key={coin} coin={coin} selected={coin === selectedCoin}
              onClick={() => setSelectedCoin(coin)} onFav={() => toggleFavorite(coin)} isFav={false}
              price={livePrices[coin]} />
          ))}
        </div>
      </div>

      <button onClick={() => {
        const next = !soundOn
        setSoundOn(next)
        localStorage.setItem('rtx_sound', next ? 'on' : 'off')
      }} style={{
        padding: '10px', borderRadius: 10, background: C.panel,
        color: soundOn ? C.gold : C.muted, fontWeight: 700, fontSize: 12,
        border: `1px solid ${soundOn ? C.gold : C.border}`,
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
      background: selected ? `linear-gradient(135deg, ${C.cyan}33, ${C.blue}33)` : C.panel,
      border: `1.5px solid ${selected ? C.cyan : C.border}`,
      borderRadius: 10, padding: '8px 12px',
      cursor: 'pointer', minWidth: 78,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <div onClick={onClick} style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: selected ? C.cyan : C.text }}>{symbol}</div>
        {price && (
          <div style={{ fontSize: 9, color: changeColor, fontWeight: 600, marginTop: 1 }}>
            {change > 0 ? '+' : ''}{change.toFixed(2)}%
          </div>
        )}
      </div>
      <div onClick={(e) => { e.stopPropagation(); onFav() }} style={{ cursor: 'pointer', fontSize: 13 }}>
        {isFav ? '⭐' : '☆'}
      </div>
    </div>
  )
                                     }
