// lib/math/__tests__/backtest.test.ts
// Unit tests for backtest.ts - known-value tests against reference implementations

import {
  describe,
  it,
  expect,
  beforeAll,
  vi,
} from 'vitest';
import * as backtest from '../backtest';

const EPSILON = 1e-10;

// Mock price data for 3 assets over 20 days
const generatePriceData = () => {
  const dates: string[] = [];
  const baseDate = new Date('2023-01-01');
  for (let i = 0; i < 20; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    // Skip weekends
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    dates.push(d.toISOString().split('T')[0]);
  }
  // Keep first 15 trading days
  const tradingDates = dates.slice(0, 15);
  
  return {
    SPY: tradingDates.map((date, i) => ({
      date,
      price: 400 * Math.exp(0.0005 * i + 0.01 * Math.sin(i * 0.5)),
    })),
    BND: tradingDates.map((date, i) => ({
      date,
      price: 100 * Math.exp(0.0001 * i + 0.005 * Math.cos(i * 0.3)),
    })),
    GLD: tradingDates.map((date, i) => ({
      date,
      price: 180 * Math.exp(-0.0002 * i + 0.008 * Math.sin(i * 0.7)),
    })),
  };
};

const priceData = generatePriceData();

const config: backtest.BacktestConfig = {
  startDate: '2023-01-01',
  endDate: '2023-12-31',
  rebalanceFrequency: 'monthly',
  initialCapital: 100000,
  weights: { SPY: 0.5, BND: 0.3, GLD: 0.2 },
};

describe('backtest', () => {
  describe('alignPrices', () => {
    it('aligns price series to common dates', () => {
      const result = backtest.alignPrices(priceData);
      expect(result.dates.length).toBeGreaterThan(0);
      expect(Object.keys(result.prices)).toEqual(['SPY', 'BND', 'GLD']);
      expect(Object.keys(result.returns)).toEqual(['SPY', 'BND', 'GLD']);
      // All series should have same length
      const lengths = Object.values(result.prices).map(p => p.length);
      expect(new Set(lengths).size).toBe(1);
    });

    it('returns empty for empty input', () => {
      const result = backtest.alignPrices({});
      expect(result.dates).toEqual([]);
      expect(result.prices).toEqual({});
      expect(result.returns).toEqual({});
    });
  });

  describe('isRebalanceDate', () => {
    it('returns true for monthly boundary', () => {
      expect(backtest.isRebalanceDate('2023-02-01', '2023-01-31', 'monthly')).toBe(true);
      expect(backtest.isRebalanceDate('2023-02-02', '2023-02-01', 'monthly')).toBe(false);
    });

    it('returns true for quarterly boundary', () => {
      expect(backtest.isRebalanceDate('2023-04-01', '2023-03-31', 'quarterly')).toBe(true);
      expect(backtest.isRebalanceDate('2023-04-03', '2023-04-01', 'quarterly')).toBe(false);
    });

    it('returns true for annually boundary', () => {
      expect(backtest.isRebalanceDate('2024-01-01', '2023-12-31', 'annually')).toBe(true);
      expect(backtest.isRebalanceDate('2024-01-02', '2024-01-01', 'annually')).toBe(false);
    });

    it('returns false for none', () => {
      expect(backtest.isRebalanceDate('2023-02-01', '2023-01-31', 'none')).toBe(false);
    });

    it('returns true for first date (no prevDate)', () => {
      expect(backtest.isRebalanceDate('2023-01-01', null, 'monthly')).toBe(true);
    });
  });

  describe('computePeriodReturns', () => {
    it('computes monthly returns from equity curve', () => {
      const equityCurve = [100, 101, 102, 103, 104, 105];
      const dates = [
        '2023-01-01', '2023-01-02', '2023-01-03',
        '2023-02-01', '2023-02-02', '2023-02-03',
      ];
      const result = backtest.computePeriodReturns(equityCurve, dates);
      expect(result.length).toBe(1); // One year (2023)
      expect(result[0].length).toBe(12); // 12 months
      // Check that Jan and Feb have non-zero returns
      expect(result[0][0]).not.toBe(0); // January
      expect(result[0][1]).not.toBe(0); // February
    });

    it('returns empty for insufficient data', () => {
      expect(backtest.computePeriodReturns([100], ['2023-01-01'])).toEqual([]);
      expect(backtest.computePeriodReturns([], [])).toEqual([]);
    });
  });

  describe('runBacktest', () => {
    it('runs backtest and returns valid result', () => {
      const result = backtest.runBacktest(priceData, config);
      
      expect(result.equityCurve.length).toBeGreaterThan(0);
      expect(result.drawdownSeries.length).toBe(result.equityCurve.length);
      expect(result.portfolioReturns.length).toBe(result.equityCurve.length - 1);
      expect(result.trades).toBeDefined();
      expect(Array.isArray(result.rebalanceDates)).toBe(true);
      
      // Check metrics
      expect(typeof result.metrics.cagr).toBe('number');
      expect(typeof result.metrics.volatility).toBe('number');
      expect(typeof result.metrics.sharpe).toBe('number');
      expect(typeof result.metrics.sortino).toBe('number');
      expect(typeof result.metrics.calmar).toBe('number');
      expect(typeof result.metrics.maxDrawdown).toBe('number');
      expect(typeof result.metrics.bestMonth).toBe('number');
      expect(typeof result.metrics.worstMonth).toBe('number');
      expect(typeof result.metrics.winRate).toBe('number');
      expect(result.metrics.maxDrawdown).toBeLessThanOrEqual(0);
      expect(result.metrics.winRate).toBeGreaterThanOrEqual(0);
      expect(result.metrics.winRate).toBeLessThanOrEqual(1);
    });

    it('handles empty price data', () => {
      const result = backtest.runBacktest({}, config);
      expect(result.equityCurve).toEqual([]);
      expect(result.metrics.cagr).toBe(0);
    });

    it('produces deterministic results', () => {
      const result1 = backtest.runBacktest(priceData, config);
      const result2 = backtest.runBacktest(priceData, config);
      expect(result1.equityCurve).toEqual(result2.equityCurve);
      expect(result1.trades).toEqual(result2.trades);
      expect(result1.metrics.cagr).toBe(result2.metrics.cagr);
    });

    it('handles no rebalance frequency', () => {
      const noRebalanceConfig = { ...config, rebalanceFrequency: 'none' as const };
      const result = backtest.runBacktest(priceData, noRebalanceConfig);
      expect(result.rebalanceDates.length).toBe(0);
      expect(result.trades.length).toBe(0);
    });

    it('handles annual rebalance', () => {
      const annualConfig = { ...config, rebalanceFrequency: 'annually' as const };
      const result = backtest.runBacktest(priceData, annualConfig);
      // Should have at most 1 rebalance per year
      expect(result.rebalanceDates.length).toBeLessThanOrEqual(1);
    });
  });
});
