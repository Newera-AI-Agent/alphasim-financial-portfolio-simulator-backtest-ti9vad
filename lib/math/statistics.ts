/**
 * Statistical functions - pure TypeScript, zero dependencies
 * Mean, variance, std, skew, kurtosis, percentile, covariance, correlation
 * Matrix operations, eigenvalues, PCA
 */

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function variance(values: readonly number[], sample = true): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return 0;
  const m = mean(values);
  const sumSq = values.reduce((sum, v) => sum + (v - m) ** 2, 0);
  const divisor = sample ? values.length - 1 : values.length;
  return sumSq / divisor;
}

export function std(values: readonly number[], sample = true): number {
  if (values.length <= 1) return 0;
  return Math.sqrt(variance(values, sample));
}

export function skew(values: readonly number[]): number {
  if (values.length <= 2) return 0;
  const m = mean(values);
  const s = std(values, false);
  if (s === 0) return 0;
  const n = values.length;
  const sumCubed = values.reduce((sum, v) => sum + ((v - m) / s) ** 3, 0);
  // Sample skewness formula
  return (n / ((n - 1) * (n - 2))) * sumCubed;
}

export function kurtosis(values: readonly number[]): number {
  if (values.length <= 3) return 0;
  const m = mean(values);
  const s = std(values, false);
  if (s === 0) return 0;
  const n = values.length;
  const sumFourth = values.reduce((sum, v) => sum + ((v - m) / s) ** 4, 0);
  // Excess kurtosis (sample)
  const term1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) * sumFourth;
  const term2 = (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
  return term1 - term2;
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  const sorted = [...values].sort((a, b) => a - b);
  const index = p * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function covariance(x: readonly number[], y: readonly number[], sample = true): number {
  if (x.length !== y.length || x.length === 0) return 0;
  if (x.length === 1) return 0;
  const mx = mean(x);
  const my = mean(y);
  const sum = x.reduce((sum, xi, i) => sum + (xi - mx) * (y[i] - my), 0);
  const divisor = sample ? x.length - 1 : x.length;
  return sum / divisor;
}

export function correlation(x: readonly number[], y: readonly number[]): number {
  if (x.length !== y.length || x.length <= 1) return 0;
  const mx = mean(x);
  const my = mean(y);
  const sx = std(x, false);
  const sy = std(y, false);
  if (sx === 0 || sy === 0) return 0;
  const cov = covariance(x, y, false);
  return cov / (sx * sy);
}

export function covarianceMatrix(returns: number[][]): number[][] {
  const nAssets = returns.length;
  if (nAssets === 0) return [];
  const nObs = returns[0].length;
  
  const means = returns.map((r) => mean(r));
  const matrix: number[][] = Array.from({ length: nAssets }, () => Array(nAssets).fill(0));
  
  for (let i = 0; i < nAssets; i++) {
    for (let j = i; j < nAssets; j++) {
      let sum = 0;
      for (let k = 0; k < nObs; k++) {
        sum += (returns[i][k] - means[i]) * (returns[j][k] - means[j]);
      }
      const cov = sum / (nObs - 1); // sample covariance
      matrix[i][j] = cov;
      matrix[j][i] = cov;
    }
  }
  
  return matrix;
}

export function correlationMatrix(returns: number[][]): number[][] {
  const cov = covarianceMatrix(returns);
  const n = cov.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else {
        const denom = Math.sqrt(cov[i][i] * cov[j][j]);
        matrix[i][j] = denom === 0 ? 0 : cov[i][j] / denom;
      }
    }
  }
  
  return matrix;
}

export function shrinkage(returns: number[][]): number[][] {
  const nAssets = returns.length;
  if (nAssets === 0) return [];
  const nObs = returns[0].length;
  if (nObs <= 1) return covarianceMatrix(returns);
  
  const sampleCov = covarianceMatrix(returns);
  
  // Target: diagonal matrix with same variances
  const target: number[][] = Array.from({ length: nAssets }, (_, i) =>
    Array.from({ length: nAssets }, (_, j) => (i === j ? sampleCov[i][i] : 0))
  );
  
  // Ledoit-Wolf shrinkage intensity
  // Simplified: use average correlation as shrinkage target
  let sumVarSq = 0;
  let sumCovSq = 0;
  
  for (let i = 0; i < nAssets; i++) {
    sumVarSq += sampleCov[i][i] ** 2;
    for (let j = i + 1; j < nAssets; j++) {
      sumCovSq += sampleCov[i][j] ** 2;
    }
  }
  
  // Shrinkage intensity (simplified)
  const pi = (sumVarSq + 2 * sumCovSq) / (nObs * (sumVarSq + 2 * sumCovSq + 1e-12));
  const intensity = Math.min(1, Math.max(0, pi));
  
  const shrunk: number[][] = Array.from({ length: nAssets }, (_, i) =>
    Array.from({ length: nAssets }, (_, j) =>
      intensity * target[i][j] + (1 - intensity) * sampleCov[i][j]
    )
  );
  
  return shrunk;
}

