/**
 * Unit tests for backtest module
 */
import { describe, it, expect } from "vitest";
import {
  alignSeries,
  computeDailyReturns,
  applyWeights,
  rebalancePortfolio,
  runBacktest,
  computeMetrics,
  computeMonthlyReturns,
  computeTradeLog,
} from "../backtest";

describe("backtest", () => {
  describe("alignSeries", () => {
    it("aligns multiple series to common dates", () => {
      const series = {
        SPY: [
          { date: "2020-01-01", price: 100 },
          { date: "2020-01-02", price: 101 },
          { date: "2020-01-03", price: 102 },
        ],
        BND: [
          { date: "2020-01-01", price: 50 },
          { date: "2020-01-02", price: 50.5 },
          { date: "2020-01-06", price: 51 }, // Missing 2020-01-03
        ],
      };
      const aligned = alignSeries(series);
      // Should only have dates present in both
      expect(aligned.dates).toEqual(["2020-01-01", "2020-01-02"]);
      expect(aligned.data.SPY).toHaveLength(2);
      expect(aligned.data.BND).toHaveLength(2);
    });
    it("handles empty series", () => {
      expect(alignSeries({})).toEqual({ dates: [], data: {} });
    });
    it("handles single series", () => {
      const series = {
        SPY: [{ date: "2020-01-01", price: 100 }],
      };
      const aligned = alignSeries(series);
      expect(aligned.dates).toEqual(["2020-01-01"]);
      expect(aligned.data.SPY).toEqual([100]);
    });
  });

  describe("computeDailyReturns", () => {
    it("computes log returns correctly", () => {
      const prices = [100, 105, 102, 108];
      const returns = computeDailyReturns(prices);
      expect(returns).toHaveLength(3);
      expect(returns[0]).toBeCloseTo(Math.log(105 / 100), 10);
      expect(returns[1]).toBeCloseTo(Math.log(102 / 105), 10);
      expect(returns[2]).toBeCloseTo(Math.log(108 / 102), 10);
    });
    it("handles single price", () => {
      expect(computeDailyReturns([100])).toEqual([]);
    });
  });

  describe("applyWeights", () => {
    it("applies weights to asset returns", () => {
      const assetReturns = {
        SPY: [0.01, 0.02, -0.01],
        BND: [0.001, 0.002, 0.001],
      };
      const weights = { SPY: 0.6, BND: 0.4 };
      const portfolioReturns = applyWeights(assetReturns, weights);
      expect(portfolioReturns).toHaveLength(3);
      // Day 0: 0.6 * 0.01 + 0.4 * 0.001 = 0.006 + 0.0004 = 0.0064
      expect(portfolioReturns[0]).toBeCloseTo(0.0064, 10);
      // Day 1: 0.6 * 0.02 + 0.4 * 0.002 = 0.012 + 0.0008 = 0.0128
      expect(portfolioReturns[1]).toBeCloseTo(0.0128, 10);
      // Day 2: 0.6 * -0.01 + 0.4 * 0.001 = -0.006 + 0.0004 = -0.0056
      expect(portfolioReturns[2]).toBeCloseTo(-0.0056, 10);
    });
  });

  describe("rebalancePortfolio", () => {
    it("rebalances at period boundaries", () => {
      const returns = [0.01, 0.02, -0.01, 0.015, -0.005];
      const weights = { SPY: 0.6, BND: 0.4 };
      // Monthly rebalance - every ~21 days
      // With 5 days, no rebalance happens
      const { portfolioReturns, rebalanceDates } = rebalancePortfolio(
        { SPY: returns, BND: returns.map((r) => r * 0.1) },
        weights,
        "monthly",
        ["2020-01-01", "2020-01-02", "2020-01-03", "2020-01-06", "2020-01-07"]
      );
      expect(portfolioReturns).toHaveLength(5);
      expect(rebalanceDates).toHaveLength(0); // Not enough days for monthly
    });
  });

  describe("runBacktest", () => {
    it("runs a complete backtest", () => {
      const prices = {
        SPY: [
          { date: "2020-01-01", price: 100 },
          { date: "2020-01-02", price: 101 },
          { date: "2020-01-03", price: 102 },
          { date: "2020-01-06", price: 103 },
          { date: "2020-01-07", price: 104 },
        ],
        BND: [
          { date: "2020-01-01", price: 50 },
          { date: "2020-01-02", price: 50.1 },
          { date: "2020-01-03", price: 50.2 },
          { date: "2020-01-06", price: 50.3 },
          { date: "2020-01-07", price: 50.4 },
        ],
      };
      const weights = { SPY: 0.6, BND: 0.4 };
      const result = runBacktest({
        prices,
        weights,
        startDate: "2020-01-01",
        endDate: "2020-01-07",
        rebalanceFreq: "none",
        initialCapital: 100000,
      });

      expect(result.equityCurve).toHaveLength(5);
      expect(result.equityCurve[0]).toBeCloseTo(100000, 0);
      expect(result.drawdownSeries).toHaveLength(5);
      expect(result.metrics).toBeDefined();
      expect(result.tradeLog).toBeDefined();
    });

    it("produces deterministic results", () => {
      const prices = {
        SPY: [
          { date: "2020-01-01", price: 100 },
          { date: "2020-01-02", price: 101 },
          { date: "2020-01-03", price: 102 },
        ],
        BND: [
          { date: "2020-01-01", price: 50 },
          { date: "2020-01-02", price: 50.1 },
          { date: "2020-01-03", price: 50.2 },
        ],
      };
      const weights = { SPY: 0.6, BND: 0.4 };
      const result1 = runBacktest({
        prices,
        weights,
        startDate: "2020-01-01",
        endDate: "2020-01-03",
        rebalanceFreq: "none",
        initialCapital: 100000,
      });
      const result2 = runBacktest({
        prices,
        weights,
        startDate: "2020-01-01",
        endDate: "2020-01-03",
        rebalanceFreq: "none",
        initialCapital: 100000,
      });
      // Results should be bit-identical
      expect(result1.equityCurve).toEqual(result2.equityCurve);
      expect(result1.metrics.cagr).toBe(result2.metrics.cagr);
    });
  });

  describe("computeMetrics", () => {
    it("computes all metrics correctly", () => {
      const equityCurve = [100000, 105000, 102000, 108000];
      const drawdownSeries = [0, 0, (105000 - 102000) / 105000, 0];
      const periodReturns = [0.05, -0.02857, 0.05882];
      const metrics = computeMetrics(equityCurve, drawdownSeries, periodReturns, 1);

      expect(metrics.cagr).toBeDefined();
      expect(metrics.volatility).toBeDefined();
      expect(metrics.sharpe).toBeDefined();
      expect(metrics.sortino).toBeDefined();
      expect(metrics.maxDrawdown).toBeCloseTo((105000 - 102000) / 105000, 5);
      expect(metrics.calmar).toBeDefined();
      expect(metrics.bestMonth).toBeDefined();
      expect(metrics.worstMonth).toBeDefined();
      expect(metrics.winRate).toBeDefined();
    });
  });

  describe("computeMonthlyReturns", () => {
    it("computes monthly returns heatmap data", () => {
      // Create ~2 years of daily data
      const dates: string[] = [];
      const equity: number[] = [100];
      let value = 100;
      for (let m = 0; m < 24; m++) {
        for (let d = 0; d < 21; d++) {
          const date = new Date(2020, m, d + 1);
          if (date.getDay() !== 0 && date.getDay() !== 6) {
            dates.push(date.toISOString().split("T")[0]);
            value *= 1 + (Math.random() - 0.48) * 0.02; // slight positive drift
            equity.push(value);
          }
        }
      }
      const monthly = computeMonthlyReturns(equity, dates);
      expect(Object.keys(monthly).length).toBeGreaterThan(0);
      // Check structure
      for (const [key, val] of Object.entries(monthly)) {
        expect(key).toMatch(/^\d{4}-\d{2}$/);
        expect(typeof val).toBe("number");
      }
    });
  });
});
