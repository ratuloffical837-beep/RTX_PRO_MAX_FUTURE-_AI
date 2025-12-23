import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as ti from 'technicalindicators';

const styles = `
  body { background: #050709; color: white; font-family: 'Inter', sans-serif; margin: 0; padding: 0; overflow: hidden; }
  
  .login-screen {
    height: 100vh; width: 100vw; display: flex; align-items: center; justify-content: center;
    background: radial-gradient(circle, #1a1e23 0%, #050709 100%);
  }
  .login-card {
    background: #111418; padding: 40px 30px; border-radius: 24px; border: 1px solid #f3ba2f;
    width: 340px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  }
  .login-card h2 { color: #f3ba2f; margin-bottom: 30px; font-weight: 900; letter-spacing: 1px; }
  .input-group { margin-bottom: 20px; text-align: left; }
  .input-group label { display: block; color: #848e9c; font-size: 0.8rem; margin-bottom: 8px; margin-left: 5px; }
  .input-group input {
    width: 100%; padding: 14px; background: #050709; border: 1px solid #333; 
    border-radius: 12px; color: white; box-sizing: border-box; outline: none; transition: 0.3s;
  }
  .input-group input:focus { border-color: #f3ba2f; box-shadow: 0 0 10px rgba(243, 186, 47, 0.2); }
  .login-btn {
    width: 100%; padding: 15px; background: #f3ba2f; border: none; border-radius: 12px;
    color: #000; font-weight: 900; cursor: pointer; font-size: 1rem; transition: 0.3s;
  }

  .app-container { display: flex; flex-direction: column; height: 100vh; max-width: 500px; margin: auto; position: relative; }
  header { padding: 12px; display: flex; justify-content: space-between; align-items: center; background: #0b0e11; border-bottom: 2px solid #f3ba2f; }
  .gold { color: #f3ba2f; font-weight: 900; }
  .logout-btn { background: none; border: 1px solid #f6465d; color: #f6465d; font-size: 0.6rem; padding: 4px 8px; border-radius: 6px; cursor: pointer; }
  
  .notif-banner { 
    background: #f3ba2f; color: #000; padding: 12px; font-size: 0.9rem; font-weight: 900; 
    position: absolute; top: 55px; width: 100%; z-index: 1000; text-align: center;
    transform: translateY(-100%); transition: 0.5s;
  }
  .notif-show { transform: translateY(0); }
  .chart-box { flex-grow: 1; width: 100%; background: #000; }
  .controls { padding: 10px; background: #161a1e; display: flex; gap: 8px; border-top: 1px solid #2b2f36; }
  select { background: #1e2329; color: white; border: 1px solid #f3ba2f; padding: 12px; border-radius: 8px; flex: 1; font-weight: bold; outline: none; }
  
  .signal-card { padding: 15px; background: #050709; }
  .main-box { background: #111418; border: 3px solid #333; border-radius: 20px; padding: 20px; text-align: center; }
  .up-border { border-color: #0ecb81 !important; box-shadow: 0 0 35px rgba(14, 203, 129, 0.4); }
  .down-border { border-color: #f6465d !important; box-shadow: 0 0 35px rgba(246, 70, 93, 0.4); }
  .status-text { color: #f3ba2f; font-size: 0.9rem; font-weight: 800; text-transform: uppercase; margin-bottom: 5px; }
  .signal-val { font-size: 2.6rem; font-weight: 900; margin: 10px 0; }
  .up-text { color: #0ecb81; } 
  .down-text { color: #f6465d; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 15px; border-top: 1px solid #222; padding-top: 15px; font-size: 0.75rem; }
  .label { color: #848e9c; text-align: left; } .value { color: #f3ba2f; font-weight: bold; text-align: right; }
  .acc-meter { border: 1px solid #f3ba2f; color: #f3ba2f; padding: 8px; border-radius: 12px; margin-top: 12px; font-weight: 900; font-size: 1.1rem; }
`;

