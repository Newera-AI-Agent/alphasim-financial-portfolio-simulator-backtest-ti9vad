// lib/math/risk.ts
// Risk analytics engine - pure TypeScript, zero framework dependencies

import {
  mean,
  std,
  covariance,
  correlation,
  covarianceMatrix,
  correlationMatrix,
  logReturns,
  percentile,
  ledoitWolfShrinkage,
  maxDrawdown,
} from './statistics';

/**
 * Risk configuration
 */
export interface RiskConfig {
  weights: number[];
  benchmarkReturns?: number[];
  confidenceLevels: number[];
  useShrinkage: boolean;
}

/**
 * Factor model result (Fama-French 3-factor)
 */
export interface FactorModelResult {
  alpha: number;
  betaMkt: number;
  betaSmb: number;
  betaHml: number;
  tStatAlpha: number;
  tStatMkt: number;
  tStatSmb: number;
  tStatHml: number;
  rSquared: number;
}

/**
 * Stress test scenario
 */
export interface StressTestScenario {
  name: string;
  description: string;
  shocks: Record<string, number>; // ticker -> shock multiplier
  portfolioReturn: number;
}

/**
 * Risk decomposition
 */
export interface RiskDecomposition {
  marginalComponentRisk: number[];
  percentageContributionToRisk: number[];
  totalRisk: number;
}

/**
 * VaR/ES results
 */
export interface TailRiskResult {
  historicalVar: Record<number, number>;
  historicalES: Record<number, number>;
  parametricVar: Record<number, number>;
  parametricES: Record<number, number>;
  cornishFisherVar: Record<number, number>;
}

/**
 * PCA result
 */
export interface PCAResult {
  eigenvalues: number[];
  eigenvectors: number[][];
  varianceExplained: number[];
  cumulativeVarianceExplained: number[];
}

/**
 * Full risk analytics result
 */
export interface RiskResult {
  covarianceMatrix: number[][];
  correlationMatrix: number[][];
  pca: PCAResult;
  factorModel: FactorModelResult;
  tailRisk: TailRiskResult;
  stressTests: StressTestScenario[];
  riskDecomposition: RiskDecomposition;
}

/*** Simple linear regression (OLS)
 */
function olsRegression(y: number[], x: number[][]): { beta: number[]; r2: number; residuals: number[] } {
  const n = y.length;
  const k = x[0].length;

  // Add intercept column
  const X = x.map(row => [1, ...row]);
  const kWithIntercept = k + 1;

  // X'X
  const XTX = Array(kWithIntercept).fill(0).map(() => Array(kWithIntercept).fill(0));
  for (let i = 0; i < kWithIntercept; i++) {
    for (let j = 0; j < kWithIntercept; j++) {
      let sum = 0;
      for (let t = 0; t < n; t++) {
        sum += X[t][i] * X[t][j];
      }
      XTX[i][j] = sum;
    }
  }

  // X'y
  const XTy = new Array(kWithIntercept).fill(0);
  for (let i = 0; i < kWithIntercept; i++) {
    let sum = 0;
    for (let t = 0; t < n; t++) {
      sum += X[t][i] * y[t];
    }
    XTy[i] = sum;
  }

  // Solve using Gaussian elimination (simple implementation)
  // For small matrices, we can use a simple approach
  const A = XTX.map((row, i) => [...row, XTy[i]]);

  // Forward elimination
  for (let i = 0; i < kWithIntercept; i++) {
    // Find pivot
    let maxRow = i;
    for (let r = i + 1; r < kWithIntercept; r++) {
      if (Math.abs(A[r][i]) > Math.abs(A[maxRow][i])) {
        maxRow = r;
      }
    }
    [A[i], A[maxRow]] = [A[maxRow], A[i]];

    // Eliminate
    for (let r = i + 1; r < kWithIntercept; r++) {
      const factor = A[r][i] / A[i][i];
      for (let c = i; c <= kWithIntercept; c++) {
        A[r][c] -= factor * A[i][c];
      }
    }
  }

  // Back substitution
  const beta = new Array(kWithIntercept).fill(0);
  for (let i = kWithIntercept - 1; i >= 0; i--) {
    let sum = A[i][kWithIntercept];
    for (let j = i + 1; j < kWithIntercept; j++) {
      sum -= A[i][j] * beta[j];
    }
    beta[i] = sum / A[i][i];
  }

  // Compute residuals and R²
  const yPred = X.map(row =>
    row.reduce((sum, val, idx) => sum + val * beta[idx], 0)
  );
  const residuals = y.map((val, idx) => val - yPred[idx]);
  const ssRes = residuals.reduce((sum, r) => sum + r * r, 0);
  const ssTot = y.reduce((sum, val) => sum + (val - mean(y)) ** 2, 0);
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { beta, r2, residuals };
}

