# RELAY HANDOFF — job vm-mv190gd0-cfmuw5vg (VM 2 of 3)
Written at the 15-minute checkpoint with 7 min left, after 317 steps.

## Original task
# RELAY HANDOFF — job vm-mv138n1a-ip2chpfa (VM 1 of 3)
Written at the 15-minute checkpoint with 13 min left, after 89 steps.

## Original task
# AlphaSim — Financial Portfolio Simulator & Backtester

## Goal
Build a complete, standalone, production-ready web application named **AlphaSim** using Next.js (App Router), TypeScript (strict mode), and Tailwind CSS. The app allows users to model multi-asset investment portfolios, run deterministic historical backtests, execute Monte Carlo simulations, and inspect quantitative risk metrics.

## Stack
- **Framework:** Next.js 14+ (App Router), TypeScript (strict: true)
- **Styling:** Tailwind CSS (dark-themed quant/fintech aesthetic)
- **Charting:** Lightweight Charts (tradingview/lightweight-charts) or Recharts for SVG-based charts
- **State:** React Server Components + Client Components where needed
- **Math Library:** Decoupled `lib/math/` — pure TypeScript, zero framework deps, fully unit-tested
- **Testing:** Vitest for unit tests, Playwright for e2e (smoke)
- **CI:** GitHub Actions (install, lint, typecheck, test, build)
- **Deploy:** Cloudflare Pages (static export via `next build` + `output: 'export'`)

## Pages & Features

### 1. Landing Page (`/`)
- Hero with app name, tagline, primary CTA → "Launch Simulator"
- Feature highlights: Backtest, Monte Carlo, Risk Metrics, Portfolio Builder
- Footer with GitHub link

### 2. Portfolio Builder (`/portfolio`)
- **Asset Search:** Debounced search against a static universe (≈50 major tickers: SPY, QQQ, VTI, BND, GLD, VWO, etc.) with name, sector, expense ratio
- **Allocation Table:** Rows: Ticker | Name | Weight % | Expected Return | Volatility | Correlation preview
- **Weight Normalization:** Real-time sum = 100% indicator; "Normalize" button redistributes proportionally
- **Persistence:** Portfolio saved to `localStorage` (key: `alphasim.portfolio`)
- **Export/Import:** JSON download/upload
- **Validation:** No negative weights, sum ≤ 100%, at least 2 assets for simulation

### 3. Historical Backtest (`/backtest`)
- **Inputs:** Portfolio (from builder or inline), Start Date, End Date, Rebalance Frequency (monthly/quarterly/annually/none), Initial Capital
- **Data Source:** Bundled static CSV/JSON price series (daily adjusted close) for the universe — ~10 years, ~2500 trading days × 50 tickers ≈ 125k rows, ~2 MB gzipped. Loaded at build time into `public/data/prices.json`.
- **Engine (`lib/math/backtest.ts`):**
  - Align all series to common date index (inner join)
  - Compute daily log returns per asset
  - Apply weights → portfolio daily returns
  - Rebalance: at each period boundary, reset weights to target (sell/buy to target)
  - Output: equity curve, drawdown series, period returns, turnover
- **Results Panel:**
  - Equity curve chart (log scale toggle)
  - Drawdown chart (area, red)
  - Metrics cards: CAGR, Volatility (ann.), Sharpe, Sortino, Max Drawdown, Calmar, Best/Worst Month, Win Rate
  - Monthly returns heatmap (calendar)
  - Trade log table (date, action, ticker, shares, price, value)
- **Determinism:** Given same inputs, bit-identical results. Seed displayed.

### 4. Monte Carlo Simulation (`/monte-carlo`)
- **Inputs:** Portfolio, Number of Paths (100–10,000, default 200), Horizon (months, 1–120), Return Model (parametric: multivariate normal from historical μ/Σ; or bootstrap: resample historical daily returns with replacement), Correlation Structure (historical / constant / shrinkage), Random Seed
- **Engine (`lib/math/monte-carlo.ts`):**
  - Parametric: Cholesky decomposition of covariance → correlated normals → price paths via GBM
  - Bootstrap: block bootstrap (block size ≈ 20 days) to preserve autocorrelation
  - Output per path: terminal wealth, max drawdown, path equity curve (sampled)
