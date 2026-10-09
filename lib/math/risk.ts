/**
 * Risk analytics engine - pure TypeScript, zero dependencies
 * VaR/ES, factor models, stress tests, risk decomposition, PCA
 */
import {
  mean,
  std,
  percentile,
  correlationMatrix,
  covarianceMatrix,
  eigenvalues,
  pcaVarianceExplained,
} from "./statistics";

export interface FactorModelResult {
  alpha: number;
  betas: { mkt: number; smb: number; hml: number };
  tStats: { mkt: number; smb: number; hml: number };
  rSquared: number;
  residuals: number[];
}

export interface RiskDecompositionResult {
  mcr: Record<string, number>; // Marginal Contribution to Risk
  cr: Record<string, number>;  // Component Risk
  pctr: Record<string, number>; // Percentage Contribution to Risk
}

export interface StressTestScenario {
  name: string;
  portfolioReturn: number;
  assetShocks: Record<string, number>;
}

export interface RiskAnalysisResult {
  var: {
    historical95: number;
    historical99: number;
    parametric95: number;
    parametric99: number;
    cornishFisher95: number;
  };
  es: {
    historical95: number;
    historical99: number;
    parametric95: number;
    parametric99: number;
  };
  factorModel: FactorModelResult;
  riskDecomposition: RiskDecompositionResult;
  stressTests: StressTestScenario[];
  pca: { varianceExplained: number[] };
}

export interface RollingRiskMetrics {
  rollingVol: number[];
  rollingSharpe: number[];
  rollingMaxDD: number[];
}

export interface ScenarioInput {
  name: string;
  shocks: Record<string, number>;
}

export interface ScenarioResult {
  name: string;
  portfolioReturn: number;
  assetReturns: Record<string, number>;
}

// Standard normal CDF and PDF approximations
function normalCDF(x: number): number {
  // Abramowitz and Stegun approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);
  
  return 0.5 * (1 + sign * y);
}

function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function normalInverseCDF(p: number): number {
  // Rational approximation for normal quantile
  if (p <= 0 || p >= 1) throw new Error("Probability must be between 0 and 1");
  
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288570e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0,
    -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0,
    3.754408661907416e0];
  
  const plow = 0.02425;
  const phigh = 1 - plow;
  
  let x: number;
  let q: number;
  
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= phigh) {
    q = p - 0.5;
    const r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  
  return x;
}

export function computeHistoricalVaR(returns: readonly number[], confidence: number): number {
  if (returns.length === 0) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * (1 - confidence));
  return -sorted[Math.max(0, index)];
}

export function computeHistoricalES(returns: readonly number[], confidence: number): number {
  if (returns.length === 0) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const tailSize = Math.max(1, Math.floor(sorted.length * (1 - confidence)));
  const tail = sorted.slice(0, tailSize);
  return -mean(tail);
}

export function computeParametricVaR(mean: number, stdDev: number, confidence: number): number {
  if (stdDev <= 0) return 0;
  const z = normalInverseCDF(confidence);
  return -(mean - z * stdDev);
}

export function computeParametricES(mean: number, stdDev: number, confidence: number): number {
  if (stdDev <= 0) return 0;
  const z = normalInverseCDF(confidence);
  const pdf = normalPDF(z);
  return -(mean - stdDev * pdf / (1 - confidence));
}

export function computeCornishFisherVaR(
  mean: number,
  stdDev: number,
  skew: number,
  excessKurtosis: number,
  confidence: number
): number {
  if (stdDev <= 0) return 0;
  const z = normalInverseCDF(confidence);
  
  // Cornish-Fisher expansion
  const zCF = z +
    (z * z - 1) * skew / 6 +
    (z * z * z - 3 * z) * excessKurtosis / 24 -
    (2 * z * z * z - 5 * z) * skew * skew / 36;
  
  return -(mean - zCF * stdDev);
}

