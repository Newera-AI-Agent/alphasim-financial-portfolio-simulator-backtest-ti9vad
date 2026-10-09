// lib/math/__tests__/monte-carlo.test.ts
// Unit tests for monte-carlo.ts - known-value tests against reference implementations

import {
  describe,
  it,
  expect,
  beforeAll,
  vi,
} from 'vitest';
import * as mc from '../monte-carlo';
import * as stats from '../statistics';

const EPSILON = 1e-10;

// Mock returns data for 3 assets
const assetReturns = [
  [0.01, 0.02, -0.01, 0.015, -0.005, 0.02, -0.01, 0.005, 0.01, -0.015],
  [0.005, 0.01, -0.005, 0.01, -0.01, 0.015, -0.005, 0.01, -0.01, 0.02],
  [-0.005, 0.01, 0.015, -0.01, 0.02, -0.005, 0.01, -0.01, 0.015, 0.005],
];

const weights = [0.4, 0.35, 0.25];
const meanReturns = assetReturns.map(r => stats.mean(r));
const covMatrix = stats.covarianceMatrix(assetReturns);

const config: mc.MonteCarloConfig = {
  numPaths: 100,
  horizonMonths: 12,
  initialCapital: 100000,
  weights,
  meanReturns,
  covMatrix,
  model: 'parametric',
  seed: 42,
};