/*** Compute t-statistics for regression coefficients
 */
function computeTStats(
  beta: number[],
  residuals: number[],
  X: number[][]
): number[] {
  const n = X.length;
  const k = X[0].length;
  const sigma2 = residuals.reduce((sum, r) => sum + r * r, 0) / (n - k);

  // Compute (X'X)^-1 diagonal (simplified - just use variance of each predictor)
  // This is a simplified version; proper implementation needs full matrix inverse
  const tStats = beta.map((b, i) => {
    if (i === 0) return 0; // intercept t-stat not typically reported
    const xCol = X.map(row => row[i]);
    const xVar = xCol.reduce((sum, v) => sum + (v - mean(xCol)) ** 2, 0) / (n - 1);
    if (xVar === 0) return 0;
    const se = Math.sqrt(sigma2 / xVar);
    return se === 0 ? 0 : b / se;
  });

  return tStats;
}

/*** Compute eigenvalues and eigenvectors (power iteration for symmetric matrices)
 */
export function pca(matrix: number[][]): PCAResult {
  const n = matrix.length;
  const eigenvalues: number[] = [];
  const eigenvectors: number[][] = [];

  // Work on a copy
  const A = matrix.map(row => [...row]);

  for (let i = 0; i < n; i++) {
    // Power iteration
    let v = new Array(n).fill(0).map(() => Math.random());
    // Normalize
    let norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
    v = v.map(x => x / norm);

    for (let iter = 0; iter < 100; iter++) {
      const Av = new Array(n).fill(0);
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          Av[r] += A[r][c] * v[c];
        }
      }
      const newNorm = Math.sqrt(Av.reduce((sum, x) => sum + x * x, 0));
      const newV = Av.map(x => x / newNorm);

      // Check convergence
      const diff = newV.reduce((sum, x, idx) => sum + Math.abs(x - v[idx]), 0);
      v = newV;
      if (diff < 1e-10) break;
    }

    // Compute eigenvalue
    const Av = new Array(n).fill(0);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        Av[r] += A[r][c] * v[c];
      }
    }
    const eigenvalue = v.reduce((sum, x, idx) => sum + x * Av[idx], 0);
    eigenvalues.push(eigenvalue);
    eigenvectors.push(v);

    // Deflate matrix
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        A[r][c] -= eigenvalue * v[r] * v[c];
      }
    }
  }

  // Sort by eigenvalue descending
  const indices = eigenvalues.map((_, i) => i).sort((a, b) => eigenvalues[b] - eigenvalues[a]);
  const sortedEigenvalues = indices.map(i => eigenvalues[i]);
  const sortedEigenvectors = indices.map(i => eigenvectors[i]);

  const totalVar = sortedEigenvalues.reduce((a, b) => a + b, 0);
  const varianceExplained = sortedEigenvalues.map(v => v / totalVar);
  const cumulativeVarianceExplained: number[] = [];
  let cumSum = 0;
  for (const v of varianceExplained) {
    cumSum += v;
    cumulativeVarianceExplained.push(cumSum);
  }

  return {
    eigenvalues: sortedEigenvalues,
    eigenvectors: sortedEigenvectors,
    varianceExplained,
    cumulativeVarianceExplained,
  };
}

/*** Cornish-Fisher expansion for VaR
 */
