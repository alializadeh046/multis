
import { Kline, Signal, Timeframe } from '../types';
import { calculateATR } from './timeframeService';

// --- Technical Indicators ---

export const calculateSMA = (data: number[], period: number): number[] => {
  return data.map((_, idx) => {
    if (idx < period - 1) return 0;
    const slice = data.slice(idx - period + 1, idx + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
};

export const calculateEMA = (data: number[], period: number): number[] => {
  const k = 2 / (period + 1);
  let ema = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
};

export const calculateRSI = (closes: number[], period: number = 14): number[] => {
  let rsi = new Array(closes.length).fill(50);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi[i] = 100 - 100 / (1 + rs);
  }
  return rsi;
};

export const calculateBollingerBands = (closes: number[], period: number = 20, stdDev: number = 2) => {
  return closes.map((_, idx) => {
    if (idx < period - 1) return { middle: 0, upper: 0, lower: 0 };
    const slice = closes.slice(idx - period + 1, idx + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    const sd = Math.sqrt(variance);
    return {
      middle: mean,
      upper: mean + (stdDev * sd),
      lower: mean - (stdDev * sd)
    };
  });
};

// --- SuperStrategy Engine ---

export const runAllStrategies = (
  symbol: string, 
  timeframe: Timeframe, 
  klines: Kline[]
): { signals: Signal[], rejections: string[] } => {
  const rejections: string[] = [];
  const signals: Signal[] = [];

  if (klines.length < 200) {
    rejections.push(`Insufficient history (${klines.length}/200) for SuperStrategy`);
    return { signals, rejections };
  }

  const closes = klines.map(k => k.close);
  const volumes = klines.map(k => k.volume);
  const last = klines.length - 1;
  const prev = last - 1;

  // 1. Trend Filter: SMA 200
  const sma200 = calculateSMA(closes, 200);
  const currentPrice = closes[last];
  const currentSMA200 = sma200[last];
  const isUptrend = currentPrice > currentSMA200;

  // 2. EMA Cross (9/21)
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  let emaScore = 0; // +1 for LONG, -1 for SHORT
  if (ema9[prev] <= ema21[prev] && ema9[last] > ema21[last]) emaScore = 1;
  else if (ema9[prev] >= ema21[prev] && ema9[last] < ema21[last]) emaScore = -1;

  // 3. RSI (Mean Reversion)
  const rsi = calculateRSI(closes, 14);
  let rsiScore = 0;
  if (rsi[last] < 30) rsiScore = 1; // Oversold -> LONG
  else if (rsi[last] > 70) rsiScore = -1; // Overbought -> SHORT

  // 4. Bollinger Bands (Volatility Breakout)
  const bands = calculateBollingerBands(closes, 20, 2);
  let bbScore = 0;
  // Price was outside, now re-entering
  if (closes[prev] < bands[prev].lower && closes[last] >= bands[last].lower) bbScore = 1;
  else if (closes[prev] > bands[prev].upper && closes[last] <= bands[last].upper) bbScore = -1;

  // 5. Volume Confirmation
  const avgVolume = calculateSMA(volumes, 20)[last];
  const isVolumeConfirmed = volumes[last] > avgVolume;

  // --- Confluence Logic ---

  // Check signals against trend
  const longSignals = [
    emaScore === 1 ? 'EMA Cross' : null,
    rsiScore === 1 ? 'RSI Oversold' : null,
    bbScore === 1 ? 'BB Re-entry' : null
  ].filter(s => s !== null);

  const shortSignals = [
    emaScore === -1 ? 'EMA Cross' : null,
    rsiScore === -1 ? 'RSI Overbought' : null,
    bbScore === -1 ? 'BB Re-entry' : null
  ].filter(s => s !== null);

  let finalDirection: 'LONG' | 'SHORT' | null = null;
  let activeStrategies: string[] = [];

  if (longSignals.length >= 2) {
    if (!isUptrend) {
      rejections.push(`${symbol}: LONG confluence (${longSignals.join('+')}) rejected by SMA 200 trend filter.`);
    } else if (!isVolumeConfirmed) {
      rejections.push(`${symbol}: LONG confluence rejected by Volume filter.`);
    } else {
      finalDirection = 'LONG';
      activeStrategies = longSignals as string[];
    }
  } else if (shortSignals.length >= 2) {
    if (isUptrend) {
      rejections.push(`${symbol}: SHORT confluence (${shortSignals.join('+')}) rejected by SMA 200 trend filter.`);
    } else if (!isVolumeConfirmed) {
      rejections.push(`${symbol}: SHORT confluence rejected by Volume filter.`);
    } else {
      finalDirection = 'SHORT';
      activeStrategies = shortSignals as string[];
    }
  } else {
    // Single strategy matches are ignored (No Confluence)
    const activeAny = longSignals.length > 0 ? longSignals : shortSignals;
    if (activeAny.length > 0) {
      rejections.push(`${symbol}: Low confluence (${activeAny.length}/2 signals). Strategy [${activeAny.join(', ')}] was active but insufficient.`);
    }
  }

  if (finalDirection) {
    const atr = calculateATR(klines, 14);
    const currentATR = atr[last];
    
    // Risk Management: 2 * ATR for Stop Loss, 1:2 R/R for Take Profit
    const slDistance = currentATR * 2;
    const tpDistance = slDistance * 2; // Ratio 1:2

    signals.push({
      symbol,
      timeframe,
      strategyName: `SuperStrategy (${activeStrategies.join(' + ')})`,
      direction: finalDirection,
      entry: currentPrice,
      stopLoss: finalDirection === 'LONG' ? currentPrice - slDistance : currentPrice + slDistance,
      takeProfit: finalDirection === 'LONG' ? currentPrice + tpDistance : currentPrice - tpDistance,
      timestamp: Date.now(),
      status: 'PENDING'
    });
  }

  return { signals, rejections };
};
