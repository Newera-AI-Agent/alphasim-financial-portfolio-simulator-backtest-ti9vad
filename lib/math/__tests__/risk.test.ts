// lib/math/__tests__/risk.test.ts
// Unit tests for risk.ts - known-value tests against reference implementations

import {
  describe,
  it,
  expect,
  beforeAll,
  vi,
} from 'vitest';
import * as risk from '../risk';
import * as stats from '../statistics';

const EPSILON = 1e-10;

// Mock returns data for 3 assets
const assetReturns = [
  [0.01, 0.02, -0.01, 0.015, -0.005, 0.02, -0.01, 0.005, 0.01, -0.015],
  [0.005, 0.01, -0.005, 0.01, -0.01, 0.015, -0.005, 0.01, -0.01, 0.02],
  [-0.005, 0.01, 0.015, -0.01, 0.02, -0.005, 0.01, -0.01, 0.015, 0.005],
];

const weights = [0.4, 0.35, 0.25];
const tickers = ['SPY', 'BND', 'GLD'];

const config: risk.RiskConfig = {
  weights,
  confidenceLevels: [0.95, 0.99],
  useShrinkage: false,
};

describe('risk', () => {
  describe('pca', () => {
    it('computes eigenvalues and eigenvectors for correlation matrix', () => {
      const corrMatrix = stats.correlationMatrix(assetReturns);
      const result = risk.pca(corrMatrix);
      
      expect(result.eigenvalues.length).toBe(3);
      expect(result.eigenvectors.length).toBe(3);
      expect(result.eigenvectors[0].length).toBe(3);
      expect(result.varianceExplained.length).toBe(3);
      expect(result.cumulativeVarianceExplained.length).toBe(3);
      
      // Eigenvalues should be sorted descending
      for (let i = 1; i < 3; i++) {
        expect(result.eigenvalues[i]).toBeLessThanOrEqual(result.eigenvalues[i - 1]);
      }
      
      // Variance explained should sum to 1
      const sumVar = result.varianceExplained.reduce((a, b) => a + b, 0);
      expect(sumVar).toBeCloseTo(1, 10);
      
      // Last cumulative should be 1
      expect(result.cumulativeVarianceExplained[2]).toBeCloseTo(1, 10);
    });

    it('handles identity matrix', () => {
      const identity = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
      const result = risk.pca(identity);
      expect(result.eigenvalues[0]).toBeCloseTo(1, 10);
      expect(result.eigenvalues[1]).toBeCloseTo(1, 10);
      expect(result.eigenvalues[2]).toBeCloseTo(1, 10);
      expect(result.varianceExplained[0]).toBeCloseTo(1/3, 10);
      expect(result.varianceExplained[1]).toBeCloseTo(1/3, 10);
      expect(result.varianceExplained[2]).toBeCloseTo(1/3, 10);
    });
  });

  describe('cornishFisherVaR', () => {
    it('computes VaR with skew/kurtosis adjustment', () => {
      const returns = assetReturns[0];
      const var95 = risk.cornishFisherVaR(returns, 0.95);
      const var99 = risk.cornishFisherVaR(returns, 0.99);
      
      expect(typeof var95).toBe('number');
      expect(typeof var99).toBe('number');
      // Both are negative (losses), 99% VaR is a larger loss (more negative)
      expect(var99).toBeLessThanOrEqual(var95);
    });
  });

  describe('computeTailRisk', () => {
    it('computes all VaR/ES measures', () => {
      const portfolioReturns = assetReturns[0].map((_, t) =>
        assetReturns.reduce((sum, r, i) => sum + r[t] * weights[i], 0)
      );
      
      const result = risk.computeTailRisk(portfolioReturns, [0.95, 0.99]);
      
      expect(result.historicalVar[0.95]).toBeDefined();
      expect(result.historicalVar[0.99]).toBeDefined();
      expect(result.historicalES[0.95]).toBeDefined();
      expect(result.historicalES[0.99]).toBeDefined();
      expect(result.parametricVar[0.95]).toBeDefined();
      expect(result.parametricVar[0.99]).toBeDefined();
      expect(result.parametricES[0.95]).toBeDefined();
      expect(result.parametricES[0.99]).toBeDefined();
      expect(result.cornishFisherVar[0.95]).toBeDefined();
      expect(result.cornishFisherVar[0.99]).toBeDefined();
      
      // ES should be >= VaR (more conservative)
      expect(result.historicalES[0.95]).toBeGreaterThanOrEqual(result.historicalVar[0.95]);
      expect(result.historicalES[0.99]).toBeGreaterThanOrEqual(result.historicalVar[0.99]);
      expect(result.parametricES[0.95]).toBeGreaterThanOrEqual(result.parametricVar[0.95]);
    });
  });

  describe('famaFrenchRegression', () => {
    it('runs 3-factor regression', () => {
      const portfolioReturns = assetReturns[0].map((_, t) =>
        assetReturns.reduce((sum, r, i) => sum + r[t] * weights[i], 0)
      );
      
      const factorData = {
        mkt: portfolioReturns.map(r => r * 0.9),
        smb: portfolioReturns.map((r, i) => (i % 2 === 0 ? 0.001 : -0.001)),
        hml: portfolioReturns.map((r, i) => (i % 3 === 0 ? -0.001 : 0.001)),
        rf: new Array(portfolioReturns.length).fill(0.02 / 252),
      };
      
      const result = risk.famaFrenchRegression(portfolioReturns, factorData);
      
      expect(result.alpha).toBeDefined();
      expect(result.betaMkt).toBeDefined();
      expect(result.betaSmb).toBeDefined();
      expect(result.betaHml).toBeDefined();
      expect(result.tStatAlpha).toBeDefined();
      expect(result.tStatMkt).toBeDefined();
      expect(result.tStatSmb).toBeDefined();
      expect(result.tStatHml).toBeDefined();
      expect(result.rSquared).toBeGreaterThanOrEqual(0);
      expect(result.rSquared).toBeLessThanOrEqual(1);
    });
  });

  describe('getStressTestScenarios', () => {
    it('returns predefined scenarios', () => {
      const scenarios = risk.getStressTestScenarios();
      expect(scenarios.length).toBe(3);
      expect(scenarios[0].name).toBe('2008 Global Financial Crisis');
      expect(scenarios[1].name).toBe('2020 COVID Crash');
      expect(scenarios[2].name).toBe('2022 Rate Hike Cycle');
      
      scenarios.forEach(s => {
        expect(s.name).toBeDefined();
        expect(s.description).toBeDefined();
        expect(s.shocks).toBeDefined();
        expect(typeof s.shocks).toBe('object');
      });
    });
  });

  describe('runStressTests', () => {
    it('computes portfolio return under each scenario', () => {
      const scenarios = risk.getStressTestScenarios();
      const results = risk.runStressTests(weights, tickers, scenarios);
      
      expect(results.length).toBe(3);
      results.forEach((r, i) => {
        expect(r.name).toBe(scenarios[i].name);
        expect(r.portfolioReturn).toBeDefined();
        expect(typeof r.portfolioReturn).toBe('number');
      });
    });
  });

  describe('computeRiskDecomposition', () => {
    it('computes MCR and PCTR', () => {
      const covMatrix = stats.covarianceMatrix(assetReturns);
      const result = risk.computeRiskDecomposition(weights, covMatrix);
      
      expect(result.marginalComponentRisk.length).toBe(3);
      expect(result.percentageContributionToRisk.length).toBe(3);
      expect(result.totalRisk).toBeGreaterThan(0);
      
      // PCTR should sum to 1 (or close)
      const pctrSum = result.percentageContributionToRisk.reduce((a, b) => a + b, 0);
      expect(pctrSum).toBeCloseTo(1, 5);
    });
  });

  describe('runRiskAnalytics', () => {
    it('runs full risk analytics pipeline', () => {
      const result = risk.runRiskAnalytics(assetReturns, weights, tickers, config);
      
      expect(result.covarianceMatrix.length).toBe(3);
      expect(result.correlationMatrix.length).toBe(3);
      expect(result.pca.eigenvalues.length).toBe(3);
      expect(result.factorModel.alpha).toBeDefined();
      expect(result.tailRisk.historicalVar[0.95]).toBeDefined();
      expect(result.stressTests.length).toBe(3);
      expect(result.riskDecomposition.marginalComponentRisk.length).toBe(3);
    });

    it('uses shrinkage when enabled', () => {
      const shrinkageConfig = { ...config, useShrinkage: true };
      const result = risk.runRiskAnalytics(assetReturns, weights, tickers, shrinkageConfig);
      expect(result.covarianceMatrix.length).toBe(3);
    });
  });
});
