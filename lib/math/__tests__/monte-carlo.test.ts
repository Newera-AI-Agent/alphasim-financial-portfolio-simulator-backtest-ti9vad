/**
 * Unit tests for monte-carlo module
 */
import { describe, it, expect } from "vitest";
import {
  generatePaths,
  generateBootstrapPaths,
  computeFanChartPercentiles,
  computeTerminalWealthHistogram,
  computeProbabilityMetrics,
  computeVaRES,
  runMonteCarlo,
} from "../monte-carlo";
import { choleskyDecomposition } from "../statistics";

describe("monte-carlo", () => {
  describe("choleskyDecomposition", () => {
    it("decomposes 2x2 covariance matrix", () => {
      const cov = [
        [0.04, 0.01],
        [0.01, 0.09],
      ];
      const L = choleskyDecomposition(cov);
      expect(L).toHaveLength(2);
      expect(L[0]).toHaveLength(2);
      // L * L' should equal cov
      const reconstructed = [
        [L[0][0] * L[0][0] + L[0][1] * L[0][1], L[0][0] * L[1][0] + L[0][1] * L[1][1]],
        [L[1][0] * L[0][0] + L[1][1] * L[0][1], L[1][0] * L[1][0] + L[1][1] * L[1][1]],
      ];
      expect(reconstructed[0][0]).toBeCloseTo(0.04, 5);
      expect(reconstructed[0][1]).toBeCloseTo(0.01, 5);
      expect(reconstructed[1][0]).toBeCloseTo(0.01, 5);
      expect(reconstructed[1][1]).toBeCloseTo(0.09, 5);
    });
    it("decomposes 3x3 covariance matrix", () => {
      const cov = [
        [0.04, 0.01, 0.005],
        [0.01, 0.09, 0.02],
        [0.005, 0.02, 0.16],
      ];
      const L = choleskyDecomposition(cov);
      expect(L).toHaveLength(3);
      // Verify L * L' = cov
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          let sum = 0;
          for (let k = 0; k <= Math.min(i, j); k++) {
            sum += L[i][k] * L[j][k];
          }
          expect(sum).toBeCloseTo(cov[i][j], 5);
        }
      }
    });
    it("throws on non-positive-definite matrix", () => {
      const cov = [
        [0.04, 0.05],
        [0.05, 0.04],
      ];
      expect(() => choleskyDecomposition(cov)).toThrow();
    });
  });

  describe("generatePaths", () => {
    it("generates GBM paths with correct dimensions", () => {
      const meanReturns = [0.0004, 0.0002]; // daily
      const covMatrix = [
        [0.0001, 0.00002],
        [0.00002, 0.00009],
      ];
      const initialPrices = [100, 50];
      const paths = generatePaths(meanReturns, covMatrix, 100, 20, initialPrices, 42);
      
      expect(paths).toHaveLength(100); // 100 paths
      expect(paths[0]).toHaveLength(20); // 20 time steps
      expect(paths[0][0]).toHaveLength(2); // 2 assets
    });

    it("produces deterministic results with same seed", () => {
      const meanReturns = [0.0004];
      const covMatrix = [[0.0001]];
      const initialPrices = [100];
      const paths1 = generatePaths(meanReturns, covMatrix, 10, 10, initialPrices, 42);
      const paths2 = generatePaths(meanReturns, covMatrix, 10, 10, initialPrices, 42);
      expect(paths1).toEqual(paths2);
    });

    it("produces different results with different seeds", () => {
      const meanReturns = [0.0004];
      const covMatrix = [[0.0001]];
      const initialPrices = [100];
      const paths1 = generatePaths(meanReturns, covMatrix, 10, 10, initialPrices, 42);
      const paths2 = generatePaths(meanReturns, covMatrix, 10, 10, initialPrices, 123);
      expect(paths1).not.toEqual(paths2);
    });

    it("handles single asset correctly", () => {
      const paths = generatePaths([0.1 / 252], [[0.16 * 0.16 / 252]], 100, 252, [100], 42);
      // Check terminal values are reasonable (around 110 for 10% return)
      const terminalValues = paths.map((p) => p[p.length - 1][0]);
      const meanTerminal = terminalValues.reduce((a, b) => a + b, 0) / terminalValues.length;
      expect(meanTerminal).toBeGreaterThan(105);
      expect(meanTerminal).toBeLessThan(120);
    });
  });

  describe("generateBootstrapPaths", () => {
    it("generates bootstrap paths from historical returns", () => {
      // Create historical returns with some autocorrelation
      const historicalReturns = Array.from({ length: 500 }, (_, i) => (
        Math.sin(i * 0.1) * 0.01 + (Math.random() - 0.5) * 0.02
      ));
      const initialPrices = [100];
      const paths = generateBootstrapPaths(historicalReturns, 50, 252, initialPrices, 20, 42);
      
      expect(paths).toHaveLength(50);
      expect(paths[0]).toHaveLength(252);
      expect(paths[0][0]).toHaveLength(1);
    });

    it("produces deterministic results with same seed", () => {
      const historicalReturns = [0.01, -0.005, 0.002, 0.015, -0.003, 0.001, -0.002, 0.008];
      const initialPrices = [100];
      const paths1 = generateBootstrapPaths(historicalReturns, 10, 20, initialPrices, 5, 42);
      const paths2 = generateBootstrapPaths(historicalReturns, 10, 20, initialPrices, 5, 42);
      expect(paths1).toEqual(paths2);
    });
  });

  describe("computeFanChartPercentiles", () => {
    it("computes percentile bands correctly", () => {
      // Simple test: paths that end at known values
      const paths = [
        [100, 105, 110], // path 1
        [100, 102, 104], // path 2
        [100, 108, 116], // path 3
        [100, 101, 102], // path 4
        [100, 110, 120], // path 5
      ];
      const percentiles = computeFanChartPercentiles(paths);
      
      expect(percentiles.median).toHaveLength(3);
      expect(percentiles.p10).toHaveLength(3);
      expect(percentiles.p90).toHaveLength(3);
      expect(percentiles.p05).toHaveLength(3);
      expect(percentiles.p95).toHaveLength(3);
      
      // At time 0, all should be 100
      expect(percentiles.median[0]).toBe(100);
      expect(percentiles.p10[0]).toBe(100);
      expect(percentiles.p90[0]).toBe(100);
    });
  });

  describe("computeTerminalWealthHistogram", () => {
    it("computes histogram with log bins", () => {
      const terminalValues = [100, 110, 120, 130, 140, 150, 200, 500];
      const histogram = computeTerminalWealthHistogram(terminalValues, 5);
      
      expect(histogram.bins).toHaveLength(5);
      expect(histogram.counts).toHaveLength(5);
      expect(histogram.counts.reduce((a, b) => a + b, 0)).toBe(8);
    });
  });

  describe("computeProbabilityMetrics", () => {
    it("computes probability of loss, 2x, 10x correctly", () => {
      const terminalValues = [80, 90, 100, 110, 120, 200, 250, 500, 1000, 1500];
      const initialValue = 100;
      const probs = computeProbabilityMetrics(terminalValues, initialValue);
      
      // Loss (< 100): 80, 90 = 2/10 = 0.2
      expect(probs.probLoss).toBeCloseTo(0.2, 5);
      // > 2x (> 200): 250, 500, 1000, 1500 = 4/10 = 0.4
      expect(probs.prob2x).toBeCloseTo(0.4, 5);
      // > 10x (> 1000): 1500 = 1/10 = 0.1
      expect(probs.prob10x).toBeCloseTo(0.1, 5);
    });
  });

  describe("computeVaRES", () => {
    it("computes VaR and ES correctly", () => {
      // Sorted returns: -0.1, -0.05, -0.02, 0, 0.01, 0.02, 0.05, 0.1
      // 95% VaR: index = floor(8 * 0.05) = 0 -> -(-0.1) = 0.1
      // 99% VaR: index = floor(8 * 0.01) = 0 -> 0.1
      const terminalValues = [90, 95, 98, 100, 101, 102, 105, 110];
      const initialValue = 100;
      const { var95, var99, es95, es99 } = computeVaRES(terminalValues, initialValue);
      
      // Returns are: -0.1, -0.05, -0.02, 0, 0.01, 0.02, 0.05, 0.1
      // 95% VaR (5% tail): index 0 = -0.1 -> VaR = 0.1
      expect(var95).toBeCloseTo(0.1, 5);
      // ES 95%: mean of worst 5% = mean of [-0.1] = 0.1
      expect(es95).toBeCloseTo(0.1, 5);
    });
  });

  describe("runMonteCarlo", () => {
    it("runs complete Monte Carlo simulation", () => {
      const result = runMonteCarlo({
        tickers: ["SPY", "BND"],
        weights: { SPY: 0.6, BND: 0.4 },
        horizonMonths: 12,
        initialCapital: 10000,
        paths: 200,
        model: "parametric",
        seed: 42,
        expectedReturns: [0.1, 0.05],
        covarianceMatrix: [
          [0.16 * 0.16, 0.02],
          [0.02, 0.1 * 0.1],
        ],
      });

      expect(result.paths).toHaveLength(200);
      expect(result.equityCurves).toHaveLength(200);
      expect(result.fanChart).toBeDefined();
      expect(result.histogram).toBeDefined();
      expect(result.probabilityMetrics).toBeDefined();
      expect(result.varES).toBeDefined();
      expect(result.pathTable).toHaveLength(200);
    });

    it("runs bootstrap model", () => {
      const historicalReturns = Array.from({ length: 500 }, (_, i) => (
        Math.sin(i * 0.1) * 0.01 + (Math.random() - 0.5) * 0.02
      ));
      const result = runMonteCarlo({
        tickers: ["SPY"],
        weights: { SPY: 1 },
        horizonMonths: 6,
        initialCapital: 10000,
        paths: 50,
        model: "bootstrap",
        historicalReturns: [historicalReturns],
        blockSize: 20,
        seed: 42,
      });

      expect(result.paths).toHaveLength(50);
      expect(result.equityCurves).toHaveLength(50);
      expect(result.fanChart).toBeDefined();
    });
  });
});
