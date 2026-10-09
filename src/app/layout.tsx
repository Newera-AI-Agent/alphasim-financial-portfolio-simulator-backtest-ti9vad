import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "AlphaSim — Financial Portfolio Simulator & Backtester",
    template: "%s | AlphaSim",
  },
  description: "Model multi-asset portfolios, run historical backtests, execute Monte Carlo simulations, and inspect quantitative risk metrics.",
  keywords: ["portfolio", "backtest", "monte carlo", "risk metrics", "quantitative finance", "investment simulator"],
  authors: [{ name: "AlphaSim" }],
  openGraph: {
    title: "AlphaSim — Financial Portfolio Simulator & Backtester",
    description: "Model multi-asset portfolios, run historical backtests, execute Monte Carlo simulations, and inspect quantitative risk metrics.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jetBrainsMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--color-bg)] text-[var(--color-fg)]">{children}</body>
    </html>
  );
}
