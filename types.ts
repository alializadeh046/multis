
export interface Kline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Timeframe = "5m" | "15m" | "1h" | "4h";

export interface Signal {
  symbol: string;
  timeframe: Timeframe;
  strategyName: string;
  direction: 'LONG' | 'SHORT';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  positionSize?: number;
  suggestedLeverage?: number;
  timestamp: number;
  status: 'PENDING' | 'SENT' | 'FAILED';
  rejectionReason?: string;
}

export interface AppConfig {
  telegramToken: string;
  telegramChatId: string;
  symbols: string[];
  accountBalance: number;
  riskPerTrade: number;
  leverage: number;
}

export interface MarketDataStore {
  [symbol: string]: {
    [tf in Timeframe]?: Kline[];
  };
}
