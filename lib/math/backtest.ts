/**
 * Historical backtest engine - pure TypeScript, zero dependencies
 * Aligns series, computes returns, applies weights, rebalances, outputs metrics
 */

import {
  mean,
  std,
  logReturns,
  drawdownSeries,
  maxDrawdown,
  cagr,
  annualizeReturn,
  annualizeVolatility,
  sharpeRatio,
  sortinoRatio,
  calmarRatio,
  covarianceMatrix,
  multiplyMatrixVector,
} from "./statistics";
import { normalizeWeights, validateWeights, Trade, computeTurnover } from "./portfolio";

// Types
export interface PriceSeries {
  [date: string]: number; // adjusted close
}

export interface AlignedData {
  dates: string[];
  prices: number[][]; // [asset][date]
  tickers: string[];
}

export interface BacktestInput {
  tickers: string[];
  weights: Record<string, number>;
  startDate: string;
  endDate: string;
  rebalanceFrequency: "monthly" | "quarterly" | "annually" | "none";
  initialCapital: number;
}

export interface BacktestResult {
  equityCurve: number[];
  dates: string[];
  drawdown: number[];
  periodReturns: { date: string; return: number }[];
  trades: Trade[];
  metrics: BacktestMetrics;
  seed: string;
}

export interface BacktestMetrics {
  cagr: number;
  volatility: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  calmar: number;
  bestMonth: number;
  worstMonth: number;
  winRate: number;
  totalReturn: number;
  annualizedReturn: number;
  annualizedVolatility: number;
}

export interface MonthlyReturn {
  year: number;
  month: number;
  return: number;
}

// Align multiple price series to common dates (inner join)
export function alignSeries(series: Record<string, PriceSeries>): AlignedData {
  const tickers = Object.keys(series);
  if (tickers.length === 0) return { dates: [], prices: [], tickers: [] };
  
  // Find common dates
  const dateSets = tickers.map((t) => new Set(Object.keys(series[t])));
  let commonDates = new Set(dateSets[0]);
  for (const ds of dateSets.slice(1)) {
    commonDates = new Set([...commonDates].filter((d) => ds.has(d)));
  }
  
  const dates = [...commonDates].sort();
  
  if (dates.length === 0) return { dates: [], prices: [], tickers: [] };
  
  const prices = tickers.map((t) => dates.map((d) => series[t][d]));
  
  return { dates, prices, tickers };
}

// Compute daily log returns from aligned prices
export function computeDailyReturns(prices: number[][]): number[][] {
  if (prices.length === 0) return [];
  const nAssets = prices.length;
  const nDays = prices[0].length;
  
  if (nDays <= 1) return Array.from({ length: nAssets }, () => []);
  
  const returns: number[][] = Array.from({ length: nAssets }, () => Array(nDays - 1).fill(0));
  
  for (let i = 0; i < nAssets; i++) {
    for (let j = 1; j < nDays; j++) {
      const prev = prices[i][j - 1];
      const curr = prices[i][j];
      if (prev > 0 && curr > 0) {
        returns[i][j - 1] = Math.log(curr / prev);
      }
    }
  }
  
  return returns;
}

// Apply weights to asset returns to get portfolio returns
export function applyWeights(
  returns: number[][],
  weights: Record<string, number>,
  tickers: string[]
): number[] {
  if (returns.length === 0 || tickers.length === 0) return [];
  const nDays = returns[0].length;
  const portfolioReturns: number[] = Array(nDays).fill(0);
  
  for (let i = 0; i < tickers.length; i++) {
    const weight = weights[tickers[i]] ?? 0;
    for (let j = 0; j < nDays; j++) {
      portfolioReturns[j] += weight * returns[i][j];
    }
  }
  
  return portfolioReturns;
}

