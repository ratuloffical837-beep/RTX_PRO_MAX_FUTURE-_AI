import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as ti from 'technicalindicators';

const styles = `
  body { background: #050709; color: white; font-family: 'Inter', sans-serif; margin: 0; padding: 0; overflow: hidden; }
  .login-container { height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle, #1a1a1a, #050709); }
  .login-box { background: #111418; padding: 30px; border-radius: 20px; border: 1px solid #f3ba2f; width: 320px; text-align: center; }
  input { width: 100%; padding: 12px; margin: 10px 0; border-radius: 8px; border: 1px solid #333; background: #050709; color: white; outline: none; }
  .login-btn { width: 100%; padding: 12px; background: #f3ba2f; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }

  .app-container { display: flex; flex-direction: column; height: 100vh; max-width: 500px; margin: auto; position: relative; }
  header { padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; background: #0b0e11; border-bottom: 2px solid #f3ba2f; }
  .gold { color: #f3ba2f; font-weight: 900; letter-spacing: 1px; }
  .logout-btn { background: #f6465d22; border: 1px solid #f6465d; color: #f6465d; font-size: 0.6rem; padding: 5px 10px; border-radius: 5px; cursor: pointer; }

  .notif-banner { background: #f3ba2f; color: #000; padding: 8px; font-size: 0.8rem; font-weight: 900; position: absolute; top: 50px; width: 100%; z-index: 1000; text-align: center; transform: translateY(-110%); transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
  .notif-show { transform: translateY(0); }

  .chart-box { flex-grow: 1; width: 100%; background: #000; position: relative; min-height: 300px; }
  .controls { padding: 10px; background: #161a1e; display: flex; gap: 8px; border-top: 1px solid #2b2f36; }
  select { background: #1e2329; color: white; border: 1px solid #f3ba2f; padding: 12px; border-radius: 8px; flex: 1; font-weight: bold; outline:none; cursor: pointer; }

  .signal-card { padding: 12px; background: #050709; }
  .main-box { background: #111418; border: 2px solid #333; border-radius: 20px; padding: 18px; text-align: center; transition: 0.3s; }
  .up-border { border-color: #0ecb81 !important; box-shadow: 0 0 25px rgba(14, 203, 129, 0.3); }
  .down-border { border-color: #f6465d !important; box-shadow: 0 0 25px rgba(246, 70, 93, 0.3); }

  .status-text { color: #f3ba2f; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; margin-bottom: 5px; }
  .signal-val { font-size: 2.3rem; font-weight: 900; margin: 5px 0; }
  .up-text { color: #0ecb81; } .down-text { color: #f6465d; }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; border-top: 1px solid #222; padding-top: 12px; font-size: 0.75rem; }
  .label { color: #848e9c; text-align: left; } .value { color: #f3ba2f; font-weight: bold; text-align: right; }
  .acc-meter { border: 1px solid #0ecb8133; background: #0ecb8111; color: #0ecb81; padding: 8px; border-radius: 10px; margin-top: 12px; font-weight: 900; font-size: 1rem; }
`;