export function computeFactorModel(
  portfolioReturns: readonly number[],
  factors: { mkt: readonly number[]; smb: readonly number[]; hml: readonly number[]; rf: readonly number[] }
): FactorModelResult {
  const n = portfolioReturns.length;
  if (n < 4) {
    return {
      alpha: 0,
      betas: { mkt: 0, smb: 0, hml: 0 },
      tStats: { mkt: 0, smb: 0, hml: 0 },
      rSquared: 0,
      residuals: [],
    };
  }
  
  // Excess returns
  const excessPortfolio = portfolioReturns.map((r, i) => r - factors.rf[i]);
  const excessMkt = factors.mkt.map((r, i) => r - factors.rf[i]);
  
  // OLS regression: y = alpha + beta_mkt * mkt + beta_smb * smb + beta_hml * hml
  // Using simple matrix algebra
  const X = Array.from({ length: n }, (_, i) => [1, excessMkt[i], factors.smb[i], factors.hml[i]]);
  const y = excessPortfolio;
  
  // X'X
  const XTX: number[][] = Array.from({ length: 4 }, () => Array(4).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 4; k++) {
        XTX[j][k] += X[i][j] * X[i][k];
      }
    }
  }
  
  // X'y
  const XTy: number[] = Array(4).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 4; j++) {
      XTy[j] += X[i][j] * y[i];
    }
  }
  
  // Solve XTX * beta = XTy using Gaussian elimination
  const A = XTX.map((row, i) => [...row, XTy[i]]);
  
  // Forward elimination
  for (let i = 0; i < 4; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < 4; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
    }
    [A[i], A[maxRow]] = [A[maxRow], A[i]];
    
    // Eliminate
    for (let k = i + 1; k < 4; k++) {
      const factor = A[k][i] / A[i][i];
      for (let j = i; j <= 4; j++) {
        A[k][j] -= factor * A[i][j];
      }
    }
  }
  
  // Back substitution
  const beta: number[] = Array(4).fill(0);
  for (let i = 3; i >= 0; i--) {
    let sum = A[i][4];
    for (let j = i + 1; j < 4; j++) {
      sum -= A[i][j] * beta[j];
    }
    beta[i] = A[i][i] === 0 ? 0 : sum / A[i][i];
  }
  
  const alpha = beta[0];
  const betas = { mkt: beta[1], smb: beta[2], hml: beta[3] };
  
  // Compute predictions and residuals
  const predictions = X.map((row) => row.reduce((sum, val, i) => sum + val * beta[i], 0));
  const residuals = y.map((yi, i) => yi - predictions[i]);
  
  // R-squared
  const yMean = mean(y);
  const ssTotal = y.reduce((sum, yi) => sum + (yi - yMean) ** 2, 0);
  const ssResidual = residuals.reduce((sum, r) => sum + r * r, 0);
  const rSquared = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;
  
  // Standard errors and t-stats (simplified)
  const mse = ssResidual / (n - 4);
  const se = Math.sqrt(mse); // Simplified - using same SE for all
  
  return {
    alpha,
    betas,
    tStats: {
      mkt: betas.mkt / (se || 1),
      smb: betas.smb / (se || 1),
      hml: betas.hml / (se || 1),
    },
    rSquared,
    residuals,
  };
}

export function computeRiskDecomposition(
  weights: Record<string, number>,
  covMatrix: number[][],
  tickers: string[]
): RiskDecompositionResult {
  const n = tickers.length;
  const weightArray = tickers.map((t) => weights[t] ?? 0);
  
  // Portfolio variance
  let portVar = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      portVar += weightArray[i] * weightArray[j] * covMatrix[i][j];
    }
  }
  const portVol = Math.sqrt(Math.max(0, portVar));
  
  // Marginal Contribution to Risk (MCR) = (cov * w) / portVol
  const mcr: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    let covWi = 0;
    for (let j = 0; j < n; j++) {
      covWi += covMatrix[i][j] * weightArray[j];
    }
    mcr[tickers[i]] = portVol === 0 ? 0 : covWi / portVol;
  }
  
  // Component Risk (CR) = weight * MCR
  const cr: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    cr[tickers[i]] = weightArray[i] * mcr[tickers[i]];
  }
  
  // Percentage Contribution to Risk (PCTR) = CR / portVol
  const pctr: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    pctr[tickers[i]] = portVol === 0 ? 0 : cr[tickers[i]] / portVol;
  }
  
  return { mcr, cr, pctr };
}

export function runStressTests(
  weights: Record<string, number>,
  assetReturns: Record<string, readonly number[]>,
  tickers: string[]
): StressTestScenario[] {
  // Predefined stress scenarios
  const scenarios = [
    {
      name: "2008 Global Financial Crisis",
      shocks: { SPY: -0.37, QQQ: -0.42, VTI: -0.37, BND: 0.05, GLD: 0.05, VWO: -0.53 },
    },
    {
      name: "2020 COVID Crash",
      shocks: { SPY: -0.34, QQQ: -0.30, VTI: -0.34, BND: 0.03, GLD: 0.10, VWO: -0.35 },
    },
    {
      name: "2022 Rate Hike Cycle",
      shocks: { SPY: -0.19, QQQ: -0.33, VTI: -0.19, BND: -0.13, GLD: -0.04, VWO: -0.20 },
    },
    {
      name: "2011 Eurozone Crisis",
      shocks: { SPY: -0.19, QQQ: -0.18, VTI: -0.19, BND: 0.07, GLD: 0.10, VWO: -0.25 },
    },
    {
      name: "2015 China Devaluation",
      shocks: { SPY: -0.12, QQQ: -0.10, VTI: -0.12, BND: 0.02, GLD: -0.05, VWO: -0.20 },
    },
  ];
  
  return scenarios.map((scenario) => {
    const assetShocks: Record<string, number> = {};
    let portfolioReturn = 0;
    
    for (const ticker of tickers) {
      const weight = weights[ticker] ?? 0;
      const shock = scenario.shocks[ticker] ?? 0;
      assetShocks[ticker] = shock;
      portfolioReturn += weight * shock;
    }
    
    return {
      name: scenario.name,
      portfolioReturn,
      assetShocks,
    };
  });
}

