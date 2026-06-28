import { C } from './App'

export default function SignalCard({ signal, coin, market, isTrial, livePrice }) {
  if (!signal || !signal.direction) return null

  const isLong = signal.direction === 'LONG'
  const color = isLong ? C.green : C.red

  const strengthColor =
    signal.strength === 'ULTRA' ? C.orange :
    signal.strength === 'STRONG' ? C.green :
    signal.strength === 'NORMAL' ? C.cyan : C.muted

  const strengthIcon =
    signal.strength === 'ULTRA' ? '🔥' :
    signal.strength === 'STRONG' ? '💪' :
    signal.strength === 'NORMAL' ? '✅' : '⚠️'

  const modeLabel =
    signal.mode === 'SWEEP_RECLAIM' ? '🔵 SWEEP' :
    signal.mode?.includes('HYBRID') ? '🔥 HYBRID' :
    '🟢 INDICATORS'

  return (
    <div style={{
      background: C.card,
      borderRadius: 16,
      padding: 18,
      border: `2px solid ${color}`,
      boxShadow: `0 0 32px ${color}33`,
      position: 'relative',
    }}>
      {/* Mode Badge */}
      <div style={{
        position: 'absolute',
        top: -14,
        left: 16,
        background: C.card,
        color: C.cyan,
        fontSize: 9,
        fontWeight: 800,
        padding: '3px 10px',
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        letterSpacing: '0.1em',
      }}>
        {modeLabel}
      </div>

      {/* Direction */}
      <div style={{ textAlign: 'center', marginBottom: 12, marginTop: 18 }}>
        <div style={{
          fontSize: 26,
          fontWeight: 900,
          color,
          letterSpacing: '0.05em',
        }}>
          {isLong ? '🟢 LONG (BUY)' : '🔴 SHORT (SELL)'}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
          {market === 'futures' ? '⚡ FUTURES' : '📊 SPOT'} • {coin}
        </div>
      </div>

      {/* Strength Badge */}
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <span style={{
          background: `linear-gradient(135deg, ${strengthColor}22, ${strengthColor}44)`,
          color: strengthColor,
          border: `1px solid ${strengthColor}77`,
          borderRadius: 24,
          padding: '6px 18px',
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.05em',
        }}>
          {strengthIcon} {signal.strength} — {signal.confidence}%
          {signal.grade && ` • ${signal.grade}`}
        </span>
      </div>

      {/* TP/SL Display */}
      {signal.tp && (
        <div style={{
          background: '#0a0e17',
          borderRadius: 12,
          padding: 14,
          marginTop: 8,
          border: `1px solid ${C.border}`,
        }}>
          <div style={{ padding: 10, background: C.panel, borderRadius: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: C.muted, fontWeight: 700 }}>💰 ENTRY PRICE</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginTop: 2 }}>
              ${signal.tp.entry}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <TPRow label={`🎯 TP1 (50%)`} value={`$${signal.tp.tp1}`} pct={`+${signal.tp.tp1Pct}%`} color={C.green} />
            <TPRow label={`🎯 TP2 (30%)`} value={`$${signal.tp.tp2}`} pct={`+${signal.tp.tp2Pct}%`} color={C.green} />
            <TPRow label={`🎯 TP3 (20%)`} value={`$${signal.tp.tp3}`} pct={`+${signal.tp.tp3Pct}%`} color={C.green} />
            <TPRow label="🛑 STOP LOSS" value={`$${signal.tp.sl}`} pct={`-${signal.tp.riskPct}%`} color={C.red} />
          </div>

          <div style={{
            marginTop: 12,
            padding: '8px 10px',
            background: `linear-gradient(135deg, ${C.gold}11, ${C.orange}11)`,
            borderRadius: 8,
            border: `1px solid ${C.gold}33`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 11, color: C.gold, fontWeight: 700 }}>
              ⚖️ R:R = 1:{signal.tp.rr}
            </span>
            {market === 'futures' && signal.tp.leverage && (
              <span style={{ fontSize: 11, color: C.orange, fontWeight: 700 }}>
                📊 {signal.tp.leverage}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <StatBox label="ADX" value={signal.adxValue} color={signal.adxValue > 25 ? C.green : C.muted} />
        <StatBox label="RSI" value={signal.rsiValue} color={signal.rsiValue > 70 ? C.red : signal.rsiValue < 30 ? C.green : C.gold} />
        <StatBox label="VOTES" value={`${signal.callVotes}/${signal.putVotes}`} color={C.cyan} />
      </div>
    </div>
  )
}

const TPRow = ({ label, value, pct, color }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 11,
    padding: '6px 8px',
    background: '#13192244',
    borderRadius: 6,
  }}>
    <span style={{ color: C.muted, fontWeight: 600 }}>{label}</span>
    <span style={{ color: C.text, fontWeight: 800 }}>
      {value} <span style={{ color, fontSize: 10, marginLeft: 4 }}>({pct})</span>
    </span>
  </div>
)

function StatBox({ label, value, color }) {
  return (
    <div style={{
      flex: 1,
      background: C.panel,
      borderRadius: 8,
      padding: '8px 6px',
      textAlign: 'center',
      border: `1px solid ${C.border}`,
    }}>
      <div style={{ fontSize: 9, color: C.muted, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color, marginTop: 3 }}>
        {value || '-'}
      </div>
    </div>
  )
    }
