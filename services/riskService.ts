
import { Signal } from '../types';

export const applyRiskManagement = (
  signal: Signal,
  balance: number,
  riskPercent: number,
  leverage: number
): Signal => {
  const riskAmount = balance * (riskPercent / 100);
  const priceDiff = Math.abs(signal.entry - signal.stopLoss);
  
  if (priceDiff === 0) return signal;

  // Position size in units of the asset
  let positionSize = riskAmount / priceDiff;
  
  // Calculate total value and ensure it respects leverage constraints (simple model)
  const totalValue = positionSize * signal.entry;
  if (totalValue > balance * leverage) {
    positionSize = (balance * leverage) / signal.entry;
  }

  return {
    ...signal,
    positionSize: Number(positionSize.toFixed(6))
  };
};
