
import { Kline, Timeframe } from '../types';

// Helper: Calculate ATR
export const calculateATR = (klines: Kline[], period: number = 14): number[] => {
  const trs = klines.map((k, i) => {
    if (i === 0) return k.high - k.low;
    const hl = k.high - k.low;
    const hpc = Math.abs(k.high - klines[i - 1].close);
    const lpc = Math.abs(k.low - klines[i - 1].close);
    return Math.max(hl, hpc, lpc);
  });

  let atr = new Array(trs.length).fill(0);
  let sum = trs.slice(0, period).reduce((a, b) => a + b, 0);
  atr[period - 1] = sum / period;

  for (let i = period; i < trs.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + trs[i]) / period;
  }
  return atr;
};

// Helper: Calculate ADX (Average Directional Index)
export const calculateADX = (klines: Kline[], period: number = 14): number[] => {
  let plusDM = new Array(klines.length).fill(0);
  let minusDM = new Array(klines.length).fill(0);

  for (let i = 1; i < klines.length; i++) {
    const upMove = klines[i].high - klines[i - 1].high;
    const downMove = klines[i - 1].low - klines[i].low;

    if (upMove > downMove && upMove > 0) plusDM[i] = upMove;
    if (downMove > upMove && downMove > 0) minusDM[i] = downMove;
  }

  const atr = calculateATR(klines, period);
  let plusDI = plusDM.map((dm, i) => 100 * (dm / (atr[i] || 1)));
  let minusDI = minusDM.map((dm, i) => 100 * (dm / (atr[i] || 1)));

  let dx = plusDI.map((p, i) => {
    const sum = p + minusDI[i];
    const diff = Math.abs(p - minusDI[i]);
    return 100 * (diff / (sum || 1));
  });

  let adx = new Array(dx.length).fill(0);
  let sumDX = dx.slice(0, period).reduce((a, b) => a + b, 0);
  adx[period - 1] = sumDX / period;

  for (let i = period; i < dx.length; i++) {
    adx[i] = (adx[i - 1] * (period - 1) + dx[i]) / period;
  }

  return adx;
};

export const selectSmartTimeframes = (klines: Kline[]): { timeframes: Timeframe[], isVolatile: boolean } => {
  if (klines.length < 50) return { timeframes: ["15m", "1h"], isVolatile: false };

  const adx = calculateADX(klines, 14);
  const atr = calculateATR(klines, 14);
  const currentADX = adx[adx.length - 1];
  const currentATR = atr[atr.length - 1];
  
  // ATR Spike Detection: Current ATR vs Average of last 20 ATRs
  const avgATR = atr.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const isVolatile = currentATR > (avgATR * 1.8); // 80% jump is "strange"

  let tfs: Timeframe[] = [];
  if (currentADX < 20) {
    tfs = ["5m", "15m"]; // Ranging market
  } else if (currentADX > 25) {
    tfs = ["1h", "4h"]; // Trending market
  } else {
    tfs = ["15m", "1h"]; // Transition
  }

  return { timeframes: tfs, isVolatile };
};
