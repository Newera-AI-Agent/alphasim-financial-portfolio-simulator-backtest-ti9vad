/**
 * Monte Carlo simulation engine - pure TypeScript, zero dependencies
 * GBM paths, bootstrap, Cholesky decomposition, fan chart percentiles
 */

import {
  mean,
  std,
  percentile,
  covarianceMatrix,
  choleskyDecomposition,
  multiplyMatrixVector,
  logReturns,
} from "./statistics";

// Types
export interface MonteCarloInput {
  tickers: string[];
  weights: Record<string, number>;
  paths: number;
  horizonMonths: number;
  model: "parametric" | "bootstrap";
  correlationStructure: "historical" | "constant" | "shrinkage";
  seed: number;
  initialCapital: number;
  historicalReturns?: number[][]; // [asset][day]
  expectedReturns?: number[]; // annualized
  covarianceMatrix?: number[][];
}

export interface MonteCarloResult {
  paths: number[][][]; // [path][asset][month]
  equityCurves: number[][]; // [path][month]
  terminalWealth: number[];
  maxDrawdowns: number[];
  cagrs: number[];
  fanChart: FanChartData;
  histogram: HistogramBin[];
  probabilityMetrics: ProbabilityMetrics;
  varES: VaRES;
  pathTable: PathSummary[];
}

export interface FanChartData {
  median: number[];
  p10: number[];
  p90: number[];
  p5: number[];
  p95: number[];
}

export interface HistogramBin {
  bin: number;
  count: number;
  density: number;
}

export interface ProbabilityMetrics {
  probLoss: number;
  prob2x: number;
  prob10x: number;
}

export interface VaRES {
  var95: number;
  var99: number;
  es95: number;
  es99: number;
}

export interface PathSummary {
  pathIndex: number;
  finalValue: number;
  maxDrawdown: number;
  cagr: number;
}

