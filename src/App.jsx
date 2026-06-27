import { useState, useEffect } from 'react'
import { db } from './firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import PaymentPage from './PaymentPage'
import SpotSection from './SpotSection'
import FuturesSection from './FuturesSection'

const tg = window.Telegram?.WebApp
const getTgUser = () => {
  if (tg?.initDataUnsafe?.user) return tg.initDataUnsafe.user
  return { id: 99999999, first_name: 'Test', last_name: '', username: 'testuser' }
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''
const SUPPORT_LINK = 'https://t.me/ratulhossain56'
const GROUP_LINK   = 'https://t.me/ratulhossain424'
const CHANNEL_LINK = 'https://t.me/ratulhossain4241'

// ── RTX Color Palette (Bybit/Bloomberg Style) ──
export const C = {
  bg:      '#0a0e17',
  card:    '#131722',
  panel:   '#1a1f2e',
  border:  '#2a2e3e',
  text:    '#e6edf3',
  muted:   '#6e7681',
  dim:     '#484f58',
  green:   '#00d68f',
  red:     '#ff3b5c',
  gold:    '#ffd700',
  orange:  '#ff8c00',
  cyan:    '#00d4ff',
  blue:    '#3b82f6',
  purple:  '#a78bfa',
  pink:    '#ec4899',
}

export default function App() {
  const tgUser = getTgUser()
  const [authStatus, setAuthStatus] = useState('loading')
  const [trialEnd, setTrialEnd] = useState(null)
  const [trialRemaining, setTrialRemaining] = useState(null)
  const [refreshCount, setRefreshCount] = useState(5)
  const [activeTab, setActiveTab] = useState(localStorage.getItem('rtx_tab') || 'futures')
  const [liveTime, setLiveTime] = useState('--:--:--')

  // ── Check Status via Backend ──
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
          setAuthStatus('new')
        }
      } catch (e) {
        console.error('Status check failed:', e)
        // Fallback to Firebase direct check
        checkFirebaseStatus()
      }
    }

    const checkFirebaseStatus = () => {
      const uid = String(tgUser.id)
      const unsub = onSnapshot(doc(db, 'crypto_users', uid), (snap) => {
        if (snap.exists()) {
          const d = snap.data()
          if (d.status === 'approved') {
            const exp = d.expiresAt?.toDate?.()
            if (exp && exp > new Date()) {
              setAuthStatus('approved')
              return
            }
          }
          if (d.status === 'pending') { setAuthStatus('pending'); return }
          if (d.status === 'rejected') { setAuthStatus('rejected'); return }
        }
        setAuthStatus('trial')
        setTrialEnd(new Date(Date.now() + 24 * 60 * 60 * 1000))
      })
      return () => unsub()
    }

    checkStatus()
    const iv = setInterval(checkStatus, 30000) // refresh every 30 sec
    return () => clearInterval(iv)
  }, [tgUser.id])

  // ── Live Clock + Trial Countdown ──
  useEffect(() => {
    const tick = setInterval(() => {
      const now = new Date()
      setLiveTime(now.toLocaleTimeString('en-GB'))

      if (trialEnd) {
        const diff = trialEnd - now
        if (diff <= 0) {
          setAuthStatus('trial_expired')
          setTrialRemaining(null)
        } else {
          const h = Math.floor(diff / 3600000)
          const m = Math.floor((diff % 3600000) / 60000)
          const s = Math.floor((diff % 60000) / 1000)
          setTrialRemaining(`${h}h ${m}m ${s}s`)
        }
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [trialEnd])

  // ── Loading ──
  if (authStatus === 'loading') {
    return (
      <div style={{
        background: C.bg, minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 20,
      }}>
        <div style={{ fontSize: 60, animation: 'bounce 1s infinite' }}>🚀</div>
        <div style={{
          fontSize: 28, fontWeight: 900, letterSpacing: '0.1em',
          background: `linear-gradient(135deg, ${C.orange}, ${C.cyan})`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>RTX</div>
        <div style={{ color: C.muted, fontSize: 11, letterSpacing: '0.2em' }}>
          REAL TRADING eXPERT
        </div>
      </div>
    )
  }

  // ── Payment / Restricted Screens ──
  if (['new', 'pending', 'rejected', 'expired', 'trial_expired'].includes(authStatus)) {
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
      {/* ── HEADER ── */}
      <header style={{
        background: `linear-gradient(180deg, ${C.card}, ${C.bg})`,
        borderBottom: `1px solid ${C.border}`,
        padding: '12px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            fontSize: 22,
            filter: 'drop-shadow(0 0 8px rgba(255,140,0,0.5))',
          }}>🚀</div>
          <div>
            <div style={{
              fontSize: 16, fontWeight: 900, letterSpacing: '0.08em',
              background: `linear-gradient(135deg, ${C.orange}, ${C.cyan})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>RTX</div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: '0.1em' }}>
              REAL TRADING eXPERT
            </div>
          </div>
        </div>

        {isTrial && trialRemaining && (
          <div style={{
            background: `linear-gradient(135deg, ${C.gold}22, ${C.orange}22)`,
            border: `1px solid ${C.gold}55`,
            borderRadius: 20, padding: '5px 12px',
            fontSize: 10, fontWeight: 700, color: C.gold,
            display: 'flex', alignItems: 'center', gap: 6,
            animation: 'pulse 2s infinite',
          }}>
            🎁 {trialRemaining}
          </div>
        )}

        {isPremium && (
          <div style={{
            background: `linear-gradient(135deg, ${C.green}22, ${C.cyan}22)`,
            border: `1px solid ${C.green}55`,
            borderRadius: 20, padding: '5px 12px',
            fontSize: 10, fontWeight: 700, color: C.green,
          }}>
            💎 PREMIUM
          </div>
        )}

        <div style={{
          fontSize: 11, color: C.muted, fontVariantNumeric: 'tabular-nums',
          fontWeight: 500,
        }}>{liveTime}</div>
      </header>

      {/* ── PREMIUM UPGRADE BANNER (Trial Only) ── */}
      {isTrial && (
        <div
          onClick={() => window.scrollTo(0, document.body.scrollHeight)}
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

      {/* ── SPOT/FUTURES TOGGLE ── */}
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
            border: 'none', transition: '0.3s',
            boxShadow: activeTab === 'spot' ? `0 4px 16px ${C.cyan}44` : 'none',
            letterSpacing: '0.05em',
          }}
        >
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
            border: 'none', transition: '0.3s',
            boxShadow: activeTab === 'futures' ? `0 4px 16px ${C.orange}44` : 'none',
            letterSpacing: '0.05em',
          }}
        >
          ⚡ FUTURES
        </button>
      </div>

      {/* ── MAIN CONTENT ── */}
      {activeTab === 'spot' ? (
        <SpotSection
          isTrial={isTrial}
          tgUser={tgUser}
          refreshCount={refreshCount}
          setRefreshCount={setRefreshCount}
        />
      ) : (
        <FuturesSection
          isTrial={isTrial}
          tgUser={tgUser}
          refreshCount={refreshCount}
          setRefreshCount={setRefreshCount}
        />
      )}

      {/* ── FOOTER ── */}
      <div style={{
        display: 'flex', gap: 8, padding: '14px 16px',
        background: C.card, borderTop: `1px solid ${C.border}`,
        marginTop: 20,
      }}>
        <button onClick={() => window.open(GROUP_LINK, '_blank')} style={footerBtn(C.cyan)}>
          💬 Group
        </button>
        <button onClick={() => window.open(CHANNEL_LINK, '_blank')} style={footerBtn(C.purple)}>
          📢 Channel
        </button>
        <button onClick={() => window.open(SUPPORT_LINK, '_blank')} style={footerBtn(C.green)}>
          🆘 Support
        </button>
      </div>

      <div style={{
        textAlign: 'center', padding: '10px', fontSize: 10, color: C.dim,
        background: C.bg,
      }}>
        RTX v3.0 • আল্লাহর রহমতে 🤲
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.02); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 12px currentColor; }
          50% { box-shadow: 0 0 24px currentColor; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
      `}</style>
    </div>
  )
}

const footerBtn = (color) => ({
  flex: 1, padding: '10px',
  borderRadius: 10, background: 'transparent',
  color, fontWeight: 700, fontSize: 11,
  border: `1px solid ${color}33`,
  cursor: 'pointer', transition: '0.2s',
})
