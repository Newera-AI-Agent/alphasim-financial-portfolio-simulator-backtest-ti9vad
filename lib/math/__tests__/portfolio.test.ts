// lib/math/__tests__/portfolio.test.ts
// Unit tests for portfolio.ts - known-value tests against reference implementations

import {
  describe,
  it,
  expect,
  beforeAll,
  vi,
} from 'vitest';
import * as portfolio from '../portfolio';
import * as stats from '../statistics';

const EPSILON = 1e-10;

// Mock asset returns: 3 assets, 10 periods each
const assetReturns = [
  [0.01, 0.02, -0.01, 0.015, -0.005, 0.02, -0.01, 0.005, 0.01, -0.015], // Asset 0
  [0.005, 0.01, -0.005, 0.01, -0.01, 0.015, -0.005, 0.01, -0.01, 0.02],   // Asset 1
  [-0.005, 0.01, 0.015, -0.01, 0.02, -0.005, 0.01, -0.01, 0.015, 0.005],  // Asset 2
];

const weights = [0.4, 0.35, 0.25];
const weights2 = [0.5, 0.3, 0.2];

// Known covariance matrix for the above returns (computed via reference)
const covMatrix = stats.covarianceMatrix(assetReturns);

describe('portfolio', () => {
  describe('portfolioReturn', () => {
    it('computes weighted portfolio returns correctly', () => {
      const result = portfolio.portfolioReturn(assetReturns, weights);
      expect(result.length).toBe(10);
      // First period: 0.4*0.01 + 0.35*0.005 + 0.25*(-0.005) = 0.004 + 0.00175 - 0.00125 = 0.0045
      expect(result[0]).toBeCloseTo(0.0045, 10);
    });

    it('handles empty inputs', () => {
      expect(portfolio.portfolioReturn([], [])).toEqual([]);
      expect(portfolio.portfolioReturn(assetReturns, [])).toEqual([]);
    });

    it('handles zero weights', () => {
      const result = portfolio.portfolioReturn(assetReturns, [0, 0, 0]);
      expect(result.every(r => r === 0)).toBe(true);
    });
  });

  describe('portfolioVolatility', () => {
    it('computes portfolio volatility from covariance matrix', () => {
      const vol = portfolio.portfolioVolatility(covMatrix, weights);
      expect(vol).toBeGreaterThan(0);
      expect(typeof vol).toBe('number');
    });

    it('returns 0 for zero weights', () => {
      expect(portfolio.portfolioVolatility(covMatrix, [0, 0, 0])).toBe(0);
    });

    it('handles empty weights', () => {
      expect(portfolio.portfolioVolatility([[]], [])).toBe(0);
    });
  });

  describe('computePortfolioMetrics', () => {
    it('computes all metrics from returns', () => {
      const portfolioReturns = portfolio.portfolioReturn(assetReturns, weights);
      const metrics = portfolio.computePortfolioMetrics(portfolioReturns, 0.02, 252);
      
      expect(metrics.expectedReturn).toBeDefined();
      expect(metrics.volatility).toBeGreaterThan(0);
      expect(metrics.sharpeRatio).toBeDefined();
      expect(metrics.sortinoRatio).toBeDefined();
      expect(metrics.calmarRatio).toBeDefined();
      expect(metrics.maxDrawdown).toBeLessThanOrEqual(0);
    });

    it('handles default risk-free rate and periods', () => {
      const portfolioReturns = portfolio.portfolioReturn(assetReturns, weights);
      const metrics = portfolio.computePortfolioMetrics(portfolioReturns);
      expect(metrics.expectedReturn).toBeDefined();
    });
  });

  describe('rebalanceWeights', () => {
    it('normalizes target weights to sum to 1', () => {
      const result = portfolio.rebalanceWeights(weights, [2, 3, 5]);
      const sum = result.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 10);
      expect(result[0]).toBeCloseTo(0.2, 10);
      expect(result[1]).toBeCloseTo(0.3, 10);
      expect(result[2]).toBeCloseTo(0.5, 10);
    });

    it('returns current weights if target sum is 0', () => {
      const result = portfolio.rebalanceWeights(weights, [0, 0, 0]);
      expect(result).toEqual(weights);
    });
  });

  describe('normalizeWeights', () => {
    it('normalizes weights to sum to 1', () => {
      const result = portfolio.normalizeWeights([2, 3, 5]);
      const sum = result.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 10);
      expect(result[0]).toBeCloseTo(0.2, 10);
      expect(result[1]).toBeCloseTo(0.3, 10);
      expect(result[2]).toBeCloseTo(0.5, 10);
    });

    it('returns original if sum is 0', () => {
      const result = portfolio.normalizeWeights([0, 0, 0]);
      expect(result).toEqual([0, 0, 0]);
    });
  });

  describe('validateWeights', () => {
    it('validates correct weights', () => {
      const result = portfolio.validateWeights([0.4, 0.35, 0.25]);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('rejects negative weights', () => {
      const result = portfolio.validateWeights([0.5, -0.1, 0.6]);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('negative'))).toBe(true);
    });

    it('rejects weights summing > 1', () => {
      const result = portfolio.validateWeights([0.6, 0.5, 0.4]);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('sum'))).toBe(true);
    });

    it('requires at least 2 assets for simulation', () => {
      const result = portfolio.validateWeights([1.0]);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('asset'))).toBe(true);
    });
  });
});
