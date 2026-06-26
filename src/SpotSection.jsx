import { useState, useEffect, useRef, useCallback } from 'react'
import { db } from './firebase'
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { TOP_SPOT, runCryptoSignalEngine } from './signalEngine'
import { C } from './App'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''

export default function SpotSection({ isTrial, tgUser }) {
  const [subTab, setSubTab]           = useState('active')
  const [selectedCoin, setSelectedCoin] = useState('BTCUSDT')
  const [coinList, setCoinList]       = useState(TOP_SPOT)
  const [favorites, setFavorites]     = useState(JSON.parse(localStorage.getItem('spot_favorites') || '[]'))
  const [searchQuery, setSearchQuery] = useState('')
  const [signals, setSignals]         = useState([])
  const [history, setHistory]         = useState([])
  const [stats, setStats]             = useState({ total: 0, wins: 0, losses: 0, winRate: 0 })
  const [currentSignal, setCurrentSignal] = useState(null)
  const [scanning, setScanning]       = useState(false)
  const [livePrices, setLivePrices]   = useState({})
  const [soundOn, setSoundOn]         = useState(localStorage.getItem('spot_sound') !== 'off')
  const [showPopup, setShowPopup]     = useState(null)
  const wsRef = useRef(null)
  const audioRef = useRef({})

  // ── Load Sounds ──
  useEffect(() => {
    audioRef.current = {
      ultra:  new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg'),
      strong: new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg'),
      normal: new Audio('https://actions.google.com/sounds/v1/cartoon/clang.ogg'),
    }
    Object.values(audioRef.current).forEach(a => { a.volume = 0.7 })
  }, [])

  // ── Listen Active Signals from Firebase ──
  useEffect(() => {
    const q = query(
      collection(db, 'crypto_signals'),
      where('market', '==', 'spot'),
      where('status', 'in', ['ACTIVE', 'TP1_HIT', 'TP2_HIT']),
      orderBy('createdAt', 'desc'),
      limit(10)
    )
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setSignals(data)

      // Show popup for newest ULTRA signal
      if (data.length > 0) {
        const latest = data[0]
        const isNew = !localStorage.getItem(`shown_${latest.id}`)
        if (isNew && latest.strength === 'ULTRA') {
          setShowPopup(latest)
          playSound('ultra')
          localStorage.setItem(`shown_${latest.id}`, '1')
        } else if (isNew && latest.strength === 'STRONG') {
          playSound('strong')
          localStorage.setItem(`shown_${latest.id}`, '1')
        } else if (isNew) {
          playSound('normal')
          localStorage.setItem(`shown_${latest.id}`, '1')
        }
      }
    }, (e) => console.error('Signals fetch error:', e))
    return () => unsub()
  }, [])

  // ── Listen History (Last 100) ──
  useEffect(() => {
    const q = query(
      collection(db, 'crypto_signals'),
      where('market', '==', 'spot'),
      where('status', 'in', ['TP3_HIT', 'SL_HIT', 'TIMEOUT', 'CLOSED']),
      orderBy('closedAt', 'desc'),
      limit(100)
    )
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setHistory(data)
      const wins = data.filter(s => ['TP1_HIT', 'TP2_HIT', 'TP3_HIT'].includes(s.result)).length
      const losses = data.filter(s => s.result === 'SL_HIT').length
      const total = wins + losses
      setStats({
        total,
        wins,
        losses,
        winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
      })
    })
    return () => unsub()
  }, [])

  // ── Live Price WebSocket ──
  useEffect(() => {
    const symbols = [...new Set([...TOP_SPOT, ...signals.map(s => s.coin)])].slice(0, 50)
    if (symbols.length === 0) return

    const streams = symbols.map(s => `${s.toLowerCase()}@miniTicker`).join('/')
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

    ws.onerror = () => console.log('Spot WS error, reconnecting...')

    return () => {
      try { ws.close() } catch (_) {}
    }
  }, [signals.length])

  // ── Fetch Current Coin Signal ──
  const fetchSignal = useCallback(async () => {
    if (scanning) return
    setScanning(true)
    try {
      const candles = await fetchKlines(selectedCoin, '1h', 100, 'spot')
      if (candles && candles.length > 60) {
        const result = runCryptoSignalEngine(candles)
        setCurrentSignal(result)
      }
    } catch (e) {
      console.error('Signal fetch error:', e)
    } finally {
      setScanning(false)
    }
  }, [selectedCoin, scanning])

  useEffect(() => {
    fetchSignal()
    const iv = setInterval(fetchSignal, 60000)
    return () => clearInterval(iv)
  }, [selectedCoin])

  const playSound = (type) => {
    if (!soundOn) return
    try {
      const audio = audioRef.current[type]
      if (audio) {
        audio.currentTime = 0
        audio.play().catch(() => {})
      }
    } catch (_) {}
  }

  const toggleFavorite = (coin) => {
    const newFavs = favorites.includes(coin)
      ? favorites.filter(c => c !== coin)
      : [...favorites, coin]
    setFavorites(newFavs)
    localStorage.setItem('spot_favorites', JSON.stringify(newFavs))
  }

  // ── Coin List Filtering ──
  const filteredCoins = coinList.filter(c =>
    !searchQuery || c.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const favCoins = filteredCoins.filter(c => favorites.includes(c))
  const otherCoins = filteredCoins.filter(c => !favorites.includes(c))

  return (
    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── SUB TABS ── */}
      <div style={{ display: 'flex', gap: 4, background: C.panel, padding: 4, borderRadius: 10 }}>
        {['active', 'history', 'stats'].map(tab => (
          <button key={tab} onClick={() => setSubTab(tab)} style={{
            flex: 1, padding: '8px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: subTab === tab ? C.card : 'transparent',
            color: subTab === tab ? C.gold : C.muted,
            border: 'none',
          }}>
            {tab === 'active' ? `🟢 ACTIVE (${signals.length})` :
             tab === 'history' ? `📜 HISTORY (${history.length})` :
             '📊 STATS'}
          </button>
        ))}
      </div>

      {/* ── ACTIVE SIGNALS TAB ── */}
      {subTab === 'active' && (
        <>
          {/* TradingView Chart */}
          <div style={{ height: '32vh', background: '#0d1117', borderRadius: 10, overflow: 'hidden' }}>
            <iframe
              key={selectedCoin}
              src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE:${selectedCoin}&theme=dark&hide_top_toolbar=1&interval=15`}
              width="100%" height="100%" style={{ border: 'none' }}
              title="chart"
            />
          </div>

          {/* Current Coin Signal */}
          {currentSignal && currentSignal.direction && (
            <SignalCard signal={currentSignal} coin={selectedCoin} isTrial={isTrial} livePrice={livePrices[selectedCoin]?.price} />
          )}

          {scanning && !currentSignal && (
            <div style={{ background: C.card, padding: 16, borderRadius: 12, textAlign: 'center', color: C.muted }}>
              ⟳ Scanning {selectedCoin}...
            </div>
          )}

          {/* Active Signals List */}
          {signals.length > 0 && (
            <div style={{ background: C.card, borderRadius: 12, padding: 12, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase' }}>
                🔔 All Active Spot Signals
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {signals.map(sig => (
                  <SignalItem key={sig.id} signal={sig} livePrice={livePrices[sig.coin]?.price} isTrial={isTrial} />
                ))}
              </div>
            </div>
          )}

          {/* Search & Coin Selector */}
          <div style={{ background: C.card, borderRadius: 12, padding: 12 }}>
            <input
              type="text"
              placeholder="🔍 Search coin..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: 10, borderRadius: 8, background: '#0d1117',
                color: C.text, border: `1px solid ${C.border}`, fontSize: 12, outline: 'none',
                marginBottom: 10, boxSizing: 'border-box',
              }}
            />

            {favCoins.length > 0 && (
              <>
                <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, marginBottom: 6 }}>
                  ⭐ FAVORITES
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {favCoins.map(coin => (
                    <CoinChip key={coin} coin={coin} selected={coin === selectedCoin}
                      onClick={() => setSelectedCoin(coin)}
                      onFav={() => toggleFavorite(coin)} isFav={true}
                      price={livePrices[coin]} />
                  ))}
                </div>
              </>
            )}

            <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginBottom: 6 }}>
              📊 TOP 50 BINANCE SPOT
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
              {otherCoins.map(coin => (
                <CoinChip key={coin} coin={coin} selected={coin === selectedCoin}
                  onClick={() => setSelectedCoin(coin)}
                  onFav={() => toggleFavorite(coin)} isFav={false}
                  price={livePrices[coin]} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── HISTORY TAB ── */}
      {subTab === 'history' && (
        <div style={{ background: C.card, borderRadius: 12, padding: 12, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>
            📜 Last 100 Signals
          </div>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', color: C.muted, padding: 20, fontSize: 12 }}>
              এখনো কোনো history নেই
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {history.map(sig => <HistoryItem key={sig.id} signal={sig} />)}
            </div>
          )}
        </div>
      )}

      {/* ── STATS TAB ── */}
      {subTab === 'stats' && <StatsView stats={stats} history={history} />}

      {/* Sound Toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => {
          const next = !soundOn
          setSoundOn(next)
          localStorage.setItem('spot_sound', next ? 'on' : 'off')
        }} style={{
          flex: 1, padding: 10, borderRadius: 8, background: C.panel,
          color: soundOn ? C.gold : C.muted, fontWeight: 700, fontSize: 12,
          border: `1px solid ${soundOn ? C.gold : C.border}`, cursor: 'pointer',
        }}>
          🔔 Sound: {soundOn ? 'ON' : 'OFF'}
        </button>
        <button onClick={fetchSignal} disabled={scanning} style={{
          flex: 2, padding: 10, borderRadius: 8,
          background: scanning ? C.panel : C.green, color: scanning ? C.muted : '#000',
          fontWeight: 800, fontSize: 12, border: 'none',
          cursor: scanning ? 'not-allowed' : 'pointer',
        }}>
          {scanning ? '⟳ Scanning...' : '🔄 Refresh Signal'}
        </button>
      </div>

      {/* Signal Popup */}
      {showPopup && (
        <SignalPopup signal={showPopup} onClose={() => setShowPopup(null)} isTrial={isTrial} />
      )}
    </div>
  )
}

// ══════════════════════════════════════════
//   FETCH KLINES FROM BINANCE
// ══════════════════════════════════════════
async function fetchKlines(symbol, interval, limit, market = 'spot') {
  const baseURL = market === 'futures'
    ? 'https://fapi.binance.com/fapi/v1/klines'
    : 'https://api.binance.com/api/v3/klines'
  try {
    const res = await fetch(`${baseURL}?symbol=${symbol}&interval=${interval}&limit=${limit}`)
    const data = await res.json()
    if (!Array.isArray(data)) return null
    return data.map(k => ({
      o: parseFloat(k[1]), h: parseFloat(k[2]), l: parseFloat(k[3]),
      c: parseFloat(k[4]), v: parseFloat(k[5]),
    }))
  } catch (e) {
    console.error('Klines error:', e)
    return null
  }
}

// ══════════════════════════════════════════
//   COMPONENTS
// ══════════════════════════════════════════

function CoinChip({ coin, selected, onClick, onFav, isFav, price }) {
  const symbol = coin.replace('USDT', '')
  const change = price?.change || 0
  const changeColor = change > 0 ? C.green : change < 0 ? C.red : C.muted
  return (
    <div style={{
      background: selected ? `${C.blue}22` : C.panel,
      border: `1px solid ${selected ? C.blue : C.border}`,
      borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: selected ? C.blue : C.text }}>
            {symbol}
          </div>
          {price && (
            <div style={{ fontSize: 9, color: changeColor }}>
              {change > 0 ? '+' : ''}{change.toFixed(2)}%
            </div>
          )}
        </div>
      </div>
      <div onClick={(e) => { e.stopPropagation(); onFav() }} style={{ cursor: 'pointer', fontSize: 12 }}>
        {isFav ? '⭐' : '☆'}
      </div>
    </div>
  )
}

function SignalCard({ signal, coin, isTrial, livePrice }) {
  const isLong = signal.direction === 'LONG'
  const color = isLong ? C.green : C.red
  const strengthColor = signal.strength === 'ULTRA' ? C.orange : signal.strength === 'STRONG' ? C.green : C.blue
  const strengthIcon = signal.strength === 'ULTRA' ? '🔥' : signal.strength === 'STRONG' ? '💪' : '✅'

  return (
    <div style={{
      background: C.card, borderRadius: 14, padding: 16,
      border: `2px solid ${color}`, boxShadow: `0 0 24px ${color}33`,
    }}>
      {/* Direction */}
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color, letterSpacing: '0.04em' }}>
          {isLong ? '🟢 LONG (BUY)' : '🔴 SHORT (SELL)'}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{coin}</div>
      </div>

      {/* Strength + Confidence */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <span style={{
          background: `${strengthColor}22`, color: strengthColor,
          border: `1px solid ${strengthColor}55`,
          borderRadius: 20, padding: '4px 14px', fontSize: 11, fontWeight: 700,
        }}>
          {strengthIcon} {signal.strength} — {signal.confidence}%
        </span>
      </div>

      {/* TP/SL */}
      <TPSLDisplay tp={signal.tp} isLong={isLong} isTrial={isTrial} currentPrice={livePrice} />

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <StatBox label="ADX" value={signal.adxValue?.toFixed(0)} color={signal.adxValue > 25 ? C.green : C.muted} />
        <StatBox label="RSI" value={signal.rsiValue?.toFixed(0)} color={C.gold} />
        <StatBox label="VOTES" value={`${signal.callVotes || 0}/${signal.putVotes || 0}`} color={C.blue} />
      </div>

      {/* Pattern */}
      {signal.pattern && signal.pattern !== 'None' && (
        <div style={{ textAlign: 'center', fontSize: 11, color: C.gold, marginTop: 10 }}>
          📊 {signal.pattern}
        </div>
      )}

      {/* Top Indicators */}
      {signal.breakdown && signal.breakdown.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 10, color: C.muted, fontWeight: 700, textAlign: 'center' }}>
            📊 Show {signal.totalIndicators || 200} Indicators
          </summary>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8 }}>
            {signal.breakdown.slice(0, 20).map((ind, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 9, padding: '4px 6px', borderRadius: 4, background: '#0d1117',
              }}>
                <span style={{ color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ind.name}</span>
                <span style={{
                  color: ind.signal.includes('BULL') ? C.green : ind.signal.includes('BEAR') ? C.red : C.muted,
                  fontWeight: 700, marginLeft: 4,
                }}>
                  {ind.signal.includes('BULL') ? '↑' : ind.signal.includes('BEAR') ? '↓' : '→'}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function TPSLDisplay({ tp, isLong, isTrial, currentPrice }) {
  if (!tp) return null

  const TrialMask = ({ children }) => isTrial ? (
    <div style={{ position: 'relative' }}>
      <div style={{ filter: 'blur(4px)', userSelect: 'none' }}>{children}</div>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${C.gold}11`, borderRadius: 8,
      }}>
        <div style={{
          background: '#000', color: C.gold, padding: '4px 10px', borderRadius: 6,
          fontSize: 10, fontWeight: 700, border: `1px solid ${C.gold}`,
        }}>
          🔒 ৳5000 দিয়ে Unlock
        </div>
      </div>
    </div>
  ) : children

  return (
    <div style={{ background: '#0d1117', borderRadius: 10, padding: 12, marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 9, color: C.muted, fontWeight: 700 }}>💰 ENTRY</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>${tp.entry}</div>
        </div>
        {currentPrice && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: C.muted, fontWeight: 700 }}>📍 NOW</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.blue }}>${currentPrice.toFixed(6)}</div>
          </div>
        )}
      </div>

      <TrialMask>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Row label="🎯 TP1" value={`$${tp.tp1}`} pct={`${isLong ? '+' : '-'}${tp.tp1Pct}%`} color={C.green} />
          <Row label="🎯 TP2" value={`$${tp.tp2}`} pct={`${isLong ? '+' : '-'}${tp.tp2Pct}%`} color={C.green} />
          <Row label="🎯 TP3" value={`$${tp.tp3}`} pct={`${isLong ? '+' : '-'}${tp.tp3Pct}%`} color={C.green} />
          <Row label="🛑 SL"  value={`$${tp.sl}`}  pct={`-${tp.riskPct}%`} color={C.red} />
        </div>

        <div style={{ marginTop: 8, padding: 6, background: C.panel, borderRadius: 6, textAlign: 'center', fontSize: 10, color: C.gold }}>
          ⚖️ R:R = 1:{tp.rr}  •  📊 Spot Trading
        </div>
      </TrialMask>
    </div>
  )
}

