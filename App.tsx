
import React, { useState, useEffect, useCallback } from 'react';
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
  Zap
} from 'lucide-react';
import { AppConfig, Signal, Timeframe, Kline } from './types';
import { APP_DEFAULTS, DEFAULT_SYMBOLS, AVAILABLE_TIMEFRAMES } from './constants';
import { fetchKlines } from './services/marketService';
import { runAllStrategies } from './services/strategyService';
import { applyRiskManagement } from './services/riskService';
import { sendTelegramSignal } from './services/telegramService';
import { getSmartTimeframes } from './services/geminiService';

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
  const [logs, setLogs] = useState<string[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem('bot_config', JSON.stringify(config));
  }, [config]);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);
  };

  const runPipeline = async () => {
    if (isRunning) return;
    setIsRunning(true);
    addLog("🚀 Starting Multi-Strategy Scan...");

    try {
      const detectedSignals: Signal[] = [];

      for (const symbol of config.symbols) {
        addLog(`Analyzing ${symbol}...`);
        
        // 1. Smart Timeframe Selection (AI)
        const sampleKlines = await fetchKlines(symbol, "15m", 250); // Get more data for EMA200
        const activeTfs = await getSmartTimeframes(symbol, sampleKlines);
        addLog(`AI focus for ${symbol}: ${activeTfs.join(', ')}`);

        for (const tf of activeTfs) {
          const klines = tf === "15m" ? sampleKlines : await fetchKlines(symbol, tf, 250);
          
          if (klines.length === 0) continue;

          // 2. Multi-Strategy Engine
          const strategyResults = runAllStrategies(symbol, tf, klines);

          for (let signal of strategyResults) {
            // 3. Risk Engine
            signal = applyRiskManagement(
              signal, 
              config.accountBalance, 
              config.riskPerTrade, 
              config.leverage
            );
            
            addLog(`⚡ [${signal.strategyName}] ${signal.direction} ${symbol} @ ${tf}`);
            detectedSignals.push(signal);
            
            // 4. Telegram Notifier
            const success = await sendTelegramSignal(
              config.telegramToken,
              config.telegramChatId,
              signal
            );
            
            signal.status = success ? 'SENT' : 'FAILED';
          }
        }
      }

      setSignals(prev => [...detectedSignals, ...prev]);
      if (detectedSignals.length === 0) addLog("No clear entries found in this cycle.");
      else addLog(`Successfully found ${detectedSignals.length} signals.`);
      
    } catch (err: any) {
      addLog(`CRITICAL ERROR: ${err.message}`);
    } finally {
      setIsRunning(false);
      addLog("System scan complete.");
    }
  };

  const clearHistory = () => {
    setSignals([]);
    setLogs([]);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">CryptoSignal Pro</h1>
            <p className="text-xs text-slate-400 font-medium">Multi-Strategy Futures Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <SettingsIcon className="w-6 h-6" />
          </button>
          <button 
            disabled={isRunning}
            onClick={runPipeline}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold transition-all shadow-lg ${
              isRunning 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/20 active:scale-95'
            }`}
          >
            {isRunning ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Run Engine Scan
              </>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden max-w-screen-2xl mx-auto w-full">
        {/* Settings Panel */}
        {showSettings && (
          <div className="lg:col-span-12 bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-4 animate-in fade-in slide-in-from-top-4">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-indigo-400" />
                Configuration
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">Close</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Telegram Token</label>
                <input 
                  type="password" 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:border-indigo-500 outline-none"
                  value={config.telegramToken}
                  onChange={e => setConfig({...config, telegramToken: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Chat ID</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:border-indigo-500 outline-none"
                  value={config.telegramChatId}
                  onChange={e => setConfig({...config, telegramChatId: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Risk Mgmt (Balance / Risk%)</label>
                <div className="flex gap-2">
                  <input type="number" className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm" value={config.accountBalance} onChange={e => setConfig({...config, accountBalance: Number(e.target.value)})}/>
                  <input type="number" className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm" value={config.riskPerTrade} onChange={e => setConfig({...config, riskPerTrade: Number(e.target.value)})}/>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Engine Logs */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-xl">
            <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="text-sm font-bold flex items-center gap-2 text-slate-400 uppercase tracking-widest">
                <BarChart2 className="w-4 h-4" />
                Engine Output
              </h3>
              <button onClick={clearHistory} className="text-slate-500 hover:text-red-400 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 p-4 mono text-[12px] leading-relaxed overflow-y-auto space-y-1 scrollbar-none">
              {logs.length === 0 ? (
                <div className="text-slate-600 italic">Engine idle. Awaiting manual trigger.</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={`${log.includes('⚡') ? 'text-indigo-400 font-bold' : log.includes('✅') ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-4">
             <div className="flex items-center gap-2 mb-3">
               <Zap className="w-4 h-4 text-indigo-400" />
               <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Loaded Strategies</span>
             </div>
             <div className="flex flex-wrap gap-2">
               {['EMA Cross', 'RSI Extremes', 'BB Breakout', 'Trend Pullback'].map(s => (
                 <span key={s} className="px-2 py-1 bg-slate-800 text-[10px] rounded border border-slate-700 text-slate-300">{s}</span>
               ))}
             </div>
          </div>
        </div>

        {/* Signal History */}
        <div className="lg:col-span-8 flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Detected Signals
            </h2>
            <div className="text-xs text-slate-500 font-mono">{signals.length} ACTIVE</div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none pb-12">
            {signals.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-3xl text-slate-700">
                <History className="w-10 h-10 mb-2 opacity-10" />
                <p className="text-sm">Scan the market to find opportunities</p>
              </div>
            ) : (
              signals.map((sig, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden group hover:border-indigo-500/50 transition-all">
                  <div className={`h-1 w-full ${sig.direction === 'LONG' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <div className="p-5 flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1 w-full">
                      <div className="flex items-center gap-3 mb-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${sig.direction === 'LONG' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {sig.direction}
                        </span>
                        <h4 className="font-black text-xl text-white">{sig.symbol}</h4>
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-400">{sig.timeframe}</span>
                        <div className="ml-auto flex items-center gap-2">
                           <span className="text-[10px] text-indigo-400 font-bold uppercase">{sig.strategyName}</span>
                           <span className="text-[10px] text-slate-600">{new Date(sig.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-slate-800/30 p-3 rounded-xl border border-slate-800">
                          <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Entry</div>
                          <div className="text-sm font-bold mono text-slate-200">{sig.entry.toLocaleString()}</div>
                        </div>
                        <div className="bg-slate-800/30 p-3 rounded-xl border border-slate-800">
                          <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Stop Loss</div>
                          <div className="text-sm font-bold mono text-rose-400">{sig.stopLoss.toLocaleString()}</div>
                        </div>
                        <div className="bg-slate-800/30 p-3 rounded-xl border border-slate-800">
                          <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Target</div>
                          <div className="text-sm font-bold mono text-emerald-400">{sig.takeProfit.toLocaleString()}</div>
                        </div>
                        <div className="bg-slate-800/30 p-3 rounded-xl border border-slate-800">
                          <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Contracts</div>
                          <div className="text-sm font-bold mono text-indigo-400">{sig.positionSize}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex md:flex-col items-center justify-center gap-2">
                      <div className={`p-2 rounded-full ${sig.status === 'SENT' ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-600 bg-slate-800'}`}>
                        <Send className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase text-slate-500">{sig.status}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <footer className="bg-slate-950 border-t border-slate-900 px-6 py-3 flex items-center justify-between text-[10px] text-slate-600 font-bold uppercase tracking-widest">
        <div className="flex gap-6">
          <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> API: ONLINE</span>
          <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> ENGINE: READY</span>
        </div>
        <div>PRO VERSION v2.1</div>
      </footer>
    </div>
  );
};

export default App;
