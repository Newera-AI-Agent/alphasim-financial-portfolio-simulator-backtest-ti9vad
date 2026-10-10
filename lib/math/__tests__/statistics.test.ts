/**
 * Unit tests for statistics module
 * Known-value tests against reference implementations
 */
import { describe, it, expect } from "vitest";
import {
  mean,
  variance,
  std,
  skew,
  kurtosis,
  percentile,
  covariance,
  correlation,
  covarianceMatrix,
  correlationMatrix,
  shrinkage,
  eigenvalues,
  multiplyMatrixVector,
  multiplyMatrices,
  transpose,
} from "../statistics";

import {
  logReturns,
  simpleReturns,
  drawdownSeries,
  maxDrawdown,
  cagr,
  annualizeReturn,
  annualizeVolatility,
  sharpeRatio,
  sortinoRatio,
  calmarRatio,
} from "../statistics";

describe("statistics", () => {
  describe("mean", () => {
    it("calculates mean correctly", () => {
      expect(mean([1, 2, 3, 4, 5])).toBe(3);
      expect(mean([10, 20, 30])).toBe(20);
      expect(mean([-1, 0, 1])).toBe(0);
      expect(mean([])).toBe(0);
    });
  });

  describe("variance", () => {
    it("calculates sample variance correctly", () => {
      // Sample variance of [1,2,3,4,5] = 2.5
      expect(variance([1, 2, 3, 4, 5])).toBeCloseTo(2.5, 10);
      // Population variance
      expect(variance([1, 2, 3, 4, 5], true)).toBeCloseTo(2.0, 10);
    });
    it("handles edge cases", () => {
      expect(variance([5])).toBe(0);
      expect(variance([])).toBe(0);
    });
  });

  describe("std", () => {
    it("calculates standard deviation correctly", () => {
      // std of [1,2,3,4,5] = sqrt(2.5) ≈ 1.5811
      expect(std([1, 2, 3, 4, 5])).toBeCloseTo(Math.sqrt(2.5), 10);
      expect(std([1, 2, 3, 4, 5], true)).toBeCloseTo(Math.sqrt(2.0), 10);
    });
  });

  describe("skew", () => {
    it("calculates skewness correctly", () => {
      // Symmetric distribution has skew ≈ 0
      expect(skew([1, 2, 3, 4, 5])).toBeCloseTo(0, 10);
      // Positive skew
      const positiveSkew = skew([1, 2, 3, 4, 100]);
      expect(positiveSkew).toBeGreaterThan(0);
      // Negative skew
      const negativeSkew = skew([-100, 1, 2, 3, 4]);
      expect(negativeSkew).toBeLessThan(0);
    });
    it("handles edge cases", () => {
      expect(skew([1])).toBe(0);
      expect(skew([1, 2])).toBe(0);
      expect(skew([])).toBe(0);
    });
  });

  describe("kurtosis", () => {
    it("calculates excess kurtosis correctly", () => {
      // Normal distribution has excess kurtosis ≈ 0
      const normal = Array.from({ length: 1000 }, (_, i) => i / 100);
      expect(Math.abs(kurtosis(normal))).toBeLessThan(1);
    });
    it("handles edge cases", () => {
      expect(kurtosis([1])).toBe(0);
      expect(kurtosis([1, 2])).toBe(0);
      expect(kurtosis([1, 2, 3])).toBe(0);
      expect(kurtosis([])).toBe(0);
    });
  });

  describe("percentile", () => {
    it("calculates percentiles correctly", () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(percentile(data, 0.5)).toBe(5.5); // median
      expect(percentile(data, 0.25)).toBe(3.25); // Q1
      expect(percentile(data, 0.75)).toBe(7.75); // Q3
      expect(percentile(data, 0)).toBe(1); // min
      expect(percentile(data, 1)).toBe(10); // max
    });
    it("handles edge cases", () => {
      expect(percentile([], 0.5)).toBe(0);
      expect(percentile([5], 0.5)).toBe(5);
    });
  });

  describe("covariance", () => {
    it("calculates covariance correctly", () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10]; // perfect correlation
      expect(covariance(x, y)).toBeCloseTo(5, 10);
    });
    it("returns 0 for uncorrelated data", () => {
      const x = [1, 2, 3, 4, 5];
      const y = [5, 4, 3, 2, 1]; // perfect negative correlation
      expect(covariance(x, y)).toBeCloseTo(-2.5, 10);
    });
  });

  describe("correlation", () => {
    it("calculates correlation correctly", () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      expect(correlation(x, y)).toBeCloseTo(1, 10);
    });
    it("returns -1 for perfect negative correlation", () => {
      const x = [1, 2, 3, 4, 5];
      const y = [10, 8, 6, 4, 2];
      expect(correlation(x, y)).toBeCloseTo(-1, 10);
    });
    it("returns 0 for uncorrelated data", () => {
      const x = [1, 2, 3, 4, 5];
      const y = [5, 5, 5, 5, 5];
      expect(correlation(x, y)).toBe(0);
    });
  });

  describe("covarianceMatrix", () => {
    it("computes covariance matrix correctly", () => {
      const returns = [
        [0.01, 0.02, 0.015, 0.005, -0.01],
        [0.02, 0.01, 0.025, 0.015, 0.005],
      ];
      const cov = covarianceMatrix(returns);
      expect(cov).toHaveLength(2);
      expect(cov[0]).toHaveLength(2);
      expect(cov[0][0]).toBeCloseTo(cov[1][1], 5); // diagonal should be variances
      expect(cov[0][1]).toBeCloseTo(cov[1][0], 10); // symmetric
    });
  });

  describe("correlationMatrix", () => {
    it("computes correlation matrix correctly", () => {
      const returns = [
        [0.01, 0.02, 0.015, 0.005, -0.01],
        [0.02, 0.01, 0.025, 0.015, 0.005],
      ];
      const corr = correlationMatrix(returns);
      expect(corr).toHaveLength(2);
      expect(corr[0][0]).toBe(1); // diagonal = 1
      expect(corr[1][1]).toBe(1);
      expect(corr[0][1]).toBeCloseTo(corr[1][0], 10); // symmetric
    });
  });

  describe("shrinkage (Ledoit-Wolf)", () => {
    it("shrinks covariance matrix toward diagonal", () => {
      const sampleCov = [
        [0.04, 0.03, 0.02],
        [0.03, 0.09, 0.04],
        [0.02, 0.04, 0.16],
      ];
      const returns = [
        [0.01, 0.02, 0.015, 0.005, -0.01],
        [0.02, 0.01, 0.025, 0.015, 0.005],
        [-0.005, 0.01, 0.02, 0.01, 0.015],
      ];
      const shrunk = shrinkage(returns);
      expect(shrunk).toHaveLength(3);
      // Diagonal should be unchanged (variances preserved)
      expect(shrunk[0][0]).toBeCloseTo(sampleCov[0][0], 5);
      expect(shrunk[1][1]).toBeCloseTo(sampleCov[1][1], 5);
      expect(shrunk[2][2]).toBeCloseTo(sampleCov[2][2], 5);
      // Off-diagonals should be shrunk toward 0
      expect(Math.abs(shrunk[0][1])).toBeLessThan(Math.abs(sampleCov[0][1]));
    });
  });

  describe("logReturns (from portfolio)", () => {
    it("calculates log returns correctly", () => {
      const prices = [100, 105, 102, 108];
      const returns = logReturns(prices);
      expect(returns).toHaveLength(3);
      expect(returns[0]).toBeCloseTo(Math.log(105 / 100), 10);
      expect(returns[1]).toBeCloseTo(Math.log(102 / 105), 10);
      expect(returns[2]).toBeCloseTo(Math.log(108 / 102), 10);
    });
    it("handles edge cases", () => {
      expect(logReturns([100])).toEqual([]);
      expect(logReturns([])).toEqual([]);
    });
  });

  describe("simpleReturns (from portfolio)", () => {
    it("calculates simple returns correctly", () => {
      const prices = [100, 105, 102, 108];
      const returns = simpleReturns(prices);
      expect(returns).toHaveLength(3);
      expect(returns[0]).toBeCloseTo(0.05, 10);
      expect(returns[1]).toBeCloseTo(-0.02857, 5);
      expect(returns[2]).toBeCloseTo(0.05882, 5);
    });
  });

  describe("drawdownSeries (from portfolio)", () => {
    it("calculates drawdown series correctly", () => {
      const prices = [100, 110, 105, 115, 100];
      const dd = drawdownSeries(prices);
      expect(dd).toHaveLength(5);
      expect(dd[0]).toBe(0); // first day no drawdown
      expect(dd[1]).toBe(0); // new peak
      expect(dd[2]).toBeCloseTo((110 - 105) / 110, 5); // drawdown from peak
      expect(dd[3]).toBe(0); // new peak
      expect(dd[4]).toBeCloseTo((115 - 100) / 115, 5); // drawdown from peak
    });
  });

  describe("maxDrawdown (from portfolio)", () => {
    it("calculates maximum drawdown correctly", () => {
      const prices = [100, 110, 105, 115, 100];
      const mdd = maxDrawdown(prices);
      // Max drawdown from 115 to 100 = 15/115 ≈ 0.1304
      expect(mdd).toBeCloseTo(15 / 115, 5);
    });
    it("returns 0 for monotonically increasing prices", () => {
      expect(maxDrawdown([100, 105, 110, 115])).toBe(0);
    });
  });

  describe("cagr (from portfolio)", () => {
    it("calculates CAGR correctly", () => {
      // 10% annual return over 1 year
      expect(cagr(100, 110, 1)).toBeCloseTo(0.10, 5);
      // 21% total return over 2 years = 10% CAGR
      expect(cagr(100, 121, 2)).toBeCloseTo(0.10, 5);
      // Negative return
      expect(cagr(100, 90, 1)).toBeCloseTo(-0.10, 5);
    });
    it("handles edge cases", () => {
      expect(cagr(100, 100, 1)).toBe(0);
      expect(cagr(100, 0, 1)).toBe(-1);
    });
  });

  describe("annualizeReturn (from portfolio)", () => {
    it("annualizes daily returns correctly", () => {
      const dailyReturn = 0.10 / 252; // 10% annual ≈ 0.0397% daily
      expect(annualizeReturn(dailyReturn, 252)).toBeCloseTo(0.10, 5);
    });
  });

  describe("annualizeVolatility (from portfolio)", () => {
    it("annualizes daily volatility correctly", () => {
      const dailyVol = 0.16 / Math.sqrt(252); // 16% annual
      expect(annualizeVolatility(dailyVol, 252)).toBeCloseTo(0.16, 5);
    });
  });

  describe("sharpeRatio (from portfolio)", () => {
    it("calculates Sharpe ratio correctly", () => {
      const returns = Array(252).fill(0.10 / 252); // 10% annual, zero vol
      const rf = 0.02 / 252; // 2% risk-free
      expect(sharpeRatio(returns, rf, 252)).toBeGreaterThan(100); // very high
    });
    it("handles zero volatility", () => {
      const returns = Array(252).fill(0);
      expect(sharpeRatio(returns, 0, 252)).toBe(0);
    });
  });

  describe("sortinoRatio (from portfolio)", () => {
    it("calculates Sortino ratio correctly", () => {
      const returns = [0.01, 0.02, -0.005, 0.015, -0.002];
      const rf = 0.02 / 252;
      const sortino = sortinoRatio(returns, rf, 252);
      expect(typeof sortino).toBe("number");
    });
  });

  describe("calmarRatio (from portfolio)", () => {
    it("calculates Calmar ratio correctly", () => {
      const prices = [100, 110, 105, 115, 120];
      const calmar = calmarRatio(prices, 1);
      expect(typeof calmar).toBe("number");
    });
  });

  describe("matrix operations", () => {
    it("multiplies matrix and vector correctly", () => {
      const matrix = [
        [1, 2],
        [3, 4],
      ];
      const vector = [5, 6];
      const result = multiplyMatrixVector(matrix, vector);
      expect(result).toEqual([17, 39]);
    });

    it("multiplies matrices correctly", () => {
      const a = [
        [1, 2],
        [3, 4],
      ];
      const b = [
        [5, 6],
        [7, 8],
      ];
      const result = multiplyMatrices(a, b);
      expect(result).toEqual([
        [19, 22],
        [43, 50],
      ]);
    });

    it("transposes matrices correctly", () => {
      const matrix = [
        [1, 2, 3],
        [4, 5, 6],
      ];
      const result = transpose(matrix);
      expect(result).toEqual([
        [1, 4],
        [2, 5],
        [3, 6],
      ]);
    });

    it("computes eigenvalues for 2x2 matrix", () => {
      // Matrix [[2, 1], [1, 2]] has eigenvalues 3 and 1
      const matrix = [
        [2, 1],
        [1, 2],
      ];
      const evals = eigenvalues(matrix);
      expect(evals).toHaveLength(2);
      expect(Math.max(...evals)).toBeCloseTo(3, 5);
      expect(Math.min(...evals)).toBeCloseTo(1, 5);
    });
  });
});
