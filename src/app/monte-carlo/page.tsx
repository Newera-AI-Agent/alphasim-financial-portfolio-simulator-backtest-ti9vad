"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";

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

interface MonteCarloConfig {
  numPaths: number;
  horizonMonths: number;
  returnModel: "parametric" | "bootstrap";
  correlationStructure: "historical" | "constant" | "shrinkage";
  randomSeed: number;
}

interface MonteCarloResult {
  paths: number[][];
  fanChart: {
    median: number[];
    p10: number[];
    p90: number[];
    p5: number[];
    p95: number[];
  };
  terminalWealth: number[];
  histogram: { bin: number; count: number }[];
  metrics: {
    probLoss: number;
    prob2x: number;
    prob10x: number;
    var95: number;
    var99: number;
    cvar95: number;
    cvar99: number;
  };
  pathSummary: {
    index: number;
    finalValue: number;
    maxDrawdown: number;
    cagr: number;
  }[];
}

const STORAGE_KEY = "alphasim.portfolio";

export default function MonteCarloPage() {
  const [universe, setUniverse] = useState<Asset[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioAsset[]>([]);
  const [config, setConfig] = useState<MonteCarloConfig>({
    numPaths: 200,
    horizonMonths: 12,
    returnModel: "parametric",
    correlationStructure: "historical",
    randomSeed: 42,
  });
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<"fan" | "histogram" | "metrics" | "paths">("fan");
  const workerRef = useRef<Worker | null>(null);

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

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const totalWeight = portfolio.reduce((sum, a) => sum + a.weight, 0);
  const isValid = portfolio.length >= 2 && totalWeight > 0.99 && totalWeight <= 1.01 && portfolio.every((a) => a.weight >= 0);

  const runMonteCarlo = useCallback(async () => {
    if (!isValid) {
      setError("Portfolio must have at least 2 assets with weights summing to 100%");
      return;
    }

    setLoading(true);
    setProgress(0);
    setError(null);

    try {
      // Use Web Worker for large simulations
      if (config.numPaths > 500) {
        await runWithWorker();
      } else {
        await runDirect();
      }
      setActiveTab("fan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }, [portfolio, config, isValid]);

  const runDirect = async () => {
    const response = await fetch("/api/monte-carlo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portfolio, config }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Simulation failed");
    }

    const data = await response.json();
    setResult(data);
  };

  const runWithWorker = async () => {
    return new Promise<void>((resolve, reject) => {
      const worker = new Worker(new URL("../../workers/monte-carlo.worker.ts", import.meta.url), { type: "module" });
      workerRef.current = worker;

      worker.postMessage({ portfolio, config });

      worker.onmessage = (e) => {
        if (e.data.type === "progress") {
          setProgress(e.data.progress);
        } else if (e.data.type === "result") {
          setResult(e.data.result);
          worker.terminate();
          workerRef.current = null;
          resolve();
        } else if (e.data.type === "error") {
          worker.terminate();
          workerRef.current = null;
          reject(new Error(e.data.error));
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        workerRef.current = null;
        reject(err);
      };
    });
  };

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
                <Link href="/backtest" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors text-sm font-medium">Backtest</Link>
                <Link href="/monte-carlo" className="text-[var(--color-accent)] font-medium text-sm">Monte Carlo</Link>
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
            <h1 className="font-display text-3xl font-bold">Monte Carlo Simulation</h1>
            <p className="text-[var(--color-fg-muted)] mt-1">Simulate future portfolio paths with parametric and bootstrap models</p>
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

            {/* Simulation Configuration */}
            <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
              <h2 className="font-display font-semibold text-lg mb-4">Simulation Config</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[var(--color-fg-muted)] mb-1">Number of Paths</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="100"
                      max="10000"
                      step="100"
                      value={config.numPaths}
                      onChange={(e) => setConfig({ ...config, numPaths: parseInt(e.target.value) })}
                      className="flex-1 accent-[var(--color-accent)]"
                    />
                    <span className="font-mono text-sm w-16 text-right">{config.numPaths}</span>
                  </div>
                  <p className="text-[var(--color-fg-muted)] text-xs mt-1">&gt;500 uses Web Worker</p>
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-fg-muted)] mb-1">Horizon (Months)</label>
                  <input
                    type="number"
                    value={config.horizonMonths}
                    onChange={(e) => setConfig({ ...config, horizonMonths: parseInt(e.target.value) })}
                    min="1"
                    max="120"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-fg-muted)] mb-1">Return Model</label>
                  <select
                    value={config.returnModel}
                    onChange={(e) => setConfig({ ...config, returnModel: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] text-sm"
                  >
                    <option value="parametric">Parametric (GBM + Cholesky)</option>
                    <option value="bootstrap">Bootstrap (Block Resampling)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-fg-muted)] mb-1">Correlation Structure</label>
                  <select
                    value={config.correlationStructure}
                    onChange={(e) => setConfig({ ...config, correlationStructure: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] text-sm"
                  >
                    <option value="historical">Historical</option>
                    <option value="constant">Constant</option>
                    <option value="shrinkage">Ledoit-Wolf Shrinkage</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-fg-muted)] mb-1">Random Seed</label>
                  <input
                    type="number"
                    value={config.randomSeed}
                    onChange={(e) => setConfig({ ...config, randomSeed: parseInt(e.target.value) })}
                    min="0"
                    max="2147483647"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] text-sm font-mono"
                  />
                </div>
              </div>

              <button
                onClick={runMonteCarlo}
                disabled={loading || !isValid}
                className="mt-6 w-full px-4 py-3 rounded-lg bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold text-sm hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                      Running... {progress}%
                    </span>
                  </>
                ) : (
                  "Run Simulation"
                )}
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
                    { id: "fan", label: "Fan Chart" },
                    { id: "histogram", label: "Terminal Wealth" },
                    { id: "metrics", label: "Risk Metrics" },
                    { id: "paths", label: "Path Table" },
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

                {/* Fan Chart */}
                {activeTab === "fan" && (
                  <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
                    <h3 className="font-display font-semibold mb-4">Fan Chart - Portfolio Value Paths</h3>
                    <p className="text-[var(--color-fg-muted)] text-sm mb-4">Median with 10/90 and 5/95 percentile bands</p>
                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={result.fanChart.median.map((v, i) => ({
                          median: v,
                          p10: result.fanChart.p10[i],
                          p90: result.fanChart.p90[i],
                          p5: result.fanChart.p5[i],
                          p95: result.fanChart.p95[i],
                          month: i + 1,
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                          <XAxis
                            dataKey="month"
                            tickFormatter={(v) => `M${v}`}
                            stroke="var(--color-fg-muted)"
                            fontSize={11}
                            interval={Math.max(1, Math.floor(config.horizonMonths / 10))}
                          />
                          <YAxis
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
                          <Area type="monotone" dataKey="p5" stroke="var(--color-accent)" fill="var(--color-accent)" fillOpacity={0.1} name="5-95%" />
                          <Area type="monotone" dataKey="p95" stroke="var(--color-accent)" fill="var(--color-accent)" fillOpacity={0.1} />
                          <Area type="monotone" dataKey="p10" stroke="var(--color-accent)" fill="var(--color-accent)" fillOpacity={0.2} name="10-90%" />
                          <Area type="monotone" dataKey="p90" stroke="var(--color-accent)" fill="var(--color-accent)" fillOpacity={0.2} />
                          <Line type="monotone" dataKey="median" stroke="var(--color-accent)" strokeWidth={2} dot={false} name="Median" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 flex gap-6 text-xs text-[var(--color-fg-muted)]">
                      <span>▬ Median</span>
                      <span>■■ 10-90%</span>
                      <span>■■ 5-95%</span>
                    </div>
                  </div>
                )}

                {/* Terminal Wealth Histogram */}
                {activeTab === "histogram" && (
                  <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
                    <h3 className="font-display font-semibold mb-4">Terminal Wealth Distribution</h3>
                    <p className="text-[var(--color-fg-muted)] text-sm mb-4">Histogram of final portfolio values across all simulated paths</p>
                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={result.histogram}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                          <XAxis
                            dataKey="bin"
                            tickFormatter={(v) => formatCurrency(v)}
                            stroke="var(--color-fg-muted)"
                            fontSize={11}
                            tickCount={8}
                          />
                          <YAxis stroke="var(--color-fg-muted)" fontSize={11} tickCount={5} />
                          <Tooltip
                            formatter={(v: number, name: string) => [v.toLocaleString(), name]}
                            contentStyle={{
                              backgroundColor: "var(--color-bg-elevated)",
                              border: "1px solid var(--color-border)",
                              borderRadius: "8px",
                            }}
                          />
                          <Legend />
                          <Bar
                            dataKey="count"
                            fill="var(--color-accent)"
                            radius={[4, 4, 0, 0]}
                            name="Paths"
                          >
                            {result.histogram.map((entry, i) => (
                              <Cell key={i} fill={entry.bin < 100000 ? "var(--color-danger)" : "var(--color-accent)"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-4 text-sm text-[var(--color-fg-muted)]">
                      <span>■ Below initial capital</span>
                      <span>■ Above initial capital</span>
                    </div>
                  </div>
                )}

                {/* Risk Metrics */}
                {activeTab === "metrics" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard label="Prob. of Loss" value={formatPercent(result.metrics.probLoss)} icon="📉" variant="danger" />
                    <MetricCard label="Prob. of 2x" value={formatPercent(result.metrics.prob2x)} icon="📈" variant="success" />
                    <MetricCard label="Prob. of 10x" value={formatPercent(result.metrics.prob10x)} icon="🚀" variant="success" />
                    <MetricCard label="VaR 95%" value={formatCurrency(result.metrics.var95)} icon="⚠️" variant="danger" />
                    <MetricCard label="VaR 99%" value={formatCurrency(result.metrics.var99)} icon="🚨" variant="danger" />
                    <MetricCard label="CVaR 95% (ES)" value={formatCurrency(result.metrics.cvar95)} icon="📊" variant="danger" />
                    <MetricCard label="CVaR 99% (ES)" value={formatCurrency(result.metrics.cvar99)} icon="📊" variant="danger" />
                    <MetricCard label="Median Final" value={formatCurrency(result.fanChart.median[result.fanChart.median.length - 1])} icon="🎯" />
                    <MetricCard label="Paths Simulated" value={config.numPaths.toLocaleString()} icon="🎲" />
                    <MetricCard label="Horizon" value={`${config.horizonMonths} months`} icon="📅" />
                    <MetricCard label="Model" value={config.returnModel === "parametric" ? "GBM + Cholesky" : "Block Bootstrap"} icon="⚙️" />
                    <MetricCard label="Seed" value={config.randomSeed.toString()} icon="🔢" />
                  </div>
                )}

                {/* Path Summary Table */}
                {activeTab === "paths" && (
                  <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
                    <h3 className="font-display font-semibold mb-4">Path Summary (sorted by final value)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-fg-muted)] font-medium">
                            <th className="pb-3 pr-4">Rank</th>
                            <th className="pb-3 pr-4 text-right">Final Value</th>
                            <th className="pb-3 pr-4 text-right">Max Drawdown</th>
                            <th className="pb-3 pr-4 text-right">CAGR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.pathSummary.slice(0, 50).map((path, i) => (
                            <tr key={path.index} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-bg-card)]/50">
                              <td className="py-2 pr-4 font-mono">{i + 1}</td>
                              <td className="py-2 pr-4 text-right font-mono">{formatCurrency(path.finalValue)}</td>
                              <td className="py-2 pr-4 text-right font-mono text-[var(--color-danger)]">{formatPercent(path.maxDrawdown)}</td>
                              <td className={`py-2 pr-4 text-right font-mono ${path.cagr > 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>{formatPercent(path.cagr)}</td>
                            </tr>
                          ))}
                          {result.pathSummary.length > 50 && (
                            <tr>
                              <td colSpan={4} className="py-4 text-center text-[var(--color-fg-muted)] text-sm">
                                Showing top 50 of {result.pathSummary.length} paths
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {!result && portfolio.length > 0 && !loading && (
              <div className="text-center py-16 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl">
                <div className="text-6xl mb-4">🎲</div>
                <h3 className="font-display text-lg font-medium mb-2">Ready to simulate</h3>
                <p className="text-[var(--color-fg-muted)] text-sm">Configure parameters and click "Run Simulation"</p>
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