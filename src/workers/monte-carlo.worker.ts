// Monte Carlo Web Worker - runs simulation off the main thread
// This file is bundled by Next.js for the worker

import {
  runMonteCarlo,
  type MonteCarloConfig,
  type MonteCarloResult,
} from '../../lib/math/monte-carlo';

self.onmessage = (e: MessageEvent) => {
  const { type, config } = e.data;

  if (type === 'run') {
    try {
      const result = runMonteCarlo(config);
      self.postMessage({ type: 'result', result });
    } catch (err) {
      self.postMessage({ type: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }
};

export {};