const Row = ({ label, value, pct, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
    <span style={{ color: C.muted }}>{label}</span>
    <span style={{ color: C.text, fontWeight: 700 }}>{value} <span style={{ color, fontSize: 10 }}>({pct})</span></span>
  </div>
)

const StatBox = ({ label, value, color }) => (
  <div style={{ flex: 1, background: '#0d1117', borderRadius: 6, padding: '6px 4px', textAlign: 'center' }}>
    <div style={{ fontSize: 9, color: C.muted }}>{label}</div>
    <div style={{ fontSize: 11, fontWeight: 700, color }}>{value || '-'}</div>
  </div>
)

function SignalItem({ signal, livePrice, isTrial }) {
  const isLong = signal.direction === 'LONG'
  const color = isLong ? C.green : C.red
  const pnl = livePrice && signal.tp?.entry
    ? ((livePrice - signal.tp.entry) / signal.tp.entry) * 100 * (isLong ? 1 : -1)
    : 0
  const strengthIcon = signal.strength === 'ULTRA' ? '🔥' : signal.strength === 'STRONG' ? '💪' : '✅'

  return (
    <div style={{
      background: '#0d1117', padding: 10, borderRadius: 8,
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
            {strengthIcon} {signal.coin?.replace('USDT', '')} {signal.direction}
          </div>
          <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>
            {signal.confidence}% • Entry: ${signal.tp?.entry}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: pnl >= 0 ? C.green : C.red }}>
            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
          </div>
          <div style={{ fontSize: 9, color: C.muted }}>{signal.status || 'ACTIVE'}</div>
        </div>
      </div>
    </div>
  )
}

function HistoryItem({ signal }) {
  const isWin = ['TP1_HIT', 'TP2_HIT', 'TP3_HIT'].includes(signal.result)
  const color = isWin ? C.green : C.red
  const icon = isWin ? '✅' : '🛑'
  return (
    <div style={{
      background: '#0d1117', padding: 8, borderRadius: 6,
      borderLeft: `3px solid ${color}`,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700 }}>
          {icon} {signal.coin?.replace('USDT', '')} {signal.direction}
        </div>
        <div style={{ fontSize: 9, color: C.muted }}>
          {signal.closedAt?.toDate?.()?.toLocaleString('en-GB') || ''}
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color }}>
        {signal.result || (isWin ? 'WIN' : 'LOSS')}
      </div>
    </div>
  )
}

