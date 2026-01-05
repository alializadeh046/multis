
import { Kline, Signal, Timeframe } from '../types';

// Helper: EMA Calculation
const calculateEMA = (data: number[], period: number): number[] => {
  const k = 2 / (period + 1);
  let ema = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
};

// Helper: RSI Calculation
const calculateRSI = (closes: number[], period: number = 14): number[] => {
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

// Helper: Bollinger Bands
const calculateBollingerBands = (closes: number[], period: number = 20, stdDev: number = 2) => {
  const bands = closes.map((_, idx) => {
    if (idx < period) return { middle: 0, upper: 0, lower: 0 };
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
  return bands;
};

// 1. EMA Cross Strategy
const checkEMACross = (symbol: string, tf: Timeframe, klines: Kline[]): Signal | null => {
  const closes = klines.map(k => k.close);
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const last = klines.length - 1;
  const prev = last - 1;

  if (ema9[prev] <= ema21[prev] && ema9[last] > ema21[last]) {
    return createSignal(symbol, tf, 'EMA Cross', 'LONG', klines[last].close);
  }
  if (ema9[prev] >= ema21[prev] && ema9[last] < ema21[last]) {
    return createSignal(symbol, tf, 'EMA Cross', 'SHORT', klines[last].close);
  }
  return null;
};

// 2. RSI Extreme Strategy
const checkRSIExtreme = (symbol: string, tf: Timeframe, klines: Kline[]): Signal | null => {
  const closes = klines.map(k => k.close);
  const rsi = calculateRSI(closes);
  const last = rsi.length - 1;

  if (rsi[last] < 30) return createSignal(symbol, tf, 'RSI Oversold', 'LONG', klines[last].close);
  if (rsi[last] > 70) return createSignal(symbol, tf, 'RSI Overbought', 'SHORT', klines[last].close);
  return null;
};

// 3. Bollinger Breakout
const checkBollingerBreakout = (symbol: string, tf: Timeframe, klines: Kline[]): Signal | null => {
  const closes = klines.map(k => k.close);
  const bands = calculateBollingerBands(closes);
  const last = klines.length - 1;

  if (klines[last].close > bands[last].upper) {
    return createSignal(symbol, tf, 'BB Breakout', 'SHORT', klines[last].close); // Mean reversion
  }
  if (klines[last].close < bands[last].lower) {
    return createSignal(symbol, tf, 'BB Breakout', 'LONG', klines[last].close);
  }
  return null;
};

// 4. Trend Pullback (Price touches EMA 200 in trend)
const checkTrendPullback = (symbol: string, tf: Timeframe, klines: Kline[]): Signal | null => {
  const closes = klines.map(k => k.close);
  const ema200 = calculateEMA(closes, 200);
  const last = klines.length - 1;
  const currentPrice = klines[last].close;

  if (klines.length < 200) return null;

  const isUptrend = currentPrice > ema200[last];
  const touchThreshold = currentPrice * 0.002; // 0.2% distance

  if (isUptrend && Math.abs(currentPrice - ema200[last]) < touchThreshold) {
    return createSignal(symbol, tf, 'Trend Pullback', 'LONG', currentPrice);
  }
  if (!isUptrend && Math.abs(currentPrice - ema200[last]) < touchThreshold) {
    return createSignal(symbol, tf, 'Trend Pullback', 'SHORT', currentPrice);
  }
  return null;
};

// Master Signal Creator
const createSignal = (
  symbol: string, 
  timeframe: Timeframe, 
  strategyName: string, 
  direction: 'LONG' | 'SHORT',
  price: number
): Signal => {
  const atr = price * 0.01; // Simple fallback ATR
  return {
    symbol,
    timeframe,
    strategyName,
    direction,
    entry: price,
    stopLoss: direction === 'LONG' ? price - (atr * 2) : price + (atr * 2),
    takeProfit: direction === 'LONG' ? price + (atr * 4) : price - (atr * 4),
    timestamp: Date.now(),
    status: 'PENDING'
  };
};

export const runAllStrategies = (
  symbol: string, 
  timeframe: Timeframe, 
  klines: Kline[]
): Signal[] => {
  if (klines.length < 50) return [];

  const signals: Signal[] = [];
  
  const emaSig = checkEMACross(symbol, timeframe, klines);
  if (emaSig) signals.push(emaSig);

  const rsiSig = checkRSIExtreme(symbol, timeframe, klines);
  if (rsiSig) signals.push(rsiSig);

  const bbSig = checkBollingerBreakout(symbol, timeframe, klines);
  if (bbSig) signals.push(bbSig);

  const trendSig = checkTrendPullback(symbol, timeframe, klines);
  if (trendSig) signals.push(trendSig);

  return signals;
};
