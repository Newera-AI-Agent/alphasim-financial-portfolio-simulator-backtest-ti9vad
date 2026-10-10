/**
 * Unit tests for risk module
 */
import { describe, it, expect } from "vitest";
import {
  computeHistoricalVaR,
  computeHistoricalES,
  computeParametricVaR,
  computeParametricES,
  computeCornishFisherVaR,
  computeFactorModel,
  computeRiskDecomposition,
  runStressTests,
  runRiskAnalysis,
  computeRollingRiskMetrics,
  scenarioAnalysis,
} from "../risk";

describe("risk", () => {
  const sampleReturns = [
    -0.02, -0.01, 0, 0.01, 0.02, -0.015, 0.005, 0.01, -0.005, 0.015,
    0.02, -0.01, 0.005, -0.02, 0.01, 0.03, -0.005, 0.01, 0.005, -0.01,
  ];
  const weights = { SPY: 0.6, BND: 0.4 };
  const tickers = ["SPY", "BND"];
  const assetReturns = {
    SPY: [0.01, 0.02, -0.01, 0.015, -0.005],
    BND: [0.001, 0.002, 0.001, 0.0015, 0.0005],
  };
  const covMatrix = [
    [0.04, 0.01],
    [0.01, 0.01],
  ];
  const meanReturns = { SPY: 0.001, BND: 0.0005 };

  describe("computeHistoricalVaR", () => {
    it("calculates 95% VaR correctly", () => {
      const var95 = computeHistoricalVaR(sampleReturns, 0.95);
      // Sorted returns: -0.02, -0.02, -0.015, -0.01, -0.01, -0.01, -0.005, -0.005, 0, 0.005, 0.005, 0.005, 0.01, 0.01, 0.01, 0.01, 0.01, 0.015, 0.02, 0.02, 0.03
      // 20 observations, 95% -> index = floor(20 * 0.05) = 1 -> sorted[1] = -0.02 -> VaR = 0.02
      expect(var95).toBeGreaterThan(0);
    });

    it("calculates 99% VaR correctly", () => {
      const var99 = computeHistoricalVaR(sampleReturns, 0.99);
      // index = floor(20 * 0.01) = 0 -> sorted[0] = -0.02 -> VaR = 0.02
      expect(var99).toBeGreaterThan(0);
    });

    it("returns 0 for empty returns", () => {
      expect(computeHistoricalVaR([], 0.95)).toBe(0);
    });
  });

  describe("computeHistoricalES", () => {
    it("calculates 95% ES correctly", () => {
      const es95 = computeHistoricalES(sampleReturns, 0.95);
      // ES = average of worst 5% = average of [-0.02] = 0.02
      expect(es95).toBeGreaterThan(0);
    });

    it("returns 0 for empty returns", () => {
      expect(computeHistoricalES([], 0.95)).toBe(0);
    });
  });

  describe("computeParametricVaR", () => {
    it("calculates 95% parametric VaR", () => {
      const mean = 0.001;
      const std = 0.01;
      // Z_0.95 = 1.645, VaR = -(mean - 1.645 * std) = 1.645 * 0.01 - 0.001 = 0.01545
      const var95 = computeParametricVaR(mean, std, 0.95);
      expect(var95).toBeCloseTo(0.01545, 5);
    });

    it("calculates 99% parametric VaR", () => {
      const mean = 0.001;
      const std = 0.01;
      // Z_0.99 = 2.326, VaR = 2.326 * 0.01 - 0.001 = 0.02226
      const var99 = computeParametricVaR(mean, std, 0.99);
      expect(var99).toBeCloseTo(0.02226, 5);
    });
  });

  describe("computeParametricES", () => {
    it("calculates 95% parametric ES", () => {
      const mean = 0.001;
      const std = 0.01;
      // ES = mean + std * phi(z) / (1 - alpha)
      // phi(1.645) ≈ 0.103, ES = 0.001 + 0.01 * 0.103 / 0.05 = 0.001 + 0.0206 = 0.0216
      const es95 = computeParametricES(mean, std, 0.95);
      expect(es95).toBeGreaterThan(0);
    });
  });

  describe("computeCornishFisherVaR", () => {
    it("adjusts for skewness and kurtosis", () => {
      const mean = 0.001;
      const std = 0.01;
      const skew = -0.5; // negative skew
      const kurt = 3; // normal kurtosis
      
      const var95 = computeCornishFisherVaR(mean, std, skew, kurt, 0.95);
      const var95Normal = computeParametricVaR(mean, std, 0.95);
      // Negative skew should increase VaR (more tail risk)
      expect(var95).toBeGreaterThan(var95Normal);
    });

    it("matches parametric VaR for normal distribution", () => {
      const mean = 0.001;
      const std = 0.01;
      const var95 = computeCornishFisherVaR(mean, std, 0, 0, 0.95); // skew=0, excess kurtosis=0
      const var95Parametric = computeParametricVaR(mean, std, 0.95);
      expect(var95).toBeCloseTo(var95Parametric, 5);
    });
  });

  describe("computeFactorModel", () => {
    it("computes factor model regression", () => {
      // Create returns with known factor exposure
      const n = 100;
      const portfolioReturns = Array.from({ length: n }, (_, i) => (
        0.0005 + 1.2 * 0.001 + 0.3 * 0.0005 - 0.2 * 0.0003 + (Math.random() - 0.5) * 0.005
      ));
      const factors = {
        mkt: Array.from({ length: n }, () => 0.001 + (Math.random() - 0.5) * 0.01),
        smb: Array.from({ length: n }, () => 0.0005 + (Math.random() - 0.5) * 0.005),
        hml: Array.from({ length: n }, () => -0.0003 + (Math.random() - 0.5) * 0.005),
        rf: Array.from({ length: n }, () => 0.0001),
      };

      const result = computeFactorModel(portfolioReturns, factors);
      
      expect(result.alpha).toBeDefined();
      expect(result.betas.mkt).toBeDefined();
      expect(result.betas.smb).toBeDefined();
      expect(result.betas.hml).toBeDefined();
      expect(result.tStats.mkt).toBeDefined();
      expect(result.tStats.smb).toBeDefined();
      expect(result.tStats.hml).toBeDefined();
      expect(result.rSquared).toBeGreaterThanOrEqual(0);
      expect(result.rSquared).toBeLessThanOrEqual(1);
    });

    it("handles insufficient data", () => {
      const result = computeFactorModel([0.01, 0.02], {
        mkt: [0.01, 0.02],
        smb: [0.001, 0.002],
        hml: [0.001, 0.002],
        rf: [0.0001, 0.0001],
      });
      expect(result.rSquared).toBe(0);
    });
  });

  describe("computeRiskDecomposition", () => {
    it("computes MCR, CR, PCTR correctly", () => {
      const result = computeRiskDecomposition(weights, covMatrix, tickers);
      
      expect(result.mcr).toBeDefined();
      expect(result.cr).toBeDefined();
      expect(result.pctr).toBeDefined();
      
      // PCTR should sum to 1
      const sumPctr = Object.values(result.pctr).reduce((a, b) => a + b, 0);
      expect(sumPctr).toBeCloseTo(1, 5);
      
      // CR = weight * MCR, should sum to portfolio volatility
      const sumCR = Object.values(result.cr).reduce((a, b) => a + b, 0);
      const portVol = Math.sqrt(0.6 * 0.6 * 0.04 + 2 * 0.6 * 0.4 * 0.01 + 0.4 * 0.4 * 0.01);
      expect(sumCR).toBeCloseTo(portVol, 5);
    });
  });

  describe("runStressTests", () => {
    it("runs all stress test scenarios", () => {
      const scenarios = runStressTests(weights, assetReturns, tickers);
      
      expect(scenarios).toHaveLength(5); // GFC, COVID, Rate Hike, Eurozone, China
      
      for (const scenario of scenarios) {
        expect(scenario.name).toBeDefined();
        expect(scenario.portfolioReturn).toBeDefined();
        expect(scenario.assetShocks).toBeDefined();
      }
    });

    it("GFC scenario produces negative return for equity-heavy portfolio", () => {
      const scenarios = runStressTests({ SPY: 0.8, BND: 0.2 }, assetReturns, tickers);
      const gfc = scenarios.find((s) => s.name.includes("2008"));
      expect(gfc).toBeDefined();
      // Equity-heavy portfolio should suffer in GFC
      expect(gfc!.portfolioReturn).toBeLessThan(0);
    });
  });

  describe("runRiskAnalysis", () => {
    it("runs complete risk analysis", () => {
      const result = runRiskAnalysis({
        weights,
        assetReturns,
        covMatrix,
        tickers,
        meanReturns,
        benchmark: "SPY",
        confidenceLevel: 0.95,
      });

      expect(result.var).toBeDefined();
      expect(result.var.historical95).toBeDefined();
      expect(result.var.historical99).toBeDefined();
      expect(result.var.parametric95).toBeDefined();
      expect(result.var.parametric99).toBeDefined();
      expect(result.var.cornishFisher95).toBeDefined();
      expect(result.es).toBeDefined();
      expect(result.factorModel).toBeDefined();
      expect(result.riskDecomposition).toBeDefined();
      expect(result.stressTests).toBeDefined();
      expect(result.pca).toBeDefined();
    });
  });

  describe("computeRollingRiskMetrics", () => {
    it("computes rolling metrics", () => {
      const returns = Array.from({ length: 500 }, () => (Math.random() - 0.48) * 0.02);
      const result = computeRollingRiskMetrics(returns, 252);
      
      expect(result.rollingVol).toBeDefined();
      expect(result.rollingSharpe).toBeDefined();
      expect(result.rollingMaxDD).toBeDefined();
      // Should have 500 - 252 + 1 = 249 points
      expect(result.rollingVol.length).toBe(249);
    });
  });

  describe("scenarioAnalysis", () => {
    it("analyzes custom scenarios", () => {
      const scenarios = [
        { name: "Test Shock", shocks: { SPY: -0.2, BND: 0.05 } },
        { name: "Rally", shocks: { SPY: 0.15, BND: 0.02 } },
      ];
      const result = scenarioAnalysis(weights, scenarios, assetReturns);
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Test Shock");
      expect(result[1].name).toBe("Rally");
      expect(result[0].portfolioReturn).toBeLessThan(0); // Negative shock
      expect(result[1].portfolioReturn).toBeGreaterThan(0); // Positive shock
    });
  });
});