export function cornishFisherVaR(
  returns: number[],
  confidenceLevel: number
): number {
  const m = mean(returns);
  const s = std(returns);
  const sk = skew(returns);
  const kt = kurtosis(returns);

  // Standard normal quantile
  const z = normalQuantile(confidenceLevel);

  // Cornish-Fisher adjustment
  const cf = z +
    (z * z - 1) * sk / 6 +
    (z * z * z - 3 * z) * kt / 24 -
    (2 * z * z * z - 5 * z) * sk * sk / 36;

  return -(m + cf * s); // Negative because VaR is a loss
}

/*** Inverse normal CDF approximation (Acklam's algorithm)
 */
function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) return p < 0.5 ? -Infinity : Infinity;

  const a = [-3.969683028665376e+01, 2.209460984245205e+02,
    -2.759285104469687e+02, 1.383577518672690e+02,
    -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02,
    -1.556989798598866e+02, 6.680131188771972e+01,
    -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01,
    -2.400758277161838e+00, -2.549732539343734e+00,
    4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01,
    2.445134137142996e+00, 3.754408661907416e+00];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q, r, x;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p > pHigh) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
       ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else {
    q = p - 0.5;
    r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  return x;
}

/*** Import skew and kurtosis from statistics
 */
import { skew, kurtosis } from './statistics';

/*** Compute VaR and ES using multiple methods
 */
export function computeTailRisk(
  returns: number[],
  confidenceLevels: number[] = [0.95, 0.99]
): TailRiskResult {
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const n = returns.length;
  const m = mean(returns);
  const s = std(returns);

  const historicalVar: Record<number, number> = {};
  const historicalES: Record<number, number> = {};
  const parametricVar: Record<number, number> = {};
  const parametricES: Record<number, number> = {};
  const cornishFisherVar: Record<number, number> = {};

  for (const cl of confidenceLevels) {
    const alpha = 1 - cl;
    const idx = Math.floor(alpha * n);

    // Historical VaR
    historicalVar[cl] = -sortedReturns[idx];

    // Historical ES (average of returns worse than VaR)
    const tailReturns = sortedReturns.slice(0, idx + 1);
    historicalES[cl] = -mean(tailReturns);

    // Parametric VaR (normal distribution)
    const z = normalQuantile(alpha);
    parametricVar[cl] = -(m + z * s);

    // Parametric ES for normal
    const phi = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
    parametricES[cl] = -(m - s * phi / alpha);

    // Cornish-Fisher VaR
    cornishFisherVar[cl] = cornishFisherVaR(returns, cl);
  }

  return {
    historicalVar,
    historicalES,
    parametricVar,
    parametricES,
    cornishFisherVar,
  };
}

/*** Fama-French 3-factor regression
 */
export function famaFrenchRegression(
  portfolioReturns: number[],
  factorData: { mkt: number[]; smb: number[]; hml: number[]; rf: number[] }
): FactorModelResult {
  const n = portfolioReturns.length;
  const excessReturns = portfolioReturns.map((r, i) => r - factorData.rf[i]);
  const X = [
    factorData.mkt.map((m, i) => m - factorData.rf[i]),
    factorData.smb,
    factorData.hml,
  ];

  // Transpose X to be n x 3
  const XTransposed = Array(n).fill(0).map((_, i) =>
    X.map(col => col[i])
  );

  const { beta, r2, residuals } = olsRegression(excessReturns, XTransposed);
  const tStats = computeTStats(beta, residuals, XTransposed.map(row => [1, ...row]));

  return {
    alpha: beta[0] * 12, // Annualize
    betaMkt: beta[1],
    betaSmb: beta[2],
    betaHml: beta[3],
    tStatAlpha: tStats[0],
    tStatMkt: tStats[1],
    tStatSmb: tStats[2],
    tStatHml: tStats[3],
    rSquared: r2,
  };
}

/*** Predefined stress test scenarios
 */
