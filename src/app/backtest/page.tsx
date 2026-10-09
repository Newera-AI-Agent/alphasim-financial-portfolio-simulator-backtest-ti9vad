"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";

interface Asset {
  ticker: string;
  name: string;
  sector: string;
  expenseRatio: number;
  expectedReturn: number;
  volatility: number;
}

interface PortfolioAsset extends Asset {
  weight: number;
}

interface BacktestConfig {
  startDate: string;
  endDate: string;
  rebalanceFrequency: "monthly" | "quarterly" | "annually" | "none";
  initialCapital: number;
}

interface Trade {
  date: string;
  action: "buy" | "sell";
  ticker: string;
  shares: number;
  price: number;
  value: number;
}

interface BacktestResult {
  equityCurve: number[];
  dates: string[];
  drawdownSeries: number[];
  portfolioReturns: number[];
  rebalanceDates: string[];
  trades: Trade[];
  metrics: {
    cagr: number;
    volatility: number;
    sharpe: number;
    sortino: number;
    maxDrawdown: number;
    calmar: number;
    bestMonth: number;
    worstMonth: number;
    winRate: number;
  };
  monthlyReturns: Record<string, number>;
}

const STORAGE_KEY = "alphasim.portfolio";
const REBALANCE_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
  { value: "none", label: "No Rebalancing" },
] as const;

