import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)] flex flex-col">
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
                <Link href="/settings" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors text-sm font-medium">Settings</Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/portfolio"
                className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--color-bg)] font-medium hover:bg-[var(--color-accent-hover)] transition-colors text-sm"
              >
                Launch Simulator
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col">
        <section className="relative py-24 sm:py-32 lg:py-40 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)]/10 via-transparent to-[var(--color-success)]/10"></div>
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="text-center max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] mb-8 animate-in">
                <span className="text-[var(--color-accent)] text-sm font-medium">v1.0.0</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"></span>
                <span className="text-[var(--color-fg-muted)] text-sm">Quant Research Platform</span>
              </div>
              <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-balance">
                <span className="text-[var(--color-fg)]">Financial Portfolio</span>
                <br />
                <span className="text-[var(--color-accent)]">Simulator & Backtester</span>
              </h1>
              <p className="text-lg sm:text-xl text-[var(--color-fg-muted)] max-w-2xl mx-auto mb-10 leading-relaxed">
                Model multi-asset portfolios, run deterministic historical backtests, execute Monte Carlo simulations, and inspect quantitative risk metrics — all in a fast, local-first web application.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/portfolio"
                  className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold text-lg hover:bg-[var(--color-accent-hover)] transition-all shadow-[var(--shadow-elevated)] hover:shadow-[0_0_30px_rgb(245_158_11_/0.3)]"
                >
                  Launch Simulator
                </Link>
                <Link
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-8 py-4 rounded-xl border border-[var(--color-border)] text-[var(--color-fg)] font-semibold text-lg hover:bg-[var(--color-bg-card)] transition-all"
                >
                  View on GitHub
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Highlights */}
        <section className="py-24 sm:py-32 bg-[var(--color-bg-elevated)]/50 border-y border-[var(--color-border)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">Core Capabilities</h2>
              <p className="text-[var(--color-fg-muted)] text-lg max-w-2xl mx-auto">Professional-grade quantitative tools accessible through an intuitive interface</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <FeatureCard
                icon="📊"
                title="Portfolio Builder"
                description="Search 50+ major ETFs, set allocations with real-time normalization, persist to localStorage, export/import JSON."
                href="/portfolio"
              />
              <FeatureCard
                icon="📈"
                title="Historical Backtest"
                description="Run deterministic backtests on ~10 years of daily data with rebalancing, equity curves, drawdowns, and full metrics suite."
                href="/backtest"
              />
              <FeatureCard
                icon="🎲"
                title="Monte Carlo"
                description="Parametric (GBM + Cholesky) and bootstrap simulations with fan charts, VaR/ES, and probability metrics."
                href="/monte-carlo"
              />
              <FeatureCard
                icon="⚠️"
                title="Risk Analytics"
                description="Correlation heatmaps, PCA, Fama-French factors, stress tests (2008/2020/2022), and risk decomposition."
                href="/risk"
              />
            </div>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="py-24 sm:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">Built with Modern Tech</h2>
              <p className="text-[var(--color-fg-muted)] text-lg max-w-2xl mx-auto">Zero-compromise stack for performance and developer experience</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { name: "Next.js 15", desc: "App Router, RSC, Static Export" },
                { name: "TypeScript", desc: "Strict mode, full type safety" },
                { name: "Tailwind CSS", desc: "Dark quant aesthetic, design tokens" },
                { name: "Vitest", desc: "80%+ coverage on math library" },
                { name: "Recharts", desc: "SVG charts, responsive, accessible" },
                { name: "GitHub Actions", desc: "CI: lint, typecheck, test, build" },
                { name: "Cloudflare Pages", desc: "Edge deployment, global CDN" },
                { name: "Web Workers", desc: "Off-main-thread Monte Carlo" },
              ].map((tech, i) => (
                <div key={i} className="p-6 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 transition-colors">
                  <h3 className="font-display font-semibold text-lg mb-1">{tech.name}</h3>
                  <p className="text-[var(--color-fg-muted)] text-sm">{tech.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)]/50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[var(--color-accent)] flex items-center justify-center">
                <span className="text-[var(--color-bg)] font-display font-bold">α</span>
              </div>
              <span className="font-display font-semibold">AlphaSim</span>
            </div>
            <p className="text-[var(--color-fg-muted)] text-sm">Financial Portfolio Simulator & Backtester</p>
            <div className="flex items-center gap-6">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] transition-colors text-sm"
              >
                GitHub
              </a>
              <a
                href="#"
                className="text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] transition-colors text-sm"
              >
                Documentation
              </a>
              <a
                href="#"
                className="text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] transition-colors text-sm"
              >
                License
              </a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-[var(--color-border)] text-center text-[var(--color-fg-muted)] text-sm">
            <p>Built with precision for quantitative research. Not investment advice.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  href,
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group p-6 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-bg-card)] transition-all h-full flex flex-col"
    >
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="font-display font-semibold text-lg mb-2 group-hover:text-[var(--color-accent)] transition-colors">{title}</h3>
      <p className="text-[var(--color-fg-muted)] text-sm flex-1">{description}</p>
      <span className="mt-4 text-[var(--color-accent)] text-sm font-medium group-hover:underline">Explore →</span>
    </Link>
  );
}