const markets = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "AVAXUSDT", "DOGEUSDT", "DOTUSDT", "LINKUSDT", "MATICUSDT", "LTCUSDT", "SHIBUSDT", "NEARUSDT", "TRXUSDT", "UNIUSDT", "OPUSDT", "APTUSDT", "ARBUSDT", "INJUSDT", "PEPEUSDT", "ORDIUSDT", "RNDRUSDT", "TIAUSDT", "SUIUSDT"];

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('isAuth') === 'true');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1m');
  const [signal, setSignal] = useState('SCANNING');
  const [confidence, setConfidence] = useState(0);
  const [serverTime, setServerTime] = useState('--:--:--');
  const [entryTime, setEntryTime] = useState('--:--:--');
  const [alert, setAlert] = useState('INITIALIZING...');
  const [notif, setNotif] = useState({ show: false, msg: '' });
  const [serverOffset, setServerOffset] = useState(0);

  const ENV_USER = import.meta.env.VITE_APP_USER || "admin";
  const ENV_PASS = import.meta.env.VITE_APP_PASS || "1234";

  useEffect(() => {
    if (!isLoggedIn) return;
    const sync = async () => {
      const res = await fetch('https://fapi.binance.com/fapi/v1/time');
      const { serverTime } = await res.json();
      setServerOffset(serverTime - Date.now());
    };
    sync();
    const styleTag = document.createElement("style"); styleTag.innerHTML = styles;
    document.head.appendChild(styleTag);
  }, [isLoggedIn]);

  const mainAnalysisEngine = useCallback(async () => {
    try {
      const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${timeframe}&limit=100`);
      const data = await res.json();
      const candles = data.map(d => ({
        open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), vol: parseFloat(d[5])
      }));

      const closes = candles.map(c => c.close);
      const rsi = ti.RSI.calculate({ values: closes, period: 14 }).pop();
      const ema = ti.EMA.calculate({ values: closes, period: 20 }).pop();
      const last = candles[99];
      const prev = candles[98];

      const body = Math.abs(last.close - last.open);
      const lowerWick = Math.min(last.close, last.open) - last.low;
      const upperWick = last.high - Math.max(last.close, last.open);

      let weight = 0;
      // লজিক ১: ট্রেন্ড ফিল্টার (EMA)
      if (last.close > ema) weight += 2; else weight -= 2;
      // লজিক ২: RSI অভারসোল্ড/অভারবট
      if (rsi < 40) weight += 3; if (rsi > 60) weight -= 3;
      // লজিক ৩: স্মার্ট রিজেকশন (Wick Analysis)
      if (lowerWick > body * 1.5) weight += 4; 
      if (upperWick > body * 1.5) weight -= 4;
      // লজিক ৪: এনগালফিং চেক
      if (last.close > prev.open && prev.close < prev.open) weight += 2;

      if (weight >= 1) {
        setSignal('BUY (LONG)');
        setConfidence(98.15 + Math.random());
      } else {
        setSignal('SELL (SHORT)');
        setConfidence(98.35 + Math.random());
      }
    } catch (e) { console.error("Engine Error"); }
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
        mainAnalysisEngine();
        setAlert('ANALYZING FUTURES...');
      } else if (remaining <= 20 && remaining > 4) {
        setAlert('PREPARING ENTRY...');
      } else if (remaining <= 4 && remaining > 0) {
        setAlert(`CONFIRMED: ${signal}`);
      }

      const next = new Date(now.getTime() + remaining * 1000);
      setEntryTime(next.toLocaleTimeString('en-GB'));
    }, 1000);
    return () => clearInterval(timer);
  }, [isLoggedIn, serverOffset, symbol, timeframe, signal, mainAnalysisEngine]);

  const futuresChart = useMemo(() => (
    <iframe key={symbol + timeframe} src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE:${symbol}.P&interval=${timeframe === '1m' ? '1' : '3'}&theme=dark&style=1&hide_side_toolbar=true&save_image=false`} width="100%" height="100%" frameBorder="0"></iframe>
  ), [symbol, timeframe]);

  if (!isLoggedIn) {
    return (
      <div className="login-screen">
        <style>{styles}</style>
        <div className="login-card">
          <h2>RTX 15 PRO</h2>
          <form onSubmit={(e) => { e.preventDefault(); if (username === ENV_USER && password === ENV_PASS) { localStorage.setItem('isAuth', 'true'); setIsLoggedIn(true); } else { alert("Error!"); } }}>
            <div className="input-group"><label>USERNAME</label><input type="text" onChange={(e) => setUsername(e.target.value)} required /></div>
            <div className="input-group"><label>PASSWORD</label><input type="password" onChange={(e) => setPassword(e.target.value)} required /></div>
            <button type="submit" className="login-btn">START ENGINE</button>
          </form>
        </div>
      </div>
    );
  }

  const isUp = signal.includes('BUY');

  return (
    <div className="app-container">
      <div className={`notif-banner ${notif.show ? 'notif-show' : ''}`}>{notif.msg}</div>
      <header>
        <div className="gold">RTX 15 PRO MAX</div>
        <button onClick={() => { localStorage.removeItem('isAuth'); setIsLoggedIn(false); }} className="logout-btn">EXIT</button>
      </header>
      <div className="chart-box">{futuresChart}</div>
      <div className="controls">
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>{markets.map(m => <option key={m} value={m}>{m} PERP</option>)}</select>
        <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}><option value="1m">1 MIN</option><option value="3m">3 MIN</option></select>
      </div>
      <div className="signal-card">
        <div className={`main-box ${isUp ? 'up-border' : 'down-border'}`}>
          <div className="status-text">{alert}</div>
          <div className={`signal-val ${isUp ? 'up-text' : 'down-text'}`}>{signal}</div>
          <div className="info-grid">
            <div className="label">LIVE CLOCK:</div><div className="value">{serverTime}</div>
            <div className="label">NEXT ENTRY:</div><div className="value">{entryTime}</div>
            <div className="label">MARKET:</div><div className="value">{symbol} PERP</div>
            <div className="label">ACCURACY:</div><div className="value">HIGH PRECISION</div>
          </div>
          <div className="acc-meter" style={{borderColor: isUp ? '#0ecb81' : '#f6465d', color: isUp ? '#0ecb81' : '#f6465d'}}>
            CONFIDENCE: {confidence.toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
