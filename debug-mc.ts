import * as mc from './lib/math/monte-carlo';
import * as stats from './lib/math/statistics';

const assetReturns = [
  [0.01, 0.02, -0.01, 0.015, -0.005, 0.02, -0.01, 0.005, 0.01, -0.015],
  [0.005, 0.01, -0.005, 0.01, -0.01, 0.015, -0.005, 0.01, -0.01, 0.02],
  [-0.005, 0.01, 0.015, -0.01, 0.02, -0.005, 0.01, -0.01, 0.015, 0.005],
];

const weights = [0.4, 0.35, 0.25];
const meanReturns = assetReturns.map(r => stats.mean(r));
const covMatrix = stats.covarianceMatrix(assetReturns);

const config: mc.MonteCarloConfig = {
  numPaths: 100,
  horizonMonths: 12,
  initialCapital: 100000,
  weights,
  meanReturns,
  covMatrix,
  model: 'parametric',
  seed: 42,
};

const result = mc.runMonteCarlo(config);
console.log('Result:', JSON.stringify(result, null, 2));
console.log('Summary:', result.summary);
console.log('medianTerminalWealth:', result.summary?.medianTerminalWealth);
console.log('terminalWealths:', result.paths.map(p => p.terminalWealth).slice(0, 5));