// Simple seeded random number generator (Mulberry32)
export function createRNG(seed: number): () => number {
  let state = seed >>> 0;
  return function () {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller transform for normal distribution
export function boxMuller(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Generate correlated normal random variables using Cholesky
export function generateCorrelatedNormals(
  nAssets: number,
  nSteps: number,
  L: number[][],
  rng: () => number
): number[][] {
  // Generate independent normals: [nAssets][nSteps]
  const independent: number[][] = Array.from({ length: nAssets }, () =>
    Array.from({ length: nSteps }, () => boxMuller(rng))
  );
  
  // Apply Cholesky: L * Z
  const correlated: number[][] = Array.from({ length: nAssets }, () =>
    Array(nSteps).fill(0)
  );
  
  for (let i = 0; i < nAssets; i++) {
    for (let j = 0; j < nSteps; j++) {
      let sum = 0;
      for (let k = 0; k <= i; k++) {
        sum += L[i][k] * independent[k][j];
      }
      correlated[i][j] = sum;
    }
  }
  
  return correlated;
}

// Generate GBM price paths
export function generatePaths(
  expectedReturns: number[], // annualized
  covMatrix: number[][],
  paths: number,
  horizonMonths: number,
  initialPrices: number[],
  seed: number
): number[][][] {
  const nAssets = expectedReturns.length;
  const nSteps = horizonMonths * 21; // ~21 trading days per month
  const dt = 1 / 252; // daily time step
  
  // Cholesky decomposition of covariance matrix
  let L: number[][];
  try {
    L = choleskyDecomposition(covMatrix);
  } catch {
    // Fallback: use diagonal (no correlation)
    L = Array.from({ length: nAssets }, (_, i) =>
      Array.from({ length: nAssets }, (_, j) => (i === j ? Math.sqrt(Math.max(covMatrix[i][i], 1e-8)) : 0))
    );
  }
  
  const allPaths: number[][][] = [];
  
  for (let p = 0; p < paths; p++) {
    const pathSeed = seed + p * 10007;
    const rng = createRNG(pathSeed);
    
    // Generate correlated random shocks
    const shocks = generateCorrelatedNormals(nAssets, nSteps, L, rng);
    
    // Generate price paths for each asset
    const assetPaths: number[][] = Array.from({ length: nAssets }, () =>
      Array(nSteps + 1).fill(0)
    );
    
    for (let i = 0; i < nAssets; i++) {
      assetPaths[i][0] = initialPrices[i];
      const mu = expectedReturns[i];
      const vol = Math.sqrt(covMatrix[i][i]);
      
      for (let t = 1; t <= nSteps; t++) {
        const drift = (mu - 0.5 * vol * vol) * dt;
        const diffusion = vol * Math.sqrt(dt) * shocks[i][t - 1];
        assetPaths[i][t] = assetPaths[i][t - 1] * Math.exp(drift + diffusion);
      }
    }
    
    allPaths.push(assetPaths);
  }
  
  return allPaths; // [path][asset][time]
}

// Block bootstrap to preserve autocorrelation
export function generateBootstrapPaths(
  historicalReturns: number[][], // [asset][day]
  paths: number,
  horizonMonths: number,
  initialPrices: number[],
  seed: number,
  blockSize = 20
): number[][][] {
  const nAssets = historicalReturns.length;
  const nObs = historicalReturns[0].length;
  const nSteps = horizonMonths * 21;
  
  if (nObs < blockSize) {
    throw new Error(`Insufficient historical data: need at least ${blockSize} observations`);
  }
  
  const nBlocks = Math.floor(nObs / blockSize);
  const allPaths: number[][][] = [];
  
  for (let p = 0; p < paths; p++) {
    const pathSeed = seed + p * 10007;
    const rng = createRNG(pathSeed);
    
    const assetPaths: number[][] = Array.from({ length: nAssets }, () =>
      Array(nSteps + 1).fill(0)
    );
    
    for (let i = 0; i < nAssets; i++) {
      assetPaths[i][0] = initialPrices[i];
    }
    
    let step = 0;
    while (step < nSteps) {
      const blockIndex = Math.floor(rng() * nBlocks);
      const startIdx = blockIndex * blockSize;
      const blockLength = Math.min(blockSize, nSteps - step);
      
      for (let i = 0; i < nAssets; i++) {
        for (let b = 0; b < blockLength; b++) {
          const ret = historicalReturns[i][startIdx + b];
          assetPaths[i][step + 1 + b] = assetPaths[i][step + b] * (1 + ret);
        }
      }
      step += blockLength;
    }
    
    allPaths.push(assetPaths);
  }
  
  return allPaths;
}

// Compute equity curves from asset paths and weights
export function computeEquityCurves(
  assetPaths: number[][][],
  weights: Record<string, number>,
  tickers: string[],
  initialCapital: number
): number[][] {
  const nPaths = assetPaths.length;
  const nSteps = assetPaths[0][0].length;
  
  const equityCurves: number[][] = Array.from({ length: nPaths }, () =>
    Array(nSteps).fill(0)
  );
  
  for (let p = 0; p < nPaths; p++) {
    equityCurves[p][0] = initialCapital;
    
    for (let t = 1; t < nSteps; t++) {
      let portfolioValue = 0;
      for (let i = 0; i < tickers.length; i++) {
        const weight = weights[tickers[i]] ?? 0;
        const prevPrice = assetPaths[p][i][t - 1];
        const currPrice = assetPaths[p][i][t];
        if (prevPrice > 0) {
          const assetReturn = (currPrice - prevPrice) / prevPrice;
          portfolioValue += weight * assetReturn;
        }
      }
      equityCurves[p][t] = equityCurves[p][t - 1] * (1 + portfolioValue);
    }
  }
  
  return equityCurves;
}

// Compute fan chart percentiles across paths
export function computeFanChartPercentiles(
  equityCurves: number[][]
): FanChartData {
  const nPaths = equityCurves.length;
  const nSteps = equityCurves[0].length;
  
  const median: number[] = Array(nSteps).fill(0);
  const p10: number[] = Array(nSteps).fill(0);
  const p90: number[] = Array(nSteps).fill(0);
  const p5: number[] = Array(nSteps).fill(0);
  const p95: number[] = Array(nSteps).fill(0);
  
  for (let t = 0; t < nSteps; t++) {
    const values = equityCurves.map((path) => path[t]).sort((a, b) => a - b);
    median[t] = percentile(values, 0.5);
    p10[t] = percentile(values, 0.1);
    p90[t] = percentile(values, 0.9);
    p5[t] = percentile(values, 0.05);
    p95[t] = percentile(values, 0.95);
  }
  
  return { median, p10, p90, p5, p95 };
}

// Compute terminal wealth histogram with log bins
export function computeTerminalWealthHistogram(
  terminalWealth: number[],
  bins = 30
): HistogramBin[] {
  if (terminalWealth.length === 0) return [];
  
  const minVal = Math.min(...terminalWealth);
  const maxVal = Math.max(...terminalWealth);
  
  if (minVal <= 0 || maxVal <= minVal) {
    return [{ bin: minVal, count: terminalWealth.length, density: 1 }];
  }
  
  const logMin = Math.log(minVal);
  const logMax = Math.log(maxVal);
  const binWidth = (logMax - logMin) / bins;
  
  const counts = Array(bins).fill(0);
  
  for (const wealth of terminalWealth) {
    if (wealth <= 0) continue;
    const logVal = Math.log(wealth);
    const binIndex = Math.min(Math.floor((logVal - logMin) / binWidth), bins - 1);
    counts[binIndex]++;
  }
  
  const total = terminalWealth.length;
  const result: HistogramBin[] = [];
  
  for (let i = 0; i < bins; i++) {
    const binEdge = Math.exp(logMin + i * binWidth);
    result.push({
      bin: binEdge,
      count: counts[i],
      density: counts[i] / (total * binWidth * binEdge),
    });
  }
  
  return result;
}

// Compute probability metrics
export function computeProbabilityMetrics(
  terminalWealth: number[],
  initialCapital: number
): ProbabilityMetrics {
  if (terminalWealth.length === 0) return { probLoss: 0, prob2x: 0, prob10x: 0 };
  
  const n = terminalWealth.length;
  const lossCount = terminalWealth.filter((w) => w < initialCapital).length;
  const twoXCount = terminalWealth.filter((w) => w > 2 * initialCapital).length;
  const tenXCount = terminalWealth.filter((w) => w > 10 * initialCapital).length;
  
  return {
    probLoss: lossCount / n,
    prob2x: twoXCount / n,
    prob10x: tenXCount / n,
  };
}

// Compute VaR and ES
export function computeVaRES(
  terminalWealth: number[],
  initialCapital: number
): VaRES {
  if (terminalWealth.length === 0) return { var95: 0, var99: 0, es95: 0, es99: 0 };
  
  // Compute returns from terminal wealth
  const returns = terminalWealth.map((w) => (w - initialCapital) / initialCapital);
  const sorted = returns.sort((a, b) => a - b);
  
  const var95 = -percentile(sorted, 0.05);
  const var99 = -percentile(sorted, 0.01);
  
  // Expected Shortfall (average of worst 5% and 1%)
  const es95Idx = Math.ceil(0.05 * sorted.length);
  const es99Idx = Math.ceil(0.01 * sorted.length);
  
  const es95 = es95Idx > 0
    ? -sorted.slice(0, es95Idx).reduce((a, b) => a + b, 0) / es95Idx
    : var95;
  const es99 = es99Idx > 0
    ? -sorted.slice(0, es99Idx).reduce((a, b) => a + b, 0) / es99Idx
    : var99;
  
  return { var95, var99, es95, es99 };
}

// Compute path summaries
export function computePathSummaries(
  equityCurves: number[][],
  horizonMonths: number
): PathSummary[] {
  return equityCurves.map((curve, idx) => {
    const finalValue = curve[curve.length - 1];
    const initialValue = curve[0];
    
    // Max drawdown
    let peak = initialValue;
    let maxDD = 0;
    for (const value of curve) {
      if (value > peak) peak = value;
      const dd = peak === 0 ? 0 : (peak - value) / peak;
      if (dd > maxDD) maxDD = dd;
    }
    
    // CAGR
    const years = horizonMonths / 12;
    const cagrValue = initialValue > 0 && finalValue > 0 && years > 0
      ? Math.pow(finalValue / initialValue, 1 / years) - 1
      : 0;
    
    return {
      pathIndex: idx,
      finalValue,
      maxDrawdown: maxDD,
      cagr: cagrValue,
    };
  });
}

// Main Monte Carlo function
export function runMonteCarlo(input: MonteCarloInput): MonteCarloResult {
  const nAssets = input.tickers.length;
  
  // Normalize weights
  const totalWeight = Object.values(input.weights).reduce((a, b) => a + b, 0);
  const weights = totalWeight > 0
    ? Object.fromEntries(Object.entries(input.weights).map(([k, v]) => [k, v / totalWeight]))
    : {};
  
  // Initial prices (use 100 as base for each asset)
  const initialPrices = input.tickers.map(() => 100);
  
  let assetPaths: number[][][];
  
  if (input.model === "bootstrap" && input.historicalReturns) {
    assetPaths = generateBootstrapPaths(
      input.historicalReturns,
      input.paths,
      input.horizonMonths,
      initialPrices,
      input.seed
    );
  } else {
    // Parametric model
    // Use historical returns to estimate expected returns and covariance
    let expectedReturns: number[];
    let covMatrix: number[][];
    
    if (input.historicalReturns && input.historicalReturns.length > 0) {
      // Annualize expected returns
      expectedReturns = input.historicalReturns.map((r) => mean(r) * 252);
      
      // Choose covariance structure
      switch (input.correlationStructure) {
        case "shrinkage":
          // Import shrinkage from statistics
          const { shrinkage } = require("./statistics");
          covMatrix = shrinkage(input.historicalReturns);
          break;
        case "constant":
          // Constant correlation model
          const sampleCov = covarianceMatrix(input.historicalReturns);
          const n = sampleCov.length;
          const avgCorr =
            n > 1
              ? sampleCov.reduce((sum, row, i) =>
                  sum + row.slice(i + 1).reduce((s, v, j) => s + v / Math.sqrt(sampleCov[i][i] * sampleCov[i + 1 + j][i + 1 + j], 0), 0)
                , 0) / (n * (n - 1) / 2)
              : 0;
          covMatrix = Array.from({ length: n }, (_, i) =>
            Array.from({ length: n }, (_, j) =>
              i === j ? sampleCov[i][i] : avgCorr * Math.sqrt(sampleCov[i][i] * sampleCov[j][j])
            )
          );
          break;
        case "historical":
        default:
          covMatrix = covarianceMatrix(input.historicalReturns);
          break;
      }
    } else {
      // Use provided values or defaults
      expectedReturns = input.expectedReturns ?? input.tickers.map(() => 0.08);
      covMatrix = input.covarianceMatrix ?? input.tickers.map((_, i) =>
        input.tickers.map((_, j) => (i === j ? 0.04 : 0))
      );
    }
    
    assetPaths = generatePaths(
      expectedReturns,
      covMatrix,
      input.paths,
      input.horizonMonths,
      initialPrices,
      input.seed
    );
  }
  
  // Compute equity curves
  const equityCurves = computeEquityCurves(assetPaths, weights, input.tickers, input.initialCapital);
  
  // Terminal wealth
  const terminalWealth = equityCurves.map((c) => c[c.length - 1]);
  
  // Max drawdowns
  const maxDrawdowns = equityCurves.map((curve) => {
    let peak = curve[0];
    let maxDD = 0;
    for (const value of curve) {
      if (value > peak) peak = value;
      const dd = peak === 0 ? 0 : (peak - value) / peak;
      if (dd > maxDD) maxDD = dd;
    }
    return maxDD;
  });
  
  // CAGRs
  const years = input.horizonMonths / 12;
  const cagrs = equityCurves.map((curve) => {
    const start = curve[0];
    const end = curve[curve.length - 1];
    return start > 0 && end > 0 && years > 0
      ? Math.pow(end / start, 1 / years) - 1
      : 0;
  });
  
  // Fan chart
  const fanChart = computeFanChartPercentiles(equityCurves);
  
  // Histogram
  const histogram = computeTerminalWealthHistogram(terminalWealth);
  
  // Probability metrics
  const probabilityMetrics = computeProbabilityMetrics(terminalWealth, input.initialCapital);
  
  // VaR/ES
  const varES = computeVaRES(terminalWealth, input.initialCapital);
  
  // Path table
  const pathTable = computePathSummaries(equityCurves, input.horizonMonths);
  
  return {
    paths: assetPaths,
    equityCurves,
    terminalWealth,
    maxDrawdowns,
    cagrs,
    fanChart,
    histogram,
    probabilityMetrics,
    varES,
    pathTable,
  };
}