- **Results Panel:**
  - Fan chart: median, 10/90, 5/95 percentile bands (semi-transparent)
  - Terminal wealth histogram (log bins)
  - Probability of loss / probability of >2x / probability of >10x
  - Value at Risk (VaR 95%, 99%) and Conditional VaR (Expected Shortfall)
  - Path table (sortable): final value, max DD, CAGR
- **Performance:** Web Worker for >500 paths to keep UI responsive

### 5. Risk Analytics (`/risk`)
- **Inputs:** Portfolio, Benchmark (default SPY), Confidence Level (95%/99%)
- **Engine (`lib/math/risk.ts`):**
  - Covariance matrix (sample, Ledoit-Wolf shrinkage option)
  - Correlation matrix + eigenvalues (PCA variance explained)
  - Factor model: regress portfolio returns on Fama-French 3-factor (mock factors bundled)
  - Tail risk: Historical VaR, Parametric VaR, Cornish-Fisher VaR, Expected Shortfall
  - Stress tests: 2008 GF, 2020 COVID, 2022 Rate Hike (predefined shock vectors)
  - Contribution to risk: Marginal Component Risk (MCR), Percentage Contribution to Risk (PCTR)
- **Results Panel:**
  - Correlation heatmap (diverging color scale)
  - Risk decomposition bar chart (PCTR per asset)
  - Factor exposure table (betas, t-stats, R²)
  - Stress test scenario table (portfolio return under each shock)
  - Tail risk comparison table

### 6. Settings (`/settings`)
- Theme: Dark (default) / Light / System
- Number format: USD / EUR / GBP / compact
- Date format
- Default simulation paths / horizon
- Data freshness indicator (build timestamp of price data)
- Clear all localStorage

## Data
- `public/data/universe.json` — 50 tickers with metadata
- `public/data/prices.json.gz` — daily adjusted close, gzipped, loaded via fetch + decompress
- `public/data/factors.json` — daily Fama-French 3-factor (MKT, SMB, HML) + RF
- Build script (`scripts/build-data.ts`) downloads from Yahoo Finance / Kenneth French library, aligns, writes JSON — run once locally, output committed

## Math Library (`lib/math/`)
- `statistics.ts` — mean, std, skew, kurtosis, percentile, autocorr, covariance, correlation, shrinkage (Ledoit-Wolf)
- `portfolio.ts` — portfolio return/vol, Sharpe, Sortino, Calmar, max DD, CAGR, rebalance logic
- `backtest.ts` — historical backtest engine (pure functions)
- `monte-carlo.ts` — GBM paths, bootstrap, Cholesky, fan chart percentiles
- `risk.ts` — VaR/ES (historical, parametric, Cornish-Fisher), factor regression, stress tests, PCA, risk decomposition
- `optimization.ts` — (stretch) mean-variance, risk parity, HRP — optional, not required for MVP
- **Tests:** `lib/math/__tests__/*.test.ts` with Vitest — known-value tests against reference implementations (NumPy/pandas equivalents)

## UI/UX Requirements
- **Dark theme default** — slate-950 background, slate-100 text, amber-500/emerald-500 accents
- **Responsive:** Mobile-first, works at 375px, 768px, 1440px
- **Accessibility:** WCAG AA contrast, keyboard navigation, ARIA labels, focus-visible outlines, reduced-motion respected
- **Loading states:** Skeleton loaders for charts, progress for Monte Carlo
- **Error boundaries:** Per-page error UI with retry
- **Tooltips:** Financial term definitions on hover (Sharpe, VaR, etc.)
- **Command palette:** Cmd+K to jump pages (stretch)

## Quality Bar
- `npm run lint` (ESLint + Prettier) — zero warnings
- `npm run typecheck` (tsc --noEmit) — zero errors
- `npm run test` — all unit tests pass, coverage ≥ 80% on `lib/math/`
- `npm run build` — successful static export (`out/` directory)
- Lighthouse: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 90, SEO ≥ 90
- Bundle: First-load JS < 150 kB gzipped (exclude chart library)

## Deliverables
1. Complete Next.js project in repo root
2. All source under `src/`, math under `lib/math/`
3. Static price data in `public/data/`
4. GitHub Actions workflow (`.github/workflows/ci.yml`)
5. `next.config.js` with `output: 'export'` and image optimization disabled
6. `README.md` with run instructions, architecture overview, data pipeline
7. Deployed to `newera-alpha-sim-2026.pages.dev`