describe('monte-carlo', () => {
  describe('RandomGenerator', () => {
    it('produces deterministic sequence with same seed', () => {
      const rng1 = new mc.RandomGenerator(123);
      const rng2 = new mc.RandomGenerator(123);
      for (let i = 0; i < 10; i++) {
        expect(rng1.next()).toBe(rng2.next());
      }
    });

    it('produces different sequences with different seeds', () => {
      const rng1 = new mc.RandomGenerator(123);
      const rng2 = new mc.RandomGenerator(456);
      let same = true;
      for (let i = 0; i < 10; i++) {
        if (rng1.next() !== rng2.next()) {
          same = false;
          break;
        }
      }
      expect(same).toBe(false);
    });

    it('nextNormal produces values with mean ~0 and std ~1', () => {
      const rng = new mc.RandomGenerator(42);
      const samples = Array.from({ length: 10000 }, () => rng.nextNormal());
      const m = stats.mean(samples);
      const s = stats.std(samples);
      expect(Math.abs(m)).toBeLessThan(0.05);
      expect(Math.abs(s - 1)).toBeLessThan(0.05);
    });
  });

  describe('choleskyDecomposition', () => {
    it('decomposes positive definite matrix', () => {
      const L = mc.choleskyDecomposition(covMatrix);
      expect(L.length).toBe(3);
      expect(L[0].length).toBe(3);
      // L should be lower triangular
      expect(L[0][1]).toBe(0);
      expect(L[0][2]).toBe(0);
      expect(L[1][2]).toBe(0);
      // L * L^T should equal original
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          let sum = 0;
          for (let k = 0; k < 3; k++) {
            sum += L[i][k] * L[j][k];
          }
          expect(sum).toBeCloseTo(covMatrix[i][j], 8);
        }
      }
    });

    it('handles diagonal matrix', () => {
      const diag = [[4, 0], [0, 9]];
      const L = mc.choleskyDecomposition(diag);
      expect(L[0][0]).toBeCloseTo(2, 10);
      expect(L[1][1]).toBeCloseTo(3, 10);
      expect(L[1][0]).toBe(0);
    });
  });

  describe('generateCorrelatedNormals', () => {
    it('generates correlated normals with correct covariance', () => {
      const L = mc.choleskyDecomposition(covMatrix);
      const rng = new mc.RandomGenerator(42);
      
      // Generate many samples
      const nSamples = 10000;
      const samples = Array.from({ length: nSamples }, () => mc.generateCorrelatedNormals(L));
      
      // Check sample covariance approximates target
      const sampleCov = stats.covarianceMatrix(samples[0].map((_, i) => samples.map(s => s[i])));
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          expect(sampleCov[i][j]).toBeCloseTo(covMatrix[i][j], 1);
        }
      }
    });
  });

  describe('simulateGBMPath', () => {
    it('produces path of correct length', () => {
      const L = mc.choleskyDecomposition(covMatrix);
      const rng = new mc.RandomGenerator(42);
      const path = mc.simulateGBMPath(100000, meanReturns, L, 252, 1/252, rng);
      expect(path.length).toBe(253); // steps + 1
      expect(path[0]).toBe(100000);
      expect(path.every(p => p > 0)).toBe(true);
    });

    it('is deterministic with same seed', () => {
      const L = mc.choleskyDecomposition(covMatrix);
      const rng1 = new mc.RandomGenerator(42);
      const rng2 = new mc.RandomGenerator(42);
      const path1 = mc.simulateGBMPath(100000, meanReturns, L, 252, 1/252, rng1);
      const path2 = mc.simulateGBMPath(100000, meanReturns, L, 252, 1/252, rng2);
      expect(path1).toEqual(path2);
    });
  });

  describe('blockBootstrap', () => {
    it('resamples blocks preserving autocorrelation structure', () => {
      const rng = new mc.RandomGenerator(42);
      const result = mc.blockBootstrap(assetReturns, 5, 2, rng);
      expect(result.length).toBe(3);
      expect(result[0].length).toBe(10); // 2 blocks * 5 size
    });
  });

  describe('computeFanChart', () => {
    it('computes percentile bands from paths', () => {
      // Create simple test paths
      const paths = [
        [100, 101, 102, 103],
        [100, 100.5, 101, 101.5],
        [100, 102, 104, 106],
        [100, 99, 98, 97],
        [100, 101.5, 103, 104.5],
      ];
      const fanChart = mc.computeFanChart(paths);
      expect(fanChart.median.length).toBe(4);
      expect(fanChart.p10.length).toBe(4);
      expect(fanChart.p90.length).toBe(4);
      expect(fanChart.p05.length).toBe(4);
      expect(fanChart.p95.length).toBe(4);
      // Median should be between p05 and p95
      for (let i = 0; i < 4; i++) {
        expect(fanChart.median[i]).toBeGreaterThanOrEqual(fanChart.p05[i]);
        expect(fanChart.median[i]).toBeLessThanOrEqual(fanChart.p95[i]);
        expect(fanChart.p10[i]).toBeLessThanOrEqual(fanChart.p90[i]);
      }
    });
  });

  describe('computeTerminalWealthHistogram', () => {
    it('computes histogram bins', () => {
      const terminalWealths = [90, 95, 100, 105, 110, 115, 120];
      const histogram = mc.computeTerminalWealthHistogram(terminalWealths, 5);
      expect(histogram.length).toBe(5);
      expect(histogram.every(b => b.count >= 0)).toBe(true);
      const totalCount = histogram.reduce((sum, b) => sum + b.count, 0);
      expect(totalCount).toBe(7);
    });

    it('handles empty input', () => {
      expect(mc.computeTerminalWealthHistogram([])).toEqual([]);
    });
  });

  describe('runMonteCarlo', () => {
    it('runs parametric simulation and returns valid result', () => {
      const result = mc.runMonteCarlo(config);
      
      expect(result.paths.length).toBe(config.numPaths);
      expect(result.fanChart.median.length).toBeGreaterThan(0);
      expect(result.terminalWealthHistogram.length).toBeGreaterThan(0);
      
      // Check probabilities
      expect(result.probabilities.loss).toBeGreaterThanOrEqual(0);
      expect(result.probabilities.loss).toBeLessThanOrEqual(1);
      expect(result.probabilities.double).toBeGreaterThanOrEqual(0);
      expect(result.probabilities.double).toBeLessThanOrEqual(1);
      expect(result.probabilities.tenx).toBeGreaterThanOrEqual(0);
      expect(result.probabilities.tenx).toBeLessThanOrEqual(1);
      
      // Check VaR/CVaR
      expect(result.var95).toBeDefined();
      expect(result.var99).toBeDefined();
      expect(result.cvar95).toBeDefined();
      expect(result.cvar99).toBeDefined();
      expect(result.var99).toBeGreaterThanOrEqual(result.var95);
      expect(result.cvar95).toBeGreaterThanOrEqual(result.var95);
      expect(result.cvar99).toBeGreaterThanOrEqual(result.var99);
      
      // Check summary
      expect(result.summary.medianTerminalWealth).toBeGreaterThan(0);
      expect(result.summary.meanTerminalWealth).toBeGreaterThan(0);
    });

    it('produces deterministic results with same seed', () => {
      const result1 = mc.runMonteCarlo({ ...config, seed: 123 });
      const result2 = mc.runMonteCarlo({ ...config, seed: 123 });
      
      expect(result1.paths[0].terminalWealth).toBe(result2.paths[0].terminalWealth);
      expect(result1.summary.medianTerminalWealth).toBe(result2.summary.medianTerminalWealth);
      expect(result1.var95).toBe(result2.var95);
    });

    it('runs bootstrap model', () => {
      const bootstrapConfig = { ...config, model: 'bootstrap' as const };
      const result = mc.runMonteCarlo(bootstrapConfig);
      expect(result.paths.length).toBe(config.numPaths);
      expect(result.fanChart.median.length).toBeGreaterThan(0);
    });

    it('handles small number of paths', () => {
      const smallConfig = { ...config, numPaths: 10 };
      const result = mc.runMonteCarlo(smallConfig);
      expect(result.paths.length).toBe(10);
    });

    it('handles single asset', () => {
      const singleAssetConfig = {
        ...config,
        weights: [1.0],
        meanReturns: [0.1 / 252],
        covMatrix: [[0.04 / 252]],
      };
      const result = mc.runMonteCarlo(singleAssetConfig);
      expect(result.paths.length).toBe(config.numPaths);
    });
  });
});
