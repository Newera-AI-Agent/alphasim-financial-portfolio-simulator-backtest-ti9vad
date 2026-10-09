// lib/math/portfolio.ts
// Portfolio math functions - pure TypeScript, zero framework dependencies

import {
  mean,
  std,
  covariance,
  correlation,
  covarianceMatrix,
  correlationMatrix,
  logReturns,
  simpleReturns,
  drawdownSeries,
  maxDrawdown,
  cagr,
  annualizeReturn,
  annualizeVolatility,
  sharpeRatio,
  sortinoRatio,
  calmarRatio,
} from './statistics';

export interface AssetAllocation {
  ticker: string;
  weight: number;
  expectedReturn?: number;
  volatility?: number;
}

export interface PortfolioMetrics {
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
}

/**
 * Compute portfolio return from asset returns and weights
 */
export function portfolioReturn(
  assetReturns: number[][],
  weights: number[]
): number[] {
  if (assetReturns.length === 0 || weights.length === 0) return [];
  const nAssets = assetReturns.length;
  const nPeriods = assetReturns[0].length;
  const result: number[] = new Array(nPeriods).fill(0);

  for (let i = 0; i < nAssets; i++) {
    const w = weights[i] ?? 0;
    for (let t = 0; t < nPeriods; t++) {
      result[t] += assetReturns[i][t] * w;
    }
  }
  return result;
}

/**
 * Compute portfolio volatility from covariance matrix and weights
 */
export function portfolioVolatility(
  covMatrix: number[][],
  weights: number[]
): number {
  if (weights.length === 0) return 0;
  let variance = 0;
  for (let i = 0; i < weights.length; i++) {
    for (let j = 0; j < weights.length; j++) {
      variance += weights[i] * weights[j] * (covMatrix[i][j] ?? 0);
    }
  }
  return Math.sqrt(Math.max(0, variance));
}

/*** Compute portfolio metrics from returns
 */
export function computePortfolioMetrics(
  returns: number[],
  riskFreeRate: number = 0,
  periodsPerYear: number = 252
): PortfolioMetrics {
  const m = mean(returns);
  const s = std(returns);
  const equity = returns.reduce(
    (acc, r) => [...acc, acc[acc.length - 1] * (1 + r)],
    [1]
  );

  return {
    expectedReturn: annualizeReturn(m, periodsPerYear),
    volatility: annualizeVolatility(s, periodsPerYear),
    sharpeRatio: sharpeRatio(returns, riskFreeRate, periodsPerYear),
    sortinoRatio: sortinoRatio(returns, riskFreeRate, periodsPerYear),
    calmarRatio: calmarRatio(equity, periodsPerYear),
    maxDrawdown: maxDrawdown(equity),
  };
}

/*** Rebalance weights to target (proportional redistribution)
 */
export function rebalanceWeights(
  currentWeights: number[],
  targetWeights: number[]
): number[] {
  const sum = targetWeights.reduce((a, b) => a + b, 0);
  if (sum === 0) return currentWeights;
  return targetWeights.map(w => w / sum);
}

/*** Normalize weights to sum to 1
 */
export function normalizeWeights(weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0) return weights;
  return weights.map(w => w / sum);
}

/*** Validate portfolio weights
 */
export function validateWeights(weights: number[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (weights.some(w => w < 0)) {
    errors.push('Weights cannot be negative');
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum > 1.0001) {
    errors.push('Weights sum cannot exceed 100%');
  }
  if (weights.filter(w => w > 0).length < 2) {
    errors.push('At least 2 assets required for simulation');
  }
  return { valid: errors.length === 0, errors };
}

// Re-export statistics functions for convenience
export {
  mean,
  std,
  covariance,
  correlation,
  covarianceMatrix,
  correlationMatrix,
  logReturns,
  simpleReturns,
  drawdownSeries,
  maxDrawdown,
  cagr,
  annualizeReturn,
  annualizeVolatility,
  sharpeRatio,
  sortinoRatio,
  calmarRatio,
} from './statistics';