// Portfolio-specific functions
export function logReturns(prices: number[]): number[] {
  if (prices.length <= 1) return [];
  return prices.slice(1).map((p, i) => Math.log(p / prices[i]));
}

export function simpleReturns(prices: number[]): number[] {
  if (prices.length <= 1) return [];
  return prices.slice(1).map((p, i) => p / prices[i] - 1);
}

export function drawdownSeries(equityCurve: number[]): number[] {
  if (equityCurve.length === 0) return [];
  const dd: number[] = [];
  let peak = equityCurve[0];
  for (const value of equityCurve) {
    if (value > peak) peak = value;
    dd.push(peak === 0 ? 0 : (peak - value) / peak);
  }
  return dd;
}

export function maxDrawdown(equityCurve: number[]): number {
  if (equityCurve.length === 0) return 0;
  let peak = equityCurve[0];
  let maxDD = 0;
  for (const value of equityCurve) {
    if (value > peak) peak = value;
    const dd = peak === 0 ? 0 : (peak - value) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

export function cagr(start: number, end: number, years: number): number {
  if (years <= 0) return 0;
  if (start <= 0) return -1;
  if (end <= 0) return -1;
  return Math.pow(end / start, 1 / years) - 1;
}

export function annualizeReturn(dailyReturn: number, periodsPerYear: number): number {
  if (periodsPerYear <= 0) return 0;
  return dailyReturn * periodsPerYear;
}

export function annualizeVolatility(dailyVol: number, periodsPerYear: number): number {
  if (periodsPerYear <= 0) return 0;
  return dailyVol * Math.sqrt(periodsPerYear);
}

export function sharpeRatio(returns: readonly number[], riskFreeRate: number, periodsPerYear: number): number {
  if (returns.length === 0) return 0;
  const excessReturns = returns.map((r) => r - riskFreeRate / periodsPerYear);
  const meanExcess = mean(excessReturns);
  const stdExcess = std(excessReturns, true);
  if (stdExcess === 0) return 0;
  return (meanExcess / stdExcess) * Math.sqrt(periodsPerYear);
}

export function sortinoRatio(returns: readonly number[], riskFreeRate: number, periodsPerYear: number): number {
  if (returns.length === 0) return 0;
  const excessReturns = returns.map((r) => r - riskFreeRate / periodsPerYear);
  const meanExcess = mean(excessReturns);
  const downsideReturns = excessReturns.filter((r) => r < 0);
  if (downsideReturns.length === 0) return meanExcess > 0 ? Infinity : 0;
  const downsideStd = std(downsideReturns, true);
  if (downsideStd === 0) return 0;
  return (meanExcess / downsideStd) * Math.sqrt(periodsPerYear);
}

export function calmarRatio(cagr: number, maxDrawdown: number): number {
  if (maxDrawdown === 0) return cagr > 0 ? Infinity : 0;
  return cagr / maxDrawdown;
}

// Matrix operations
export function multiplyMatrixVector(matrix: number[][], vector: number[]): number[] {
  return matrix.map((row) => row.reduce((sum, val, i) => sum + val * vector[i], 0));
}

export function multiplyMatrices(a: number[][], b: number[][]): number[][] {
  const rowsA = a.length;
  const colsA = a[0].length;
  const colsB = b[0].length;
  const result: number[][] = Array.from({ length: rowsA }, () => Array(colsB).fill(0));
  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      let sum = 0;
      for (let k = 0; k < colsA; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

export function transpose(matrix: number[][]): number[][] {
  if (matrix.length === 0) return [];
  return matrix[0].map((_, i) => matrix.map((row) => row[i]));
}

export function choleskyDecomposition(matrix: number[][]): number[][] {
  const n = matrix.length;
  if (n === 0) return [];
  
  const L: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        const val = matrix[i][i] - sum;
        if (val <= 0) {
          throw new Error("Matrix is not positive definite");
        }
        L[i][j] = Math.sqrt(val);
      } else {
        L[i][j] = (matrix[i][j] - sum) / L[j][j];
      }
    }
  }
  
  return L;
}

export function eigenvalues(matrix: number[][]): number[] {
  // Only implemented for 2x2 matrices
  if (matrix.length !== 2 || matrix[0].length !== 2) {
    throw new Error("eigenvalues only implemented for 2x2 matrices");
  }
  const a = matrix[0][0];
  const b = matrix[0][1];
  const c = matrix[1][0];
  const d = matrix[1][1];
  
  const trace = a + d;
  const det = a * d - b * c;
  const discriminant = trace * trace - 4 * det;
  
  if (discriminant < 0) return [];
  
  const sqrtDisc = Math.sqrt(discriminant);
  return [(trace + sqrtDisc) / 2, (trace - sqrtDisc) / 2];
}

export function pcaVarianceExplained(covMatrix: number[][]): number[] {
  const eigenvals = eigenvalues(covMatrix);
  if (eigenvals.length === 0) return [];
  const total = eigenvals.reduce((a, b) => a + b, 0);
  if (total === 0) return eigenvals.map(() => 0);
  return eigenvals.map((v) => v / total).sort((a, b) => b - a);
}
