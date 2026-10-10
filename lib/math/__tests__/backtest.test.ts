/**
 * Unit tests for backtest module
 */
import { describe, it, expect } from "vitest";
import {
  alignSeries,
  computeDailyReturns,
  applyWeights,
  isRebalanceDate,
  rebalancePortfolio,
  runBacktest,
  computeMetrics,
  computeMonthlyReturns,
} from "../backtest";
import { computePeriodReturns } from "../portfolio";

// Helper to create PriceSeries from array
function createPriceSeries(prices: Array<{ date: string; price: number }>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const { date, price } of prices) {
    result[date] = price;
  }
  return result;
}

describe("backtest", () => {
  describe("alignSeries", () => {
    it("aligns multiple series to common dates", () => {
      const series = {
        SPY: createPriceSeries([
          { date: "2020-01-01", price: 100 },
          { date: "2020-01-02", price: 101 },
          { date: "2020-01-03", price: 102 },
        ]),
        BND: createPriceSeries([
          { date: "2020-01-01", price: 50 },
          { date: "2020-01-02", price: 50.5 },
          { date: "2020-01-06", price: 51 }, // Missing 2020-01-03
        ]),
      };
      const aligned = alignSeries(series);
      // Should only have dates present in both
      expect(aligned.dates).toEqual(["2020-01-01", "2020-01-02"]);
      expect(aligned.prices[0]).toHaveLength(2); // SPY
      expect(aligned.prices[1]).toHaveLength(2); // BND
      expect(aligned.tickers).toEqual(["SPY", "BND"]);
    });
    it("handles empty series", () => {
      expect(alignSeries({})).toEqual({ dates: [], prices: [], tickers: [] });
    });
    it("handles single series", () => {
      const series = {
        SPY: createPriceSeries([{ date: "2020-01-01", price: 100 }]),
      };
      const aligned = alignSeries(series);
      expect(aligned.dates).toEqual(["2020-01-01"]);
      expect(aligned.prices[0]).toEqual([100]);
      expect(aligned.tickers).toEqual(["SPY"]);
    });
  });

  describe("computeDailyReturns", () => {
    it("computes log returns correctly", () => {
      const prices = [[100, 105, 102, 108]];
      const returns = computeDailyReturns(prices);
      expect(returns).toHaveLength(1);
      expect(returns[0]).toHaveLength(3);
      expect(returns[0][0]).toBeCloseTo(Math.log(105 / 100), 10);
      expect(returns[0][1]).toBeCloseTo(Math.log(102 / 105), 10);
      expect(returns[0][2]).toBeCloseTo(Math.log(108 / 102), 10);
    });
    it("handles single price", () => {
      expect(computeDailyReturns([[100]])).toEqual([[]]);
    });
  });

  describe("applyWeights", () => {
    it("applies weights to asset returns", () => {
      const assetReturns = [
        [0.01, 0.02, -0.01], // SPY
        [0.001, 0.002, 0.001], // BND
      ];
      const weights = { SPY: 0.6, BND: 0.4 };
      const tickers = ["SPY", "BND"];
      const portfolioReturns = applyWeights(assetReturns, weights, tickers);
      expect(portfolioReturns).toHaveLength(3);
      // Day 0: 0.6 * 0.01 + 0.4 * 0.001 = 0.006 + 0.0004 = 0.0064
      expect(portfolioReturns[0]).toBeCloseTo(0.0064, 10);
      // Day 1: 0.6 * 0.02 + 0.4 * 0.002 = 0.012 + 0.0008 = 0.0128
      expect(portfolioReturns[1]).toBeCloseTo(0.0128, 10);
      // Day 2: 0.6 * -0.01 + 0.4 * 0.001 = -0.006 + 0.0004 = -0.0056
      expect(portfolioReturns[2]).toBeCloseTo(-0.0056, 10);
    });
  });

  describe("isRebalanceDate", () => {
    it("detects monthly rebalance boundaries", () => {
      expect(isRebalanceDate("2020-02-01", "2020-01-31", "monthly")).toBe(true);
      expect(isRebalanceDate("2020-01-02", "2020-01-01", "monthly")).toBe(false);
    });
    it("detects quarterly rebalance boundaries", () => {
      expect(isRebalanceDate("2020-04-01", "2020-03-31", "quarterly")).toBe(true);
      expect(isRebalanceDate("2020-02-01", "2020-01-31", "quarterly")).toBe(false);
    });
    it("detects annually rebalance boundaries", () => {
      expect(isRebalanceDate("2021-01-01", "2020-12-31", "annually")).toBe(true);
      expect(isRebalanceDate("2020-06-01", "2020-05-31", "annually")).toBe(false);
    });
    it("returns false for none frequency", () => {
      expect(isRebalanceDate("2020-02-01", "2020-01-31", "none")).toBe(false);
    });
    it("returns true for first date (no prevDate)", () => {
      expect(isRebalanceDate("2020-01-01", null, "monthly")).toBe(true);
    });
  });

  describe("rebalancePortfolio", () => {
    it("returns equity curve and trades", () => {
      const portfolioReturns = [0.01, 0.02, -0.01, 0.015, -0.005];
      const assetReturns = [
        portfolioReturns, // SPY
        portfolioReturns.map((r) => r * 0.1), // BND
      ];
      const weights = { SPY: 0.6, BND: 0.4 };
      const tickers = ["SPY", "BND"];
      const dates = ["2020-01-01", "2020-01-02", "2020-01-03", "2020-01-06", "2020-01-07", "2020-01-08"];
      
      const { equityCurve, trades } = rebalancePortfolio(
        portfolioReturns,
        assetReturns,
        weights,
        tickers,
        dates,
        "none"
      );
      expect(equityCurve).toHaveLength(6); // initial + 5 returns
      expect(equityCurve[0]).toBe(1);
      expect(trades).toHaveLength(0); // no rebalance with "none"
    });
  });

  describe("runBacktest", () => {
    it("runs a complete backtest", () => {
      const priceData = {
        SPY: createPriceSeries([
          { date: "2020-01-01", price: 100 },
          { date: "2020-01-02", price: 101 },
          { date: "2020-01-03", price: 102 },
          { date: "2020-01-06", price: 103 },
          { date: "2020-01-07", price: 104 },
        ]),
        BND: createPriceSeries([
          { date: "2020-01-01", price: 50 },
          { date: "2020-01-02", price: 50.1 },
          { date: "2020-01-03", price: 50.2 },
          { date: "2020-01-06", price: 50.3 },
          { date: "2020-01-07", price: 50.4 },
        ]),
      };
      const input = {
        tickers: ["SPY", "BND"],
        weights: { SPY: 0.6, BND: 0.4 },
        startDate: "2020-01-01",
        endDate: "2020-01-07",
        rebalanceFrequency: "none" as const,
        initialCapital: 100000,
      };
      const result = runBacktest(input, priceData);

      expect(result.equityCurve).toHaveLength(5);
      expect(result.equityCurve[0]).toBeCloseTo(100000, 0);
      expect(result.drawdown).toHaveLength(5);
      expect(result.metrics).toBeDefined();
      expect(result.trades).toBeDefined();
      expect(result.dates).toHaveLength(5);
      expect(result.periodReturns).toBeDefined();
      expect(result.seed).toBe("deterministic");
    });

    it("produces deterministic results", () => {
      const priceData = {
        SPY: createPriceSeries([
          { date: "2020-01-01", price: 100 },
          { date: "2020-01-02", price: 101 },
          { date: "2020-01-03", price: 102 },
        ]),
        BND: createPriceSeries([
          { date: "2020-01-01", price: 50 },
          { date: "2020-01-02", price: 50.1 },
          { date: "2020-01-03", price: 50.2 },
        ]),
      };
      const input = {
        tickers: ["SPY", "BND"],
        weights: { SPY: 0.6, BND: 0.4 },
        startDate: "2020-01-01",
        endDate: "2020-01-03",
        rebalanceFrequency: "none" as const,
        initialCapital: 100000,
      };
      const result1 = runBacktest(input, priceData);
      const result2 = runBacktest(input, priceData);
      // Results should be bit-identical
      expect(result1.equityCurve).toEqual(result2.equityCurve);
      expect(result1.metrics.cagr).toBe(result2.metrics.cagr);
    });
  });

  describe("computeMetrics", () => {
    it("computes all metrics correctly", () => {
      const equityCurve = [100000, 105000, 102000, 108000];
      const dates = ["2020-01-01", "2020-01-02", "2020-01-03", "2020-01-04"];
      const metrics = computeMetrics(equityCurve, dates);

      expect(metrics.cagr).toBeDefined();
      expect(metrics.volatility).toBeDefined();
      expect(metrics.sharpe).toBeDefined();
      expect(metrics.sortino).toBeDefined();
      expect(metrics.maxDrawdown).toBeCloseTo((105000 - 102000) / 105000, 5);
      expect(metrics.calmar).toBeDefined();
      expect(metrics.bestMonth).toBeDefined();
      expect(metrics.worstMonth).toBeDefined();
      expect(metrics.winRate).toBeDefined();
      expect(metrics.totalReturn).toBeCloseTo(0.08, 3);
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
      expect(monthly.length).toBeGreaterThan(0);
      expect(monthly[0]).toHaveProperty("year");
      expect(monthly[0]).toHaveProperty("month");
      expect(monthly[0]).toHaveProperty("return");
    });
  });

  describe("computePeriodReturns", () => {
    it("computes period returns from equity curve", () => {
      const equityCurve = [100, 105, 102, 108];
      const dates = ["2020-01-01", "2020-01-02", "2020-01-03", "2020-01-04"];
      const returns = computePeriodReturns(equityCurve, dates);
      expect(returns).toHaveLength(3);
      expect(returns[0].return).toBeCloseTo(0.05, 5);
      expect(returns[1].return).toBeCloseTo(-0.02857, 3);
      expect(returns[2].return).toBeCloseTo(0.05882, 3);
    });
  });
});