import { useState, useEffect, useRef, useCallback } from 'react'
import { db } from './firebase'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import PaymentPage from './PaymentPage'
import TrialPage from './TrialPage'
import SpotSection from './SpotSection'
import FuturesSection from './FuturesSection'

const tg = window.Telegram?.WebApp
if (tg) { tg.ready(); tg.expand() }

const getTgUser = () => {
  if (tg?.initDataUnsafe?.user) return tg.initDataUnsafe.user
  return { id: 99999999, first_name: 'Test', last_name: '', username: 'testuser' }
}

const SUPPORT_LINK = 'https://t.me/ratulhossain56'
const GROUP_LINK   = 'https://t.me/ratulhossain424'
const CHANNEL_LINK = 'https://t.me/ratulhossain4241'

export const C = {
  bg: '#0b0e11', card: '#141820', panel: '#1a1f2e',
  border: '#2b3139', text: '#e0e0e0', muted: '#555', dim: '#888',
  green: '#0ecb81', red: '#f6465d', gold: '#f3ba2f',
  blue: '#60a5fa', purple: '#a78bfa', orange: '#fb923c',
  pink: '#ec4899',
}

export default function App() {
  const tgUser = getTgUser()
  const [authStatus, setAuthStatus]   = useState('loading')
  const [trialData, setTrialData]     = useState(null)
  const [activeTab, setActiveTab]     = useState(localStorage.getItem('crypto_tab') || 'futures')
  const [liveTime, setLiveTime]       = useState('--:--:--')
  const [trialRemaining, setTrialRemaining] = useState(null)

  // ── Firebase Auth Listener ──
  useEffect(() => {
    const uid = String(tgUser.id)
    if (!uid || uid === '0') { setAuthStatus('new'); return }

    // Check paid user first
    const unsubUser = onSnapshot(doc(db, 'crypto_users', uid), async (snap) => {
      if (snap.exists()) {
        const d = snap.data()
        if (d.status === 'approved') {
          const exp = d.expiresAt?.toDate?.()
          if (exp && exp < new Date()) {
            setAuthStatus('expired')
          } else {
            setAuthStatus('approved')
            return
          }
        } else if (d.status === 'rejected') {
          setAuthStatus('rejected')
          return
        } else if (d.status === 'disconnected') {
          setAuthStatus('expired')
          return
        } else if (d.status === 'pending') {
          setAuthStatus('pending')
          return
        }
      }

      // No paid user → Check trial
      checkTrial(uid)
    }, () => checkTrial(uid))

    return () => unsubUser()
  }, [tgUser.id])

  const checkTrial = async (uid) => {
    const trialRef = doc(db, 'crypto_trials', uid)
    const unsubTrial = onSnapshot(trialRef, async (snap) => {
      if (!snap.exists()) {
        // Start new trial - 24h free
        const trialEnd = new Date(Date.now() + 24 * 60 * 60 * 1000)
        const trialStart = new Date()
        try {
          await setDoc(trialRef, {
            userId: uid,
            name: tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : ''),
            username: tgUser.username || '',
            trialStart,
            trialEnd,
            createdAt: serverTimestamp(),
          })
          setTrialData({ trialStart, trialEnd })
          setAuthStatus('trial')
        } catch (e) {
          console.error('Trial create error:', e)
          setAuthStatus('new')
        }
      } else {
        const d = snap.data()
        const trialEnd = d.trialEnd?.toDate?.()
        if (trialEnd && trialEnd > new Date()) {
          setTrialData({ trialStart: d.trialStart?.toDate?.(), trialEnd })
          setAuthStatus('trial')
        } else {
          setAuthStatus('trial_expired')
        }
      }
    })
    return () => unsubTrial()
  }

  // ── Live Clock + Trial Countdown ──
  useEffect(() => {
    const tick = setInterval(() => {
      const now = new Date()
      setLiveTime(now.toLocaleTimeString('en-GB'))

      if (trialData?.trialEnd) {
        const diff = trialData.trialEnd - now
        if (diff <= 0) {
          setAuthStatus('trial_expired')
          setTrialRemaining(null)
        } else {
          const hours = Math.floor(diff / 3600000)
          const minutes = Math.floor((diff % 3600000) / 60000)
          const seconds = Math.floor((diff % 60000) / 1000)
          setTrialRemaining(`${hours}h ${minutes}m ${seconds}s`)
        }
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [trialData])

  // ── Auth Guards ──
  if (authStatus === 'loading') {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 48 }}>🚀</div>
        <div style={{ color: C.muted, fontSize: 14 }}>লোড হচ্ছে...</div>
        <div style={{ width: 40, height: 4, background: C.panel, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: '100%', height: '100%', background: C.gold, animation: 'pulse 1s infinite' }} />
        </div>
      </div>
    )
  }

  if (['new', 'pending', 'rejected', 'expired', 'trial_expired'].includes(authStatus)) {
    return <PaymentPage tgUser={tgUser} status={authStatus} />
  }

  // ── Main Trading UI ──
  const isTrial = authStatus === 'trial'

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: "'Inter', -apple-system, sans-serif", minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── TOP HEADER ── */}
      <header style={{
        background: C.card, borderBottom: `1px solid ${C.border}`,
        padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 18 }}>🚀</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Crypto Master</div>
            <div style={{ fontSize: 9, color: C.muted }}>v2.0 • Live</div>
          </div>
        </div>

        {isTrial && trialRemaining && (
          <div style={{
            background: `${C.gold}22`, border: `1px solid ${C.gold}55`,
            borderRadius: 16, padding: '4px 10px', fontSize: 10, fontWeight: 700, color: C.gold,
          }}>
            🎁 Trial: {trialRemaining}
          </div>
        )}

        <div style={{ fontSize: 11, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
          {liveTime}
        </div>
      </header>

      {/* ── SPOT/FUTURES TOGGLE ── */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 12px',
        background: C.card, borderBottom: `1px solid ${C.border}`,
      }}>
        <button
          onClick={() => { setActiveTab('spot'); localStorage.setItem('crypto_tab', 'spot') }}
          style={{
            flex: 1, padding: '10px', borderRadius: 8, fontWeight: 800, fontSize: 13,
            cursor: 'pointer', transition: '0.2s',
            background: activeTab === 'spot' ? `linear-gradient(135deg, ${C.blue}, ${C.purple})` : C.panel,
            color: activeTab === 'spot' ? '#fff' : C.muted,
            border: 'none',
            boxShadow: activeTab === 'spot' ? `0 4px 12px ${C.blue}44` : 'none',
          }}
        >
          📊 SPOT TRADING
        </button>
        <button
          onClick={() => { setActiveTab('futures'); localStorage.setItem('crypto_tab', 'futures') }}
          style={{
            flex: 1, padding: '10px', borderRadius: 8, fontWeight: 800, fontSize: 13,
            cursor: 'pointer', transition: '0.2s',
            background: activeTab === 'futures' ? `linear-gradient(135deg, ${C.orange}, ${C.pink})` : C.panel,
            color: activeTab === 'futures' ? '#fff' : C.muted,
            border: 'none',
            boxShadow: activeTab === 'futures' ? `0 4px 12px ${C.orange}44` : 'none',
          }}
        >
          ⚡ FUTURES
        </button>
      </div>

      {/* ── MAIN CONTENT ── */}
      {activeTab === 'spot' ? (
        <SpotSection isTrial={isTrial} tgUser={tgUser} />
      ) : (
        <FuturesSection isTrial={isTrial} tgUser={tgUser} />
      )}

      {/* ── FOOTER ── */}
      <div style={{ display: 'flex', gap: 6, padding: '12px', background: C.card, borderTop: `1px solid ${C.border}` }}>
        <button onClick={() => window.open(GROUP_LINK, '_blank')} style={footerBtn(C.blue)}>
          💬 Group
        </button>
        <button onClick={() => window.open(CHANNEL_LINK, '_blank')} style={footerBtn(C.purple)}>
          📢 Channel
        </button>
        <button onClick={() => window.open(SUPPORT_LINK, '_blank')} style={footerBtn(C.green)}>
          🆘 Support
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 8px currentColor; }
          50% { box-shadow: 0 0 24px currentColor; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0b0e11; }
        ::-webkit-scrollbar-thumb { background: #2b3139; border-radius: 3px; }
      `}</style>
    </div>
  )
}

const footerBtn = (color) => ({
  flex: 1, padding: '10px', borderRadius: 8, background: 'transparent',
  color, fontWeight: 700, fontSize: 11,
  border: `1px solid ${color}33`, cursor: 'pointer',
})
