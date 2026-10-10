/**
 * Portfolio math functions - pure TypeScript, zero dependencies
 * Portfolio return, volatility, Sharpe, Sortino, max DD, CAGR, rebalancing
 */

import {
  mean,
  std,
  sharpeRatio,
  sortinoRatio,
  maxDrawdown,
  cagr,
  logReturns,
} from "./statistics";

export interface PortfolioAsset {
  ticker: string;
  weight: number;
  expectedReturn?: number;
  volatility?: number;
}

export interface Weights {
  [ticker: string]: number;
}

export function portfolioReturn(weights: Weights, returns: Weights): number {
  let sum = 0;
  for (const [ticker, weight] of Object.entries(weights)) {
    sum += weight * (returns[ticker] ?? 0);
  }
  return sum;
}

export function portfolioVolatility(weights: Weights, covMatrix: number[][], tickers: string[]): number {
  if (tickers.length === 0) return 0;
  const w = tickers.map((t) => weights[t] ?? 0);
  let variance = 0;
  for (let i = 0; i < tickers.length; i++) {
    for (let j = 0; j < tickers.length; j++) {
      variance += w[i] * w[j] * covMatrix[i][j];
    }
  }
  return Math.sqrt(Math.max(0, variance));
}

export function portfolioSharpe(
  weights: Weights,
  returns: Weights,
  riskFreeRate: number,
  periodsPerYear: number
): number {
  // For a single period, we need historical returns to compute Sharpe
  // This is a simplified version - in practice you'd use time series
  const portReturn = portfolioReturn(weights, returns);
  const excessReturn = portReturn - riskFreeRate / periodsPerYear;
  // Without volatility, we can't compute true Sharpe
  // This is a placeholder that would need historical return series
  return excessReturn > 0 ? 1 : 0;
}

export function portfolioSortino(
  weights: Weights,
  returns: Weights,
  riskFreeRate: number,
  periodsPerYear: number
): number {
  const portReturn = portfolioReturn(weights, returns);
  const excessReturn = portReturn - riskFreeRate / periodsPerYear;
  // Simplified - needs downside deviation from time series
  return excessReturn > 0 ? 1 : 0;
}

export function portfolioMaxDrawdown(equityCurve: number[]): number {
  return maxDrawdown(equityCurve);
}

export function portfolioCAGR(startValue: number, endValue: number, years: number): number {
  return cagr(startValue, endValue, years);
}

export function rebalanceWeights(
  currentWeights: Weights,
  targetWeights: Weights,
  prices: Weights,
  totalValue: number
): { trades: Trade[]; newWeights: Weights } {
  const trades: Trade[] = [];
  const newWeights: Weights = { ...targetWeights };
  
  const allTickers = new Set([...Object.keys(currentWeights), ...Object.keys(targetWeights)]);
  
  for (const ticker of allTickers) {
    const currentWeight = currentWeights[ticker] ?? 0;
    const targetWeight = targetWeights[ticker] ?? 0;
    const price = prices[ticker] ?? 0;
    
    if (price === 0) continue;
    
    const currentValue = currentWeight * totalValue;
    const targetValue = targetWeight * totalValue;
    const diff = targetValue - currentValue;
    
    if (Math.abs(diff) > 0.01) { // Only trade if difference > 1 cent
      const shares = diff / price;
      trades.push({
        ticker,
        shares,
        price,
        value: diff,
        side: diff > 0 ? "buy" : "sell",
      });
    }
  }
  
  return { trades, newWeights };
}

export interface Trade {
  ticker: string;
  shares: number;
  price: number;
  value: number;
  side: "buy" | "sell";
}

export function normalizeWeights(weights: Weights): Weights {
  const validWeights: Weights = {};
  let sum = 0;
  
  for (const [ticker, weight] of Object.entries(weights)) {
    if (weight > 0) {
      validWeights[ticker] = weight;
      sum += weight;
    }
  }
  
  if (sum === 0) {
    return {};
  }
  
  const normalized: Weights = {};
  for (const [ticker, weight] of Object.entries(validWeights)) {
    normalized[ticker] = weight / sum;
  }
  
  return normalized;
}

export function validateWeights(weights: Weights): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const [ticker, weight] of Object.entries(weights)) {
    if (weight < 0) {
      errors.push(`Negative weight for ${ticker}: ${weight}`);
    }
  }
  
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (sum > 1.0001) { // Allow small floating point errors
    errors.push(`Weights sum to ${sum}, must be <= 1`);
  }
  
  const assetCount = Object.keys(weights).filter((t) => weights[t] > 0).length;
  if (assetCount < 2) {
    errors.push(`Portfolio must have at least 2 assets, got ${assetCount}`);
  }
  
  return { valid: errors.length === 0, errors };
}

export function computeTurnover(trades: Trade[]): number {
  if (!Array.isArray(trades) || trades.length === 0) return 0;
  return trades.reduce((sum, trade) => sum + Math.abs(trade.value), 0);
}

export function computePeriodReturns(equityCurve: number[], dates: string[]): { date: string; return: number }[] {
  if (equityCurve.length < 2 || dates.length < 2) return [];
  
  const result: { date: string; return: number }[] = [];
  
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1];
    const curr = equityCurve[i];
    if (prev > 0) {
      result.push({ date: dates[i], return: (curr - prev) / prev });
    }
  }
  
  return result;
}

export function assetContribution(
  weights: Weights,
  assetReturns: Weights,
  portfolioReturnValue: number
): Weights {
  const contribution: Weights = {};
  for (const [ticker, weight] of Object.entries(weights)) {
    const assetReturn = assetReturns[ticker] ?? 0;
    contribution[ticker] = weight * assetReturn;
  }
  return contribution;
}
