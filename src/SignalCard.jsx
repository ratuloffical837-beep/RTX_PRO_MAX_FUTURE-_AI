import { C } from './App'

export default function SignalCard({ signal, coin, market, isTrial, livePrice }) {
  if (!signal || !signal.direction) return null

  const isLong = signal.direction === 'LONG'
  const color = isLong ? C.green : C.red
  const strengthColor =
    signal.strength === 'ULTRA' ? C.orange :
    signal.strength === 'STRONG' ? C.green :
    signal.strength === 'NORMAL' ? C.cyan :
    C.muted
  const strengthIcon =
    signal.strength === 'ULTRA' ? '🔥' :
    signal.strength === 'STRONG' ? '💪' :
    signal.strength === 'NORMAL' ? '✅' : '⚠️'

  return (
    <div style={{
      background: C.card, borderRadius: 16, padding: 18,
      border: `2px solid ${color}`,
      boxShadow: `0 0 32px ${color}33`,
      animation: 'fadeIn 0.4s ease-out',
    }}>
      {/* ── DIRECTION ── */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{
          fontSize: 28, fontWeight: 900, color,
          letterSpacing: '0.05em',
          textShadow: `0 0 20px ${color}66`,
        }}>
          {isLong ? '🟢 LONG (BUY)' : '🔴 SHORT (SELL)'}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4, letterSpacing: '0.1em' }}>
          {market === 'futures' ? '⚡ FUTURES' : '📊 SPOT'} • {coin}
        </div>
      </div>

      {/* ── STRENGTH BADGE ── */}
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <span style={{
          background: `linear-gradient(135deg, ${strengthColor}22, ${strengthColor}44)`,
          color: strengthColor,
          border: `1px solid ${strengthColor}77`,
          borderRadius: 24, padding: '6px 18px',
          fontSize: 12, fontWeight: 800, letterSpacing: '0.05em',
        }}>
          {strengthIcon} {signal.strength} — {signal.confidence}%
        </span>
      </div>

      {/* ── TP/SL DISPLAY ── */}
      {signal.tp && (
        <TPSLDisplay
          tp={signal.tp}
          isLong={isLong}
          isTrial={isTrial}
          currentPrice={livePrice}
          market={market}
        />
      )}

      {/* ── QUICK STATS ── */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <StatBox label="ADX" value={signal.adxValue} color={signal.adxValue > 25 ? C.green : C.muted} />
        <StatBox label="RSI" value={signal.rsiValue} color={signal.rsiValue > 70 ? C.red : signal.rsiValue < 30 ? C.green : C.gold} />
        <StatBox label="VOTES" value={`${signal.callVotes}/${signal.putVotes}`} color={C.cyan} />
      </div>

      {/* ── SMC ANALYSIS ── */}
      {signal.smcAnalysis && (
        <div style={{
          marginTop: 12, padding: 10, background: C.panel, borderRadius: 8,
          border: `1px solid ${C.border}`,
        }}>
          <div style={{
            fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', marginBottom: 8,
          }}>
            🏦 Smart Money Analysis
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <SMCItem label="Order Block" value={signal.smcAnalysis.orderBlock} />
            <SMCItem label="FVG" value={signal.smcAnalysis.fvg} />
            <SMCItem label="BOS/CHoCH" value={signal.smcAnalysis.bos} />
            <SMCItem label="CRT" value={signal.smcAnalysis.crt} />
            <SMCItem label="TBS" value={signal.smcAnalysis.tbs} />
            <SMCItem label="VSA" value={signal.smcAnalysis.vsa} />
          </div>
        </div>
      )}

      {/* ── MTF BIAS ── */}
      {signal.mtfBias && Object.keys(signal.mtfBias).length > 0 && (
        <div style={{
          marginTop: 10, padding: 10, background: C.panel, borderRadius: 8,
          border: `1px solid ${C.border}`,
        }}>
          <div style={{
            fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', marginBottom: 8,
          }}>
            ⏱️ Multi-Timeframe Bias
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', gap: 4 }}>
            {Object.entries(signal.mtfBias).map(([tf, bias]) => (
              <div key={tf} style={{
                flex: 1, textAlign: 'center', padding: '6px 4px',
                background: bias === 'B' ? `${C.green}22` : bias === 'S' ? `${C.red}22` : `${C.muted}22`,
                borderRadius: 6,
                border: `1px solid ${bias === 'B' ? C.green : bias === 'S' ? C.red : C.muted}44`,
              }}>
                <div style={{ fontSize: 9, color: C.muted, fontWeight: 700 }}>{tf.toUpperCase()}</div>
                <div style={{
                  fontSize: 14, fontWeight: 800,
                  color: bias === 'B' ? C.green : bias === 'S' ? C.red : C.muted,
                  marginTop: 2,
                }}>
                  {bias === 'B' ? '↑' : bias === 'S' ? '↓' : '→'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PATTERN ── */}
      {signal.pattern && signal.pattern !== 'None' && (
        <div style={{
          textAlign: 'center', fontSize: 11, color: C.gold,
          marginTop: 12, padding: '6px',
          background: `${C.gold}11`, borderRadius: 6,
          border: `1px solid ${C.gold}33`,
        }}>
          📊 {signal.pattern}
        </div>
      )}

      {/* ── INDICATORS BREAKDOWN ── */}
      {signal.indicators && signal.indicators.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{
            cursor: 'pointer', fontSize: 10, color: C.cyan, fontWeight: 700,
            textAlign: 'center', padding: 8, background: `${C.cyan}11`,
            borderRadius: 6, border: `1px solid ${C.cyan}33`,
          }}>
            📊 View {signal.totalIndicators || 200} Indicators Analysis
          </summary>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 4, marginTop: 8, maxHeight: 240, overflowY: 'auto',
          }}>
            {signal.indicators.map((ind, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 9, padding: '5px 8px', borderRadius: 4,
                background: '#0d1117',
                borderLeft: `2px solid ${
                  ind.signal.includes('BULL') ? C.green :
                  ind.signal.includes('BEAR') ? C.red : C.muted
                }`,
              }}>
                <span style={{
                  color: C.muted, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{ind.name}</span>
                <span style={{
                  color: ind.signal.includes('BULL') ? C.green :
                         ind.signal.includes('BEAR') ? C.red : C.muted,
                  fontWeight: 800, marginLeft: 4,
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

function TPSLDisplay({ tp, isLong, isTrial, currentPrice, market }) {
  if (!tp) return null

  return (
    <div style={{
      background: '#0a0e17', borderRadius: 12, padding: 14,
      marginTop: 8, border: `1px solid ${C.border}`,
    }}>
      {/* Entry + Current Price */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginBottom: 12,
        padding: 10, background: C.panel, borderRadius: 8,
      }}>
        <div>
          <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: '0.08em' }}>
            💰 ENTRY
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginTop: 2 }}>
            ${tp.entry}
          </div>
        </div>
        {currentPrice && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: '0.08em' }}>
              📍 NOW
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.cyan, marginTop: 2 }}>
              ${currentPrice.toFixed(tp.entry < 1 ? 6 : tp.entry < 100 ? 4 : 2)}
            </div>
          </div>
        )}
      </div>

      {/* TP/SL Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <TPRow label={`🎯 TP1 (${tp.closePosition?.[0] || 50}%)`} value={`$${tp.tp1}`}
               pct={`${isLong ? '+' : '-'}${tp.tp1Pct}%`} color={C.green} />
        <TPRow label={`🎯 TP2 (${tp.closePosition?.[1] || 30}%)`} value={`$${tp.tp2}`}
               pct={`${isLong ? '+' : '-'}${tp.tp2Pct}%`} color={C.green} />
        <TPRow label={`🎯 TP3 (${tp.closePosition?.[2] || 20}%)`} value={`$${tp.tp3}`}
               pct={`${isLong ? '+' : '-'}${tp.tp3Pct}%`} color={C.green} />
        <TPRow label="🛑 STOP LOSS" value={`$${tp.sl}`} pct={`-${tp.riskPct}%`} color={C.red} />
      </div>

      {/* Risk:Reward + Leverage */}
      <div style={{
        marginTop: 12, padding: '8px 10px',
        background: `linear-gradient(135deg, ${C.gold}11, ${C.orange}11)`,
        borderRadius: 8, border: `1px solid ${C.gold}33`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, color: C.gold, fontWeight: 700 }}>
          ⚖️ R:R = 1:{tp.rr}
        </span>
        {market === 'futures' && (
          <span style={{ fontSize: 11, color: C.orange, fontWeight: 700 }}>
            📊 Leverage: {tp.leverage}
          </span>
        )}
      </div>

      {/* Trial Warning */}
      {isTrial && (
        <div style={{
          marginTop: 10, padding: '8px 10px',
          background: `${C.gold}22`, borderRadius: 6,
          border: `1px solid ${C.gold}55`, textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: C.gold, fontWeight: 700 }}>
            🎁 Trial Mode — Full Access
          </div>
          <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>
            Premium নিন Unlimited Signal এর জন্য
          </div>
        </div>
      )}
    </div>
  )
}

const TPRow = ({ label, value, pct, color }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 11, padding: '6px 8px',
    background: '#13192244', borderRadius: 6,
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
      flex: 1, background: C.panel, borderRadius: 8,
      padding: '8px 6px', textAlign: 'center',
      border: `1px solid ${C.border}`,
    }}>
      <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color, marginTop: 3 }}>
        {value || '-'}
      </div>
    </div>
  )
}

function SMCItem({ label, value }) {
  const color = value === 'B' ? C.green : value === 'S' ? C.red : C.muted
  const icon = value === 'B' ? '↑' : value === 'S' ? '↓' : '→'
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '4px 8px', background: '#0a0e17',
      borderRadius: 4, fontSize: 10,
      borderLeft: `2px solid ${color}`,
    }}>
      <span style={{ color: C.muted, fontWeight: 600 }}>{label}</span>
      <span style={{ color, fontWeight: 800 }}>{icon}</span>
    </div>
  )
          }
