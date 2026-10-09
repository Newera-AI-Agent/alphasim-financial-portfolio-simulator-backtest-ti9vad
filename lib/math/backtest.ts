// lib/math/backtest.ts
// Historical backtest engine - pure TypeScript, zero framework dependencies

import {
  logReturns,
  portfolioReturn,
  portfolioVolatility,
  rebalanceWeights,
  normalizeWeights,
  covarianceMatrix,
  mean,
  std,
  annualizeReturn,
  annualizeVolatility,
  sharpeRatio,
  sortinoRatio,
  calmarRatio,
  maxDrawdown,
  drawdownSeries,
  cagr,
} from './portfolio';

/**
 * Price series data point
 */
export interface PricePoint {
  date: string;
  price: number;
}

type PriceSeries = PricePoint[];

/**
 * Aligned price data across assets
 */
export interface AlignedData {
  dates: string[];
  prices: Record<string, number[]>;
  returns: Record<string, number[]>;
}

/**
 * Trade log entry
 */
export interface Trade {
  date: string;
  action: 'buy' | 'sell';
  ticker: string;
  shares: number;
  price: number;
  value: number;
}

/**
 * Backtest configuration
 */
export interface BacktestConfig {
  startDate: string;
  endDate: string;
  rebalanceFrequency: 'monthly' | 'quarterly' | 'annually' | 'none';
  initialCapital: number;
  weights: Record<string, number>;
}

/**
 * Backtest result
 */
export interface BacktestResult {
  equityCurve: number[];
  drawdownSeries: number[];
  portfolioReturns: number[];
  rebalanceDates: string[];
  trades: Trade[];
  metrics: {
    cagr: number;
    volatility: number;
    sharpe: number;
    sortino: number;
    calmar: number;
    maxDrawdown: number;
    bestMonth: number;
    worstMonth: number;
    winRate: number;
  };
  periodReturns: number[][];
}

/**
 * Align price series to common date index (inner join)
 */
export function alignPrices(priceData: Record<string, PriceSeries>): AlignedData {
  // Collect all dates
  const dateSets = Object.values(priceData).map(series =>
    new Set(series.map(p => p.date))
  );
  if (dateSets.length === 0) {
    return { dates: [], prices: {}, returns: {} };
  }

  // Find intersection of all dates
  let commonDates = dateSets[0];
  for (let i = 1; i < dateSets.length; i++) {
    commonDates = new Set([...commonDates].filter(d => dateSets[i].has(d)));
  }

  const sortedDates = [...commonDates].sort();

  // Build aligned prices and returns
  const prices: Record<string, number[]> = {};
  const returns: Record<string, number[]> = {};

  for (const [ticker, series] of Object.entries(priceData)) {
    const priceMap = new Map(series.map(p => [p.date, p.price]));
    const alignedPrices = sortedDates.map(d => priceMap.get(d) ?? 0);
    prices[ticker] = alignedPrices;
    returns[ticker] = logReturns(alignedPrices);
  }

  return { dates: sortedDates, prices, returns };
}

/**
 * Check if a date is a rebalance boundary
 */
export function isRebalanceDate(
  date: string,
  prevDate: string | null,
  frequency: 'monthly' | 'quarterly' | 'annually' | 'none'
): boolean {
  if (frequency === 'none') return false;
  if (!prevDate) return true;

  const curr = new Date(date);
  const prev = new Date(prevDate);

  switch (frequency) {
    case 'monthly':
      return curr.getMonth() !== prev.getMonth() || curr.getFullYear() !== prev.getFullYear();
    case 'quarterly':
      return Math.floor(curr.getMonth() / 3) !== Math.floor(prev.getMonth() / 3) ||
        curr.getFullYear() !== prev.getFullYear();
    case 'annually':
      return curr.getFullYear() !== prev.getFullYear();
    default:
      return false;
  }
}

/**
 * Compute period returns (monthly)
 */
export function computePeriodReturns(
  equityCurve: number[],
  dates: string[]
): number[][] {
  if (equityCurve.length !== dates.length || equityCurve.length < 2) {
    return [];
  }

  const monthlyReturns: Record<string, number[]> = {};

  for (let i = 1; i < equityCurve.length; i++) {
    const date = new Date(dates[i]);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const ret = (equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1];
    if (!monthlyReturns[key]) monthlyReturns[key] = [];
    monthlyReturns[key].push(ret);
  }

  // Convert to array of arrays (year x month)
  const years = new Set(Object.keys(monthlyReturns).map(k => parseInt(k.split('-')[0])));
  const sortedYears = [...years].sort((a, b) => a - b);

  return sortedYears.map(year =>
    Array.from({ length: 12 }, (_, m) => {
      const key = `${year}-${String(m + 1).padStart(2, '0')}`;
      const rets = monthlyReturns[key];
      if (!rets || rets.length === 0) return 0;
      // Compound returns within the month
      return rets.reduce((acc, r) => acc * (1 + r), 1) - 1;
    })
  );
}

