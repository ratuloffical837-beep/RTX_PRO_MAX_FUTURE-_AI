import { useState } from 'react'
import { db } from './firebase'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { C } from './App'

const BKASH_NUMBER = '01725218874'
const NAGAD_NUMBER = '01725218874'
const SUPPORT_LINK = 'https://t.me/ratulhossain56'
const GROUP_LINK = 'https://t.me/ratulhossain424'
const CHANNEL_LINK = 'https://t.me/ratulhossain4241'
const MONTHLY_AMOUNT = 5000
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''

export default function PaymentPage({ tgUser, status }) {
  const [method, setMethod] = useState('')
  const [phone, setPhone] = useState('')
  const [txId, setTxId] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  const copyNum = (num, label) => {
    navigator.clipboard.writeText(num).catch(() => {})
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  const handleSubmit = async () => {
    if (!method) return setError('পেমেন্ট মেথড সিলেক্ট করুন')
    if (!phone || phone.length < 11) return setError('সঠিক ফোন নম্বর দিন')
    if (!amount || isNaN(amount)) return setError('সঠিক পরিমাণ লিখুন')
    if (!txId.trim()) return setError('ট্রানজেকশন আইডি লিখুন')

    setLoading(true)
    setError('')

    try {
      const name = tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '')

      const data = {
        userId: String(tgUser.id),
        name,
        username: tgUser.username || '',
        phone: phone.trim(),
        method,
        amount: Number(amount),
        txId: txId.trim(),
        status: 'pending',
        appType: 'rtx',
        createdAt: serverTimestamp(),
      }

      await setDoc(doc(db, 'crypto_payments', txId.trim()), data)

      if (BACKEND_URL) {
        await fetch(`${BACKEND_URL}/api/notify-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }).catch(() => {})
      }

      setDone(true)
    } catch (e) {
      console.error(e)
      setError('সাবমিট হয়নি। ইন্টারনেট চেক করুন।')
    } finally {
      setLoading(false)
    }
  }

  // ── Status Pages ──
  if (done || status === 'pending') {
    return (
      <Wrapper>
        <TopBanner />
        <div style={{ padding: 16 }}>
          <Card center>
            <div style={{ fontSize: 60, marginBottom: 16 }}>⏳</div>
            <div style={{ color: C.gold, fontWeight: 800, fontSize: 22, marginBottom: 10 }}>
              পেমেন্ট রিভিউতে আছে
            </div>
            <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.8 }}>
              আপনার পেমেন্ট যাচাই হলে ৩০ দিনের অ্যাক্সেস পাবেন।<br />
              সাধারণত ১–১৫ মিনিটের মধ্যে কনফার্ম হয়।
            </div>
            <SocialButtons />
            <SupportButton />
          </Card>
        </div>
      </Wrapper>
    )
  }

  if (status === 'rejected') {
    return (
      <Wrapper>
        <TopBanner />
        <div style={{ padding: 16 }}>
          <Card center border={C.red}>
            <div style={{ fontSize: 50, marginBottom: 12 }}>❌</div>
            <div style={{ color: C.red, fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
              পেমেন্ট রিজেক্ট হয়েছে
            </div>
            <div style={{ color: C.muted, fontSize: 12 }}>
              সঠিক ট্রানজেকশন আইডি দিয়ে আবার পেমেন্ট করুন।
            </div>
          </Card>
          <PayForm {...{ method, setMethod, phone, setPhone, txId, setTxId, amount, setAmount, loading, error, copied, copyNum, handleSubmit }} />
          <SupportButton />
        </div>
      </Wrapper>
    )
  }

  if (status === 'expired' || status === 'trial_expired') {
    return (
      <Wrapper>
        <TopBanner />
        <div style={{ padding: 16 }}>
          <Card center border={C.gold}>
            <div style={{ fontSize: 50, marginBottom: 12 }}>
              {status === 'trial_expired' ? '🎁' : '⌛'}
            </div>
            <div style={{ color: C.gold, fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
              {status === 'trial_expired' ? '২৪ ঘন্টা ট্রায়াল শেষ!' : 'সাবস্ক্রিপশন শেষ'}
            </div>
            <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.7 }}>
              {status === 'trial_expired'
                ? 'আপনার ফ্রি ট্রায়াল শেষ হয়েছে।\nসেবা চালু রাখতে ৳5000 পেমেন্ট করুন।'
                : 'পুনরায় পেমেন্ট করুন এবং ৩০ দিন ব্যবহার করুন।'}
            </div>
          </Card>
          <PayForm {...{ method, setMethod, phone, setPhone, txId, setTxId, amount, setAmount, loading, error, copied, copyNum, handleSubmit }} />
          <SupportButton />
        </div>
      </Wrapper>
    )
  }

  // ── Default Payment Form ──
  return (
    <Wrapper>
      <TopBanner />
      <div style={{ padding: '12px 16px' }}>
        <Card center>
          <div style={{ fontSize: 50, marginBottom: 6 }}>🚀</div>
          <div style={{
            fontSize: 32, fontWeight: 900, letterSpacing: '0.12em',
            background: `linear-gradient(135deg, ${C.orange}, ${C.cyan})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            RTX PRO MAX
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4, letterSpacing: '0.1em' }}>
            REAL TRADING eXPERT
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>
            Sweep Reclaim + 200 Indicators • 92%+ Accuracy
          </div>

          {tgUser?.id && (
            <div style={{
              marginTop: 12, background: C.bg, borderRadius: 8,
              padding: '8px 12px', fontSize: 12, color: C.muted,
            }}>
              👤 {tgUser.first_name} {tgUser.last_name || ''} {tgUser.username && <span style={{ color: C.cyan }}>@ {tgUser.username}</span>}
            </div>
          )}

          <div style={{
            marginTop: 14, padding: '14px',
            background: `linear-gradient(135deg, ${C.gold}22, ${C.orange}22)`,
            borderRadius: 12, border: `1px solid ${C.gold}55`,
          }}>
            <div style={{ color: C.gold, fontWeight: 900, fontSize: 32 }}>৳{MONTHLY_AMOUNT}</div>
            <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>প্রতি মাসে • ৩০ দিন Premium</div>
          </div>
        </Card>

        <SocialButtons />
        <PayForm {...{ method, setMethod, phone, setPhone, txId, setTxId, amount, setAmount, loading, error, copied, copyNum, handleSubmit }} />
        <SupportButton />
      </div>
    </Wrapper>
  )
}

// ── Helper Components ──
function Wrapper({ children }) {
  return <div style={{ background: C.bg, minHeight: '100vh', paddingBottom: 30 }}>{children}</div>
}

function TopBanner() {
  return (
    <div style={{
      background: `linear-gradient(90deg, ${C.orange}22, ${C.cyan}22)`,
      borderBottom: `1px solid ${C.orange}33`,
      color: C.gold, fontSize: 12, padding: '10px 16px',
      textAlign: 'center', fontWeight: 600,
    }}>
      🚀 <strong>RTX Premium</strong> ৳{MONTHLY_AMOUNT}/মাস | ২৪ ঘন্টা ফ্রি ট্রায়াল 🎁
    </div>
  )
}

function Card({ children, center, border }) {
  return (
    <div style={{
      background: C.card, borderRadius: 14, padding: 20,
      marginBottom: 12, border: border ? `1px solid ${border}44` : `1px solid ${C.border}`,
      textAlign: center ? 'center' : 'left',
    }}>
      {children}
    </div>
  )
}

function SocialButtons() {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12, marginTop: 12 }}>
      <button onClick={() => window.open(GROUP_LINK, '_blank')} style={socialBtn(C.cyan)}>💬 Group</button>
      <button onClick={() => window.open(CHANNEL_LINK, '_blank')} style={socialBtn(C.purple)}>📢 Channel</button>
    </div>
  )
}

