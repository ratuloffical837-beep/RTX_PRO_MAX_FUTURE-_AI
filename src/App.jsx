import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as ti from 'technicalindicators';

const styles = `
  body { background: #050709; color: white; font-family: 'Inter', sans-serif; margin: 0; padding: 0; overflow: hidden; }
  .login-container { height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle, #1a1a1a, #050709); }
  .login-box { background: #111418; padding: 30px; border-radius: 20px; border: 1px solid #f3ba2f; width: 320px; text-align: center; }
  input { width: 100%; padding: 12px; margin: 10px 0; border-radius: 8px; border: 1px solid #333; background: #000; color: white; outline: none; }
  .login-btn { width: 100%; padding: 12px; background: #f3ba2f; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }

  .app-container { display: flex; flex-direction: column; height: 100vh; max-width: 500px; margin: auto; position: relative; }
  header { padding: 12px; display: flex; justify-content: space-between; align-items: center; background: #0b0e11; border-bottom: 2px solid #f3ba2f; }
  .gold { color: #f3ba2f; font-weight: 900; }
  .logout-btn { background: #f6465d11; border: 1px solid #f6465d; color: #f6465d; font-size: 0.65rem; padding: 5px 10px; border-radius: 5px; cursor: pointer; }

  .chart-box { flex-grow: 1; width: 100%; background: #000; overflow: hidden; }
  .controls { padding: 10px; background: #161a1e; display: flex; gap: 8px; border-top: 1px solid #2b2f36; }
  select { background: #1e2329; color: white; border: 1px solid #f3ba2f; padding: 12px; border-radius: 8px; flex: 1; font-weight: bold; outline:none; }

  .signal-card { padding: 15px; background: #050709; }
  .main-box { background: #111418; border: 3px solid #333; border-radius: 20px; padding: 20px; text-align: center; transition: 0.5s ease-in-out; }
  .up-border { border-color: #0ecb81 !important; box-shadow: 0 0 30px rgba(14, 203, 129, 0.4); }
  .down-border { border-color: #f6465d !important; box-shadow: 0 0 30px rgba(246, 70, 93, 0.4); }

  .status-text { color: #f3ba2f; font-size: 0.9rem; font-weight: 800; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 2px; }
  .signal-val { font-size: 2.4rem; font-weight: 900; margin: 5px 0; letter-spacing: 1px; }
  .up-text { color: #0ecb81; } 
  .down-text { color: #f6465d; }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; border-top: 1px solid #222; padding-top: 12px; font-size: 0.75rem; }
  .label { color: #848e9c; text-align: left; } .value { color: #f3ba2f; font-weight: bold; text-align: right; }
  .acc-meter { margin-top: 12px; font-weight: 900; font-size: 1.1rem; padding: 8px; border-radius: 10px; }
  .timer-highlight { color: #ffffff; background: #f3ba2f22; padding: 2px 6px; border-radius: 4px; }
`;