/*** Run historical backtest
 */
export function runBacktest(
  priceData: Record<string, PriceSeries>,
  config: BacktestConfig
): BacktestResult {
  // Align prices
  const aligned = alignPrices(priceData);
  const { dates, prices, returns } = aligned;

  if (dates.length === 0) {
    return {
      equityCurve: [],
      drawdownSeries: [],
      portfolioReturns: [],
      rebalanceDates: [],
      trades: [],
      metrics: {
        cagr: 0,
        volatility: 0,
        sharpe: 0,
        sortino: 0,
        calmar: 0,
        maxDrawdown: 0,
        bestMonth: 0,
        worstMonth: 0,
        winRate: 0,
      },
      periodReturns: [],
    };
  }

  // Get tickers in consistent order
  const tickers = Object.keys(prices);
  const targetWeights = tickers.map(t => config.weights[t] ?? 0);
  const normalizedWeights = normalizeWeights(targetWeights);

  // Convert returns to matrix (assets x time)
  const returnMatrix = tickers.map(t => returns[t]);

  // Initial equity
  let equity = config.initialCapital;
  const equityCurve: number[] = [equity];
  const portfolioReturns: number[] = [];
  const trades: Trade[] = [];
  const rebalanceDates: string[] = [];

  // Current weights (start with target)
  let currentWeights = [...normalizedWeights];

  // Run through each day
  for (let day = 1; day < dates.length; day++) {
    const date = dates[day];
    const prevDate = dates[day - 1];

    // Check for rebalance
    const shouldRebalance = isRebalanceDate(date, prevDate, config.rebalanceFrequency);

    if (shouldRebalance) {
      // Calculate current portfolio value per asset
      const assetValues = tickers.map((t, i) => equity * currentWeights[i]);

      // Rebalance to target weights
      const newWeights = rebalanceWeights(currentWeights, normalizedWeights);

      // Record trades
      for (let i = 0; i < tickers.length; i++) {
        const ticker = tickers[i];
        const price = prices[ticker][day];
        const targetValue = equity * newWeights[i];
        const currentValue = assetValues[i];
        const diff = targetValue - currentValue;

        if (Math.abs(diff) > 0.01 && price > 0) {
          const shares = diff / price;
          trades.push({
            date,
            action: shares > 0 ? 'buy' : 'sell',
            ticker,
            shares: Math.abs(shares),
            price,
            value: Math.abs(diff),
          });
        }
      }

      currentWeights = newWeights;
      rebalanceDates.push(date);
    }

    // Compute daily portfolio return
    const dailyReturns = tickers.map((t, i) => returns[t][day - 1] ?? 0);
    let portfolioRet = 0;
    for (let i = 0; i < tickers.length; i++) {
      portfolioRet += dailyReturns[i] * currentWeights[i];
    }

    portfolioReturns.push(portfolioRet);
    equity *= 1 + portfolioRet;
    equityCurve.push(equity);
  }

  // Compute metrics
  const ddSeries = drawdownSeries(equityCurve);
  const periodReturns = computePeriodReturns(equityCurve, dates);

  // Monthly returns for best/worst month and win rate
  const monthlyRets = periodReturns.flatMap(year =>
    year.filter((m): m is number => m !== null)
  );
  const bestMonth = monthlyRets.length > 0 ? Math.max(...monthlyRets) : 0;
  const worstMonth = monthlyRets.length > 0 ? Math.min(...monthlyRets) : 0;
  const winRate = monthlyRets.length > 0
    ? monthlyRets.filter(r => r > 0).length / monthlyRets.length
    : 0;

  return {
    equityCurve,
    drawdownSeries: ddSeries,
    portfolioReturns,
    rebalanceDates,
    trades,
    metrics: {
      cagr: cagr(equityCurve),
      volatility: annualizeVolatility(std(portfolioReturns)),
      sharpe: sharpeRatio(portfolioReturns),
      sortino: sortinoRatio(portfolioReturns),
      calmar: calmarRatio(equityCurve),
      maxDrawdown: maxDrawdown(equityCurve),
      bestMonth,
      worstMonth,
      winRate,
    },
    periodReturns,
  };
}