function StatsView({ stats, history }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <BigStatBox label="Total" value={stats.total} color={C.blue} />
        <BigStatBox label="Wins" value={stats.wins} color={C.green} />
        <BigStatBox label="Losses" value={stats.losses} color={C.red} />
      </div>
      <div style={{ background: C.card, borderRadius: 12, padding: 20, border: `1px solid ${C.border}`, textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em' }}>
          Win Rate
        </div>
        <div style={{ fontSize: 48, fontWeight: 900, color: stats.winRate >= 70 ? C.green : C.gold, marginTop: 8 }}>
          {stats.winRate}%
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
          আল্লাহর রহমতে 🤲
        </div>
      </div>
    </div>
  )
}

const BigStatBox = ({ label, value, color }) => (
  <div style={{ flex: 1, background: C.card, borderRadius: 10, padding: 12, textAlign: 'center', border: `1px solid ${C.border}` }}>
    <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
  </div>
)

function SignalPopup({ signal, onClose, isTrial }) {
  const isLong = signal.direction === 'LONG'
  const color = isLong ? C.green : C.red

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20,
      animation: 'fadeIn 0.3s',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.card, borderRadius: 16, padding: 20,
        border: `2px solid ${color}`, maxWidth: 360, width: '100%',
        boxShadow: `0 0 40px ${color}66`,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, color: C.orange, fontWeight: 700 }}>🔥 ULTRA SIGNAL!</div>
          <div style={{ fontSize: 28, fontWeight: 900, color, marginTop: 4 }}>
            {isLong ? '🟢 LONG' : '🔴 SHORT'} {signal.coin?.replace('USDT', '')}
          </div>
        </div>
        <TPSLDisplay tp={signal.tp} isLong={isLong} isTrial={isTrial} />
        <button onClick={onClose} style={{
          width: '100%', padding: 12, borderRadius: 10, marginTop: 12,
          background: color, color: '#000', fontWeight: 800, fontSize: 13,
          border: 'none', cursor: 'pointer',
        }}>
          ✅ ঠিক আছে
        </button>
      </div>
    </div>
  )
  }
