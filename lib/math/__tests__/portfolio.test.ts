/**
 * Unit tests for portfolio module
 */
import { describe, it, expect } from "vitest";
import {
  portfolioReturn,
  portfolioVolatility,
  portfolioSharpe,
  portfolioSortino,
  portfolioMaxDrawdown,
  portfolioCAGR,
  rebalanceWeights,
  normalizeWeights,
  validateWeights,
  computeTurnover,
  computePeriodReturns,
  assetContribution,
} from "../portfolio";

describe("portfolio", () => {
  const mockCovMatrix = [
    [0.04, 0.01, 0.005],
    [0.01, 0.09, 0.02],
    [0.005, 0.02, 0.16],
  ];
  const tickers = ["SPY", "BND", "GLD"];
  const weights = { SPY: 0.6, BND: 0.3, GLD: 0.1 };

  describe("portfolioReturn", () => {
    it("calculates weighted portfolio return", () => {
      const expectedReturns = { SPY: 0.10, BND: 0.04, GLD: 0.05 };
      const ret = portfolioReturn(weights, expectedReturns);
      // 0.6 * 0.10 + 0.3 * 0.04 + 0.1 * 0.05 = 0.06 + 0.012 + 0.005 = 0.077
      expect(ret).toBeCloseTo(0.077, 10);
    });
    it("handles missing weights", () => {
      const expectedReturns = { SPY: 0.10, BND: 0.04 };
      const ret = portfolioReturn({ SPY: 0.5, BND: 0.5 }, expectedReturns);
      expect(ret).toBeCloseTo(0.07, 10);
    });
    it("returns 0 for empty weights", () => {
      expect(portfolioReturn({}, { SPY: 0.10 })).toBe(0);
    });
  });

  describe("portfolioVolatility", () => {
    it("calculates portfolio volatility correctly", () => {
      // w = [0.6, 0.3, 0.1]
      // w' * Σ * w = [0.6, 0.3, 0.1] * [[0.04, 0.01, 0.005], [0.01, 0.09, 0.02], [0.005, 0.02, 0.16]] * [0.6, 0.3, 0.1]'
      // = 0.6*(0.6*0.04 + 0.3*0.01 + 0.1*0.005) + 0.3*(0.6*0.01 + 0.3*0.09 + 0.1*0.02) + 0.1*(0.6*0.005 + 0.3*0.02 + 0.1*0.16)
      // = 0.6*(0.024 + 0.003 + 0.0005) + 0.3*(0.006 + 0.027 + 0.002) + 0.1*(0.003 + 0.006 + 0.016)
      // = 0.6*0.0275 + 0.3*0.035 + 0.1*0.025 = 0.0165 + 0.0105 + 0.0025 = 0.0295
      // sqrt(0.0295) ≈ 0.1718
      const vol = portfolioVolatility(weights, mockCovMatrix, tickers);
      expect(vol).toBeCloseTo(Math.sqrt(0.0295), 5);
    });
    it("returns 0 for empty weights", () => {
      expect(portfolioVolatility({}, mockCovMatrix, tickers)).toBe(0);
    });
  });

  describe("portfolioSharpe", () => {
    it("calculates Sharpe ratio correctly", () => {
      const expectedReturns = { SPY: 0.10, BND: 0.04, GLD: 0.05 };
      const rf = 0.02;
      const sharpe = portfolioSharpe(weights, expectedReturns, mockCovMatrix, tickers, rf);
      // Expected return = 0.077, rf = 0.02, excess = 0.057
      // Vol ≈ 0.1718, Sharpe = 0.057 / 0.1718 ≈ 0.332
      expect(sharpe).toBeCloseTo((0.077 - 0.02) / Math.sqrt(0.0295), 5);
    });
    it("returns 0 when volatility is 0", () => {
      const zeroCov = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ];
      expect(portfolioSharpe(weights, { SPY: 0.10, BND: 0.04, GLD: 0.05 }, zeroCov, tickers, 0.02)).toBe(0);
    });
  });

  describe("portfolioSortino", () => {
    it("calculates Sortino ratio correctly", () => {
      const dailyReturns = [0.001, 0.002, -0.001, 0.0015, -0.0005];
      const downsideReturns = dailyReturns.filter((r) => r < 0);
      const downsideDev = Math.sqrt(downsideReturns.reduce((sum, r) => sum + r * r, 0) / downsideReturns.length);
      const meanRet = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
      const sortino = portfolioSortino(dailyReturns, 0);
      expect(sortino).toBeCloseTo(meanRet / downsideDev, 5);
    });
    it("handles no downside returns", () => {
      expect(portfolioSortino([0.001, 0.002, 0.003], 0)).toBe(Infinity);
    });
  });

  describe("portfolioMaxDrawdown", () => {
    it("calculates max drawdown from equity curve", () => {
      const equity = [100, 110, 105, 115, 100];
      const mdd = portfolioMaxDrawdown(equity);
      // Peak at 115, trough at 100: (115-100)/115 = 0.1304
      expect(mdd).toBeCloseTo(15 / 115, 5);
    });
    it("returns 0 for always increasing equity", () => {
      expect(portfolioMaxDrawdown([100, 105, 110, 115])).toBe(0);
    });
    it("handles empty equity", () => {
      expect(portfolioMaxDrawdown([])).toBe(0);
    });
  });

  describe("portfolioCAGR", () => {
    it("calculates CAGR correctly", () => {
      const cagr = portfolioCAGR(100, 121, 2);
      expect(cagr).toBeCloseTo(0.10, 5); // 10% CAGR over 2 years
    });
    it("handles negative returns", () => {
      const cagr = portfolioCAGR(100, 90, 1);
      expect(cagr).toBeCloseTo(-0.10, 5);
    });
  });

  describe("rebalanceWeights", () => {
    it("rebalances weights to target", () => {
      const current = { SPY: 0.7, BND: 0.2, GLD: 0.1 };
      const target = { SPY: 0.6, BND: 0.3, GLD: 0.1 };
      const prices = { SPY: 110, BND: 105, GLD: 120 };
      const portfolioValue = 100000;
      
      const { trades, newWeights } = rebalanceWeights(current, target, prices, portfolioValue);
      
      expect(newWeights.SPY).toBeCloseTo(0.6, 3);
      expect(newWeights.BND).toBeCloseTo(0.3, 3);
      expect(newWeights.GLD).toBeCloseTo(0.1, 3);
      expect(trades).toHaveLength(3);
    });
    it("handles no rebalancing needed", () => {
      const current = { SPY: 0.6, BND: 0.3, GLD: 0.1 };
      const target = { SPY: 0.6, BND: 0.3, GLD: 0.1 };
      const prices = { SPY: 110, BND: 105, GLD: 120 };
      const { trades } = rebalanceWeights(current, target, prices, 100000);
      // Small trades due to rounding
      for (const trade of trades) {
        expect(Math.abs(trade.shares)).toBeLessThan(1);
      }
    });
  });

  describe("normalizeWeights", () => {
    it("normalizes weights to sum to 1", () => {
      const weights = { SPY: 60, BND: 30, GLD: 10 };
      const normalized = normalizeWeights(weights);
      expect(normalized.SPY).toBeCloseTo(0.6, 10);
      expect(normalized.BND).toBeCloseTo(0.3, 10);
      expect(normalized.GLD).toBeCloseTo(0.1, 10);
      const sum = Object.values(normalized).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 10);
    });
    it("handles zero sum", () => {
      expect(normalizeWeights({ SPY: 0, BND: 0 })).toEqual({ SPY: 0, BND: 0 });
    });
    it("handles negative weights by setting to 0", () => {
      const weights = { SPY: 1.2, BND: -0.2 };
      const normalized = normalizeWeights(weights);
      expect(normalized.SPY).toBe(1);
      expect(normalized.BND).toBe(0);
    });
  });

  describe("validateWeights", () => {
    it("validates correct weights", () => {
      const result = validateWeights({ SPY: 0.6, BND: 0.4 });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    it("rejects negative weights", () => {
      const result = validateWeights({ SPY: -0.1, BND: 1.1 });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("negative"))).toBe(true);
    });
    it("rejects sum > 1", () => {
      const result = validateWeights({ SPY: 0.7, BND: 0.5 });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("sum"))).toBe(true);
    });
    it("rejects single asset", () => {
      const result = validateWeights({ SPY: 1.0 });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("at least 2"))).toBe(true);
    });
  });

  describe("computeTurnover", () => {
    it("calculates turnover correctly", () => {
      const prev = { SPY: 0.6, BND: 0.3, GLD: 0.1 };
      const curr = { SPY: 0.5, BND: 0.4, GLD: 0.1 };
      // |0.6-0.5| + |0.3-0.4| + |0.1-0.1| = 0.1 + 0.1 + 0 = 0.2
      const turnover = computeTurnover(prev, curr);
      expect(turnover).toBeCloseTo(0.2, 10);
    });
  });

  describe("computePeriodReturns", () => {
    it("computes period returns from equity curve", () => {
      const equity = [100, 105, 102, 108];
      const returns = computePeriodReturns(equity);
      expect(returns).toHaveLength(3);
      expect(returns[0]).toBeCloseTo(0.05, 5);
      expect(returns[1]).toBeCloseTo(-0.02857, 5);
      expect(returns[2]).toBeCloseTo(0.05882, 5);
    });
  });

  describe("assetContribution", () => {
    it("calculates asset contribution to portfolio return", () => {
      const weights = { SPY: 0.6, BND: 0.4 };
      const returns = { SPY: 0.10, BND: 0.04 };
      const contrib = assetContribution(weights, returns);
      expect(contrib.SPY).toBeCloseTo(0.06, 10); // 0.6 * 0.10
      expect(contrib.BND).toBeCloseTo(0.016, 10); // 0.4 * 0.04
    });
  });
});
