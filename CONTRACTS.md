# CONTRACTS

AUTO-GENERATED after every successful file write. Do not edit by hand - your edits will be overwritten.

This is the authoritative list of what exists in this project. If a symbol is not listed here and not in a file you have read during this run, IT DOES NOT EXIST. Do not reference it. Read the file or write the symbol first.

## Dependencies (package.json)

- `@playwright/test` `^1.48.2`
- `@tailwindcss/turbopack` `^4`
- `@types/lodash-es` `^4.17.12`
- `@types/node` `^20`
- `@types/pako` `^2.0.3`
- `@types/react` `^19`
- `@types/react-dom` `^19`
- `@vitest/coverage-v8` `^2.1.4`
- `date-fns` `^3.6.0`
- `eslint` `^9`
- `eslint-config-next` `16.4.0`
- `lightweight-charts` `^4.2.1`
- `lodash-es` `^4.17.21`
- `next` `16.4.0`
- `pako` `^2.1.0`
- `playwright` `^1.48.2`
- `react` `19.3.0`
- `react-dom` `19.3.0`
- `recharts` `^2.12.7`
- `tailwindcss` `^4`
- `tsx` `^4.19.2`
- `typescript` `^5`
- `vitest` `^2.1.4`
- `zod` `^3.23.8`

Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`, `test:coverage`, `e2e`, `e2e:ui`, `data:build`

## Files and public API

### `eslint.config.mjs` - 19 lines
- exports: (nothing public)

### `lib/math/__tests__/backtest.test.ts` - 263 lines
- imports: `lib/math/backtest.ts`, `lib/math/portfolio.ts`
- exports: (nothing public)

### `lib/math/__tests__/monte-carlo.test.ts` - 244 lines
- imports: `lib/math/monte-carlo.ts`, `lib/math/statistics.ts`
- exports: (nothing public)

### `lib/math/__tests__/portfolio.test.ts` - 214 lines
- imports: `lib/math/portfolio.ts`
- exports: (nothing public)

### `lib/math/__tests__/risk.test.ts` - 252 lines
- imports: `lib/math/risk.ts`
- exports: (nothing public)

### `lib/math/__tests__/statistics.test.ts` - 359 lines
- imports: `lib/math/statistics.ts`
- exports: (nothing public)

### `lib/math/backtest.ts` - 390 lines
- imports: `lib/math/statistics.ts`, `lib/math/portfolio.ts`
- `PriceSeries` (interface)
- `AlignedData` (interface): dates, prices, tickers
- `BacktestInput` (interface): endDate, initialCapital, rebalanceFrequency, startDate, tickers, weights
- `BacktestResult` (interface): dates, drawdown, equityCurve, metrics, periodReturns, seed, trades
- `BacktestMetrics` (interface): annualizedReturn, annualizedVolatility, bestMonth, cagr, calmar, maxDrawdown, sharpe, sortino, totalReturn, volatility, winRate, worstMonth
- `MonthlyReturn` (interface): month, year
- `alignSeries` (function)
- `computeDailyReturns` (function)
- `applyWeights` (function)
- `isRebalanceDate` (function)
- `rebalancePortfolio` (function)
- `computeMetrics` (function)
- `computeMonthlyReturns` (function)
- `runBacktest` (function)

### `lib/math/index.ts` - 10 lines
- imports: `lib/math/statistics.ts`, `lib/math/portfolio.ts`, `lib/math/backtest.ts`, `lib/math/monte-carlo.ts`, `lib/math/risk.ts`
- exports: (nothing public)

### `lib/math/monte-carlo.ts` - 552 lines
- imports: `lib/math/statistics.ts`
- `MonteCarloInput` (interface): correlationStructure, covarianceMatrix, expectedReturns, historicalReturns, horizonMonths, initialCapital, model, paths, seed, tickers, weights
- `MonteCarloResult` (interface): cagrs, equityCurves, fanChart, histogram, maxDrawdowns, paths, pathTable, probabilityMetrics, terminalWealth, varES
- `FanChartData` (interface): median, p10, p5, p90, p95
- `HistogramBin` (interface): bin, count, density
- `ProbabilityMetrics` (interface): prob10x, prob2x, probLoss
- `VaRES` (interface): es95, es99, var95, var99
- `PathSummary` (interface): cagr, finalValue, maxDrawdown, pathIndex
- `createRNG` (function)
- `boxMuller` (function)
- `generateCorrelatedNormals` (function)
- `generatePaths` (function)
- `generateBootstrapPaths` (function)
- `computeEquityCurves` (function)
- `computeFanChartPercentiles` (function)
- `computeTerminalWealthHistogram` (function)
- `computeProbabilityMetrics` (function)
- `computeVaRES` (function)
- `computePathSummaries` (function)
- `runMonteCarlo` (function)

### `lib/math/portfolio.ts` - 205 lines
- imports: `lib/math/statistics.ts`
- `PortfolioAsset` (interface): expectedReturn, ticker, volatility, weight
- `Weights` (interface)
- `Trade` (interface): price, shares, side, ticker, value
- `portfolioReturn` (function)
- `portfolioVolatility` (function)
- `portfolioSharpe` (function)
- `portfolioSortino` (function)
- `portfolioMaxDrawdown` (function)
- `portfolioCAGR` (function)
- `rebalanceWeights` (function)
- `normalizeWeights` (function)
- `validateWeights` (function)
- `computeTurnover` (function)
- `computePeriodReturns` (function)
- `assetContribution` (function)

### `lib/math/risk.ts` - 499 lines
- imports: `lib/math/statistics.ts`
- `FactorModelResult` (interface): alpha, betas, residuals, rSquared, tStats
- `RiskDecompositionResult` (interface): cr, mcr, pctr
- `StressTestScenario` (interface): assetShocks, name, portfolioReturn
- `RiskAnalysisResult` (interface): es, factorModel, pca, riskDecomposition, stressTests
- `RollingRiskMetrics` (interface): rollingMaxDD, rollingSharpe, rollingVol
- `ScenarioInput` (interface): name, shocks
- `ScenarioResult` (interface): assetReturns, name, portfolioReturn
- `computeHistoricalVaR` (function)
- `computeHistoricalES` (function)
- `computeParametricVaR` (function)
- `computeParametricES` (function)
- `computeCornishFisherVaR` (function)
- `computeFactorModel` (function)
- `computeRiskDecomposition` (function)
- `runStressTests` (function)
- `runRiskAnalysis` (function)
- `computeRollingRiskMetrics` (function)
- `scenarioAnalysis` (function)

### `lib/math/statistics.ts` - 320 lines
- `mean` (function)
- `variance` (function)
- `std` (function)
- `skew` (function)
- `kurtosis` (function)
- `percentile` (function)
- `covariance` (function)
- `correlation` (function)
- `covarianceMatrix` (function)
- `correlationMatrix` (function)
- `shrinkage` (function)
- `logReturns` (function)
- `simpleReturns` (function)
- `drawdownSeries` (function)
- `maxDrawdown` (function)
- `cagr` (function)
- `annualizeReturn` (function)
- `annualizeVolatility` (function)
- `sharpeRatio` (function)
- `sortinoRatio` (function)
- `calmarRatio` (function)
- `multiplyMatrixVector` (function)
- `multiplyMatrices` (function)
- `transpose` (function)
- `choleskyDecomposition` (function)
- `eigenvalues` (function)
- `pcaVarianceExplained` (function)

### `next-env.d.ts` - 6 lines
- exports: (nothing public)

### `next.config.ts` - 21 lines
- exports: (nothing public)

### `scripts/build-data.ts` - 183 lines
- imports: `public/data/universe.json`
- exports: (nothing public)

### `src/app/globals.css` - 85 lines
- exports: (nothing public)

### `src/app/layout.tsx` - 54 lines
- imports: `src/app/globals.css`
- `RootLayout` (function)
- `metadata` (const): authors, description, keywords, openGraph, title
- `viewport` (const): themeColor
- default export: `RootLayout`

### `src/app/page.tsx` - 70 lines
- `Home` (function)
- default export: `Home`

## Unresolved references

- (none) - every internal import resolves.
