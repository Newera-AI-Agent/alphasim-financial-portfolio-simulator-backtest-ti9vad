// lib/math/statistics.ts
// Pure TypeScript statistical functions - zero framework dependencies

export interface PriceSeries {
  date: string;
  price: number;
}

export interface ReturnSeries {
  date: string;
  return: number;
}

/**
 * Compute simple returns from price series
 * r_t = (p_t - p_{t-1}) / p_{t-1}
 */
export function simpleReturns(prices: number[]): number[] {
  if (prices.length < 2) return [];
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    const curr = prices[i];
    if (prev === 0) {
      returns.push(0);
    } else {
      returns.push((curr - prev) / prev);
    }
  }
  return returns;
}

/**
 * Compute log returns from price series
 * r_t = ln(p_t / p_{t-1})
 */
export function logReturns(prices: number[]): number[] {
  if (prices.length < 2) return [];
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    const curr = prices[i];
    if (prev <= 0 || curr <= 0) {
      returns.push(0);
    } else {
      returns.push(Math.log(curr / prev));
    }
  }
  return returns;
}

/**
 * Compute mean of an array
 */
export function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Compute sample standard deviation
 */
export function std(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Compute population standard deviation
 */
export function stdPop(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Compute skewness
 */
export function skew(values: number[]): number {
  if (values.length < 3) return 0;
  const m = mean(values);
  const s = std(values);
  if (s === 0) return 0;
  const n = values.length;
  const sum = values.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * sum;
}

/**
 * Compute excess kurtosis
 */
export function kurtosis(values: number[]): number {
  if (values.length < 4) return 0;
  const m = mean(values);
  const s = std(values);
  if (s === 0) return 0;
  const n = values.length;
  const sum = values.reduce((acc, v) => acc + ((v - m) / s) ** 4, 0);
  const term1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) * sum;
  const term2 = (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
  return term1 - term2;
}

/**
 * Compute percentile (0-1)
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = p * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  const weight = idx - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Compute autocorrelation at lag k
 */
export function autocorr(values: number[], lag: number): number {
  if (lag >= values.length || lag < 0) return 0;
  const m = mean(values);
  let num = 0;
  let den = 0;
  for (let i = lag; i < values.length; i++) {
    num += (values[i] - m) * (values[i - lag] - m);
  }
  for (let i = 0; i < values.length; i++) {
    den += (values[i] - m) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/**
 * Compute covariance between two series (population)
 */
export function covariance(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return NaN;
  const mx = mean(x);
  const my = mean(y);
  let sum = 0;
  for (let i = 0; i < x.length; i++) {
    sum += (x[i] - mx) * (y[i] - my);
  }
  return sum / x.length;
}

/**
 * Compute correlation between two series
 */
export function correlation(x: number[], y: number[]): number {
  const sx = stdPop(x);
  const sy = stdPop(y);
  if (sx === 0 || sy === 0) return 0;
  return covariance(x, y) / (sx * sy);
}

/**
 * Compute covariance matrix from return series (assets x time)
 */
export function covarianceMatrix(returns: number[][]): number[][] {
  const n = returns.length;
  const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      matrix[i][j] = covariance(returns[i], returns[j]);
    }
  }
  return matrix;
}

/**
 * Compute correlation matrix from return series
 */
export function correlationMatrix(returns: number[][]): number[][] {
  const n = returns.length;
  const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let corr = correlation(returns[i], returns[j]);
      // Clamp to [-1, 1] to handle floating point precision issues
      corr = Math.max(-1, Math.min(1, corr));
      matrix[i][j] = corr;
    }
  }
  return matrix;
}

/**
 * Ledoit-Wolf shrinkage estimator for covariance matrix
 * Shrinks sample covariance toward diagonal matrix with average variance
 */
