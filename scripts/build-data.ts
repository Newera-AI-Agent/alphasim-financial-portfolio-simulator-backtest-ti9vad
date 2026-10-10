/**
 * Build script to generate synthetic price data for the universe
 * Run with: npm run data:build
 */
import { writeFileSync, mkdirSync } from "fs";
import { gzipSync } from "zlib";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import universe from "../public/data/universe.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

type UniverseAsset = {
  ticker: string;
  name: string;
  sector: string;
  expenseRatio: number;
  expectedReturn: number;
  volatility: number;
};

const UNIVERSE = universe as UniverseAsset[];

// Generate ~10 years of daily data (252 trading days/year * 10 = 2520 days)
const TRADING_DAYS_PER_YEAR = 252;
const YEARS = 10;
const TOTAL_DAYS = TRADING_DAYS_PER_YEAR * YEARS;

// Start date: 10 years ago from now
const endDate = new Date();
const startDate = new Date(endDate);
startDate.setFullYear(endDate.getFullYear() - YEARS);

// Generate trading dates (skip weekends)
function generateTradingDates(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) { // Not Sunday (0) or Saturday (6)
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

const tradingDates = generateTradingDates(startDate, endDate).slice(-TOTAL_DAYS);

// Seeded random for reproducibility
class SeededRandom {
  private seed: number;
  constructor(seed: number) { this.seed = seed; }
  next(): number {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  nextNormal(): number {
    const u1 = this.next();
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

// Generate correlated returns using a simple factor model
function generateCorrelatedReturns(
  tickers: string[],
  expectedReturns: number[],
  volatilities: number[],
  dates: Date[],
  seed: number
): Record<string, number[]> {
  const n = tickers.length;
  const T = dates.length;
  
  // Market factor
  const marketRng = new SeededRandom(seed + 1000);
  const marketReturns: number[] = [];
  const marketMu = 0.10 / TRADING_DAYS_PER_YEAR;
  const marketSigma = 0.16 / Math.sqrt(TRADING_DAYS_PER_YEAR);
  for (let t = 0; t < T; t++) {
    marketReturns.push(marketMu + marketSigma * marketRng.nextNormal());
  }

  // Generate asset returns with beta to market + idiosyncratic noise
  const assetReturns: Record<string, number[]> = {};
  
  for (let i = 0; i < n; i++) {
    const ticker = tickers[i];
    const mu = expectedReturns[i] / TRADING_DAYS_PER_YEAR;
    const sigma = volatilities[i] / Math.sqrt(TRADING_DAYS_PER_YEAR);
    
    // Beta between 0.5 and 1.5 based on sector
    const beta = 0.5 + (i % 10) * 0.1;
    const idioSigma = sigma * Math.sqrt(1 - 0.5 * 0.5); // Assume R^2 ~ 0.5
    
    const assetRng = new SeededRandom(seed + i + 2000);
    const returns: number[] = [];
    
    for (let t = 0; t < T; t++) {
      const marketComponent = beta * marketReturns[t];
      const idioComponent = idioSigma * assetRng.nextNormal();
      returns.push(mu + marketComponent + idioComponent);
    }
    assetReturns[ticker] = returns;
  }

  return assetReturns;
}

// Convert returns to prices
function returnsToPrices(returns: number[], startPrice = 100): number[] {
  const prices: number[] = [startPrice];
  for (const r of returns) {
    prices.push(prices[prices.length - 1] * Math.exp(r));
  }
  return prices.slice(1); // Remove initial price to match returns length
}

function main() {
  console.log("Generating synthetic price data...");
  
  const tickers = UNIVERSE.map((a) => a.ticker);
  const expectedReturns = UNIVERSE.map((a) => a.expectedReturn);
  const volatilities = UNIVERSE.map((a) => a.volatility);
  
  const assetReturns = generateCorrelatedReturns(
    tickers,
    expectedReturns,
    volatilities,
    tradingDates,
    42 // Fixed seed for reproducibility
  );

  // Build prices object
  const pricesData: Record<string, { dates: string[]; prices: number[] }> = {};
  
  for (const ticker of tickers) {
    const returns = assetReturns[ticker];
    const startPrice = 50 + Math.random() * 200; // Random start price 50-250
    const prices = returnsToPrices(returns, startPrice);
    
    pricesData[ticker] = {
      dates: tradingDates.map((d) => d.toISOString().split("T")[0]),
      prices,
    };
  }

  // Write prices.json
  const pricesPath = join(projectRoot, "public", "data", "prices.json");
  mkdirSync(dirname(pricesPath), { recursive: true });
  writeFileSync(pricesPath, JSON.stringify(pricesData));
  console.log(`Written ${pricesPath} (${(JSON.stringify(pricesData).length / 1024 / 1024).toFixed(2)} MB)`);

  // Write gzipped version
  const gzipped = gzipSync(Buffer.from(JSON.stringify(pricesData)));
  const gzPath = join(projectRoot, "public", "data", "prices.json.gz");
  writeFileSync(gzPath, gzipped);
  console.log(`Written ${gzPath} (${(gzipped.length / 1024 / 1024).toFixed(2)} MB gzipped)`);

  // Generate Fama-French 3-factor mock data
  const factorRng = new SeededRandom(42 + 5000);
  const factorData = {
    dates: tradingDates.map((d) => d.toISOString().split("T")[0]),
    mkt: Array.from({ length: tradingDates.length }, () => 0.10 / TRADING_DAYS_PER_YEAR + (0.16 / Math.sqrt(TRADING_DAYS_PER_YEAR)) * factorRng.nextNormal()),
    smb: Array.from({ length: tradingDates.length }, () => 0.02 / TRADING_DAYS_PER_YEAR + (0.10 / Math.sqrt(TRADING_DAYS_PER_YEAR)) * factorRng.nextNormal()),
    hml: Array.from({ length: tradingDates.length }, () => 0.03 / TRADING_DAYS_PER_YEAR + (0.10 / Math.sqrt(TRADING_DAYS_PER_YEAR)) * factorRng.nextNormal()),
    rf: Array.from({ length: tradingDates.length }, () => 0.02 / TRADING_DAYS_PER_YEAR),
  };

  const factorsPath = join(projectRoot, "public", "data", "factors.json");
  writeFileSync(factorsPath, JSON.stringify(factorData));
  console.log(`Written ${factorsPath}`);

  console.log("Data generation complete!");
}

main();
