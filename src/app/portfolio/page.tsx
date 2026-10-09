"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

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

const STORAGE_KEY = "alphasim.portfolio";

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatNumber(value: number): string {
  return value.toFixed(4);
}

export default function PortfolioPage() {
  const [universe, setUniverse] = useState<Asset[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioAsset[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  // Save portfolio to localStorage
  const savePortfolio = useCallback((newPortfolio: PortfolioAsset[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPortfolio));
      setPortfolio(newPortfolio);
      setSuccess("Portfolio saved");
      setTimeout(() => setSuccess(null), 2000);
    } catch {
      setError("Failed to save portfolio");
    }
  }, []);

  const totalWeight = portfolio.reduce((sum, a) => sum + a.weight, 0);
  const isValid = portfolio.length >= 2 && totalWeight > 0 && totalWeight <= 1.0001 && portfolio.every((a) => a.weight >= 0);

  const handleWeightChange = (ticker: string, weight: number) => {
    if (weight < 0) return;
    const newPortfolio = portfolio.map((a) =>
      a.ticker === ticker ? { ...a, weight } : a
    );
    savePortfolio(newPortfolio);
  };

  const handleRemoveAsset = (ticker: string) => {
    const newPortfolio = portfolio.filter((a) => a.ticker !== ticker);
    savePortfolio(newPortfolio);
  };

  const handleNormalize = () => {
    const total = portfolio.reduce((sum, a) => sum + a.weight, 0);
    if (total === 0) return;
    const newPortfolio = portfolio.map((a) => ({ ...a, weight: a.weight / total }));
    savePortfolio(newPortfolio);
  };

  const handleAddAsset = (asset: Asset, weight: number) => {
    if (portfolio.some((a) => a.ticker === asset.ticker)) {
      setError("Asset already in portfolio");
      return;
    }
    const newPortfolio = [...portfolio, { ...asset, weight }];
    savePortfolio(newPortfolio);
    setShowAddModal(false);
    setSearchQuery("");
  };

  const handleExport = () => {
    const data = JSON.stringify(portfolio, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alphasim-portfolio-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSuccess("Portfolio exported");
    setTimeout(() => setSuccess(null), 2000);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported) && imported.every((a) => a.ticker && typeof a.weight === "number")) {
          savePortfolio(imported);
          setSuccess("Portfolio imported");
        } else {
          setError("Invalid portfolio format");
        }
      } catch {
        setError("Failed to parse JSON");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleClearAll = () => {
    if (confirm("Clear all assets from portfolio?")) {
      savePortfolio([]);
    }
  };

  const filteredAssets = universe.filter(
    (a) =>
      !portfolio.some((p) => p.ticker === a.ticker) &&
      (a.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.sector.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
                <Link href="/portfolio" className="text-[var(--color-accent)] font-medium text-sm">Portfolio</Link>
                <Link href="/backtest" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors text-sm font-medium">Backtest</Link>
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
            <h1 className="font-display text-3xl font-bold">Portfolio Builder</h1>
            <p className="text-[var(--color-fg-muted)] mt-1">Build and manage your multi-asset investment portfolio</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-fg)] hover:bg-[var(--color-bg-card)] transition-colors text-sm font-medium"
            >
              Export JSON
            </button>
            <label className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-fg)] hover:bg-[var(--color-bg-card)] transition-colors text-sm font-medium cursor-pointer">
              Import JSON
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
            <button
              onClick={handleClearAll}
              className="px-4 py-2 rounded-lg bg-[var(--color-danger)]/20 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/30 transition-colors text-sm font-medium"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Notifications */}
        {(error || success) && (
          <div className="mb-6">
            {error && (
              <div className="mb-2 p-3 rounded-lg bg-[var(--color-danger)]/20 border border-[var(--color-danger)]/50 text-[var(--color-danger)] text-sm flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="ml-4 text-[var(--color-danger)] hover:text-[var(--color-fg)]">×</button>
              </div>
            )}
            {success && (
              <div className="p-3 rounded-lg bg-[var(--color-success)]/20 border border-[var(--color-success)]/50 text-[var(--color-success)] text-sm flex items-center justify-between">
                <span>{success}</span>
                <button onClick={() => setSuccess(null)} className="ml-4 text-[var(--color-success)] hover:text-[var(--color-fg)]">×</button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Asset Search Panel */}
          <div className="lg:col-span-1">
            <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
              <h2 className="font-display font-semibold text-lg mb-4">Add Assets</h2>
              <div className="relative mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tickers, names, sectors..."
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] placeholder-[var(--color-fg-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] text-sm"
                />
              </div>
              <div className="max-h-96 overflow-y-auto">
                {filteredAssets.length === 0 ? (
                  <p className="text-[var(--color-fg-muted)] text-sm text-center py-8">No matching assets found</p>
                ) : (
                  <ul className="space-y-2">
                    {filteredAssets.map((asset) => (
                      <li key={asset.ticker}>
                        <AddAssetRow asset={asset} onAdd={handleAddAsset} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Portfolio Allocation Panel */}
          <div className="lg:col-span-2">
            <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display font-semibold text-lg">Portfolio Allocation</h2>
                <div className="flex items-center gap-4">
                  <div className={`text-sm font-mono ${totalWeight > 1 ? "text-[var(--color-danger)]" : totalWeight === 1 ? "text-[var(--color-success)]" : "text-[var(--color-fg-muted)]"}`}>
                    Total: {formatPercent(totalWeight)}
                  </div>
                  {totalWeight > 0 && totalWeight < 1 && (
                    <button
                      onClick={handleNormalize}
                      disabled={portfolio.length === 0}
                      className="px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-[var(--color-bg)] text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
                    >
                      Normalize
                    </button>
                  )}
                </div>
              </div>

              {portfolio.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">📊</div>
                  <h3 className="font-display text-lg font-medium mb-2">No assets in portfolio</h3>
                  <p className="text-[var(--color-fg-muted)] text-sm mb-6">Search and add assets from the panel on the left</p>
                  <p className="text-[var(--color-fg-muted)] text-xs">Need at least 2 assets for simulations</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-fg-muted)] font-medium">
                        <th className="pb-3 pr-4">Ticker</th>
                        <th className="pb-3 pr-4">Name</th>
                        <th className="pb-3 pr-4 text-right">Weight</th>
                        <th className="pb-3 pr-4 text-right">Exp. Return</th>
                        <th className="pb-3 pr-4 text-right">Volatility</th>
                        <th className="pb-3 pr-4 text-right">Sector</th>
                        <th className="pb-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.map((asset) => (
                        <tr key={asset.ticker} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-bg-card)]/50">
                          <td className="py-3 pr-4 font-mono font-medium">{asset.ticker}</td>
                          <td className="py-3 pr-4 max-w-xs truncate" title={asset.name}>{asset.name}</td>
                          <td className="py-3 pr-4 text-right">
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              max="1"
                              value={asset.weight}
                              onChange={(e) => handleWeightChange(asset.ticker, parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] text-right focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] font-mono text-sm"
                            />
                          </td>
                          <td className="py-3 pr-4 text-right font-mono">{formatPercent(asset.expectedReturn)}</td>
                          <td className="py-3 pr-4 text-right font-mono">{formatPercent(asset.volatility)}</td>
                          <td className="py-3 pr-4 text-right text-[var(--color-fg-muted)]">{asset.sector}</td>
                          <td className="py-3">
                            <button
                              onClick={() => handleRemoveAsset(asset.ticker)}
                              className="text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] transition-colors p-1"
                              aria-label={`Remove ${asset.ticker}`}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Portfolio Metrics Summary */}
              {portfolio.length > 0 && (
                <div className="mt-6 pt-6 border-t border-[var(--color-border)] grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard
                    label="Assets"
                    value={portfolio.length}
                    icon="📦"
                  />
                  <MetricCard
                    label="Exp. Return"
                    value={formatPercent(portfolio.reduce((sum, a) => sum + a.weight * a.expectedReturn, 0))}
                    icon="📈"
                  />
                  <MetricCard
                    label="Exp. Volatility"
                    value={formatPercent(Math.sqrt(portfolio.reduce((sum, a) => sum + a.weight ** 2 * a.volatility ** 2, 0)))}
                    icon="📊"
                  />
                  <MetricCard
                    label="Status"
                    value={isValid ? "Ready" : portfolio.length < 2 ? "Need 2+" : totalWeight > 1 ? "Over 100%" : "Incomplete"}
                    icon={isValid ? "✅" : "⚠️"}
                    variant={isValid ? "success" : "warning"}
                  />
                </div>
              )}
            </div>

            {/* Navigation to other pages */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/backtest" className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 transition-colors text-center">
                <div className="text-2xl mb-2">📈</div>
                <div className="font-semibold">Run Backtest</div>
                <div className="text-[var(--color-fg-muted)] text-sm">Test on historical data</div>
              </Link>
              <Link href="/monte-carlo" className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 transition-colors text-center">
                <div className="text-2xl mb-2">🎲</div>
                <div className="font-semibold">Monte Carlo</div>
                <div className="text-[var(--color-fg-muted)] text-sm">Simulate future paths</div>
              </Link>
              <Link href="/risk" className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 transition-colors text-center">
                <div className="text-2xl mb-2">⚠️</div>
                <div className="font-semibold">Risk Analytics</div>
                <div className="text-[var(--color-fg-muted)] text-sm">Analyze risk factors</div>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function AddAssetRow({ asset, onAdd }: { asset: Asset; onAdd: (asset: Asset, weight: number) => void }) {
  const [weight, setWeight] = useState(0.1);

  return (
    <button
      onClick={() => onAdd(asset, weight)}
      className="w-full p-3 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-bg-card)] transition-colors text-left flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono font-medium">{asset.ticker}</span>
          <span className="ml-2 text-[var(--color-fg-muted)] text-xs">{asset.sector}</span>
        </div>
        <span className="text-[var(--color-accent)] font-mono text-sm">{formatPercent(asset.expenseRatio)} ER</span>
      </div>
      <div className="text-[var(--color-fg-muted)] text-xs truncate">{asset.name}</div>
      <div className="flex items-center gap-2">
        <span className="text-[var(--color-fg-muted)] text-xs">Exp. Ret: {formatPercent(asset.expectedReturn)}</span>
        <span className="text-[var(--color-fg-muted)] text-xs">Vol: {formatPercent(asset.volatility)}</span>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <label className="text-[var(--color-fg-muted)] text-xs">Weight:</label>
        <input
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={weight}
          onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
          className="w-20 px-2 py-1 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-fg)] text-right focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] font-mono text-xs"
        />
        <span className="px-2 py-1 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)] text-xs font-medium">Add</span>
      </div>
    </button>
  );
}

function MetricCard({ label, value, icon, variant = "default" }: { label: string; value: string | number; icon: string; variant?: "default" | "success" | "warning" }) {
  const colors = {
    default: "text-[var(--color-fg)]",
    success: "text-[var(--color-success)]",
    warning: "text-[var(--color-warning)]",
  };
  return (
    <div className="p-4 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-[var(--color-fg-muted)] text-xs">{label}</span>
      </div>
      <div className={`font-mono font-semibold ${colors[variant]}`}>{value}</div>
    </div>
  );
}