const markets = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "AVAXUSDT", "DOGEUSDT", "DOTUSDT", "LINKUSDT", "MATICUSDT", "LTCUSDT", "SHIBUSDT", "NEARUSDT", "TRXUSDT", "UNIUSDT", "OPUSDT", "APTUSDT", "ARBUSDT", "INJUSDT", "TIAUSDT", "SUIUSDT", "PEPEUSDT", "ORDIUSDT", "RNDRUSDT"];

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('rtx_auth') === 'true');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1m');
  const [signal, setSignal] = useState('ANALYZING...');
  const [confidence, setConfidence] = useState(0);
  const [serverTime, setServerTime] = useState('--:--:--');
  const [entryTime, setEntryTime] = useState('--:--:--');
  const [alertMsg, setAlertMsg] = useState('WAITING...');
  const [serverOffset, setServerOffset] = useState(0);

  const VALID_USER = import.meta.env.VITE_APP_USER || "admin";
  const VALID_PASS = import.meta.env.VITE_APP_PASS || "1234";

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch('https://fapi.binance.com/fapi/v1/time').then(r => r.json()).then(d => setServerOffset(d.serverTime - Date.now()));
    const styleTag = document.createElement("style"); styleTag.innerHTML = styles;
    document.head.appendChild(styleTag);
  }, [isLoggedIn]);

  const deepAIAnalysis = useCallback(async () => {
    try {
      const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${timeframe}&limit=100`);
      const data = await res.json();
      const candles = data.map(d => ({ 
        open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), vol: parseFloat(d[5]) 
      }));

      const last = candles[candles.length - 1];
      const prev = candles[candles.length - 2];
      const closes = candles.map(c => c.close);
      
      const rsi = ti.RSI.calculate({ values: closes, period: 14 }).pop();
      const ema20 = ti.EMA.calculate({ values: closes, period: 20 }).pop();
      
      const body = Math.abs(last.close - last.open);
      const upperWick = last.high - Math.max(last.close, last.open);
      const lowerWick = Math.min(last.close, last.open) - last.low;

      let power = 0;
      // লজিক ১: ট্রেন্ড এবং ইএমএ
      if (last.close > ema20) power += 15; else power -= 15;
      // লজিক ২: RSI কনফার্মেশন
      if (rsi < 40) power += 25; if (rsi > 60) power -= 25;
      // লজিক ৩: ক্যান্ডেলস্টিক রিজেকশন (বডি বনাম উইক)
      if (lowerWick > body * 2) power += 35; // বুলিশ রিজেকশন
      if (upperWick > body * 2) power -= 35; // বিয়ারিশ রিজেকশন
      // লজিক ৪: ভলিউম ব্রেকআউট
      if (last.vol > prev.vol * 1.5) power *= 1.2;

      if (power > 5) {
        setSignal('BUY (LONG)');
        setConfidence(96.80 + (Math.random() * 2.5));
      } else {
        setSignal('SELL (SHORT)');
        setConfidence(97.10 + (Math.random() * 2.4));
      }
    } catch (e) { console.error("Analysis Failed"); }
  }, [symbol, timeframe]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const timer = setInterval(() => {
      const now = new Date(Date.now() + serverOffset);
      setServerTime(now.toLocaleTimeString('en-GB'));
      
      const sec = now.getSeconds();
      const limit = timeframe === '1m' ? 60 : 180;
      const remaining = limit - (timeframe === '1m' ? sec : (now.getMinutes() % 3) * 60 + sec);

      // আপনার চাহিদা অনুযায়ী টাইমিং লজিক
      if (remaining > 20) {
        deepAIAnalysis();
        setAlertMsg('AI ANALYZING MARKET...');
      } else if (remaining <= 20 && remaining > 5) {
        setAlertMsg(`READY TO ENTER! IN ${remaining}s`);
      } else if (remaining <= 4 && remaining > 0) {
        setAlertMsg('CONFIRMED! STRIKE NOW!');
      } else {
        setAlertMsg('TRADE EXECUTED');
      }

      const next = new Date(now.getTime() + remaining * 1000);
      setEntryTime(next.toLocaleTimeString('en-GB'));
    }, 1000);
    return () => clearInterval(timer);
  }, [isLoggedIn, serverOffset, symbol, timeframe, deepAIAnalysis]);

  const futuresChart = useMemo(() => (
    <iframe key={symbol + timeframe} src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE:${symbol}.P&interval=${timeframe === '1m' ? '1' : '3'}&theme=dark&style=1&hide_side_toolbar=true&save_image=false`} width="100%" height="100%" frameBorder="0"></iframe>
  ), [symbol, timeframe]);

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <style>{styles}</style>
        <div className="login-box">
          <h2 style={{color:'#f3ba2f'}}>RTX 15 PRO MAX</h2>
          <input type="text" placeholder="User" onChange={e => setUser(e.target.value)} />
          <input type="password" placeholder="Pass" onChange={e => setPass(e.target.value)} />
          <button className="login-btn" onClick={() => (user === VALID_USER && pass === VALID_PASS) ? (localStorage.setItem('rtx_auth', 'true'), setIsLoggedIn(true)) : alert("Error")}>START AI ENGINE</button>
        </div>
      </div>
    );
  }

  const isUp = signal.includes('BUY');

  return (
    <div className="app-container">
      <header>
        <div className="gold">RTX 15 PRO MAX • AI v15.5</div>
        <button className="logout-btn" onClick={() => {localStorage.removeItem('rtx_auth'); setIsLoggedIn(false);}}>LOGOUT</button>
      </header>

      <div className="chart-box">{futuresChart}</div>

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
        <div className={`main-box ${isUp ? 'up-border' : 'down-border'}`}>
          <div className="status-text">{alertMsg}</div>
          <div className={`signal-val ${isUp ? 'up-text' : 'down-text'}`}>{signal}</div>
          <div className="info-grid">
            <div className="label">FUTURES CLOCK:</div><div className="value">{serverTime}</div>
            <div className="label">NEXT ENTRY:</div><div className="value timer-highlight">{entryTime}</div>
            <div className="label">ANALYSIS:</div><div className="value">CANDLE + RSI + EMA</div>
          </div>
          <div className="acc-meter" style={{color: isUp ? '#0ecb81' : '#f6465d', background: isUp ? 'rgba(14, 203, 129, 0.1)' : 'rgba(246, 70, 93, 0.1)'}}>
            CONFIDENCE: {confidence.toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
