
import { BINANCE_BASE_URL } from '../constants';
import { Kline, Timeframe } from '../types';

export const fetchKlines = async (symbol: string, interval: Timeframe, limit: number = 100): Promise<Kline[]> => {
  try {
    const url = `${BINANCE_BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    
    return data.map((item: any[]) => ({
      time: item[0],
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
    }));
  } catch (error) {
    console.error(`Error fetching klines for ${symbol} ${interval}:`, error);
    return [];
  }
};