## Non-Goals
- User accounts / auth
- Real-time data feeds
- Broker integration
- Database / backend
- Server-side rendering (static export only)

## Acceptance Criteria
- [ ] Landing page loads, navigates to all 5 main pages
- [ ] Portfolio builder: add/remove assets, normalize weights, persist to localStorage, export/import JSON
- [ ] Backtest: runs on historical data, produces equity curve, drawdown, all metrics, monthly heatmap, trade log
- [ ] Monte Carlo: runs parametric + bootstrap, fan chart, histogram, VaR/ES, probability metrics
- [ ] Risk: correlation heatmap, PCA, factor betas, stress tests, risk decomposition
- [ ] All math functions have unit tests with known-value assertions
- [ ] CI passes (lint, typecheck, test, build)
- [ ] Deployed URL responds 200 and renders correctly
- [ ] Lighthouse scores meet thresholds

## GREENFIELD
No project files were uploaded — the repository contains ONLY the NewEra runner, workflow and skills. You are building this project FROM SCRATCH: scaffold it yourself (create-next-app / flutter create / npm create vite / npm init / python), then install, build and test for real. Read the relevant stack skill first (list_skills → read_skill) — it encodes the scaffold commands, the build loop and the static-output contract the deploy stage requires.
All requirements live in this brief — the user cannot answer questions here.

## DEPLOY (user pre-approved)
When the build VERIFIABLY passes, call request_deploy{subdomain:"alpha-sim-2026", mode:"permanent"} IMMEDIATELY — the user already approved newera-alpha-sim-2026.pages.dev. Do not ask again; do not deploy off a red build. If the tool returns an error, RETRY it — never claim the site is live unless request_deploy returned ok. (The harness also auto-requests this at wind-down as a safety net, but call it yourself the moment the build is green.)

## Progress so far
(no rolling summary was generated — reconstruct state from the git log below and the repo itself)

## Worklog (latest lines — every VM in this chain appended)
# VM Agent Worklog
Durable session memory for this VM job chain. Each line is one step or wind-down from one VM. Read it on boot; never delete it.
- [2026-10-09T14:56:30.227Z | VM 1/3] boot: VM 1/3 online (job vm-mv138n1a-ip2chpfa, 180 min budget)
- [2026-10-09T14:56:30.228Z | VM 1/3] self-check PASS: shell: VERIFIED (the harness executed bash on this VM at boot); node: v24.21.0; npm: 11.19.0; python3: Python 3.12.3; git: repo checked out @ b75d06a; filesystem: WRITABLE (the harness wrote + read back a probe file); skills: 23 knowledge docs in .newera/skills/ (list_skills / read_skill); project: 
- [2026-10-09T16:35:27.833Z | VM 1/3] VERIFIED green: npm run test -- --reporter=verbose 2>&1 | head -100
- [2026-10-09T16:41:32.309Z | VM 1/3] VERIFIED green: npm run test -- --reporter=verbose 2>&1 | head -150
- [2026-10-09T17:01:13.761Z | VM 1/3] VERIFIED green: npm run test -- --reporter=verbose 2>&1 | head -100

## Repository state
Changed/added files:
 M README.md
?? .gitignore
?? .newera/vm/WORKLOG.md
?? AGENTS.md
?? agent.log
?? eslint.config.mjs
?? lib/
?? next.config.ts
?? package-lock.json
?? package.json
?? public/
?? scripts/
?? src/
?? tsconfig.json

Recent commits:
b75d06a newera: VM agent job vm-mv138n1a-ip2chpfa

## Current plan (todo state)
(no plan was recorded — write one with todo{steps} before editing)

