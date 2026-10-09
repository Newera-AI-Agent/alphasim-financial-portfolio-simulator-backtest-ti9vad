"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, PieChart, Pie, Sector } from "recharts";

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

interface RiskConfig {
  benchmark: string;
  confidenceLevel: 0.95 | 0.99;
}

interface RiskResult {
  correlationMatrix: number[][];
  eigenvalues: number[];
  varianceExplained: number[];
  factorBetas: { mkt: number; smb: number; hml: number; rf: number };
  factorTStats: { mkt: number; smb: number; hml: number };
  factorR2: number;
  tailRisk: {
    historicalVaR95: number;
    historicalVaR99: number;
    parametricVaR95: number;
    parametricVaR99: number;
    cornishFisherVaR95: number;
    cornishFisherVaR99: number;
    expectedShortfall95: number;
    expectedShortfall99: number;
  };
  stressTests: { scenario: string; portfolioReturn: number; benchmarkReturn: number }[];
  riskDecomposition: { ticker: string; mcr: number; pctr: number; weight: number }[];
  pcaComponents: { component: number; variance: number; cumulativeVariance: number; loadings: number[] }[];
}

const STORAGE_KEY = "alphasim.portfolio";
const BENCHMARKS = ["SPY", "QQQ", "VTI", "IVV", "VOO"] as const;

