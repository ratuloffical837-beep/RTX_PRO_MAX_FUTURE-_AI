import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as ti from 'technicalindicators';
import axios from 'axios';
import { ShieldCheck, Zap, Activity, Cpu, BellRing, ChevronDown } from 'lucide-react';

const styles = `
  :root { --gold: #f3ba2f; --green: #0ecb81; --red: #f6465d; --bg: #010203; --card: #0b0e11; }
  body { font-family: 'Inter', sans-serif; background: var(--bg); margin: 0; color: #fff; overflow-x: hidden; }
  .terminal { max-width: 480px; margin: auto; min-height: 100vh; background: var(--bg); border: 1px solid #1a1c20; }
  
  header { padding: 15px; background: #0b0e11; border-bottom: 2px solid var(--gold); display: flex; justify-content: space-between; align-items: center; }
  .logo { font-weight: 900; color: var(--gold); letter-spacing: 1px; font-size: 0.9rem; }
  
  .price-bar { background: #161a1e; padding: 12px; text-align: center; font-family: 'JetBrains Mono'; font-size: 1.5rem; font-weight: 800; border-bottom: 1px solid #222; }
  
  .controls { padding: 12px; display: grid; grid-template-columns: 1.5fr 1fr; gap: 8px; background: #0b0e11; }
  
  /* Custom Select Style with Arrow Fix */
  .select-wrapper { position: relative; width: 100%; }
  .select-wrapper select { 
    width: 100%; padding: 12px; background: #0b0e11; color: var(--gold); 
    border: 1px solid #333; border-radius: 8px; font-weight: bold; 
    outline: none; appearance: none; -webkit-appearance: none; cursor: pointer; 
  }
  .select-arrow { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--gold); }

  .chart-container { height: 300px; background: #000; border-bottom: 1px solid #222; }

  .signal-panel { padding: 15px; }
  .card { background: var(--card); border-radius: 24px; padding: 25px; border: 1px solid #222; text-align: center; transition: all 0.5s ease; position: relative; }
  .long-mode { border-color: var(--green); box-shadow: 0 0 50px rgba(14, 203, 129, 0.1); }
  .short-mode { border-color: var(--red); box-shadow: 0 0 50px rgba(246, 70, 93, 0.1); }

  .tags { display: flex; justify-content: center; gap: 6px; margin-bottom: 15px; }
  .tag { font-size: 0.6rem; padding: 3px 8px; border-radius: 4px; background: #1e2329; color: #848e9c; border: 1px solid #333; font-weight: bold; }
  .tag-on { background: var(--gold); color: #000; border-color: var(--gold); }

  .sig-text { font-size: 2.6rem; font-weight: 900; margin: 5px 0; font-family: 'JetBrains Mono'; letter-spacing: -1px; }
  
  .alert-box { font-size: 0.8rem; font-weight: 900; padding: 10px; border-radius: 10px; margin: 10px 0; border: 1px solid transparent; }
  .sure-shot { background: #f3ba2f11; color: var(--gold); border-color: var(--gold); animation: blink 1.5s infinite; }
  .trailing-sl { background: #0ecb8111; color: var(--green); border-color: var(--green); font-size: 0.7rem; }

  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

  .targets { background: #050709; border-radius: 16px; padding: 18px; display: grid; gap: 12px; border: 1px solid #1a1c20; }
  .t-row { display: flex; justify-content: space-between; font-family: 'JetBrains Mono'; font-size: 0.85rem; }
  .t-label { color: #5d6673; }
  .t-val { font-weight: bold; }

  .footer-info { margin-top: 20px; display: flex; justify-content: space-between; font-size: 0.65rem; color: #444; border-top: 1px solid #1a1c20; padding-top: 10px; }
`;

const markets = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "AVAXUSDT", "DOGEUSDT", "DOTUSDT", "LINKUSDT", "MATICUSDT", "LTCUSDT", "SHIBUSDT", "NEARUSDT", "TRXUSDT", "PEPEUSDT", "SUIUSDT", "TIAUSDT", "OPUSDT", "ARBUSDT", "INJUSDT", "SEIUSDT", "ORDIUSDT", "RNDRUSDT", "FILUSDT", "ATOMUSDT", "ETCUSDT", "ICPUSDT", "APTUSDT", "STXUSDT"];