// Check if date is a rebalance boundary
export function isRebalanceDate(
  date: string,
  prevDate: string | null,
  frequency: "monthly" | "quarterly" | "annually" | "none"
): boolean {
  if (frequency === "none") return false;
  if (!prevDate) return true;
  
  const curr = new Date(date);
  const prev = new Date(prevDate);
  
  switch (frequency) {
    case "monthly":
      return curr.getMonth() !== prev.getMonth() || curr.getFullYear() !== prev.getFullYear();
    case "quarterly":
      return Math.floor(curr.getMonth() / 3) !== Math.floor(prev.getMonth() / 3) ||
        curr.getFullYear() !== prev.getFullYear();
    case "annually":
      return curr.getFullYear() !== prev.getFullYear();
    default:
      return false;
  }
}

// Rebalance portfolio at period boundaries
export function rebalancePortfolio(
  portfolioReturns: number[],
  assetReturns: number[][],
  weights: Record<string, number>,
  tickers: string[],
  dates: string[],
  frequency: "monthly" | "quarterly" | "annually" | "none"
): { equityCurve: number[]; trades: Trade[] } {
  const nDays = portfolioReturns.length;
  if (nDays === 0) return { equityCurve: [], trades: [] };
  
  const equityCurve: number[] = [1]; // Start with 1 (normalized)
  const trades: Trade[] = [];
  let currentWeights = { ...weights };
  let prevDate: string | null = null;
  
  for (let i = 0; i < nDays; i++) {
    const date = dates[i + 1]; // dates is one longer than returns
    
    // Check if we need to rebalance
    if (isRebalanceDate(date, prevDate, frequency)) {
      // Rebalance: compute trades to get back to target weights
      const currentValue = equityCurve[equityCurve.length - 1];
      
      // Calculate current asset values
      const assetValues: Record<string, number> = {};
      for (let j = 0; j < tickers.length; j++) {
        const ticker = tickers[j];
        // Track asset value changes since last rebalance
        // This is simplified - in reality we'd track individual asset equity
        assetValues[ticker] = currentWeights[ticker] * currentValue;
      }
      
      const { trades: rebalanceTrades, newWeights } = rebalanceWeights(
        currentWeights,
        weights,
        // Use current prices (approximate)
        Object.fromEntries(tickers.map((t, idx) => [t, 1])),
        currentValue
      );
      
      trades.push(...rebalanceTrades);
      currentWeights = newWeights;
    }
    
    // Apply portfolio return for this day
    const dailyReturn = portfolioReturns[i];
    const newEquity = equityCurve[equityCurve.length - 1] * (1 + dailyReturn);
    equityCurve.push(newEquity);
    
    prevDate = date;
  }
  
  return { equityCurve, trades };
}

// Compute all backtest metrics
export function computeMetrics(
  equityCurve: number[],
  dates: string[],
  riskFreeRate = 0.02
): BacktestMetrics {
  if (equityCurve.length < 2) {
    return {
      cagr: 0,
      volatility: 0,
      sharpe: 0,
      sortino: 0,
      maxDrawdown: 0,
      calmar: 0,
      bestMonth: 0,
      worstMonth: 0,
      winRate: 0,
      totalReturn: 0,
      annualizedReturn: 0,
      annualizedVolatility: 0,
    };
  }
  
  const startValue = equityCurve[0];
  const endValue = equityCurve[equityCurve.length - 1];
  const totalReturn = (endValue - startValue) / startValue;
  
  // Daily returns from equity curve
  const dailyReturns = equityCurve.slice(1).map((v, i) => (v - equityCurve[i]) / equityCurve[i]);
  
  const years = dailyReturns.length / 252;
  const cagrValue = cagr(startValue, endValue, years);
  
  const dailyVol = std(dailyReturns, true);
  const annualizedVol = annualizeVolatility(dailyVol, 252);
  
  const sharpe = sharpeRatio(dailyReturns, riskFreeRate, 252);
  const sortino = sortinoRatio(dailyReturns, riskFreeRate, 252);
  
  const dd = drawdownSeries(equityCurve);
  const maxDD = maxDrawdown(equityCurve);
  
  const calmar = calmarRatio(cagrValue, maxDD);
  
  // Monthly returns for best/worst month and win rate
  const monthlyReturns = computeMonthlyReturns(equityCurve, dates);
  const monthReturns = monthlyReturns.map((m) => m.return);
  const bestMonth = monthReturns.length > 0 ? Math.max(...monthReturns) : 0;
  const worstMonth = monthReturns.length > 0 ? Math.min(...monthReturns) : 0;
  const winRate = monthReturns.length > 0 ? monthReturns.filter((r) => r > 0).length / monthReturns.length : 0;
  
  return {
    cagr: cagrValue,
    volatility: annualizedVol,
    sharpe,
    sortino,
    maxDrawdown: maxDD,
    calmar,
    bestMonth,
    worstMonth,
    winRate,
    totalReturn,
    annualizedReturn: cagrValue,
    annualizedVolatility: annualizedVol,
  };
}

