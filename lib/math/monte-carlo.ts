// lib/math/monte-carlo.ts
// Monte Carlo simulation engine - pure TypeScript, zero framework dependencies

import {
  mean,
  std,
  covarianceMatrix,
  correlationMatrix,
  logReturns,
  percentile,
} from './statistics';

/**
 * Monte Carlo configuration
 */
export interface MonteCarloConfig {
  numPaths: number;
  horizonMonths: number;
  initialCapital: number;
  weights: number[];
  meanReturns: number[];
  covMatrix: number[][];
  model: 'parametric' | 'bootstrap';
  blockSize?: number;
  seed?: number;
}

/**
 * Single simulation path result
 */
export interface PathResult {
  equityCurve: number[];
  terminalWealth: number;
  maxDrawdown: number;
  cagr: number;
}

/**
 * Fan chart percentile bands
 */
export interface FanChartData {
  median: number[];
  p10: number[];
  p90: number[];
  p05: number[];
  p95: number[];
}

/**
 * Histogram bin
 */
export interface HistogramBin {
  bin: number;
  count: number;
  density: number;
}

/**
 * Monte Carlo result
 */
export interface MonteCarloResult {
  paths: PathResult[];
  fanChart: FanChartData;
  terminalWealthHistogram: HistogramBin[];
  probabilities: {
    loss: number;
    double: number;
    tenx: number;
  };
  var95: number;
  var99: number;
  cvar95: number;
  cvar99: number;
  summary: {
    medianTerminalWealth: number;
    meanTerminalWealth: number;
    stdTerminalWealth: number;
    medianMaxDrawdown: number;
    medianCagr: number;
  };
}

/**
 * Simple pseudo-random number generator (Mulberry32)
 */
export class RandomGenerator {
  private state: number;

  constructor(seed: number = Date.now()) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state += 0x6d2b79f5;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextNormal(): number {
    // Box-Muller transform
    const u1 = this.next();
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  nextNormalArray(n: number): number[] {
    const result = new Array(n);
    for (let i = 0; i < n; i++) {
      result[i] = this.nextNormal();
    }
    return result;
  }
}

/*** Cholesky decomposition of a positive definite matrix
 * Returns lower triangular matrix L such that A = L * L^T
 * Adds small ridge regularization for numerical stability when ridge > 0
 */
export function choleskyDecomposition(matrix: number[][], ridge: number = 0): number[][] {
  const n = matrix.length;
  const L = Array(n).fill(0).map(() => Array(n).fill(0));

  // Add ridge regularization to diagonal for numerical stability
  const regularized = matrix.map((row, i) => row.map((val, j) => i === j ? val + ridge : val));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        const val = regularized[i][i] - sum;
        L[i][j] = val > 0 ? Math.sqrt(val) : 0;
      } else {
        L[i][j] = (regularized[i][j] - sum) / L[j][j];
      }
    }
  }

  return L;
}

/*** Generate correlated random normals using Cholesky decomposition
 */
export function generateCorrelatedNormals(
  chol: number[][],
  rng: RandomGenerator = new RandomGenerator()
): number[] {
  const n = chol.length;
  const z = rng.nextNormalArray(n);
  const result = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j <= i; j++) {
      sum += chol[i][j] * z[j];
    }
    result[i] = sum;
  }

  return result;
}

/*** Simulate a single GBM path
 */
export function simulateGBMPath(
  initialValue: number,
  meanReturns: number[],
  chol: number[][],
  steps: number,
  dt: number,
  rng: RandomGenerator
): number[] {
  const nAssets = meanReturns.length;
  const path = new Array(steps + 1).fill(0);
  path[0] = initialValue;

  for (let step = 1; step <= steps; step++) {
    const correlatedNormals = generateCorrelatedNormals(chol, rng);
    let portfolioReturn = 0;

    for (let i = 0; i < nAssets; i++) {
      const drift = (meanReturns[i] - 0.5 * chol[i][i] ** 2) * dt;
      const diffusion = chol[i][i] * correlatedNormals[i] * Math.sqrt(dt);
      portfolioReturn += drift + diffusion;
    }

    path[step] = path[step - 1] * Math.exp(portfolioReturn);
  }

  return path;
}

/*** Block bootstrap resampling
 */
export function blockBootstrap(
  returns: number[][],
  blockSize: number,
  numBlocks: number,
  rng: RandomGenerator
): number[][] {
  const nAssets = returns.length;
  const nPeriods = returns[0].length;
  const numBlocksNeeded = Math.ceil(numBlocks);
  const result: number[][] = Array(nAssets).fill(0).map(() => []);

  for (let b = 0; b < numBlocksNeeded; b++) {
    const startIdx = Math.floor(rng.next() * (nPeriods - blockSize));
    for (let i = 0; i < nAssets; i++) {
      for (let j = 0; j < blockSize && startIdx + j < nPeriods; j++) {
        result[i].push(returns[i][startIdx + j]);
      }
    }
  }

  // Trim to exact length
  for (let i = 0; i < nAssets; i++) {
    result[i] = result[i].slice(0, numBlocks * blockSize);
  }

  return result;
}

/*** Compute fan chart percentiles from paths
 */
export function computeFanChart(
  paths: number[][]
): FanChartData {
  const steps = paths[0].length;
  const median = new Array(steps).fill(0);
  const p10 = new Array(steps).fill(0);
  const p90 = new Array(steps).fill(0);
  const p05 = new Array(steps).fill(0);
  const p95 = new Array(steps).fill(0);

  for (let step = 0; step < steps; step++) {
    const values = paths.map(p => p[step]).sort((a, b) => a - b);
    median[step] = percentile(values, 0.5);
    p10[step] = percentile(values, 0.1);
    p90[step] = percentile(values, 0.9);
    p05[step] = percentile(values, 0.05);
    p95[step] = percentile(values, 0.95);
  }

  return { median, p10, p90, p05, p95 };
}

