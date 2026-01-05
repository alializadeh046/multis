
import { BINANCE_BASE_URL } from '../constants';
import { Kline, Timeframe } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchKlines = async (
  symbol: string, 
  interval: Timeframe, 
  limit: number = 300, 
  retries: number = 3
): Promise<Kline[]> => {
  let lastError;

  for (let i = 0; i < retries; i++) {
    try {
      const url = `${BINANCE_BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
      const response = await fetch(url);
      
      if (response.status === 429) {
        console.warn("Rate limit hit, waiting longer...");
        await sleep(5000);
        continue;
      }

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      const rawKlines = data.map((item: any[]) => ({
        time: item[0],
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5]),
      }));

      // Logic: ffill() equivalent for missing values
      return rawKlines.map((k: Kline, idx: number) => {
        if (isNaN(k.close) || k.close === 0) {
          return idx > 0 ? { ...k, close: rawKlines[idx - 1].close } : k;
        }
        return k;
      });

    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${i + 1} failed for ${symbol}. Retrying in 2s...`);
      await sleep(2000);
    }
  }

  console.error(`Failed to fetch ${symbol} after ${retries} attempts:`, lastError);
  return [];
};