function SupportButton() {
  return (
    <button onClick={() => window.open(SUPPORT_LINK, '_blank')} style={{
      width: '100%', padding: 14, borderRadius: 10,
      background: `${C.cyan}11`, color: C.cyan, fontWeight: 700,
      fontSize: 13, border: `1px solid ${C.cyan}44`, marginTop: 12,
    }}>
      💬 Customer Support
    </button>
  )
}

function PayForm({ method, setMethod, phone, setPhone, txId, setTxId, amount, setAmount, loading, error, copied, copyNum, handleSubmit }) {
  return (
    <>
      <Card>
        <Label>পেমেন্ট নম্বর (Send Money করুন)</Label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <NumCard onClick={() => copyNum(BKASH_NUMBER, 'bkash')} color="#e2136e" emoji="🩷" label="বিকাশ" num={BKASH_NUMBER} copied={copied === 'bkash'} />
          <NumCard onClick={() => copyNum(NAGAD_NUMBER, 'nagad')} color="#f7941d" emoji="🧡" label="নগদ" num={NAGAD_NUMBER} copied={copied === 'nagad'} />
        </div>
        <div style={{ textAlign: 'center', fontSize: 13, color: C.muted, marginTop: 8 }}>
          Amount: <strong style={{ color: C.gold }}>৳{MONTHLY_AMOUNT}</strong>
        </div>
      </Card>

      <Card>
        <Label>পেমেন্ট তথ্য দিন</Label>

        <FieldLabel>মেথড সিলেক্ট করুন</FieldLabel>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[{ key: 'বিকাশ', color: '#e2136e' }, { key: 'নগদ', color: '#f7941d' }].map(({ key, color }) => (
            <button key={key} onClick={() => setMethod(key)} style={{
              flex: 1, padding: 12, borderRadius: 8, fontWeight: 700, fontSize: 13,
              background: method === key ? color + '22' : C.panel,
              color: method === key ? color : C.muted,
              border: method === key ? `2px solid ${color}` : `2px solid ${C.border}`,
            }}>{key}</button>
          ))}
        </div>

        <FieldLabel>আপনার ফোন নম্বর</FieldLabel>
        <Input type="tel" placeholder="01XXXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} />

        <FieldLabel>পরিমাণ (টাকা)</FieldLabel>
        <Input type="number" placeholder="যত টাকা পাঠিয়েছেন" value={amount} onChange={e => setAmount(e.target.value)} />

        <FieldLabel>ট্রানজেকশন আইডি / TrxID</FieldLabel>
        <Input type="text" placeholder="TrxID বা Ref নম্বর" value={txId} onChange={e => setTxId(e.target.value)} />

        {error && (
          <div style={{
            background: `${C.red}11`, border: `1px solid ${C.red}44`,
            borderRadius: 8, padding: '10px 12px', color: C.red, fontSize: 12, marginBottom: 12,
          }}>
            ⚠️ {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading} style={{
          width: '100%', padding: 14, borderRadius: 10,
          background: loading ? C.panel : `linear-gradient(135deg, ${C.gold}, ${C.orange})`,
          color: loading ? C.muted : '#000',
          fontWeight: 800, fontSize: 14, border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}>
          {loading ? '⏳ সাবমিট হচ্ছে...' : '✅ পেমেন্ট সাবমিট করুন'}
        </button>
      </Card>
    </>
  )
}

const Label = ({ children }) => (
  <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 12 }}>
    {children}
  </div>
)

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 6, marginTop: 4 }}>
    {children}
  </div>
)

const Input = (props) => (
  <input {...props} style={{
    width: '100%', padding: 12, borderRadius: 8,
    background: C.bg, color: C.text, border: `1px solid ${C.border}`,
    fontSize: 13, marginBottom: 14,
  }} />
)

function NumCard({ onClick, color, emoji, label, num, copied }) {
  return (
    <div onClick={onClick} style={{
      flex: 1, background: C.bg, borderRadius: 10, padding: '14px 10px',
      textAlign: 'center', cursor: 'pointer', border: `1px solid ${color}55`,
    }}>
      <div style={{ color, fontWeight: 800, fontSize: 12, marginBottom: 6 }}>{emoji} {label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{num}</div>
      <div style={{ fontSize: 10, color: copied ? C.green : C.muted, marginTop: 4 }}>
        {copied ? '✅ কপি হয়েছে!' : 'ট্যাপ করে কপি'}
      </div>
    </div>
  )
}

const socialBtn = (color) => ({
  flex: 1, padding: 11, borderRadius: 10,
  background: `${color}11`, color, fontWeight: 700,
  fontSize: 12, border: `1px solid ${color}33`,
  cursor: 'pointer',
})