export function runRiskAnalysis(input: {
  weights: Record<string, number>;
  assetReturns: Record<string, readonly number[]>;
  covMatrix: number[][];
  tickers: string[];
  meanReturns: Record<string, number>;
  benchmark: string;
  confidenceLevel: number;
}): RiskAnalysisResult {
  // Portfolio returns
  const portfolioReturns = Object.keys(input.assetReturns[input.tickers[0]]).map((_, i) =>
    input.tickers.reduce((sum, ticker) => sum + (input.weights[ticker] ?? 0) * input.assetReturns[ticker][i], 0)
  );
  
  const portMean = mean(portfolioReturns);
  const portStd = std(portfolioReturns, false);
  const portSkew = portfolioReturns.length > 2 ? portfolioReturns.reduce((sum, r) => sum + Math.pow((r - portMean) / portStd, 3), 0) / portfolioReturns.length : 0;
  const portKurt = portfolioReturns.length > 3 ? portfolioReturns.reduce((sum, r) => sum + Math.pow((r - portMean) / portStd, 4), 0) / portfolioReturns.length - 3 : 0;
  
  // VaR/ES
  const varResult = {
    historical95: computeHistoricalVaR(portfolioReturns, 0.95),
    historical99: computeHistoricalVaR(portfolioReturns, 0.99),
    parametric95: computeParametricVaR(portMean, portStd, 0.95),
    parametric99: computeParametricVaR(portMean, portStd, 0.99),
    cornishFisher95: computeCornishFisherVaR(portMean, portStd, portSkew, portKurt, 0.95),
  };
  
  const esResult = {
    historical95: computeHistoricalES(portfolioReturns, 0.95),
    historical99: computeHistoricalES(portfolioReturns, 0.99),
    parametric95: computeParametricES(portMean, portStd, 0.95),
    parametric99: computeParametricES(portMean, portStd, 0.99),
  };
  
  // Factor model (mock factors for testing)
  const n = portfolioReturns.length;
  const factors = {
    mkt: Array.from({ length: n }, (_, i) => input.assetReturns[input.benchmark]?.[i] ?? 0),
    smb: Array.from({ length: n }, () => (Math.random() - 0.5) * 0.01),
    hml: Array.from({ length: n }, () => (Math.random() - 0.5) * 0.01),
    rf: Array.from({ length: n }, () => 0.0001),
  };
  const factorModel = computeFactorModel(portfolioReturns, factors);
  
  // Risk decomposition
  const riskDecomposition = computeRiskDecomposition(input.weights, input.covMatrix, input.tickers);
  
  // Stress tests
  const stressTests = runStressTests(input.weights, input.assetReturns, input.tickers);
  
  // PCA
  const pca = { varianceExplained: pcaVarianceExplained(input.covMatrix) };
  
  return {
    var: varResult,
    es: esResult,
    factorModel,
    riskDecomposition,
    stressTests,
    pca,
  };
}

export function computeRollingRiskMetrics(
  returns: readonly number[],
  window: number
): RollingRiskMetrics {
  if (returns.length < window) {
    return { rollingVol: [], rollingSharpe: [], rollingMaxDD: [] };
  }
  
  const rollingVol: number[] = [];
  const rollingSharpe: number[] = [];
  const rollingMaxDD: number[] = [];
  
  for (let i = window; i <= returns.length; i++) {
    const windowReturns = returns.slice(i - window, i);
    const vol = std(windowReturns, false) * Math.sqrt(252);
    const avgRet = mean(windowReturns) * 252;
    const sharpe = vol === 0 ? 0 : avgRet / vol;
    
    // Build equity curve for max DD
    let equity = 1;
    const equityCurve = [1];
    for (const r of windowReturns) {
      equity *= 1 + r;
      equityCurve.push(equity);
    }
    let peak = equityCurve[0];
    let maxDD = 0;
    for (const v of equityCurve) {
      if (v > peak) peak = v;
      const dd = (peak - v) / peak;
      if (dd > maxDD) maxDD = dd;
    }
    
    rollingVol.push(vol);
    rollingSharpe.push(sharpe);
    rollingMaxDD.push(maxDD);
  }
  
  return { rollingVol, rollingSharpe, rollingMaxDD };
}

export function scenarioAnalysis(
  weights: Record<string, number>,
  scenarios: ScenarioInput[],
  assetReturns: Record<string, readonly number[]>
): ScenarioResult[] {
  return scenarios.map((scenario) => {
    const assetReturnsResult: Record<string, number> = {};
    let portfolioReturn = 0;
    
    for (const [ticker, shock] of Object.entries(scenario.shocks)) {
      const weight = weights[ticker] ?? 0;
      assetReturnsResult[ticker] = shock;
      portfolioReturn += weight * shock;
    }
    
    return {
      name: scenario.name,
      portfolioReturn,
      assetReturns: assetReturnsResult,
    };
  });
}