## Contract status
## TASK CONTRACT — the requirement matrix the user approved (SCOPE LOCK)
- [pending] REQ-001 — # AlphaSim — Financial Portfolio Simulator & Backtester (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-002 — ## Goal (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-003 — Build a complete, standalone, production-ready web application named **AlphaSim** using Next.js (App Router), TypeScript (strict mode), and  (MANDATORY) | acceptance: A relevant build or static verification passed after the latest relevant edit.
- [pending] REQ-004 — The app allows users to model multi-asset investment portfolios, run deterministic historical backtests, execute Monte Carlo simulations, an (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-005 — ## Stack (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-006 — Framework:** Next.js 14+ (App Router), TypeScript (strict: true) (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-007 — Styling:** Tailwind CSS (dark-themed quant/fintech aesthetic) (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-008 — Charting:** Lightweight Charts (tradingview/lightweight-charts) or Recharts for SVG-based charts (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-009 — State:** React Server Components + Client Components where needed (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-010 — Math Library:** Decoupled `lib/math/` — pure TypeScript, zero framework deps, fully unit-tested (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-011 — Testing:** Vitest for unit tests, Playwright for e2e (smoke) (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-012 — CI:** GitHub Actions (install, lint, typecheck, test, build) (MANDATORY) | acceptance: The requested tests were executed after the latest relevant edit and passed.
- [pending] REQ-013 — Deploy:** Cloudflare Pages (static export via `next build` + `output: 'export'`) (MANDATORY) | acceptance: A relevant build or static verification passed after the latest relevant edit.
- [pending] REQ-014 — ## Pages & Features (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-015 — ### 1. (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-016 — Landing Page (`/`) (MANDATORY) | acceptance: The requested file or implementation exists and its relevant contents were inspected.
- [pending] REQ-017 — Hero with app name, tagline, primary CTA → "Launch Simulator" (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-018 — Feature highlights: Backtest, Monte Carlo, Risk Metrics, Portfolio Builder (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-019 — Footer with GitHub link (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-020 — ### 2. (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
Work ONLY on these requirements — anything else is out of scope. Mark progress with update_contract. finish requires every MANDATORY requirement complete (or blocked with documented evidence).

## What the next VM must do
1. Check the repo state above — everything committed so far is real and on disk.
2. Do NOT redo finished work. Verify what exists (build, tests) before touching anything.
3. Continue the ORIGINAL task to completion, then finish with an honest summary.
4. If a deploy was requested and the build is green, make sure request_deploy was called (see .newera/vm/deploy-request.json).

## Progress so far
(no rolling summary was generated — reconstruct state from the git log below and the repo itself)

## Worklog (latest lines — every VM in this chain appended)
Durable session memory for this VM job chain. Each line is one step or wind-down from one VM. Read it on boot; never delete it.
- [2026-10-09T14:56:30.227Z | VM 1/3] boot: VM 1/3 online (job vm-mv138n1a-ip2chpfa, 180 min budget)
- [2026-10-09T14:56:30.228Z | VM 1/3] self-check PASS: shell: VERIFIED (the harness executed bash on this VM at boot); node: v24.21.0; npm: 11.19.0; python3: Python 3.12.3; git: repo checked out @ b75d06a; filesystem: WRITABLE (the harness wrote + read back a probe file); skills: 23 knowledge docs in .newera/skills/ (list_skills / read_skill); project: 
- [2026-10-09T16:35:27.833Z | VM 1/3] VERIFIED green: npm run test -- --reporter=verbose 2>&1 | head -100
- [2026-10-09T16:41:32.309Z | VM 1/3] VERIFIED green: npm run test -- --reporter=verbose 2>&1 | head -150
- [2026-10-09T17:01:13.761Z | VM 1/3] VERIFIED green: npm run test -- --reporter=verbose 2>&1 | head -100
- [2026-10-09T17:37:44.090Z | VM 1/3] RELAY checkpoint at step 89 — handoff committed, VM 2 continues.
- [2026-10-09T17:38:02.034Z | VM 2/3] boot: VM 2/3 online (job vm-mv190gd0-cfmuw5vg, 180 min budget, relay continuation)
- [2026-10-09T17:38:02.034Z | VM 2/3] self-check PASS: shell: VERIFIED (the harness executed bash on this VM at boot); node: v24.21.0; npm: 11.19.0; python3: Python 3.12.3; git: repo checked out @ 4f53886; filesystem: WRITABLE (the harness wrote + read back a probe file); skills: 23 knowledge docs in .newera/skills/ (list_skills / read_skill); project: 
- [2026-10-09T17:38:14.693Z | VM 2/3] boot auto-setup: npm install --no-audit --no-fund ok
- [2026-10-09T17:41:12.314Z | VM 2/3] VERIFIED green: npm run test -- --reporter=verbose 2>&1 | head -200
- [2026-10-09T17:41:34.268Z | VM 2/3] VERIFIED green: npm run build 2>&1 | head -100
- [2026-10-09T17:57:14.568Z | VM 2/3] PLAN updated: 10 steps
- [2026-10-09T18:06:15.551Z | VM 2/3] VERIFIED green: npm run build 2>&1 | head -200
- [2026-10-09T18:10:18.063Z | VM 2/3] VERIFIED green: npm run build 2>&1 | head -100
- [2026-10-09T18:35:04.851Z | VM 2/3] VERIFIED green: npm run build 2>&1 | head -100
- [2026-10-09T18:37:05.882Z | VM 2/3] VERIFIED green: npm run build 2>&1 | head -100
- [2026-10-09T18:38:00.226Z | VM 2/3] VERIFIED green: npm run build 2>&1
- [2026-10-09T18:41:50.050Z | VM 2/3] VERIFIED green: npm run test 2>&1 | head -80
- [2026-10-09T18:45:15.682Z | VM 2/3] VERIFIED green: npm run test 2>&1 | head -60
- [2026-10-09T18:45:49.037Z | VM 2/3] VERIFIED green: npm run test 2>&1 | head -60
- [2026-10-09T18:55:47.186Z | VM 2/3] VERIFIED green: npm run test -- --reporter=verbose 2>&1 | head -200
- [2026-10-09T18:55:57.788Z | VM 2/3] VERIFIED green: npm run test -- --reporter=verbose 2>&1 | tail -100
- [2026-10-09T19:00:30.317Z | VM 2/3] VERIFIED green: npm run test -- --reporter=verbose 2>&1 | head -200
- [2026-10-09T19:03:37.153Z | VM 2/3] VERIFIED green: npm run test -- --reporter=verbose 2>&1 | tail -100
- [2026-10-09T19:18:40.057Z | VM 2/3] VERIFIED green: npm run test 2>&1 | head -100
- [2026-10-09T19:18:45.675Z | VM 2/3] VERIFIED green: npm run test 2>&1 | tail -50
- [2026-10-09T19:24:42.744Z | VM 2/3] VERIFIED green: npm run typecheck 2>&1
- [2026-10-09T19:30:05.458Z | VM 2/3] VERIFIED green: npm run test 2>&1 | head -100
- [2026-10-09T19:45:50.001Z | VM 2/3] VERIFIED green: npm run test -- --reporter=verbose 2>&1 | grep -A 30 'computeFanChart'
- [2026-10-09T19:48:20.659Z | VM 2/3] VERIFIED green: npm run test -- --reporter=verbose 2>&1 | head -50
- [2026-10-09T19:51:42.652Z | VM 2/3] VERIFIED green: npm run test -- --reporter=verbose 2>&1 | head -80
- [2026-10-09T19:57:13.185Z | VM 2/3] VERIFIED green: npm run test -- --reporter=verbose 2>&1 | tail -50
- [2026-10-09T19:59:07.306Z | VM 2/3] VERIFIED green: npx vitest run lib/math/__tests__/monte-carlo.test.ts --reporter=verbose 2>&1 | grep -A 30 'runs parametric simulation'
- [2026-10-09T19:59:44.774Z | VM 2/3] VERIFIED green: npx vitest run -c vitest.config.ts --reporter=verbose 2>&1 | head -100
- [2026-10-09T19:59:53.160Z | VM 2/3] VERIFIED green: cat package.json | grep -A 20 vitest
- [2026-10-09T19:59:58.425Z | VM 2/3] VERIFIED green: ls -la vitest.config.* 2>/dev/null; ls -la *.config.* 2>/dev/null
- [2026-10-09T20:03:08.759Z | VM 2/3] VERIFIED green: npm run test -- --reporter=verbose 2>&1 | tail -50
- [2026-10-09T20:03:16.559Z | VM 2/3] VERIFIED green: npm run typecheck 2>&1
- [2026-10-09T20:03:34.154Z | VM 2/3] VERIFIED green: npm run build 2>&1

## Repository state
Changed/added files:
 M .newera/vm/WORKLOG.md
 M lib/math/__tests__/backtest.test.ts
 M lib/math/__tests__/monte-carlo.test.ts
 M lib/math/__tests__/portfolio.test.ts
 M lib/math/__tests__/risk.test.ts
 M lib/math/__tests__/statistics.test.ts
 M lib/math/backtest.ts
 M lib/math/monte-carlo.ts
 M lib/math/portfolio.ts
 M lib/math/risk.ts
 M lib/math/statistics.ts
 M next.config.ts
?? .newera/vm/PLAN.json
?? agent.log
?? debug-mc.ts

Recent commits:
4f53886 agent: relay checkpoint (handoff + progress committed)

## Current plan (todo state)
## CURRENT PLAN (10 steps)
1. [~] Fix lib/math/statistics.ts - ensure all required exports (req REQ-010)  <- NOW
2. [ ] Fix lib/math/portfolio.ts - add missing exports, fix Sharpe/Sortino (req REQ-010)
3. [ ] Fix lib/math/backtest.ts - fix imports, add missing functions (req REQ-010)
4. [ ] Fix lib/math/monte-carlo.ts - export cholesky, fix types (req REQ-010)
5. [ ] Fix lib/math/risk.ts - fix index signature issues (req REQ-010)
6. [ ] Update all test files to match corrected APIs (req REQ-011)
7. [ ] Run typecheck and tests to verify (req REQ-011)
8. [ ] Build the full Next.js app (req REQ-013)
9. [ ] Implement missing pages (portfolio, backtest, monte-carlo, risk, settings) (req REQ-014)
10. [ ] Run CI pipeline and deploy (req REQ-012)
0/10 steps done

## Contract status
## TASK CONTRACT — the requirement matrix the user approved (SCOPE LOCK)
- [pending] REQ-001 — # AlphaSim — Financial Portfolio Simulator & Backtester (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-002 — ## Goal (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-003 — Build a complete, standalone, production-ready web application named **AlphaSim** using Next.js (App Router), TypeScript (strict mode), and  (MANDATORY) | acceptance: A relevant build or static verification passed after the latest relevant edit.
- [pending] REQ-004 — The app allows users to model multi-asset investment portfolios, run deterministic historical backtests, execute Monte Carlo simulations, an (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-005 — ## Stack (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-006 — Framework:** Next.js 14+ (App Router), TypeScript (strict: true) (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-007 — Styling:** Tailwind CSS (dark-themed quant/fintech aesthetic) (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-008 — Charting:** Lightweight Charts (tradingview/lightweight-charts) or Recharts for SVG-based charts (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-009 — State:** React Server Components + Client Components where needed (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-010 — Math Library:** Decoupled `lib/math/` — pure TypeScript, zero framework deps, fully unit-tested (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-011 — Testing:** Vitest for unit tests, Playwright for e2e (smoke) (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-012 — CI:** GitHub Actions (install, lint, typecheck, test, build) (MANDATORY) | acceptance: The requested tests were executed after the latest relevant edit and passed.
- [pending] REQ-013 — Deploy:** Cloudflare Pages (static export via `next build` + `output: 'export'`) (MANDATORY) | acceptance: A relevant build or static verification passed after the latest relevant edit.
- [pending] REQ-014 — ## Pages & Features (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-015 — ### 1. (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-016 — Landing Page (`/`) (MANDATORY) | acceptance: The requested file or implementation exists and its relevant contents were inspected.
- [pending] REQ-017 — Hero with app name, tagline, primary CTA → "Launch Simulator" (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-018 — Feature highlights: Backtest, Monte Carlo, Risk Metrics, Portfolio Builder (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-019 — Footer with GitHub link (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
- [pending] REQ-020 — ### 2. (MANDATORY) | acceptance: Concrete implementation evidence is recorded and the outcome matches the user request.
Work ONLY on these requirements — anything else is out of scope. Mark progress with update_contract. finish requires every MANDATORY requirement complete (or blocked with documented evidence).

## What the next VM must do
1. Check the repo state above — everything committed so far is real and on disk.
2. Do NOT redo finished work. Verify what exists (build, tests) before touching anything.
3. Continue the ORIGINAL task to completion, then finish with an honest summary.
4. If a deploy was requested and the build is green, make sure request_deploy was called (see .newera/vm/deploy-request.json).
