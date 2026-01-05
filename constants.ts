
import { Timeframe } from './types';

export const DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];
export const AVAILABLE_TIMEFRAMES: Timeframe[] = ["5m", "15m", "1h", "4h"];

export const BINANCE_BASE_URL = "https://api.binance.com/api/v3";

export const APP_DEFAULTS = {
  accountBalance: 1000,
  riskPerTrade: 1, // 1%
  leverage: 10,
};
