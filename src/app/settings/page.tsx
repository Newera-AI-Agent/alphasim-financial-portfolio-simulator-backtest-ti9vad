"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Settings {
  theme: "dark" | "light" | "system";
  numberFormat: "USD" | "EUR" | "GBP" | "compact";
  dateFormat: "US" | "EU" | "ISO";
  defaultPaths: number;
  defaultHorizonMonths: number;
}

const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  numberFormat: "USD",
  dateFormat: "US",
  defaultPaths: 200,
  defaultHorizonMonths: 12,
};

const STORAGE_KEY = "alphasim.settings";
const PORTFOLIO_KEY = "alphasim.portfolio";

function formatDate(date: Date, format: Settings["dateFormat"]): string {
  switch (format) {
    case "US":
      return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    case "EU":
      return date.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
    case "ISO":
      return date.toISOString().split("T")[0];
  }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [dataFreshness, setDataFreshness] = useState<string>("Unknown");
  const [saved, setSaved] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch {
      // Use defaults
    }
  }, []);

  // Load data freshness (build timestamp)
  useEffect(() => {
    fetch("/data/prices.json")
      .then((res) => {
        const lastModified = res.headers.get("last-modified");
        if (lastModified) {
          setDataFreshness(formatDate(new Date(lastModified), settings.dateFormat));
        } else {
          setDataFreshness("Unknown (no Last-Modified header)");
        }
      })
      .catch(() => setDataFreshness("Failed to load"));
  }, [settings.dateFormat]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "dark") {
      root.classList.add("dark");
    } else if (settings.theme === "light") {
      root.classList.remove("dark");
    } else {
      // system
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) root.classList.add("dark");
      else root.classList.remove("dark");
    }
  }, [settings.theme]);

  const handleChange = useCallback(<SettingKey extends keyof Settings>(key: SettingKey, value: Settings[SettingKey]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  }, [settings]);

  const handleClearAll = useCallback(async () => {
    if (!window.confirm("This will clear ALL AlphaSim data from localStorage (portfolio, settings, backtest results). Are you sure?")) {
      return;
    }

    setClearing(true);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PORTFOLIO_KEY);
      localStorage.removeItem("alphasim.backtest");
      localStorage.removeItem("alphasim.monte-carlo");
      localStorage.removeItem("alphasim.risk");
      
      // Reset to defaults
      setSettings(DEFAULT_SETTINGS);
      setSaved(true);
    } catch (e) {
      console.error("Failed to clear storage:", e);
    } finally {
      setClearing(false);
    }
  }, []);

  const formatCurrency = (value: number, format: Settings["numberFormat"]): string => {
  switch (format) {
    case "USD":
      return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
    case "EUR":
      return value.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
    case "GBP":
      return value.toLocaleString("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 0 });
    case "compact":
      return new Intl.NumberFormat("en-US", { notation: "compact", compactDisplay: "short" }).format(value);
  }
};

  const formatNumber = (value: number, format: Settings["numberFormat"]): string => {
  switch (format) {
    case "USD":
      return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "EUR":
      return value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "GBP":
      return value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "compact":
      return new Intl.NumberFormat("en-US", { notation: "compact", compactDisplay: "short" }).format(value);
  }
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
                <Link href="/risk" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors text-sm font-medium">Risk</Link>
                <Link href="/settings" className="text-[var(--color-accent)] font-medium text-sm">Settings</Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold">Settings</h1>
          <p className="text-[var(--color-fg-muted)] mt-1">Customize your AlphaSim experience</p>
        </div>

        {/* Appearance */}
        <section className="mb-8 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
          <h2 className="font-display font-semibold text-lg mb-6 flex items-center gap-2">
            <span className="text-2xl">🎨</span> Appearance
          </h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm text-[var(--color-fg-muted)] mb-2">Theme</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "dark", label: "Dark", icon: "🌙" },
                  { value: "light", label: "Light", icon: "☀️" },
                  { value: "system", label: "System", icon: "💻" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleChange("theme", opt.value as Settings["theme"])}
                    className={`p-4 rounded-lg border-2 transition-all text-center ${
                      settings.theme === opt.value
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                        : "border-[var(--color-border)] hover:border-[var(--color-fg-muted)]"
                    }`}
                  >
                    <div className="text-3xl mb-1">{opt.icon}</div>
                    <div className="font-medium">{opt.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Number & Date Format */}
        <section className="mb-8 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
          <h2 className="font-display font-semibold text-lg mb-6 flex items-center gap-2">
            <span className="text-2xl">🔢</span> Number & Date Format
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-[var(--color-fg-muted)] mb-2">Number Format</label>
              <select
                value={settings.numberFormat}
                onChange={(e) => handleChange("numberFormat", e.target.value as Settings["numberFormat"])}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              >
                <option value="USD">USD ($1,234.56)</option>
                <option value="EUR">EUR (1.234,56 €)</option>
                <option value="GBP">GBP (£1,234.56)</option>
                <option value="compact">Compact (1.2K)</option>
              </select>
              <p className="text-[var(--color-fg-muted)] text-xs mt-1">Preview: {formatCurrency(1234567, settings.numberFormat)} | {formatNumber(1234.56, settings.numberFormat)}</p>
            </div>
            <div>
              <label className="block text-sm text-[var(--color-fg-muted)] mb-2">Date Format</label>
              <select
                value={settings.dateFormat}
                onChange={(e) => handleChange("dateFormat", e.target.value as Settings["dateFormat"])}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              >
                <option value="US">US (Jan 15, 2024)</option>
                <option value="EU">EU (15 Jan 2024)</option>
                <option value="ISO">ISO (2024-01-15)</option>
              </select>
              <p className="text-[var(--color-fg-muted)] text-xs mt-1">Preview: {formatDate(new Date("2024-01-15"), settings.dateFormat)}</p>
            </div>
          </div>
        </section>

        {/* Simulation Defaults */}
        <section className="mb-8 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
          <h2 className="font-display font-semibold text-lg mb-6 flex items-center gap-2">
            <span className="text-2xl">🎲</span> Simulation Defaults
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-[var(--color-fg-muted)] mb-2">Default Monte Carlo Paths</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="100"
                  max="10000"
                  step="100"
                  value={settings.defaultPaths}
                  onChange={(e) => handleChange("defaultPaths", parseInt(e.target.value))}
                  className="flex-1 accent-[var(--color-accent)]"
                />
                <input
                  type="number"
                  value={settings.defaultPaths}
                  onChange={(e) => handleChange("defaultPaths", parseInt(e.target.value) || 100)}
                  min="100"
                  max="10000"
                  step="100"
                  className="w-24 px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] text-center font-mono"
                />
              </div>
              <p className="text-[var(--color-fg-muted)] text-xs mt-1">Applied when opening Monte Carlo page</p>
            </div>
            <div>
              <label className="block text-sm text-[var(--color-fg-muted)] mb-2">Default Horizon (Months)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="120"
                  step="1"
                  value={settings.defaultHorizonMonths}
                  onChange={(e) => handleChange("defaultHorizonMonths", parseInt(e.target.value))}
                  className="flex-1 accent-[var(--color-accent)]"
                />
                <input
                  type="number"
                  value={settings.defaultHorizonMonths}
                  onChange={(e) => handleChange("defaultHorizonMonths", parseInt(e.target.value) || 1)}
                  min="1"
                  max="120"
                  step="1"
                  className="w-24 px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] text-center font-mono"
                />
              </div>
              <p className="text-[var(--color-fg-muted)] text-xs mt-1">Applied when opening Monte Carlo page</p>
            </div>
          </div>
        </section>

        {/* Data Freshness */}
        <section className="mb-8 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl p-6">
          <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
            <span className="text-2xl">📊</span> Data Freshness
          </h2>
          <div className="flex items-center gap-4 p-4 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
            <div className="text-3xl">📅</div>
            <div>
              <div className="font-medium">Price Data Last Updated</div>
              <div className="font-mono text-[var(--color-accent)]">{dataFreshness}</div>
              <div className="text-[var(--color-fg-muted)] text-xs mt-1">Data is bundled at build time. Rebuild to refresh.</div>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="mb-8 bg-[var(--color-bg-elevated)] border border-[var(--color-danger)]/30 rounded-xl p-6">
          <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2 text-[var(--color-danger)]">
            <span className="text-2xl">⚠️</span> Danger Zone
          </h2>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-[var(--color-fg)]">Clear All Local Data</div>
                  <div className="text-[var(--color-fg-muted)] text-sm">Remove portfolio, settings, and all cached results from browser storage</div>
                </div>
                <button
                  onClick={handleClearAll}
                  disabled={clearing}
                  className="px-4 py-2 rounded-lg bg-[var(--color-danger)]/20 border border-[var(--color-danger)] text-[var(--color-danger)] font-medium text-sm hover:bg-[var(--color-danger)]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {clearing ? "Clearing..." : "Clear All Data"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
          <div className="text-[var(--color-fg-muted)] text-sm">
            Settings are saved to localStorage and persist across sessions.
          </div>
          <button
            onClick={handleSave}
            className="px-6 py-3 rounded-lg bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold text-sm hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            {saved ? "Saved!" : "Save Settings"}
          </button>
        </div>
      </main>
    </div>
  );
}