export function ledoitWolfShrinkage(returns: number[][]): number[][] {
  const n = returns.length; // number of assets
  const t = returns[0]?.length ?? 0; // number of observations
  if (n === 0 || t < 2) return [];

  // Sample covariance matrix
  const sampleCov = covarianceMatrix(returns);

  // Average variance (target is diagonal with average variance)
  let avgVar = 0;
  for (let i = 0; i < n; i++) {
    avgVar += sampleCov[i][i];
  }
  avgVar /= n;

  // Target matrix (diagonal with average variance)
  const target: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    target[i][i] = avgVar;
  }

  // Estimate optimal shrinkage intensity (simplified Ledoit-Wolf)
  // For small samples, use a reasonable default
  const shrinkage = Math.min(1, Math.max(0, 0.5 / Math.sqrt(t)));

  // Shrink
  const shrunk: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      shrunk[i][j] = shrinkage * target[i][j] + (1 - shrinkage) * sampleCov[i][j];
    }
  }

  return shrunk;
}

/**
 * Compute drawdown series from equity curve
 */
export function drawdownSeries(equity: number[]): number[] {
  if (equity.length === 0) return [];
  const dd: number[] = [];
  let peak = equity[0];
  for (let i = 0; i < equity.length; i++) {
    if (equity[i] > peak) peak = equity[i];
    dd.push(peak === 0 ? 0 : (equity[i] - peak) / peak);
  }
  return dd;
}

/**
 * Compute maximum drawdown from equity curve (negative value, zero or negative)
 */
export function maxDrawdown(equity: number[]): number {
  const dd = drawdownSeries(equity);
  return Math.min(0, ...dd);
}

/**
 * Compute CAGR (Compound Annual Growth Rate)
 * Assumes daily returns, 252 trading days per year
 * periodsPerYear: number of periods per year (e.g., 252 for daily)
 * numPeriods: total number of periods in the equity curve (if not provided, uses equity.length - 1)
 */
export function cagr(equity: number[], periodsPerYear: number = 252, numPeriods?: number): number {
  if (equity.length < 2) return 0;
  const start = equity[0];
  const end = equity[equity.length - 1];
  if (start <= 0) return 0;
  const periods = numPeriods ?? (equity.length - 1);
  const years = periods / periodsPerYear;
  if (years === 0) return 0;
  return Math.pow(end / start, 1 / years) - 1;
}

/**
 * Annualize return
 */
export function annualizeReturn(returnValue: number, periodsPerYear: number = 252): number {
  return Math.pow(1 + returnValue, periodsPerYear) - 1;
}

/**
 * Annualize volatility
 */
export function annualizeVolatility(volatility: number, periodsPerYear: number = 252): number {
  return volatility * Math.sqrt(periodsPerYear);
}

/**
 * Compute Sharpe ratio
 * (mean return - risk free rate) / std dev of returns
 */
export function sharpeRatio(
  returns: number[],
  riskFreeRate: number = 0,
  periodsPerYear: number = 252
): number {
  if (returns.length < 2) return 0;
  const m = mean(returns);
  const s = std(returns);
  if (s === 0) return 0;
  const excessReturn = m - riskFreeRate / periodsPerYear;
  return (excessReturn / s) * Math.sqrt(periodsPerYear);
}

/**
 * Compute Sortino ratio
 * (mean return - risk free rate) / downside deviation
 */
export function sortinoRatio(
  returns: number[],
  riskFreeRate: number = 0,
  periodsPerYear: number = 252
): number {
  if (returns.length < 2) return 0;
  const m = mean(returns);
  const targetReturn = riskFreeRate / periodsPerYear;
  const downsideReturns = returns.filter(r => r < targetReturn);
  if (downsideReturns.length === 0) return 0;
  const downsideDev = Math.sqrt(
    downsideReturns.reduce((sum, r) => sum + (r - targetReturn) ** 2, 0) / returns.length
  );
  if (downsideDev === 0) return 0;
  const excessReturn = m - targetReturn;
  return (excessReturn / downsideDev) * Math.sqrt(periodsPerYear);
}

/**
 * Compute Calmar ratio
 * CAGR / |Max Drawdown|
 */
export function calmarRatio(equity: number[], periodsPerYear: number = 252): number {
  const cagrValue = cagr(equity, periodsPerYear);
  const md = maxDrawdown(equity);
  if (md === 0) return 0;
  return cagrValue / Math.abs(md);
}
