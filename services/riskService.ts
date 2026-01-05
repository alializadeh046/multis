
import { Signal } from '../types';

export interface RiskResult {
  isValid: boolean;
  signal: Signal;
  reason?: string;
}

/**
 * Professional Dynamic Risk Management System
 * Replaces risk_engine.py logic
 */
export const applyRiskManagement = (
  signal: Signal,
  balance: number,
  riskPercent: number, // e.g., 1%
  maxLeverage: number
): RiskResult => {
  const entry = signal.entry;
  const sl = signal.stopLoss;
  const tp = signal.takeProfit;

  // 1. Calculate Distance to Stop Loss
  const slDistance = Math.abs(entry - sl);
  const slPercent = slDistance / entry;

  if (slDistance === 0) {
    return { isValid: false, signal, reason: "Zero distance Stop Loss detected" };
  }

  // 2. Validation: SL Distance (Volatility Check)
  // Too small: Noise risk (< 0.1%)
  // Too large: Extreme volatility risk (> 10%)
  if (slPercent < 0.001) {
    return { isValid: false, signal, reason: "Unsafe: SL distance too small (Market Noise)" };
  }
  if (slPercent > 0.10) {
    return { isValid: false, signal, reason: "Unsafe: SL distance too large (Extreme Volatility)" };
  }

  // 3. Dynamic R/R Ratio Check (Target >= 2.0)
  const tpDistance = Math.abs(tp - entry);
  const rrRatio = tpDistance / slDistance;

  if (rrRatio < 2.0) {
    return { 
      isValid: false, 
      signal, 
      reason: `Rejected: R/R Ratio too low (${rrRatio.toFixed(2)} < 2.0)` 
    };
  }

  // 4. Max Exposure Limit (Hard Cap 5% of total capital)
  const effectiveRiskPercent = Math.min(riskPercent, 5.0);
  const riskAmount = balance * (effectiveRiskPercent / 100);

  // 5. Position Sizing (Units/Coins)
  // Formula: (Balance * Risk%) / (Entry - SL)
  let positionSize = riskAmount / slDistance;

  // 6. Leverage Calculation
  // We need to ensure Position Value doesn't exceed Balance * MaxLeverage
  const positionValue = positionSize * entry;
  const requiredLeverage = positionValue / balance;

  let suggestedLeverage = Math.ceil(requiredLeverage);

  // If required leverage exceeds user limit, scale down position size
  if (suggestedLeverage > maxLeverage) {
    suggestedLeverage = maxLeverage;
    positionSize = (balance * maxLeverage) / entry;
  }

  // Ensure minimum leverage of 1x
  suggestedLeverage = Math.max(1, suggestedLeverage);

  return {
    isValid: true,
    signal: {
      ...signal,
      positionSize: Number(positionSize.toFixed(6)),
      suggestedLeverage: suggestedLeverage
    }
  };
};