function App() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [livePrice, setLivePrice] = useState('0.00');
  const [analysis, setAnalysis] = useState({ 
    type: 'SCANNING', entry: 0, tp1: 0, tp2: 0, sl: 0, 
    conf: 0, mtf: 'SYNCING', volume: 'NORMAL', isSureShot: false, isTrailing: false 
  });
  
  const ws = useRef(null);
  const timeoutId = useRef(null);
  const isMounted = useRef(true);

  const cleanSymbol = (s) => s.replace('/', '');
  const precision = symbol.includes('PEPE') || symbol.includes('SHIB') ? 8 : 2;

  const fetchKlines = async (s, interval) => {
    const r = await axios.get(`https://fapi.binance.com/fapi/v1/klines?symbol=${cleanSymbol(s)}&interval=${interval}&limit=100`);
    return r.data.map(d => ({ h: +d[2], l: +d[3], c: +d[4], v: +d[5] }));
  };

  const runQuantumEngine = useCallback(async () => {
    if (!isMounted.current) return;
    try {
      const [k1m, k5m] = await Promise.all([fetchKlines(symbol, '1m'), fetchKlines(symbol, '5m')]);
      const c1m = k1m.map(x => x.c);
      const c5m = k5m.map(x => x.c);
      
      const rsi = ti.RSI.calculate({ values: c1m, period: 14 }).pop();
      const ema20 = ti.EMA.calculate({ values: c1m, period: 20 }).pop();
      const macd = ti.MACD.calculate({ values: c1m, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }).pop();
      const atr = ti.ATR.calculate({ high: k1m.map(x=>x.h), low: k1m.map(x=>x.l), close: c1m, period: 14 }).pop();
      
      const last5m = c5m[c5m.length - 1];
      const ema5m = ti.EMA.calculate({ values: c5m, period: 20 }).pop();
      const mtfTrend = last5m > ema5m ? 'UP' : 'DOWN';

      const volumes = k1m.map(x => x.v);
      const avgVol = ti.SMA.calculate({ values: volumes, period: 20 }).pop();
      const isVolConfirm = volumes[volumes.length - 1] > avgVol * 1.4;

      const lastPrice = c1m[c1m.length - 1];
      
      // Adaptive RSI Logic: Strong trend-এ RSI ফিল্টার শিথিল করা হয়েছে
      const isRsiBull = (mtfTrend === 'UP' && isVolConfirm) ? rsi > 45 : (rsi > 45 && rsi < 70);
      const isRsiBear = (mtfTrend === 'DOWN' && isVolConfirm) ? rsi < 55 : (rsi < 55 && rsi > 30);

      let buyScore = 0;
      if (lastPrice > ema20) buyScore += 20;
      if (macd.histogram > 0) buyScore += 20;
      if (isRsiBull) buyScore += 20;
      if (mtfTrend === 'UP') buyScore += 20;
      if (isVolConfirm) buyScore += 20;

      let sellScore = 0;
      if (lastPrice < ema20) sellScore += 20;
      if (macd.histogram < 0) sellScore += 20;
      if (isRsiBear) sellScore += 20;
      if (mtfTrend === 'DOWN') sellScore += 20;
      if (isVolConfirm) sellScore += 20;

      const sl_dist = atr * 1.8;
      const tp1_val = buyScore > sellScore ? lastPrice + sl_dist : lastPrice - sl_dist;
      
      // Trailing SL logic visual check
      const isTrailingActive = buyScore > sellScore ? lastPrice >= tp1_val : lastPrice <= tp1_val;

      if (isMounted.current) {
        setAnalysis({
          type: buyScore > sellScore ? 'BUY (LONG)' : sellScore > buyScore ? 'SELL (SHORT)' : 'SCANNING',
          entry: lastPrice.toFixed(precision),
          tp1: tp1_val.toFixed(precision),
          tp2: (buyScore > sellScore ? lastPrice + sl_dist * 2.8 : lastPrice - sl_dist * 2.8).toFixed(precision),
          sl: (buyScore > sellScore ? lastPrice - sl_dist : lastPrice + sl_dist).toFixed(precision),
          conf: Math.max(buyScore, sellScore),
          mtf: mtfTrend,
          volume: isVolConfirm ? 'HIGH SPIKE' : 'STABLE',
          isSureShot: Math.max(buyScore, sellScore) >= 80,
          isTrailing: isTrailingActive
        });
      }
    } catch (e) { console.warn("Engine re-syncing..."); }
    if (isMounted.current) timeoutId.current = setTimeout(runQuantumEngine, 4000);
  }, [symbol, precision]);

  useEffect(() => {
    isMounted.current = true;
    if (ws.current) ws.current.close();
    ws.current = new WebSocket(`wss://fstream.binance.com/ws/${cleanSymbol(symbol).toLowerCase()}@markPrice`);
    ws.current.onmessage = (e) => {
      if (isMounted.current) setLivePrice(parseFloat(JSON.parse(e.data).p).toFixed(precision));
    };
    runQuantumEngine();
    const styleElem = document.createElement("style"); styleElem.innerHTML = styles;
    document.head.appendChild(styleElem);
    return () => { isMounted.current = false; clearTimeout(timeoutId.current); if (ws.current) ws.current.close(); };
  }, [symbol, runQuantumEngine, precision]);

  const isUp = analysis.type.includes('BUY');
  const isDown = analysis.type.includes('SELL');

  return (
    <div className="terminal">
      <header>
        <div className="logo">RTX 15 PRO MAX V5.1 [PRO]</div>
        <div style={{color: '#0ecb81', fontSize: '0.6rem', display:'flex', alignItems:'center', gap:'4px', fontWeight:'bold'}}>
          <BellRing size={12}/> ENGINE ACTIVE
        </div>
      </header>

      <div className="price-bar" style={{color: isUp ? '#0ecb81' : isDown ? '#f6465d' : '#f3ba2f'}}>
        {livePrice}
      </div>

      <div className="controls">
        <div className="select-wrapper">
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {markets.sort().map(m => <option key={m} value={m}>{m} PERP</option>)}
          </select>
          <ChevronDown className="select-arrow" size={16} />
        </div>
        <div style={{background:'#161a1e', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid #333', fontSize:'0.7rem', fontWeight:'bold', color: '#f3ba2f'}}>
          <Activity size={12} style={{marginRight:'5px'}}/> PRO SYNC
        </div>
      </div>

      <div className="chart-container">
        <iframe key={symbol} src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE:${cleanSymbol(symbol)}.P&interval=1&theme=dark&style=1&hide_side_toolbar=true`} width="100%" height="100%" frameBorder="0"></iframe>
      </div>

      <div className="signal-panel">
        <div className={`card ${isUp ? 'long-mode' : isDown ? 'short-mode' : ''}`}>
          <div className="tags">
            <span className={`tag ${analysis.volume.includes('HIGH') ? 'tag-on' : ''}`}>VOL_CORE</span>
            <span className={`tag ${analysis.mtf === (isUp?'UP':'DOWN') ? 'tag-on' : ''}`}>MTF_LOCK</span>
            <span className={`tag ${analysis.isSureShot ? 'tag-on' : ''}`}>AI_PRO</span>
          </div>

          <div className="sig-text" style={{color: isUp ? '#0ecb81' : isDown ? '#f6465d' : '#fff'}}>
            {analysis.type}
          </div>

          {analysis.isSureShot && (
            <div className="alert-box sure-shot">
              ⚡ QUANTUM SURE-SHOT DETECTED ⚡
            </div>
          )}

          {analysis.isTrailing && (
            <div className="alert-box trailing-sl">
              🛡️ TP1 HIT: TRAILING SL TO ENTRY ENABLED
            </div>
          )}

          <div className="targets">
            <div className="t-row"><span className="t-label">ENTRY</span><span className="t-val">{analysis.entry}</span></div>
            <div className="t-row"><span className="t-label">TAKE PROFIT 1</span><span className="t-val" style={{color:'#0ecb81'}}>{analysis.tp1}</span></div>
            <div className="t-row"><span className="t-label">TAKE PROFIT 2</span><span className="t-val" style={{color:'#0ecb81'}}>{analysis.tp2}</span></div>
            <div className="t-row"><span className="t-label">STOP LOSS</span><span className="t-val" style={{color:'#f6465d'}}>{analysis.sl}</span></div>
          </div>

          <div className="footer-info">
            <span>VOL: {analysis.volume}</span>
            <span style={{color: '#f3ba2f'}}>CONFIDENCE: {analysis.conf}%</span>
          </div>
        </div>
      </div>

      <div style={{padding:'10px', textAlign:'center', opacity: 0.3, fontSize:'0.5rem', display:'flex', justifyContent:'center', gap:'5px', alignItems:'center'}}>
        <ShieldCheck size={10}/> INSTITUTIONAL GRADE • NO REPAINT
      </div>
    </div>
  );
}

export default App;