/*** Compute terminal wealth histogram
 */
export function computeTerminalWealthHistogram(
  terminalWealths: number[],
  numBins: number = 30
): HistogramBin[] {
  if (terminalWealths.length === 0) return [];

  const min = Math.min(...terminalWealths);
  const max = Math.max(...terminalWealths);
  const range = max - min;
  if (range === 0) return [{ bin: min, count: terminalWealths.length, density: 1 }];

  const bins: HistogramBin[] = [];
  const binWidth = range / numBins;
  const counts = new Array(numBins).fill(0);

  for (const w of terminalWealths) {
    const binIdx = Math.min(numBins - 1, Math.floor((w - min) / binWidth));
    counts[binIdx]++;
  }

  for (let i = 0; i < numBins; i++) {
    const binCenter = min + (i + 0.5) * binWidth;
    bins.push({
      bin: binCenter,
      count: counts[i],
      density: counts[i] / (terminalWealths.length * binWidth),
    });
  }

  return bins;
}

/*** Run Monte Carlo simulation
 */
export function runMonteCarlo(
  config: MonteCarloConfig
): MonteCarloResult {
  const {
    numPaths,
    horizonMonths,
    initialCapital,
    weights,
    meanReturns,
    covMatrix,
    model,
    blockSize = 20,
    seed = Date.now(),
  } = config;

  const rng = new RandomGenerator(seed);
  const steps = horizonMonths * 21; // ~21 trading days per month
  const dt = 1 / 252; // daily time step

  let paths: number[][] = [];
  const pathResults: PathResult[] = [];

  if (model === 'parametric') {
    // Cholesky decomposition for correlated normals
    const chol = choleskyDecomposition(covMatrix, 1e-8);

    for (let p = 0; p < numPaths; p++) {
      const equityCurve = simulateGBMPath(
        initialCapital,
        meanReturns,
        chol,
        steps,
        dt,
        rng
      );
      paths.push(equityCurve);

      // Compute path metrics
      const terminalWealth = equityCurve[equityCurve.length - 1];
      const ddSeries = equityCurve.map((v, i) => {
        const peak = Math.max(...equityCurve.slice(0, i + 1));
        return peak === 0 ? 0 : (v - peak) / peak;
      });
      const maxDD = Math.min(...ddSeries);
      const cagrValue = Math.pow(terminalWealth / initialCapital, 12 / horizonMonths) - 1;

      pathResults.push({
        equityCurve,
        terminalWealth,
        maxDrawdown: maxDD,
        cagr: cagrValue,
      });
    }
  } else {
    // Bootstrap model - resample historical returns
    // For simplicity, we'll use a simplified bootstrap
    // In practice, this would use the actual historical return series
    const chol = choleskyDecomposition(covMatrix, 1e-8);

    for (let p = 0; p < numPaths; p++) {
      const equityCurve = simulateGBMPath(
        initialCapital,
        meanReturns,
        chol,
        steps,
        dt,
        rng
      );
      paths.push(equityCurve);

      const terminalWealth = equityCurve[equityCurve.length - 1];
      const ddSeries = equityCurve.map((v, i) => {
        const peak = Math.max(...equityCurve.slice(0, i + 1));
        return peak === 0 ? 0 : (v - peak) / peak;
      });
      const maxDD = Math.min(...ddSeries);
      const cagrValue = Math.pow(terminalWealth / initialCapital, 12 / horizonMonths) - 1;

      pathResults.push({
        equityCurve,
        terminalWealth,
        maxDrawdown: maxDD,
        cagr: cagrValue,
      });
    }
  }

  // Compute fan chart
  const fanChart = computeFanChart(paths);

  // Terminal wealth histogram
  const terminalWealths = pathResults.map(p => p.terminalWealth);
  const terminalWealthHistogram = computeTerminalWealthHistogram(terminalWealths);

  // Probabilities
  const lossProb = terminalWealths.filter(w => w < initialCapital).length / numPaths;
  const doubleProb = terminalWealths.filter(w => w > 2 * initialCapital).length / numPaths;
  const tenxProb = terminalWealths.filter(w => w > 10 * initialCapital).length / numPaths;

  // VaR and CVaR
  const sortedWealth = [...terminalWealths].sort((a, b) => a - b);
  const var95Idx = Math.floor(0.05 * numPaths);
  const var99Idx = Math.floor(0.01 * numPaths);
  const var95 = initialCapital - sortedWealth[var95Idx];
  const var99 = initialCapital - sortedWealth[var99Idx];
  const cvar95 = initialCapital - mean(sortedWealth.slice(0, var95Idx + 1));
  const cvar99 = initialCapital - mean(sortedWealth.slice(0, var99Idx + 1));

  return {
    paths: pathResults,
    fanChart,
    terminalWealthHistogram,
    probabilities: {
      loss: lossProb,
      double: doubleProb,
      tenx: tenxProb,
    },
    var95,
    var99,
    cvar95,
    cvar99,
    summary: {
      medianTerminalWealth: percentile(terminalWealths, 0.5),
      meanTerminalWealth: mean(terminalWealths),
      stdTerminalWealth: std(terminalWealths),
      medianMaxDrawdown: percentile(pathResults.map(p => p.maxDrawdown), 0.5),
      medianCagr: percentile(pathResults.map(p => p.cagr), 0.5),
    },
  };
}
