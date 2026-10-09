// lib/math/__tests__/statistics.test.ts
// Unit tests for statistics.ts - known-value tests against reference implementations

import {
  describe,
  it,
  expect,
  beforeAll,
} from 'vitest';
import * as stats from '../statistics';

const EPSILON = 1e-10;

// Known test data
const testValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const testReturns = [0.01, -0.02, 0.015, -0.005, 0.02, -0.01, 0.005, 0.01, -0.015, 0.005];
const testPrices = [100, 101, 99, 100.5, 100, 102, 101, 101.5, 100, 101, 101.5];

// Multi-asset returns for matrix functions
const assetReturns = [
  [0.01, 0.02, -0.01, 0.015, -0.005, 0.02, -0.01, 0.005, 0.01, -0.015],
  [0.005, 0.01, -0.005, 0.01, -0.01, 0.015, -0.005, 0.01, -0.01, 0.02],
  [-0.005, 0.01, 0.015, -0.01, 0.02, -0.005, 0.01, -0.01, 0.015, 0.005],
];

describe('statistics', () => {
  describe('simpleReturns', () => {
    it('computes simple returns from prices', () => {
      const returns = stats.simpleReturns(testPrices);
      expect(returns.length).toBe(testPrices.length - 1);
      // First return: (101 - 100) / 100 = 0.01
      expect(returns[0]).toBeCloseTo(0.01, 10);
    });

    it('handles single price', () => {
      expect(stats.simpleReturns([100])).toEqual([]);
    });
  });

  describe('logReturns', () => {
    it('computes log returns from prices', () => {
      const returns = stats.logReturns(testPrices);
      expect(returns.length).toBe(testPrices.length - 1);
      // First log return: ln(101/100) ≈ 0.00995
      expect(returns[0]).toBeCloseTo(Math.log(101/100), 10);
    });
  });

  describe('mean', () => {
    it('computes arithmetic mean', () => {
      expect(stats.mean(testValues)).toBe(5.5);
      // testReturns = [0.01, -0.02, 0.015, -0.005, 0.02, -0.01, 0.005, 0.01, -0.015, 0.005] = 0.015
      expect(stats.mean(testReturns)).toBeCloseTo(0.0015, 4);
    });

    it('handles empty array', () => {
      expect(stats.mean([])).toBeNaN();
    });
  });

  describe('std', () => {
    it('computes sample standard deviation', () => {
      // std of 1..10 with sample correction (n-1)
      const m = stats.mean(testValues);
      const variance = testValues.reduce((sum, v) => sum + (v - m) ** 2, 0) / (testValues.length - 1);
      const expected = Math.sqrt(variance);
      expect(stats.std(testValues)).toBeCloseTo(expected, 10);
    });

    it('returns 0 for single value', () => {
      expect(stats.std([5])).toBe(0);
    });
  });

  describe('stdPop', () => {
    it('computes population standard deviation', () => {
      const m = stats.mean(testValues);
      const variance = testValues.reduce((sum, v) => sum + (v - m) ** 2, 0) / testValues.length;
      const expected = Math.sqrt(variance);
      expect(stats.stdPop(testValues)).toBeCloseTo(expected, 10);
    });
  });

  describe('skew', () => {
    it('computes skewness', () => {
      const symmetric = [-2, -1, 0, 1, 2];
      expect(stats.skew(symmetric)).toBeCloseTo(0, 10);
      
      const positiveSkew = [1, 2, 3, 4, 100];
      expect(stats.skew(positiveSkew)).toBeGreaterThan(0);
    });
  });

  describe('kurtosis', () => {
    it('computes excess kurtosis', () => {
      // Normal distribution has excess kurtosis ≈ 0
      const normal = Array.from({ length: 1000 }, (_, i) => (i - 500) / 100);
      // Uniform distribution has excess kurtosis ≈ -1.2
      expect(stats.kurtosis(normal)).toBeLessThan(1);
      expect(stats.kurtosis(normal)).toBeGreaterThan(-2);
    });
  });

  describe('percentile', () => {
    it('computes percentiles correctly', () => {
      const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(stats.percentile(sorted, 0.5)).toBe(5.5); // median
      expect(stats.percentile(sorted, 0.25)).toBe(3.25); // Q1
      expect(stats.percentile(sorted, 0.75)).toBe(7.75); // Q3
    });
  });

  describe('autocorr', () => {
    it('computes autocorrelation at lag', () => {
      const series = [1, 2, 3, 4, 5];
      const acf1 = stats.autocorr(series, 1);
      expect(typeof acf1).toBe('number');
      
      // Perfect correlation with itself at lag 0
      expect(stats.autocorr(series, 0)).toBeCloseTo(1, 10);
    });
  });

  describe('covariance', () => {
    it('computes covariance between two series', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      // cov(x, 2x) = 2 * var(x)
      const expected = 2 * stats.stdPop(x) ** 2;
      expect(stats.covariance(x, y)).toBeCloseTo(expected, 10);
    });
  });

  describe('correlation', () => {
    it('computes correlation between two series', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      expect(stats.correlation(x, y)).toBeCloseTo(1, 10);
      
      const z = [5, 4, 3, 2, 1];
      expect(stats.correlation(x, z)).toBeCloseTo(-1, 10);
    });
  });

  describe('covarianceMatrix', () => {
    it('computes covariance matrix for multiple assets', () => {
      const covMat = stats.covarianceMatrix(assetReturns);
      expect(covMat.length).toBe(3);
      expect(covMat[0].length).toBe(3);
      
      // Diagonal should be variances
      for (let i = 0; i < 3; i++) {
        expect(covMat[i][i]).toBeCloseTo(stats.stdPop(assetReturns[i]) ** 2, 10);
      }
      
      // Should be symmetric
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          expect(covMat[i][j]).toBeCloseTo(covMat[j][i], 10);
        }
      }
    });
  });

  describe('correlationMatrix', () => {
    it('computes correlation matrix', () => {
      const corrMat = stats.correlationMatrix(assetReturns);
      expect(corrMat.length).toBe(3);
      expect(corrMat[0].length).toBe(3);
      
      // Diagonal should be 1
      for (let i = 0; i < 3; i++) {
        expect(corrMat[i][i]).toBeCloseTo(1, 10);
      }
      
      // Should be symmetric
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          expect(corrMat[i][j]).toBeCloseTo(corrMat[j][i], 10);
        }
      }
      
      // All values in [-1, 1]
      for (const row of corrMat) {
        for (const val of row) {
          expect(val).toBeGreaterThanOrEqual(-1);
          expect(val).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('ledoitWolfShrinkage', () => {
    it('computes shrinkage estimator', () => {
      const shrunk = stats.ledoitWolfShrinkage(assetReturns);
      expect(shrunk.length).toBe(3);
      expect(shrunk[0].length).toBe(3);
      
      // Should be symmetric
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          expect(shrunk[i][j]).toBeCloseTo(shrunk[j][i], 10);
        }
      }
      
      // Diagonal should be positive
      for (let i = 0; i < 3; i++) {
        expect(shrunk[i][i]).toBeGreaterThan(0);
      }
    });
  });

  describe('drawdownSeries', () => {
    it('computes drawdown series from equity curve', () => {
      const equity = [100, 110, 105, 115, 100, 120];
      const dd = stats.drawdownSeries(equity);
      expect(dd.length).toBe(equity.length);
      expect(dd[0]).toBe(0); // No drawdown at start
      expect(dd[2]).toBeCloseTo((105 - 110) / 110, 10); // -4.5%
    });
  });

  describe('maxDrawdown', () => {
    it('computes maximum drawdown', () => {
      const equity = [100, 110, 105, 115, 90, 120];
      const mdd = stats.maxDrawdown(equity);
      // Peak 115, trough 90 -> (90-115)/115 = -21.7%
      expect(mdd).toBeCloseTo(-0.217, 2);
    });
  });

  describe('cagr', () => {
    it('computes CAGR', () => {
      // 100 to 200 over 2 years (504 trading days)
      const equity = [100, 200];
      const cagr = stats.cagr(equity, 252, 504);
      // (200/100)^(252/504) - 1 = 2^0.5 - 1 ≈ 0.414
      expect(cagr).toBeCloseTo(Math.sqrt(2) - 1, 3);
    });
  });

  describe('sharpeRatio', () => {
    it('computes Sharpe ratio', () => {
      const returns = [0.01, 0.02, 0.015, 0.01, 0.02];
      const rf = 0.001;
      const sharpe = stats.sharpeRatio(returns, rf);
      expect(typeof sharpe).toBe('number');
    });
  });

  describe('sortinoRatio', () => {
    it('computes Sortino ratio', () => {
      const returns = [0.01, -0.02, 0.015, -0.005, 0.02];
      const rf = 0.001;
      const sortino = stats.sortinoRatio(returns, rf);
      expect(typeof sortino).toBe('number');
    });
  });

  describe('calmarRatio', () => {
    it('computes Calmar ratio', () => {
      const equity = [100, 110, 105, 115, 100, 120];
      const calmar = stats.calmarRatio(equity);
      expect(typeof calmar).toBe('number');
    });
  });
});
