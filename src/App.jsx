import { useState, useEffect } from 'react'
import PaymentPage from './PaymentPage'
import SpotSection from './SpotSection'
import FuturesSection from './FuturesSection'
import SettingsModal from './SettingsModal'

const tg = window.Telegram?.WebApp

const getTgUser = () => {
  if (tg?.initDataUnsafe?.user) return tg.initDataUnsafe.user
  return { id: 99999999, first_name: 'Test', last_name: '', username: 'testuser' }
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''
const SUPPORT_LINK = 'https://t.me/ratulhossain56'
const GROUP_LINK = 'https://t.me/ratulhossain424'
const CHANNEL_LINK = 'https://t.me/ratulhossain4241'

export const C = {
  bg: '#0a0e17',
  card: '#131722',
  panel: '#1a1f2e',
  border: '#2a2e3e',
  text: '#e6edf3',
  muted: '#6e7681',
  dim: '#484f58',
  green: '#00d68f',
  red: '#ff3b5c',
  gold: '#ffd700',
  orange: '#ff8c00',
  cyan: '#00d4ff',
  blue: '#3b82f6',
  purple: '#a78bfa',
  pink: '#ec4899',
}

export default function App() {
  const tgUser = getTgUser()
  const [authStatus, setAuthStatus] = useState('loading')
  const [trialEnd, setTrialEnd] = useState(null)
  const [refreshCount, setRefreshCount] = useState(2)
  const [activeTab, setActiveTab] = useState(localStorage.getItem('rtx_tab') || 'futures')
  const [liveTime, setLiveTime] = useState('--:--:--')
  const [showSettings, setShowSettings] = useState(false)
  const [signalMode, setSignalMode] = useState(localStorage.getItem('rtx_mode') || 'hybrid')

  // ── Check Status (Only once on load) ──
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/check-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: String(tgUser.id) }),
        })
        const data = await res.json()

        if (data.ok) {
          setAuthStatus(data.status)
          if (data.trialEnd) setTrialEnd(new Date(data.trialEnd))
          if (typeof data.remaining === 'number') setRefreshCount(data.remaining)
        } else {
          setAuthStatus('trial')
        }
      } catch (e) {
        console.error('Status check failed:', e)
        setAuthStatus('trial')
      }
    }

    checkStatus()
  }, [tgUser.id])

  // ── Live Clock ──
  useEffect(() => {
    const tick = setInterval(() => {
      const now = new Date()
      setLiveTime(now.toLocaleTimeString('en-GB'))
    }, 1000)
    return () => clearInterval(tick)
  }, [])

  const handleModeChange = (mode) => {
    setSignalMode(mode)
    localStorage.setItem('rtx_mode', mode)
  }

  // ── Loading Screen ──
  if (authStatus === 'loading') {
    return (
      <div style={{
        background: C.bg, minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 20,
      }}>
        <div style={{ fontSize: 60, animation: 'bounce 1s infinite' }}>🚀</div>
        <div style={{
          fontSize: 32, fontWeight: 900, letterSpacing: '0.15em',
          background: `linear-gradient(135deg, ${C.orange}, ${C.cyan})`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          RTX
        </div>
        <div style={{ color: C.muted, fontSize: 11, letterSpacing: '0.2em' }}>
          REAL TRADING eXPERT • PRO MAX
        </div>
      </div>
    )
  }

  // ── Payment / Trial Expired Pages ──
  if (['new', 'pending', 'rejected', 'expired', 'trial_expired', 'upgrade'].includes(authStatus)) {
    return <PaymentPage tgUser={tgUser} status={authStatus} />
  }

  const isTrial = authStatus === 'trial'
  const isPremium = authStatus === 'approved'

  return (
    <div style={{
      background: C.bg, color: C.text,
      fontFamily: "'Inter', -apple-system, sans-serif",
      minHeight: '100vh', overflowX: 'hidden',
    }}>
      {/* Header */}
      <header style={{
        background: `linear-gradient(180deg, ${C.card}, ${C.bg})`,
        borderBottom: `1px solid ${C.border}`,
        padding: '12px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 22, filter: 'drop-shadow(0 0 8px rgba(255,140,0,0.5))' }}>🚀</div>
          <div>
            <div style={{
              fontSize: 16, fontWeight: 900, letterSpacing: '0.08em',
              background: `linear-gradient(135deg, ${C.orange}, ${C.cyan})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              RTX PRO MAX
            </div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: '0.1em' }}>
              {signalMode === 'sweep' ? '🔵 RTX PRO' :
               signalMode === 'indicator' ? '🟢 RTX PRO MAX' :
               '🔥 RTX ULTRA PRO MAX'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isTrial && trialEnd && (
            <div style={{
              background: `linear-gradient(135deg, ${C.gold}22, ${C.orange}22)`,
              border: `1px solid ${C.gold}55`,
              borderRadius: 20, padding: '5px 10px',
              fontSize: 10, fontWeight: 700, color: C.gold,
            }}>
              🎁 Trial
            </div>
          )}

          {isPremium && (
            <div style={{
              background: `linear-gradient(135deg, ${C.green}22, ${C.cyan}22)`,
              border: `1px solid ${C.green}55`,
              borderRadius: 20, padding: '5px 10px',
              fontSize: 10, fontWeight: 700, color: C.green,
            }}>
              💎 PREMIUM
            </div>
          )}

          <button onClick={() => setShowSettings(true)} style={{
            background: C.panel, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '6px 10px',
            color: C.cyan, fontSize: 16, cursor: 'pointer',
          }}>
            ⚙️
          </button>
        </div>
      </header>

      {/* Premium Upgrade Banner */}
      {isTrial && (
        <div
          onClick={() => setAuthStatus('upgrade')}
          style={{
            background: `linear-gradient(135deg, ${C.gold}, ${C.orange})`,
            padding: '10px 16px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            cursor: 'pointer',
            borderBottom: `1px solid ${C.border}`,
          }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#000' }}>
              💎 Premium নিন এখনই — ৳5000
            </div>
            <div style={{ fontSize: 10, color: '#000', opacity: 0.7, marginTop: 2 }}>
              Unlimited Signals + ৩০ দিন
            </div>
          </div>
          <div style={{
            background: '#000', color: C.gold, padding: '6px 12px',
            borderRadius: 6, fontSize: 11, fontWeight: 800,
          }}>
            UPGRADE →
          </div>
        </div>
      )}

      {/* Tab Switcher */}
      <div style={{
        display: 'flex', gap: 8, padding: '12px 16px',
        background: C.card, borderBottom: `1px solid ${C.border}`,
      }}>
        <button
          onClick={() => { setActiveTab('spot'); localStorage.setItem('rtx_tab', 'spot') }}
          style={{
            flex: 1, padding: '12px', borderRadius: 10,
            fontWeight: 800, fontSize: 13, cursor: 'pointer',
            background: activeTab === 'spot'
              ? `linear-gradient(135deg, ${C.cyan}, ${C.blue})`
              : C.panel,
            color: activeTab === 'spot' ? '#000' : C.muted,
            border: 'none',
          }}>
          📊 SPOT
        </button>
        <button
          onClick={() => { setActiveTab('futures'); localStorage.setItem('rtx_tab', 'futures') }}
          style={{
            flex: 1, padding: '12px', borderRadius: 10,
            fontWeight: 800, fontSize: 13, cursor: 'pointer',
            background: activeTab === 'futures'
              ? `linear-gradient(135deg, ${C.orange}, ${C.pink})`
              : C.panel,
            color: activeTab === 'futures' ? '#000' : C.muted,
            border: 'none',
          }}>
          ⚡ FUTURES
        </button>
      </div>

      {/* Main Content */}
      {activeTab === 'spot' ? (
        <SpotSection
          isTrial={isTrial}
          tgUser={tgUser}
          refreshCount={refreshCount}
          setRefreshCount={setRefreshCount}
          signalMode={signalMode}
        />
      ) : (
        <FuturesSection
          isTrial={isTrial}
          tgUser={tgUser}
          refreshCount={refreshCount}
          setRefreshCount={setRefreshCount}
          signalMode={signalMode}
        />
      )}

      {/* Footer */}
      <div style={{
        display: 'flex', gap: 8, padding: '14px 16px',
        background: C.card, borderTop: `1px solid ${C.border}`,
        marginTop: 20,
      }}>
        <button onClick={() => window.open(GROUP_LINK, '_blank')} style={footerBtn(C.cyan)}>💬 Group</button>
        <button onClick={() => window.open(CHANNEL_LINK, '_blank')} style={footerBtn(C.purple)}>📢 Channel</button>
        <button onClick={() => window.open(SUPPORT_LINK, '_blank')} style={footerBtn(C.green)}>🆘 Support</button>
      </div>

      <div style={{
        textAlign: 'center', padding: '10px', fontSize: 10, color: C.dim,
        background: C.bg,
      }}>
        RTX Pro Max v4.0 • আল্লাহর রহমতে 🤲
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          currentMode={signalMode}
          onModeChange={handleModeChange}
        />
      )}
    </div>
  )
}

const footerBtn = (color) => ({
  flex: 1, padding: '10px',
  borderRadius: 10, background: 'transparent',
  color, fontWeight: 700, fontSize: 11,
  border: `1px solid ${color}33`,
  cursor: 'pointer',
})
