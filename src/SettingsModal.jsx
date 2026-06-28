import { C } from './App'

export default function SettingsModal({ onClose, currentMode, onModeChange }) {
  const modes = [
    {
      id: 'sweep',
      icon: '🔵',
      title: 'RTX PRO',
      subtitle: 'Sweep Reclaim Strategy',
      description: 'Liquidity Sweep + Smart Money Reclaim',
      accuracy: '88-90% Accuracy',
      frequency: '3-8 signals/day',
      color: C.cyan,
      borderColor: C.cyan,
    },
    {
      id: 'indicator',
      icon: '🟢',
      title: 'RTX PRO MAX',
      subtitle: '200 Indicators + Voting',
      description: 'CRT + ICT + TBS + VSA + ATR',
      accuracy: '82-85% Accuracy',
      frequency: '15-25 signals/day',
      color: C.green,
      borderColor: C.green,
    },
    {
      id: 'hybrid',
      icon: '🔥',
      title: 'RTX ULTRA PRO MAX',
      subtitle: 'Best of Both Worlds',
      description: 'Sweep + Indicators Combined',
      accuracy: '93-96% Accuracy',
      frequency: '8-15 signals/day',
      color: C.orange,
      borderColor: C.orange,
      recommended: true,
    },
  ]

  const handleSelect = (mode) => {
    onModeChange(mode)
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('success')
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-end',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%',
        maxHeight: '85vh',
        background: C.card,
        borderRadius: '20px 20px 0 0',
        padding: '20px',
        overflowY: 'auto',
        border: `1px solid ${C.border}`,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 20,
        }}>
          <div>
            <div style={{
              fontSize: 18, fontWeight: 900,
              background: `linear-gradient(135deg, ${C.orange}, ${C.cyan})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              ⚙️ RTX Settings
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
              Choose Your Strategy
            </div>
          </div>
          <button onClick={onClose} style={{
            background: C.panel, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '8px 14px',
            color: C.text, fontSize: 16, cursor: 'pointer',
          }}>✕</button>
        </div>

        <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 12 }}>
          🎯 Signal Strategy
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {modes.map((mode) => (
            <div
              key={mode.id}
              onClick={() => handleSelect(mode.id)}
              style={{
                background: currentMode === mode.id
                  ? `linear-gradient(135deg, ${mode.color}22, ${mode.color}11)`
                  : C.panel,
                border: `2px solid ${currentMode === mode.id ? mode.borderColor : C.border}`,
                borderRadius: 14,
                padding: 16,
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {mode.recommended && (
                <div style={{
                  position: 'absolute', top: -8, right: 12,
                  background: `linear-gradient(135deg, ${C.gold}, ${C.orange})`,
                  color: '#000', fontSize: 9, fontWeight: 800,
                  padding: '3px 8px', borderRadius: 6,
                }}>
                  ⭐ RECOMMENDED
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 20 }}>{mode.icon}</span>
                    <div>
                      <div style={{
                        fontSize: 14, fontWeight: 800,
                        color: currentMode === mode.id ? mode.color : C.text,
                      }}>
                        {mode.title}
                      </div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                        {mode.subtitle}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: C.text, opacity: 0.8, marginBottom: 8 }}>
                    ⚡ {mode.description}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{
                      background: `${C.green}22`, color: C.green,
                      fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                    }}>
                      📊 {mode.accuracy}
                    </span>
                    <span style={{
                      background: `${C.cyan}22`, color: C.cyan,
                      fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                    }}>
                      ⏰ {mode.frequency}
                    </span>
                  </div>
                </div>

                <div style={{
                  width: 24, height: 24,
                  borderRadius: '50%',
                  background: currentMode === mode.id ? mode.color : 'transparent',
                  border: `2px solid ${currentMode === mode.id ? mode.color : C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {currentMode === mode.id && <span style={{ color: '#000', fontSize: 14 }}>✓</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={onClose} style={{
          width: '100%', marginTop: 16, padding: 14,
          background: `linear-gradient(135deg, ${C.orange}, ${C.cyan})`,
          color: '#000', fontWeight: 800, fontSize: 14,
          border: 'none', borderRadius: 12, cursor: 'pointer',
        }}>
          ✅ Save &amp; Close
        </button>
      </div>
    </div>
  )
  }
