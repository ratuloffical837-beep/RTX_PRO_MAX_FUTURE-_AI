import { C } from './App'

export default function TrialPage({ remaining, onClose }) {
  return (
    <div style={{
      background: `${C.gold}11`, border: `1px solid ${C.gold}44`,
      borderRadius: 12, padding: '10px 14px', margin: '8px 12px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      animation: 'glow 2s infinite', color: C.gold,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🎁</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800 }}>Free Trial Active</div>
          <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>
            TP/SL দেখতে পেমেন্ট করুন
          </div>
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.gold }}>
        {remaining || '...'}
      </div>
    </div>
  )
                   }