export default function RiskPage() {
  const [universe, setUniverse] = useState<Asset[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioAsset[]>([]);
  const [config, setConfig] = useState<RiskConfig>({ benchmark: "SPY", confidenceLevel: 0.95 });
  const [result, setResult] = useState<RiskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"correlation" | "pca" | "factor" | "tail" | "stress" | "decomp">("correlation");

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

  const runRiskAnalysis = useCallback(async () => {
    if (!isValid) {
      setError("Portfolio must have at least 2 assets with weights summing to 100%");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolio, config }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Risk analysis failed");
      }

      const data = await response.json();
      setResult(data);
      setActiveTab("correlation");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Risk analysis failed");
    } finally {
      setLoading(false);
    }
  }, [portfolio, config, isValid]);

  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
  const formatNumber = (value: number) => value.toFixed(4);
  const formatCurrency = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getColorForValue = (value: number, isCorrelation = true) => {
    if (isCorrelation) {
      if (value > 0.7) return "var(--color-danger)";
      if (value > 0.3) return "var(--color-accent)";
      if (value > 0) return "var(--color-success)";
      if (value > -0.3) return "var(--color-fg-muted)";
      if (value > -0.7) return "var(--color-warning)";
      return "var(--color-danger)";
    }
    return value > 0 ? "var(--color-success)" : "var(--color-danger)";
  };

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
                <Link href="/monte-carlo" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors text-sm font-medium">Monte Carlo</Link>
                <Link href="/risk" className="text-[var(--color-accent)] font-medium text-sm">Risk</Link>
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
            <h1 className="font-display text-3xl font-bold">Risk Analytics</h1>
            <p className="text-[var(--color-fg-muted)] mt-1">Deep risk decomposition, factor models, and stress testing</p>
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

            {/* Risk Configuration */}
            <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
              <h2 className="font-display font-semibold text-lg mb-4">Analysis Config</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[var(--color-fg-muted)] mb-1">Benchmark</label>
                  <select
                    value={config.benchmark}
                    onChange={(e) => setConfig({ ...config, benchmark: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] text-sm"
                  >
                    {BENCHMARKS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-fg-muted)] mb-1">Confidence Level</label>
                  <select
                    value={config.confidenceLevel}
                    onChange={(e) => setConfig({ ...config, confidenceLevel: parseFloat(e.target.value) as 0.95 | 0.99 })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] text-sm"
                  >
                    <option value={0.95}>95%</option>
                    <option value={0.99}>99%</option>
                  </select>
                </div>
              </div>

              <button
                onClick={runRiskAnalysis}
                disabled={loading || !isValid}
                className="mt-6 w-full px-4 py-3 rounded-lg bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold text-sm hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Analyzing..." : "Run Risk Analysis"}
              </button>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-3 space-y-6">
            {result && (
              <>)
                {/* Tabs */}
                <div className="flex flex-wrap gap-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg p-1">
                  {[
                    { id: "correlation", label: "Correlation Heatmap" },
                    { id: "pca", label: "PCA" },
                    { id: "factor", label: "Factor Model" },
                    { id: "tail", label: "Tail Risk" },
                    { id: "stress", label: "Stress Tests" },
                    { id: "decomp", label: "Risk Decomposition" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                        activeTab === tab.id
                          ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
                          : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Correlation Heatmap */}
                {activeTab === "correlation" && (
                  <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
                    <h3 className="font-display font-semibold mb-4">Correlation Matrix</h3>
                    <p className="text-[var(--color-fg-muted)] text-sm mb-4">Asset return correlations (diverging color scale)</p>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr>
                            <th className="pb-2 pr-4 sticky left-0 bg-[var(--color-bg-elevated)] z-10 text-left text-[var(--color-fg-muted)] font-medium">Ticker</th>
                            {portfolio.map((a) => (
                              <th key={a.ticker} className="pb-2 px-2 text-center text-[var(--color-fg-muted)] font-medium w-14 rotate-45 origin-left sticky top-0 bg-[var(--color-bg-elevated)] z-10">{a.ticker}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {portfolio.map((asset, i) => (
                            <tr key={asset.ticker}>
                              <td className="pr-4 sticky left-0 bg-[var(--color-bg-elevated)] z-10 font-mono font-medium text-[var(--color-fg)]">{asset.ticker}</td>
                              {portfolio.map((_, j) => {
                                const corr = result.correlationMatrix[i]?.[j] ?? 0;
                                const absCorr = Math.abs(corr);
                                const opacity = Math.min(0.9, 0.2 + absCorr * 0.7);
                                return (
                                  <td key={j} className="px-2 text-center w-14">
                                    <div
                                      className="w-full h-10 flex items-center justify-center rounded text-xs font-mono"
                                      style={{
                                        backgroundColor: getColorForValue(corr),
                                        opacity,
                                        color: absCorr > 0.5 ? "white" : "var(--color-fg)",
                                      }}
                                      title={`${asset.ticker} vs ${portfolio[j]?.ticker}: ${corr.toFixed(3)}`}
                                    >
                                      {corr.toFixed(2)}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-4 text-xs text-[var(--color-fg-muted)]">
                      <span>■ Strong positive (&gt;0.7)</span>
                      <span>■ Moderate positive (0.3-0.7)</span>
                      <span>■ Weak positive (0-0.3)</span>
                      <span>■ Negative (&lt;0)</span>
                    </div>
                  </div>
                )}

                {/* PCA */}
                {activeTab === "pca" && (
                  <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
                    <h3 className="font-display font-semibold mb-4">Principal Component Analysis</h3>
                    <p className="text-[var(--color-fg-muted)] text-sm mb-4">Variance explained by each principal component</p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={result.pcaComponents}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                            <XAxis
                              dataKey="component"
                              tickFormatter={(v) => `PC${v}`}
                              stroke="var(--color-fg-muted)"
                              fontSize={11}
                            />
                            <YAxis stroke="var(--color-fg-muted)" fontSize={11} tickCount={5} />
                            <Tooltip
                              formatter={(v: number) => [formatPercent(v), "Variance Explained"]}
                              contentStyle={{ backgroundColor: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: "8px" }}
                            />
                            <Legend />
                            <Bar dataKey="variance" fill="var(--color-accent)" radius={[4, 4, 0, 0]} name="Variance" />
                            <Bar dataKey="cumulativeVariance" fill="var(--color-success)" radius={[4, 4, 0, 0]} name="Cumulative" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div>
                        <h4 className="font-display font-medium mb-3">Component Loadings</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-fg-muted)] font-medium">
                                <th className="pb-2 pr-4">Asset</th>
                                {result.pcaComponents.slice(0, 5).map((pc) => (
                                  <th key={pc.component} className="pb-2 px-2 text-center w-14">PC{pc.component}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {portfolio.map((asset, i) => (
                                <tr key={asset.ticker} className="border-b border-[var(--color-border)]/50">
                                  <td className="py-2 pr-4 font-mono font-medium">{asset.ticker}</td>
                                  {result.pcaComponents.slice(0, 5).map((pc) => (
                                    <td key={pc.component} className="py-2 px-2 text-center font-mono text-xs">
                                      <span className={pc.loadings[i] > 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>
                                        {pc.loadings[i].toFixed(3)}
                                      </span>
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Factor Model */}
                {activeTab === "factor" && (
                  <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
                    <h3 className="font-display font-semibold mb-4">Fama-French 3-Factor Model</h3>
                    <p className="text-[var(--color-fg-muted)] text-sm mb-4">Portfolio return regressed on MKT, SMB, HML factors</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                      <div className="p-4 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                        <div className="text-[var(--color-fg-muted)] text-xs mb-1">R²</div>
                        <div className="font-display font-bold text-2xl">{result.factorR2.toFixed(4)}</div>
                      </div>
                      <div className="p-4 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                        <div className="text-[var(--color-fg-muted)] text-xs mb-1">Market Beta (MKT)</div>
                        <div className="font-display font-bold text-2xl">{result.factorBetas.mkt.toFixed(4)}</div>
                      </div>
                      <div className="p-4 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                        <div className="text-[var(--color-fg-muted)] text-xs mb-1">Alpha (annualized)</div>
                        <div className="font-display font-bold text-2xl text-[var(--color-accent)]">{formatPercent(result.factorBetas.rf)}</div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-fg-muted)] font-medium">
                            <th className="pb-3 pr-4">Factor</th>
                            <th className="pb-3 pr-4 text-right">Beta</th>
                            <th className="pb-3 pr-4 text-right">t-stat</th>
                            <th className="pb-3 pr-4 text-right">Significance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { name: "Market (MKT)", beta: result.factorBetas.mkt, tstat: result.factorTStats.mkt },
                            { name: "Size (SMB)", beta: result.factorBetas.smb, tstat: result.factorTStats.smb },
                            { name: "Value (HML)", beta: result.factorBetas.hml, tstat: result.factorTStats.hml },
                          ].map((f) => (
                            <tr key={f.name} className="border-b border-[var(--color-border)]/50">
                              <td className="py-2 pr-4 font-medium">{f.name}</td>
                              <td className="py-2 pr-4 text-right font-mono">{f.beta.toFixed(4)}</td>
                              <td className="py-2 pr-4 text-right font-mono">{f.tstat.toFixed(2)}</td>
                              <td className="py-2 pr-4 text-right">
                                <span className={Math.abs(f.tstat) > 2 ? "text-[var(--color-success)]" : "text-[var(--color-fg-muted)]"}>
                                  {Math.abs(f.tstat) > 2 ? "***" : Math.abs(f.tstat) > 1.65 ? "**" : "*"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tail Risk */}
                {activeTab === "tail" && (
                  <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
                    <h3 className="font-display font-semibold mb-4">Tail Risk Measures</h3>
                    <p className="text-[var(--color-fg-muted)] text-sm mb-4">VaR and Expected Shortfall at 95% and 99% confidence levels</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <MetricCard label="Historical VaR 95%" value={formatCurrency(result.tailRisk.historicalVaR95)} icon="📊" variant="danger" />
                      <MetricCard label="Historical VaR 99%" value={formatCurrency(result.tailRisk.historicalVaR99)} icon="📊" variant="danger" />
                      <MetricCard label="Parametric VaR 95%" value={formatCurrency(result.tailRisk.parametricVaR95)} icon="📈" variant="danger" />
                      <MetricCard label="Parametric VaR 99%" value={formatCurrency(result.tailRisk.parametricVaR99)} icon="📈" variant="danger" />
                      <MetricCard label="Cornish-Fisher VaR 95%" value={formatCurrency(result.tailRisk.cornishFisherVaR95)} icon="📐" variant="danger" />
                      <MetricCard label="Cornish-Fisher VaR 99%" value={formatCurrency(result.tailRisk.cornishFisherVaR99)} icon="📐" variant="danger" />
                      <MetricCard label="Expected Shortfall 95%" value={formatCurrency(result.tailRisk.expectedShortfall95)} icon="⚠️" variant="danger" />
                      <MetricCard label="Expected Shortfall 99%" value={formatCurrency(result.tailRisk.expectedShortfall99)} icon="⚠️" variant="danger" />
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                          { method: "Historical", var95: Math.abs(result.tailRisk.historicalVaR95), var99: Math.abs(result.tailRisk.historicalVaR99), es95: Math.abs(result.tailRisk.expectedShortfall95), es99: Math.abs(result.tailRisk.expectedShortfall99) },
                          { method: "Parametric", var95: Math.abs(result.tailRisk.parametricVaR95), var99: Math.abs(result.tailRisk.parametricVaR99), es95: Math.abs(result.tailRisk.expectedShortfall95), es99: Math.abs(result.tailRisk.expectedShortfall99) },
                          { method: "Cornish-Fisher", var95: Math.abs(result.tailRisk.cornishFisherVaR95), var99: Math.abs(result.tailRisk.cornishFisherVaR99), es95: Math.abs(result.tailRisk.expectedShortfall95), es99: Math.abs(result.tailRisk.expectedShortfall99) },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                          <XAxis dataKey="method" stroke="var(--color-fg-muted)" fontSize={11} />
                          <YAxis tickFormatter={(v) => formatCurrency(v)} stroke="var(--color-fg-muted)" fontSize={11} />
                          <Tooltip formatter={(v: number) => [formatCurrency(v), "Loss Amount"]} contentStyle={{ backgroundColor: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: "8px" }} />
                          <Legend />
                          <Bar dataKey="var95" fill="var(--color-accent)" name="VaR 95%" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="var99" fill="var(--color-danger)" name="VaR 99%" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="es95" fill="var(--color-warning)" name="ES 95%" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="es99" fill="var(--color-accent-hover)" name="ES 99%" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Stress Tests */}
                {activeTab === "stress" && (
                  <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
                    <h3 className="font-display font-semibold mb-4">Stress Test Scenarios</h3>
                    <p className="text-[var(--color-fg-muted)] text-sm mb-4">Portfolio performance under historical crisis scenarios</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-fg-muted)] font-medium">
                            <th className="pb-3 pr-4">Scenario</th>
                            <th className="pb-3 pr-4 text-right">Portfolio Return</th>
                            <th className="pb-3 pr-4 text-right">Benchmark Return</th>
                            <th className="pb-3 pr-4 text-right">Excess Return</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.stressTests.map((s, i) => (
                            <tr key={i} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-bg-card)]/50">
                              <td className="py-3 pr-4 font-medium">{s.scenario}</td>
                              <td className={`py-3 pr-4 text-right font-mono ${s.portfolioReturn > 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>{formatPercent(s.portfolioReturn)}</td>
                              <td className={`py-3 pr-4 text-right font-mono ${s.benchmarkReturn > 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>{formatPercent(s.benchmarkReturn)}</td>
                              <td className={`py-3 pr-4 text-right font-mono ${(s.portfolioReturn - s.benchmarkReturn) > 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>{formatPercent(s.portfolioReturn - s.benchmarkReturn)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Risk Decomposition */}
                {activeTab === "decomp" && (
                  <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
                    <h3 className="font-display font-semibold mb-4">Risk Decomposition</h3>
                    <p className="text-[var(--color-fg-muted)] text-sm mb-4">Marginal and Percentage Contribution to Risk (MCR / PCTR)</p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-display font-medium mb-3">Contribution to Portfolio Risk</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-fg-muted)] font-medium">
                                <th className="pb-3 pr-4">Asset</th>
                                <th className="pb-3 pr-4 text-right">Weight</th>
                                <th className="pb-3 pr-4 text-right">MCR</th>
                                <th className="pb-3 pr-4 text-right">PCTR</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.riskDecomposition.map((r) => (
                                <tr key={r.ticker} className="border-b border-[var(--color-border)]/50">
                                  <td className="py-2 pr-4 font-mono font-medium">{r.ticker}</td>
                                  <td className="py-2 pr-4 text-right font-mono">{formatPercent(r.weight)}</td>
                                  <td className="py-2 pr-4 text-right font-mono">{r.mcr.toFixed(6)}</td>
                                  <td className="py-2 pr-4 text-right font-mono text-[var(--color-accent)]">{formatPercent(r.pctr)}</td>
                                </tr>
                              ))}
                              <tr className="font-semibold border-t-2 border-[var(--color-border)]">
                                <td className="py-2 pr-4">Total</td>
                                <td className="py-2 pr-4 text-right font-mono">{formatPercent(result.riskDecomposition.reduce((s, r) => s + r.weight, 0))}</td>
                                <td className="py-2 pr-4 text-right font-mono">{result.riskDecomposition.reduce((s, r) => s + r.mcr, 0).toFixed(6)}</td>
                                <td className="py-2 pr-4 text-right font-mono text-[var(--color-accent)]">{formatPercent(result.riskDecomposition.reduce((s, r) => s + r.pctr, 0))}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={result.riskDecomposition}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="pctr"
                              nameKey="ticker"
                              label={({ ticker, pctr }) => `${ticker} ${formatPercent(pctr)}`}
                              labelLine={false}
                            >
                              {result.riskDecomposition.map((r, i) => (
                                <Cell key={r.ticker} fill={`hsl(${(i * 360) / result.riskDecomposition.length}, 70%, 50%)`} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v: number) => [formatPercent(v), "PCTR"]} contentStyle={{ backgroundColor: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: "8px" }} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {!result && portfolio.length > 0 && !loading && (
              <div className="text-center py-16 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="font-display text-lg font-medium mb-2">Ready to analyze risk</h3>
                <p className="text-[var(--color-fg-muted)] text-sm">Configure and click "Run Risk Analysis"</p>
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