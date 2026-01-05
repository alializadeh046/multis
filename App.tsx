
import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Activity, 
  Play, 
  Send, 
  AlertCircle,
  History,
  TrendingUp,
  BarChart2,
  Trash2,
  Zap,
  ShieldAlert,
  Info,
  Scale,
  Cpu
} from 'lucide-react';
import { AppConfig, Signal, Timeframe, Kline } from './types';
import { APP_DEFAULTS, DEFAULT_SYMBOLS } from './constants';
import { fetchKlines } from './services/marketService';
import { runAllStrategies } from './services/strategyService';
import { applyRiskManagement } from './services/riskService';
import { sendTelegramSignal } from './services/telegramService';
import { selectSmartTimeframes, calculateADX } from './services/timeframeService';

const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('bot_config');
    return saved ? JSON.parse(saved) : {
      telegramToken: '',
      telegramChatId: '',
      symbols: DEFAULT_SYMBOLS,
      accountBalance: APP_DEFAULTS.accountBalance,
      riskPerTrade: APP_DEFAULTS.riskPerTrade,
      leverage: APP_DEFAULTS.leverage,
    };
  });

  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<{msg: string, type: 'info' | 'warn' | 'success' | 'error'}[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem('bot_config', JSON.stringify(config));
  }, [config]);

  const addLog = (msg: string, type: 'info' | 'warn' | 'success' | 'error' = 'info') => {
    setLogs(prev => [{ msg: `[${new Date().toLocaleTimeString()}] ${msg}`, type }, ...prev.slice(0, 99)]);
  };

  const runPipeline = async () => {
    if (isRunning) return;
    setIsRunning(true);
    
    // Step 1: Initialization (main_test.py start)
    addLog("--- INITIALIZING MAIN TEST ENGINE (SuperStrategy v3) ---", 'info');

    try {
      const detectedSignals: Signal[] = [];

      for (const symbol of config.symbols) {
        addLog(`SCANNING SYMBOL: ${symbol}`, 'info');
        
        // Step 2: Market Data Engine
        const analysisData = await fetchKlines(symbol, "15m", 300);
        if (analysisData.length < 200) {
          addLog(`${symbol}: Rejected by Engine (Insufficient candle history for SMA 200)`, 'warn');
          continue;
        }

        // Step 3: Smart Timeframe Selector
        const adx = calculateADX(analysisData, 14);
        const currentADX = adx[adx.length - 1];
        const { timeframes, isVolatile } = selectSmartTimeframes(analysisData);
        
        addLog(`${symbol} Market Profile: ADX=${currentADX.toFixed(2)}`, 'info');

        if (isVolatile) {
          addLog(`${symbol}: Rejected by Volatility Filter (ATR Spike detected)`, 'error');
          continue;
        }

        for (const tf of timeframes) {
          addLog(`Analyzing ${tf} timeframe...`, 'info');
          
          const klines = tf === "15m" ? analysisData : await fetchKlines(symbol, tf, 300);
          if (klines.length < 200) continue;

          // Step 4: SuperStrategy Execution (Confluence logic)
          const { signals: strategyResults, rejections } = runAllStrategies(symbol, tf, klines);
          
          // Log all internal strategy rejections for transparency
          rejections.forEach(reason => addLog(`  - ${reason}`, 'warn'));

          for (let signal of strategyResults) {
            // Step 5: Advanced Risk Engine Validation
            addLog(`  - Trade found! Validating Risk Parameters...`, 'info');
            
            const riskResult = applyRiskManagement(
              signal, 
              config.accountBalance, 
              config.riskPerTrade, 
              config.leverage
            );
            
            if (!riskResult.isValid) {
              addLog(`  - REJECTED BY RISK ENGINE: ${riskResult.reason}`, 'error');
              continue;
            }

            const validatedSignal = riskResult.signal;
            addLog(`⚡ CONFIRMED: ${validatedSignal.strategyName} ${validatedSignal.direction} @ ${tf}`, 'success');
            detectedSignals.push(validatedSignal);
            
            // Step 6: Telegram Notifier (Final Step)
            if (config.telegramToken && config.telegramChatId) {
              const success = await sendTelegramSignal(
                config.telegramToken,
                config.telegramChatId,
                validatedSignal
              );
              validatedSignal.status = success ? 'SENT' : 'FAILED';
              if (success) addLog(`  - Signal broadcasted to Telegram successfully.`, 'success');
              else addLog(`  - FAILED to send Telegram alert. Check Token/ChatID.`, 'error');
            } else {
              addLog(`  - Telegram notification skipped (Configuration missing).`, 'warn');
            }
          }
        }
      }

      setSignals(prev => [...detectedSignals, ...prev]);
      if (detectedSignals.length === 0) {
        addLog("EXECUTION FINISHED: No signals met the strict SuperStrategy Confluence + Risk requirements.", 'warn');
      } else {
        addLog(`EXECUTION FINISHED: Successfully captured ${detectedSignals.length} high-probability trades.`, 'success');
      }
      
    } catch (err: any) {
      addLog(`CRITICAL ENGINE FAILURE: ${err.message}`, 'error');
    } finally {
      setIsRunning(false);
      addLog("--- ENGINE STATUS: STANDBY ---", 'info');
    }
  };

  const clearHistory = () => {
    setSignals([]);
    setLogs([]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#050505]">
      {/* Dynamic Header */}
      <header className="bg-slate-900/50 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-500/20">
            <Cpu className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tighter uppercase">SuperStrategy <span className="text-indigo-500">v3.0</span></h1>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
              <p className="text-[10px] text-slate-500 font-bold tracking-[0.2em] uppercase">Test Engine Active</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowSettings(!showSettings)} 
            className={`p-2.5 rounded-xl border border-white/5 transition-all ${showSettings ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
          
          <button 
            disabled={isRunning}
            onClick={runPipeline}
            className={`flex items-center gap-3 px-10 py-3.5 rounded-2xl font-black text-xs uppercase tracking-[0.15em] transition-all ${
              isRunning 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-[0_10px_30px_-10px_rgba(79,70,229,0.5)] active:scale-95'
            }`}
          >
            {isRunning ? 'Analyzing Market...' : 'Run main_test.py'}
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-screen-2xl mx-auto w-full">
        {/* Settings Overlay - Dynamic */}
        {showSettings && (
          <div className="lg:col-span-12 bg-slate-900/80 border border-white/10 rounded-[2.5rem] p-10 mb-2 shadow-2xl backdrop-blur-2xl animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-2xl font-black flex items-center gap-4 text-white uppercase tracking-tight">
                <ShieldAlert className="w-8 h-8 text-indigo-500" /> Test Configuration
              </h2>
              <button onClick={() => setShowSettings(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 text-[10px] font-black uppercase tracking-widest transition-all">Close</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">Telegram Bot Token</label>
                <input type="password" placeholder="bot..." className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-sm focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-indigo-400" value={config.telegramToken} onChange={e => setConfig({...config, telegramToken: e.target.value})}/>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">Telegram Chat ID</label>
                <input type="text" placeholder="-100..." className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-sm focus:border-indigo-500/50 outline-none transition-all" value={config.telegramChatId} onChange={e => setConfig({...config, telegramChatId: e.target.value})}/>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">Account Balance ($)</label>
                <input type="number" className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-sm font-bold mono" value={config.accountBalance} onChange={e => setConfig({...config, accountBalance: Number(e.target.value)})}/>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">Max System Leverage</label>
                <input type="number" className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-sm font-bold mono text-indigo-500" value={config.leverage} onChange={e => setConfig({...config, leverage: Number(e.target.value)})}/>
              </div>
            </div>
          </div>
        )}

        {/* Engine Console Output */}
        <div className="lg:col-span-5 flex flex-col gap-6 h-full min-h-[500px]">
          <div className="flex-1 bg-slate-900/30 border border-white/5 rounded-[2.5rem] flex flex-col overflow-hidden shadow-inner">
            <div className="px-8 py-5 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                <span className="text-[11px] font-black text-slate-300 uppercase tracking-[0.25em]">Execution Logs</span>
              </div>
              <button onClick={clearHistory} className="p-2 bg-white/5 hover:bg-rose-500/20 rounded-xl text-slate-500 hover:text-rose-400 transition-all"><Trash2 className="w-4 h-4" /></button>
            </div>
            
            <div className="flex-1 p-8 mono text-[11px] leading-relaxed overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-white/5">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 select-none">
                  <Activity className="w-12 h-12 mb-4" />
                  <p className="text-center font-black uppercase tracking-[0.3em] text-[10px]">Engine Idle. Initiate scan to proceed.</p>
                </div>
              ) : logs.map((log, i) => (
                <div key={i} className={`flex gap-4 group animate-in slide-in-from-left-4 duration-300 ${
                  log.type === 'success' ? 'text-emerald-400' : 
                  log.type === 'warn' ? 'text-orange-400/80' : 
                  log.type === 'error' ? 'text-rose-400' : 'text-slate-500'
                }`}>
                  <span className="opacity-20 whitespace-nowrap group-hover:opacity-100 transition-opacity">[{log.msg.split('] ')[0].replace('[', '')}]</span>
                  <span className={`${log.type === 'success' ? 'font-black' : ''} tracking-tight`}>{log.msg.split('] ')[1]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20 rounded-[2rem] p-8 shadow-2xl">
             <div className="flex items-center gap-4 text-indigo-400 mb-6">
               <ShieldAlert className="w-6 h-6" />
               <span className="text-sm font-black uppercase tracking-[0.15em]">System Protocols</span>
             </div>
             <div className="grid grid-cols-1 gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-wide">
               <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl border border-white/5"><TrendingUp className="w-4 h-4 text-emerald-500" /> SuperStrategy Confluence (Min 2 Signals)</div>
               <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl border border-white/5"><Scale className="w-4 h-4 text-indigo-400" /> Dynamic R/R Protection (Target 2.0+)</div>
               <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl border border-white/5"><Zap className="w-4 h-4 text-amber-500" /> ATR Volatility Anomaly Detection</div>
             </div>
          </div>
        </div>

        {/* Signals Feed - Aesthetic Cards */}
        <div className="lg:col-span-7 flex flex-col gap-6 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-black flex items-center gap-4 text-white uppercase tracking-tight">
              <TrendingUp className="w-8 h-8 text-emerald-500" /> Filtered Signals
            </h2>
            <div className="bg-slate-900 px-5 py-2 rounded-full text-[11px] font-black text-slate-500 mono border border-white/5">
              {signals.length} CAPTURED
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-6 pr-2 pb-20 scrollbar-none">
            {signals.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.02]">
                <Info className="w-12 h-12 text-slate-800 mb-4" />
                <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-700">Awaiting Valid Confluence Signals</p>
              </div>
            ) : (
              signals.map((sig, i) => (
                <div key={i} className="group bg-slate-900/40 border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl transition-all hover:bg-slate-900/60 hover:border-indigo-500/30 animate-in zoom-in-95 duration-500">
                  <div className={`h-2 w-full ${sig.direction === 'LONG' ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-rose-600 to-rose-400'}`} />
                  <div className="p-8 md:p-10">
                       <div className="flex items-center gap-5 mb-8">
                         <div className={`px-6 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl ${sig.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                           {sig.direction}
                         </div>
                         <h3 className="font-black text-3xl text-white tracking-tighter">{sig.symbol}</h3>
                         <span className="bg-white/5 px-4 py-1.5 rounded-xl text-[11px] font-black text-slate-500 uppercase tracking-widest">{sig.timeframe}</span>
                         <div className="ml-auto flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2 text-indigo-400">
                              <Scale className="w-4 h-4" />
                              <span className="text-[11px] font-black uppercase tracking-widest">{sig.suggestedLeverage}x Leverage</span>
                            </div>
                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{sig.strategyName}</span>
                         </div>
                       </div>
                       
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         {[
                           { label: "Entry", val: sig.entry, color: "text-white" },
                           { label: "Stop Loss", val: sig.stopLoss, color: "text-rose-500" },
                           { label: "Take Profit", val: sig.takeProfit, color: "text-emerald-500" },
                           { label: "Position (Units)", val: sig.positionSize, color: "text-indigo-400" }
                         ].map((item, idx) => (
                           <div key={idx} className="bg-black/30 p-5 rounded-3xl border border-white/5 group-hover:border-white/10 transition-all">
                             <div className="text-[9px] text-slate-500 font-black uppercase mb-2 tracking-[0.15em]">{item.label}</div>
                             <div className={`text-lg font-black mono ${item.color}`}>{item.val?.toLocaleString() || '-'}</div>
                           </div>
                         ))}
                       </div>
                       
                       <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
                         <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest flex items-center gap-2">
                           <History className="w-3 h-3" /> Captured: {new Date(sig.timestamp).toLocaleTimeString()}
                         </div>
                         <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${sig.status === 'SENT' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                           <Send className="w-3 h-3" /> {sig.status}
                         </div>
                       </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <footer className="bg-black/80 backdrop-blur-lg border-t border-white/5 px-8 py-5 flex items-center justify-between">
        <div className="flex gap-10">
           <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Binance Cloud API: Verified</span>
           </div>
           <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confluence Engine: 2/2 Required</span>
           </div>
        </div>
        <div className="text-[11px] font-black text-slate-800 uppercase tracking-[0.5em] select-none">
          Risk Engine Pro v3.0.4-LATEST
        </div>
      </footer>
    </div>
  );
};

export default App;
