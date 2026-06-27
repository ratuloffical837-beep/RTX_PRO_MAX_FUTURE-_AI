import { C } from './App'

export default function SettingsModal({ onClose, currentMode, onModeChange }) {
  const modes = [
    {
      id: 'sweep',
      icon: '🔵',
      title: 'SWEEP RECLAIM',
      subtitle: 'Pro Institutional Strategy',
      description: 'Liquidity Sweep + Smart Money Reclaim',
      accuracy: '90%+ Accuracy',
      frequency: '3-8 signals/day',
      color: C.cyan,
      borderColor: C.cyan,
    },
    {
      id: 'indicator',
      icon: '🟢',
      title: 'INDICATORS ONLY',
      subtitle: '200 Indicators + Voting',
      description: 'CRT + ICT + TBS + VSA + ATR',
      accuracy: '80-85% Accuracy',
      frequency: '15-25 signals/day',
      color: C.green,
      borderColor: C.green,
    },
    {
      id: 'hybrid',
      icon: '🔥',
      title: 'HYBRID MODE',
      subtitle: 'Best of Both Worlds',
      description: 'Sweep + Indicators Combined',
      accuracy: '92-95% Accuracy',
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
      animation: 'fadeIn 0.2s ease-out',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%',
        maxHeight: '85vh',
        background: C.card,
        borderRadius: '20px 20px 0 0',
        padding: '20px',
        overflowY: 'auto',
        border: `1px solid ${C.border}`,
        animation: 'slideUp 0.3s ease-out',
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
              letterSpacing: '0.05em',
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
          }}>
            ✕
          </button>
        </div>

        {/* Section Title */}
        <div style={{
          fontSize: 11, color: C.muted, fontWeight: 700,
          letterSpacing: '0.1em', marginBottom: 12,
          textTransform: 'uppercase',
        }}>
          🎯 Signal Strategy
        </div>

        {/* Mode Cards */}
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
                transition: '0.3s',
                position: 'relative',
                boxShadow: currentMode === mode.id ? `0 4px 20px ${mode.color}33` : 'none',
              }}
            >
              {mode.recommended && (
                <div style={{
                  position: 'absolute',
                  top: -8, right: 12,
                  background: `linear-gradient(135deg, ${C.gold}, ${C.orange})`,
                  color: '#000', fontSize: 9, fontWeight: 800,
                  padding: '3px 8px', borderRadius: 6,
                  letterSpacing: '0.05em',
                }}>
                  ⭐ RECOMMENDED
                </div>
              )}

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                gap: 12,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 6,
                  }}>
                    <span style={{ fontSize: 20 }}>{mode.icon}</span>
                    <div>
                      <div style={{
                        fontSize: 14, fontWeight: 800,
                        color: currentMode === mode.id ? mode.color : C.text,
                        letterSpacing: '0.03em',
                      }}>
                        {mode.title}
                      </div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                        {mode.subtitle}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    fontSize: 11, color: C.text, opacity: 0.8,
                    marginBottom: 8, marginTop: 6,
                  }}>
                    ⚡ {mode.description}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{
                      background: `${C.green}22`, color: C.green,
                      fontSize: 9, fontWeight: 700,
                      padding: '3px 8px', borderRadius: 6,
                      border: `1px solid ${C.green}33`,
                    }}>
                      📊 {mode.accuracy}
                    </span>
                    <span style={{
                      background: `${C.cyan}22`, color: C.cyan,
                      fontSize: 9, fontWeight: 700,
                      padding: '3px 8px', borderRadius: 6,
                      border: `1px solid ${C.cyan}33`,
                    }}>
                      ⏰ {mode.frequency}
                    </span>
                  </div>
                </div>

                {/* Selection Indicator */}
                <div style={{
                  width: 24, height: 24,
                  borderRadius: '50%',
                  background: currentMode === mode.id ? mode.color : 'transparent',
                  border: `2px solid ${currentMode === mode.id ? mode.color : C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  transition: '0.3s',
                }}>
                  {currentMode === mode.id && (
                    <span style={{ color: '#000', fontSize: 14, fontWeight: 900 }}>✓</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info Box */}
        <div style={{
          marginTop: 16, padding: 12,
          background: `${C.cyan}11`, borderRadius: 10,
          border: `1px solid ${C.cyan}33`,
        }}>
          <div style={{
            fontSize: 10, color: C.cyan, fontWeight: 700,
            marginBottom: 4,
          }}>
            ℹ️ Current Mode
          </div>
          <div style={{ fontSize: 11, color: C.text }}>
            {currentMode === 'sweep' && 'Pure Institutional Strategy — কম signal কিন্তু super high quality'}
            {currentMode === 'indicator' && '200 Indicators voting system — বেশি opportunity'}
            {currentMode === 'hybrid' && 'Best of both worlds — Maximum accuracy ⭐'}
          </div>
        </div>

        {/* Save Button */}
        <button onClick={onClose} style={{
          width: '100%', marginTop: 16, padding: 14,
          background: `linear-gradient(135deg, ${C.orange}, ${C.cyan})`,
          color: '#000', fontWeight: 800, fontSize: 14,
          border: 'none', borderRadius: 12, cursor: 'pointer',
          letterSpacing: '0.05em',
          boxShadow: `0 4px 16px ${C.orange}44`,
        }}>
          ✅ Save & Close
        </button>
      </div>
    </div>
  )
      }