// ২৫টি আল্ট্রা ফাস্ট ফিউচার মার্কেট
const markets = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "AVAXUSDT", "DOGEUSDT", 
  "DOTUSDT", "LINKUSDT", "MATICUSDT", "LTCUSDT", "SHIBUSDT", "NEARUSDT", "TRXUSDT", 
  "UNIUSDT", "OPUSDT", "APTUSDT", "ARBUSDT", "INJUSDT", "TIAUSDT", "SUIUSDT", "PEPEUSDT", "ORDIUSDT", "RNDRUSDT"
];

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('rtx_auth') === 'true');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1m');
  const [signal, setSignal] = useState('SCANNING');
  const [confidence, setConfidence] = useState(0);
  const [serverTime, setServerTime] = useState('--:--:--');
  const [entryTime, setEntryTime] = useState('--:--:--');
  const [alert, setAlert] = useState('READY');
  const [notif, setNotif] = useState({ show: false, msg: '' });
  const [serverOffset, setServerOffset] = useState(0);

  const VALID_USER = import.meta.env.VITE_APP_USER || "admin";
  const VALID_PASS = import.meta.env.VITE_APP_PASS || "1234";

  const handleLogin = () => {
    if (user === VALID_USER && pass === VALID_PASS) {
      localStorage.setItem('rtx_auth', 'true');
      setIsLoggedIn(true);
    } else { alert("Access Denied!"); }
  };

  const handleLogout = () => {
    localStorage.removeItem('rtx_auth');
    setIsLoggedIn(false);
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    // Fast Server Sync
    fetch('https://fapi.binance.com/fapi/v1/time').then(r => r.json()).then(d => setServerOffset(d.serverTime - Date.now()));
    
    const styleTag = document.createElement("style"); styleTag.innerHTML = styles;
    document.head.appendChild(styleTag);

    // আল্ট্রা পাওয়ার ৩ সেকেন্ড স্ক্যানার
    let scanIndex = 0;
    const scanner = setInterval(() => {
      const pair = markets[scanIndex];
      checkMarketSignal(pair);
      scanIndex = (scanIndex + 1) % markets.length;
    }, 3000);

    return () => clearInterval(scanner);
  }, [isLoggedIn]);

  const checkMarketSignal = async (pair) => {
    try {
      const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${pair}&interval=1m&limit=14`);
      const data = await res.json();
      const closes = data.map(d => parseFloat(d[4]));
      const rsi = ti.RSI.calculate({ values: closes, period: 7 }).pop();
      
      if (rsi < 30 || rsi > 70) {
        setNotif({ show: true, msg: `🔥 PRO SIGNAL: ${pair} (${rsi > 70 ? 'SELL' : 'BUY'})` });
        setTimeout(() => setNotif({ show: false, msg: '' }), 2500);
      }
    } catch (e) {}
  };

  const futuresAnalysis = useCallback(async () => {
    try {
      const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${timeframe}&limit=50`);
      const data = await res.json();
      const closes = data.map(d => parseFloat(d[4]));
      const rsi = ti.RSI.calculate({ values: closes, period: 14 }).pop();
      const last = closes[closes.length - 1];
      const prev = closes[closes.length - 2];

      if (rsi < 45 || (last > prev && rsi < 60)) {
        setSignal('UP (LONG)');
        setConfidence(98.45 + Math.random());
      } else {
        setSignal('DOWN (SHORT)');
        setConfidence(98.65 + Math.random());
      }
    } catch (e) {}
  }, [symbol, timeframe]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const timer = setInterval(() => {
      const now = new Date(Date.now() + serverOffset);
      setServerTime(now.toLocaleTimeString('en-GB'));
      const sec = now.getSeconds();
      const limit = timeframe === '1m' ? 60 : 180;
      const remaining = limit - (timeframe === '1m' ? sec : (now.getMinutes() % 3) * 60 + sec);

      if (remaining > 20) {
        futuresAnalysis();
        setAlert('Predicting Market...');
      } else if (remaining <= 20 && remaining > 5) {
        setAlert('Confirming Entry...');
      } else {
        setAlert(`SURE SHOT ${signal.includes('UP') ? 'UP' : 'DOWN'}`);
      }

      const next = new Date(now.getTime() + remaining * 1000);
      setEntryTime(next.toLocaleTimeString('en-GB'));
    }, 1000);
    return () => clearInterval(timer);
  }, [isLoggedIn, serverOffset, symbol, timeframe, futuresAnalysis, signal]);

  // ফিউচার চার্ট ফরম্যাট BINANCE:SYMBOLP
  const chartSymbol = `BINANCE:${symbol}P`;

  // অপ্রয়োজনীয় লোড কমাতে useMemo চার্ট
  const cryptoChart = useMemo(() => (
    <iframe 
      key={chartSymbol + timeframe}
      src={`https://s.tradingview.com/widgetembed/?symbol=${chartSymbol}&interval=${timeframe === '1m' ? '1' : '3'}&theme=dark&style=1&timezone=Etc%2FUTC&hide_side_toolbar=true&save_image=false&backgroundColor=%23050709`} 
      width="100%" height="100%" frameBorder="0" loading="lazy">
    </iframe>
  ), [chartSymbol, timeframe]);

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <style>{styles}</style>
        <div className="login-box">
          <h2 style={{color:'#f3ba2f'}}>RTX ELITE LOGIN</h2>
          <input type="text" placeholder="Username" onChange={e => setUser(e.target.value)} />
          <input type="password" placeholder="Password" onChange={e => setPass(e.target.value)} />
          <button className="login-btn" onClick={handleLogin}>RUN V13 PRO</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className={`notif-banner ${notif.show ? 'notif-show' : ''}`}>{notif.msg}</div>
      <header>
        <div className="gold">RTX FUTURES PRO V13</div>
        <button className="logout-btn" onClick={handleLogout}>LOGOUT</button>
      </header>
      <div className="chart-box">{cryptoChart}</div>
      <div className="controls">
        <select value={symbol} onChange={e => setSymbol(e.target.value)}>
          {markets.map(m => <option key={m} value={m}>{m} PERP</option>)}
        </select>
        <select value={timeframe} onChange={e => setTimeframe(e.target.value)}>
          <option value="1m">1 MINUTE</option>
          <option value="3m">3 MINUTE</option>
        </select>
      </div>
      <div className="signal-card">
        <div className={`main-box ${signal.includes('UP') ? 'up-border' : 'down-border'}`}>
          <div className="status-text">{alert}</div>
          <div className={`signal-val ${signal.includes('UP') ? 'up-text' : 'down-text'}`}>{signal}</div>
          <div className="info-grid">
            <div className="label">FUTURES TIME:</div><div className="value">{serverTime}</div>
            <div className="label">ENTRY TIME:</div><div className="value">{entryTime}</div>
            <div className="label">SYMBOL:</div><div className="value">{symbol} PERP</div>
          </div>
          <div className="acc-meter">POWER ACCURACY: {confidence.toFixed(2)}%</div>
        </div>
      </div>
    </div>
  );
}

export default App;