// Compute monthly returns for heatmap
export function computeMonthlyReturns(
  equityCurve: number[],
  dates: string[]
): MonthlyReturn[] {
  if (equityCurve.length < 2 || dates.length < 2) return [];
  
  const monthlyMap = new Map<string, { start: number; end: number }>();
  
  for (let i = 0; i < equityCurve.length; i++) {
    const date = new Date(dates[i]);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    
    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, { start: equityCurve[i], end: equityCurve[i] });
    } else {
      const entry = monthlyMap.get(key)!;
      entry.end = equityCurve[i];
    }
  }
  
  const result: MonthlyReturn[] = [];
  for (const [key, { start, end }] of monthlyMap) {
    const [year, month] = key.split("-").map(Number);
    if (start > 0) {
      result.push({ year, month, return: (end - start) / start });
    }
  }
  
  return result.sort((a, b) => a.year - b.year || a.month - b.month);
}

// Main backtest function
export function runBacktest(
  input: BacktestInput,
  priceData: Record<string, PriceSeries>
): BacktestResult {
  // Validate weights
  const validation = validateWeights(input.weights);
  if (!validation.valid) {
    throw new Error(`Invalid weights: ${validation.errors.join(", ")}`);
  }
  
  // Normalize weights to sum to 1
  const weights = normalizeWeights(input.weights);
  
  // Filter price data to date range and align
  const filteredData: Record<string, PriceSeries> = {};
  for (const ticker of input.tickers) {
    if (priceData[ticker]) {
      filteredData[ticker] = {};
      for (const [date, price] of Object.entries(priceData[ticker])) {
        if (date >= input.startDate && date <= input.endDate) {
          filteredData[ticker][date] = price;
        }
      }
    }
  }
  
  const aligned = alignSeries(filteredData);
  
  if (aligned.dates.length === 0) {
    throw new Error("No common dates found in price data");
  }
  
  // Compute daily returns
  const assetReturns = computeDailyReturns(aligned.prices);
  
  // Apply weights to get portfolio returns
  const portfolioReturns = applyWeights(assetReturns, weights, aligned.tickers);
  
  // Run rebalancing simulation
  const { equityCurve, trades } = rebalancePortfolio(
    portfolioReturns,
    assetReturns,
    weights,
    aligned.tickers,
    aligned.dates,
    input.rebalanceFrequency
  );
  
  // Scale equity curve by initial capital
  const scaledEquity = equityCurve.map((v) => v * input.initialCapital);
  
  // Compute drawdown
  const drawdown = drawdownSeries(scaledEquity);
  
  // Compute period returns
  const periodReturns = computePeriodReturns(scaledEquity, aligned.dates);
  
  // Compute metrics
  const metrics = computeMetrics(scaledEquity, aligned.dates);
  
  return {
    equityCurve: scaledEquity,
    dates: aligned.dates,
    drawdown,
    periodReturns,
    trades,
    metrics,
    seed: "deterministic", // Backtest is deterministic
  };
}