export function getStressTestScenarios():
  Omit<StressTestScenario, 'portfolioReturn'>[] {
  return [
    {
      name: '2008 Global Financial Crisis',
      description: 'Equity crash, credit spread widening, flight to quality',
      shocks: { SPY: -0.50, QQQ: -0.55, VTI: -0.48, BND: 0.05, GLD: 0.10, VWO: -0.60 },
    },
    {
      name: '2020 COVID Crash',
      description: 'Sharp equity decline, volatility spike, quick recovery',
      shocks: { SPY: -0.34, QQQ: -0.30, VTI: -0.35, BND: 0.03, GLD: 0.15, VWO: -0.40 },
    },
    {
      name: '2022 Rate Hike Cycle',
      description: 'Rising rates hurt both stocks and bonds',
      shocks: { SPY: -0.20, QQQ: -0.33, VTI: -0.19, BND: -0.13, GLD: -0.05, VWO: -0.25 },
    },
  ];
}

/*** Run stress tests on portfolio
 */
export function runStressTests(
  weights: number[],
  tickers: string[],
  scenarios: Omit<StressTestScenario, 'portfolioReturn'>[]
): StressTestScenario[] {
  return scenarios.map(scenario => {
    let portfolioReturn = 0;
    for (let i = 0; i < tickers.length; i++) {
      const shock = scenario.shocks[tickers[i]] ?? 0;
      portfolioReturn += weights[i] * shock;
    }
    return { ...scenario, portfolioReturn };
  });
}

/*** Compute risk decomposition (MCR and PCTR)
 */
export function computeRiskDecomposition(
  weights: number[],
  covMatrix: number[][]
): RiskDecomposition {
  const n = weights.length;
  const marginalComponentRisk = new Array(n).fill(0);

  // MCR_i = (Σ_j w_j * σ_ij) / σ_p
  const portfolioVar = weights.reduce((sum, wi, i) =>
    sum + weights.reduce((sum2, wj, j) => sum2 + wi * wj * covMatrix[i][j], 0), 0
  );
  const portfolioVol = Math.sqrt(Math.max(0, portfolioVar));

  for (let i = 0; i < n; i++) {
    let mcr = 0;
    for (let j = 0; j < n; j++) {
      mcr += weights[j] * covMatrix[i][j];
    }
    marginalComponentRisk[i] = portfolioVol === 0 ? 0 : mcr / portfolioVol;
  }

  // PCTR_i = w_i * MCR_i / σ_p
  const percentageContributionToRisk = weights.map((w, i) =>
    portfolioVol === 0 ? 0 : (w * marginalComponentRisk[i]) / portfolioVol
  );

  return {
    marginalComponentRisk,
    percentageContributionToRisk,
    totalRisk: portfolioVol,
  };
}

/*** Main risk analytics function
 */
export function runRiskAnalytics(
  returns: number[][],
  weights: number[],
  tickers: string[],
  config: RiskConfig
): RiskResult {
  // Covariance matrix (with optional shrinkage)
  const covMatrix = config.useShrinkage
    ? ledoitWolfShrinkage(returns)
    : covarianceMatrix(returns);

  // Correlation matrix
  const corrMatrix = correlationMatrix(returns);

  // PCA
  const pcaResult = pca(corrMatrix);

  // Portfolio returns
  const portfolioReturns = returns[0].map((_, t) =>
    returns.reduce((sum, assetReturns, i) => sum + assetReturns[t] * weights[i], 0)
  );

  // Factor model (mock factors for now)
  const n = portfolioReturns.length;
  const mockFactors = {
    mkt: portfolioReturns.map(r => r * 0.9 + (Math.random() - 0.5) * 0.01),
    smb: portfolioReturns.map(() => (Math.random() - 0.5) * 0.005),
    hml: portfolioReturns.map(() => (Math.random() - 0.5) * 0.005),
    rf: new Array(n).fill(0.02 / 252),
  };
  const factorModel = famaFrenchRegression(portfolioReturns, mockFactors);

  // Tail risk
  const tailRisk = computeTailRisk(portfolioReturns, config.confidenceLevels);

  // Stress tests
  const scenarios = getStressTestScenarios();
  const stressTests = runStressTests(weights, tickers, scenarios);

  // Risk decomposition
  const riskDecomposition = computeRiskDecomposition(weights, covMatrix);

  return {
    covarianceMatrix: covMatrix,
    correlationMatrix: corrMatrix,
    pca: pcaResult,
    factorModel,
    tailRisk,
    stressTests,
    riskDecomposition,
  };
}