export default function BacktestPage() {
  const [universe, setUniverse] = useState<Asset[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioAsset[]>([]);
  const [config, setConfig] = useState<BacktestConfig>({
    startDate: "2015-01-01",
    endDate: new Date().toISOString().split("T")[0],
    rebalanceFrequency: "quarterly",
    initialCapital: 100000,
  });
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logScale, setLogScale] = useState(false);
  const [activeTab, setActiveTab] = useState<"charts" | "metrics" | "heatmap" | "trades">("charts");

  // Load universe data
  useEffect(() => {
    fetch("/data/universe.json")
      .then((res) => res.json())
      .then((data) => setUniverse(data))
      .catch(() => setError("Failed to load asset universe"));
  }, []);

  // Load portfolio from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setPortfolio(parsed);
        }
      }
    } catch {
      setError("Failed to load portfolio from storage");
    }
  }, []);

  const totalWeight = portfolio.reduce((sum, a) => sum + a.weight, 0);
  const isValid = portfolio.length >= 2 && totalWeight > 0.99 && totalWeight <= 1.01 && portfolio.every((a) => a.weight >= 0);

  const runBacktest = useCallback(async () => {
    if (!isValid) {
      setError("Portfolio must have at least 2 assets with weights summing to 100%");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolio, config }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Backtest failed");
      }

      const data = await response.json();
      setResult(data);
      setActiveTab("charts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backtest failed");
    } finally {
      setLoading(false);
    }
  }, [portfolio, config, isValid]);

  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
  const formatNumber = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatCurrency = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)]">
      {/* Navigation */}
      <nav className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center">
                  <span className="text-[var(--color-bg)] font-display font-bold text-lg">α</span>
                </div>
                <span className="font-display font-semibold text-xl">AlphaSim</span>
              </Link>
              <div className="hidden md:flex items-center gap-6">
                <Link href="/portfolio" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors text-sm font-medium">Portfolio</Link>
                <Link href="/backtest" className="text-[var(--color-accent)] font-medium text-sm">Backtest</Link>
                <Link href="/monte-carlo" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors text-sm font-medium">Monte Carlo</Link>
                <Link href="/risk" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors text-sm font-medium">Risk</Link>
                <Link href="/settings" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors text-sm font-medium">Settings</Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold">Historical Backtest</h1>
            <p className="text-[var(--color-fg-muted)] mt-1">Run deterministic backtests on historical price data</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-[var(--color-danger)]/20 border border-[var(--color-danger)]/50 text-[var(--color-danger)] text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 text-[var(--color-danger)] hover:text-[var(--color-fg)]">×</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Configuration Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Portfolio Summary */}
            <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
              <h2 className="font-display font-semibold text-lg mb-4">Portfolio</h2>
              {portfolio.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">📦</div>
                  <p className="text-[var(--color-fg-muted)] text-sm">No portfolio loaded</p>
                  <Link href="/portfolio" className="mt-3 inline-block text-[var(--color-accent)] text-sm font-medium hover:underline">Build Portfolio →</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {portfolio.map((a) => (
                    <div key={a.ticker} className="flex items-center justify-between text-sm">
                      <span className="font-mono font-medium">{a.ticker}</span>
                      <span className="text-[var(--color-accent)] font-mono">{formatPercent(a.weight)}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-sm font-medium">
                    <span>Total</span>
                    <span className={totalWeight === 1 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>
                      {formatPercent(totalWeight)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Backtest Configuration */}
            <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
              <h2 className="font-display font-semibold text-lg mb-4">Configuration</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[var(--color-fg-muted)] mb-1">Start Date</label>
                  <input
                    type="date"
                    value={config.startDate}
                    onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] text-sm"
                    max={config.endDate}
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-fg-muted)] mb-1">End Date</label>
                  <input
                    type="date"
                    value={config.endDate}
                    onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] text-sm"
                    min={config.startDate}
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-fg-muted)] mb-1">Rebalance Frequency</label>
                  <select
                    value={config.rebalanceFrequency}
                    onChange={(e) => setConfig({ ...config, rebalanceFrequency: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] text-sm"
                  >
                    {REBALANCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-fg-muted)] mb-1">Initial Capital</label>
                  <input
                    type="number"
                    value={config.initialCapital}
                    onChange={(e) => setConfig({ ...config, initialCapital: parseInt(e.target.value) })}
                    min="1000"
                    step="1000"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] text-sm font-mono"
                  />
                </div>
              </div>

              <button
                onClick={runBacktest}
                disabled={loading || !isValid}
                className="mt-6 w-full px-4 py-3 rounded-lg bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold text-sm hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Running..." : "Run Backtest"}
              </button>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-3 space-y-6">
            {result && (
              <>)
                {/* Tabs */}
                <div className="flex gap-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg p-1">
                  {[
                    { id: "charts", label: "Charts" },
                    { id: "metrics", label: "Metrics" },
                    { id: "heatmap", label: "Monthly Heatmap" },
                    { id: "trades", label: "Trade Log" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
                          : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Equity Curve & Drawdown */}
                {activeTab === "charts" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-display font-semibold">Equity Curve</h3>
                        <label className="flex items-center gap-2 text-sm text-[var(--color-fg-muted)]">
                          <input
                            type="checkbox"
                            checked={logScale}
                            onChange={(e) => setLogScale(e.target.checked)}
                            className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                          />
                          Log Scale
                        </label>
                      </div>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={result.equityCurve.map((v, i) => ({ value: v, date: result.dates[i] }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", year: "2-digit" })}
                              stroke="var(--color-fg-muted)"
                              fontSize={11}
                              interval="preserveStartEnd"
                            />
                            <YAxis
                              type="number"
                              tickFormatter={(v) => formatCurrency(v)}
                              stroke="var(--color-fg-muted)"
                              fontSize={11}
                              tickCount={5}
                            />
                            <Tooltip
                              formatter={(v: number) => [formatCurrency(v), "Portfolio Value"]}
                              contentStyle={{
                                backgroundColor: "var(--color-bg-elevated)",
                                border: "1px solid var(--color-border)",
                                borderRadius: "8px",
                              }}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke="var(--color-accent)"
                              strokeWidth={2}
                              dot={false}
                              name="Portfolio Value"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
                      <h3 className="font-display font-semibold mb-4">Drawdown</h3>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={result.drawdownSeries.map((v, i) => ({ value: v * 100, date: result.dates[i] }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", year: "2-digit" })}
                              stroke="var(--color-fg-muted)"
                              fontSize={11}
                              interval="preserveStartEnd"
                            />
                            <YAxis
                              tickFormatter={(v) => `${v.toFixed(1)}%`}
                              stroke="var(--color-fg-muted)"
                              fontSize={11}
                              tickCount={5}
                              domain={["auto", 0]}
                            />
                            <Tooltip
                              formatter={(v: number) => [`${v.toFixed(2)}%`, "Drawdown"]}
                              contentStyle={{
                                backgroundColor: "var(--color-bg-elevated)",
                                border: "1px solid var(--color-border)",
                                borderRadius: "8px",
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="value"
                              stroke="var(--color-danger)"
                              fill="var(--color-danger)"
                              fillOpacity={0.3}
                              strokeWidth={1}
                              name="Drawdown"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}

                {/* Metrics Cards */}
                {activeTab === "metrics" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard label="CAGR" value={formatPercent(result.metrics.cagr)} icon="📈" />
                    <MetricCard label="Volatility (Ann.)" value={formatPercent(result.metrics.volatility)} icon="📊" />
                    <MetricCard label="Sharpe Ratio" value={result.metrics.sharpe.toFixed(2)} icon="⚡" />
                    <MetricCard label="Sortino Ratio" value={result.metrics.sortino.toFixed(2)} icon="📉" />
                    <MetricCard label="Max Drawdown" value={formatPercent(result.metrics.maxDrawdown)} icon="🔻" variant="danger" />
                    <MetricCard label="Calmar Ratio" value={result.metrics.calmar.toFixed(2)} icon="⚖️" />
                    <MetricCard label="Best Month" value={formatPercent(result.metrics.bestMonth)} icon="🟢" variant="success" />
                    <MetricCard label="Worst Month" value={formatPercent(result.metrics.worstMonth)} icon="🔴" variant="danger" />
                    <MetricCard label="Win Rate" value={formatPercent(result.metrics.winRate)} icon="🎯" />
                    <MetricCard label="Final Value" value={formatCurrency(result.equityCurve[result.equityCurve.length - 1])} icon="💰" />
                    <MetricCard label="Total Return" value={formatPercent((result.equityCurve[result.equityCurve.length - 1] / config.initialCapital) - 1)} icon="📈" />
                    <MetricCard label="Rebalances" value={result.rebalanceDates.length.toString()} icon="🔄" />
                  </div>
                )}

                {/* Monthly Returns Heatmap */}
                {activeTab === "heatmap" && (
                  <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
                    <h3 className="font-display font-semibold mb-4">Monthly Returns Heatmap</h3>
                    <MonthlyHeatmap monthlyReturns={result.monthlyReturns} />
                  </div>
                )}

                {/* Trade Log */}
                {activeTab === "trades" && (
                  <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display font-semibold">Trade Log</h3>
                      <span className="text-[var(--color-fg-muted)] text-sm">{result.trades.length} trades</span>
                    </div>
                    {result.trades.length === 0 ? (
                      <p className="text-[var(--color-fg-muted)] text-center py-8">No trades (buy-and-hold or no rebalancing)</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-fg-muted)] font-medium">
                              <th className="pb-3 pr-4">Date</th>
                              <th className="pb-3 pr-4">Action</th>
                              <th className="pb-3 pr-4">Ticker</th>
                              <th className="pb-3 pr-4 text-right">Shares</th>
                              <th className="pb-3 pr-4 text-right">Price</th>
                              <th className="pb-3 pr-4 text-right">Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.trades.slice(0, 100).map((trade, i) => (
                              <tr key={i} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-bg-card)]/50">
                                <td className="py-2 pr-4 font-mono">{trade.date}</td>
                                <td className="py-2 pr-4">
                                  <span className={trade.action === "buy" ? "px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-success)]/20 text-[var(--color-success)]" : "px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-danger)]/20 text-[var(--color-danger)]"}>
                                    {trade.action.toUpperCase()}
                                  </span>
                                </td>
                                <td className="py-2 pr-4 font-mono font-medium">{trade.ticker}</td>
                                <td className="py-2 pr-4 text-right font-mono">{trade.shares.toFixed(4)}</td>
                                <td className="py-2 pr-4 text-right font-mono">${trade.price.toFixed(2)}</td>
                                <td className="py-2 pr-4 text-right font-mono">${trade.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              </tr>
                            ))}
                            {result.trades.length > 100 && (
                              <tr>
                                <td colSpan={6} className="py-4 text-center text-[var(--color-fg-muted)] text-sm">
                                  Showing first 100 of {result.trades.length} trades
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {!result && portfolio.length > 0 && !loading && (
              <div className="text-center py-16 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl">
                <div className="text-6xl mb-4">📈</div>
                <h3 className="font-display text-lg font-medium mb-2">Ready to backtest</h3>
                <p className="text-[var(--color-fg-muted)] text-sm">Configure parameters and click "Run Backtest"</p>
              </div>
            )}

            {!result && portfolio.length === 0 && (
              <div className="text-center py-16 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl">
                <div className="text-6xl mb-4">📦</div>
                <h3 className="font-display text-lg font-medium mb-2">No portfolio loaded</h3>
                <p className="text-[var(--color-fg-muted)] text-sm mb-4">Build a portfolio first</p>
                <Link href="/portfolio" className="inline-block px-4 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--color-bg)] font-medium text-sm hover:bg-[var(--color-accent-hover)] transition-colors">
                  Go to Portfolio Builder
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ label, value, icon, variant = "default" }: { label: string; value: string; icon: string; variant?: "default" | "success" | "danger" }) {
  const colors = {
    default: "text-[var(--color-fg)]",
    success: "text-[var(--color-success)]",
    danger: "text-[var(--color-danger)]",
  };
  return (
    <div className="p-4 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-[var(--color-fg-muted)] text-xs">{label}</span>
      </div>
      <div className={`font-mono font-semibold ${colors[variant]}`}>{value}</div>
    </div>
  );
}

function MonthlyHeatmap({ monthlyReturns }: { monthlyReturns: Record<string, number> }) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const years = Object.keys(monthlyReturns)
    .map((k) => k.split("-")[0])
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort();

  const getColor = (value: number) => {
    if (value > 0.05) return "var(--color-success)";
    if (value > 0) return "var(--color-success)";
    if (value < -0.05) return "var(--color-danger)";
    if (value < 0) return "var(--color-danger)";
    return "var(--color-fg-muted)";
  };

  const getOpacity = (value: number) => {
    const abs = Math.abs(value);
    if (abs > 0.1) return 0.9;
    if (abs > 0.05) return 0.6;
    if (abs > 0.02) return 0.4;
    return 0.2;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="pb-2 pr-4 text-left text-[var(--color-fg-muted)] font-medium">Year</th>
            {months.map((m) => (
              <th key={m} className="pb-2 px-2 text-center text-[var(--color-fg-muted)] font-medium w-10">{m}</th>
            ))}
            <th className="pb-2 pl-4 text-right text-[var(--color-fg-muted)] font-medium">Annual</th>
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year}>
              <td className="pr-4 font-mono text-[var(--color-fg-muted)]">{year}</td>
              <React.Fragment>
              {months.map((month, mi) => {
                const key = `${year}-${String(mi + 1).padStart(2, "0")}`;
                const value = monthlyReturns[key] ?? 0;
                const hasData = key in monthlyReturns;
                return (
                  <td key={key} className="px-2 text-center h-8">
                    {hasData ? (
                      <div
                        className="w-full h-full rounded"
                        style={{
                          backgroundColor: getColor(value),
                          opacity: getOpacity(value),
                        }}
                        title={`${months[mi]} ${year}: ${(value * 100).toFixed(2)}%`}
                      >
                        <span
                          className="block text-[10px] font-mono"
                          style={{ color: Math.abs(value) > 0.03 ? "white" : "var(--color-fg)" }}
                        >
                          {(value * 100).toFixed(1)}%
                        </span>
                      </div>
                    ) : null}
                  </td>
                )
              })}
              </React.Fragment>
              <td className="pl-4 text-right font-mono">
                {(() => {
                  const annualSum = Object.entries(monthlyReturns)
                    .filter(([k]) => k.startsWith(year))
                    .reduce((sum, [, v]) => sum + v, 0);
                  if (annualSum === 0) return null;
                  return (
                    <span
                      className={annualSum > 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}
                    >
                      {annualSum.toFixed(2)}%
                    </span>
                  );
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}