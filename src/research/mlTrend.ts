/**
 * A learned alternative to the Watchlist's hand-written trend flag (utils/trajectory.ts classifyTrend).
 *
 * This is a research comparison, not a replacement: classifyTrend ships in the app unchanged. This module
 * trains a small logistic regression offline, from the same (asOf, country) observations the backtest
 * already replays (src/research/backtest.ts), to predict exactly the label the backtest measures —
 * "elevated": is the severity score over the next 72h above the prior week's pace by more than the flat
 * band. The point of training it is to find out, with the same backtest harness and the same lift metric
 * used for the rule, whether a model that sees more of the window than one scalar delta actually does
 * better — not to assume it will.
 *
 * No network calls, no framework dependency: plain batch gradient descent on standardised features, pure
 * and synchronous so it can run in a test and in a Node script on the same code path.
 */
import type { Observation } from './backtest'

export const FEATURE_NAMES = ['recent', 'priorPace', 'mid', 'recentCount', 'priorCount', 'shortMomentum', 'daysSinceLast'] as const
export type FeatureName = typeof FEATURE_NAMES[number]

export function featureVector(o: Observation): number[] {
  return [o.recent, o.priorPace, o.features.mid, o.features.recentCount, o.features.priorCount, o.features.shortMomentum, o.features.daysSinceLast]
}

/** Elevated: next 72h above the prior week's pace by more than the flat band — the same label the backtest's `rates()` reports. */
export function elevatedLabel(o: Observation, flatDeadzone: number): 0 | 1 {
  return o.next - o.priorPace > flatDeadzone ? 1 : 0
}

export interface Standardizer { mean: number[]; std: number[] }

export function fitStandardizer(X: number[][]): Standardizer {
  const n = X.length
  const d = X[0]?.length ?? 0
  const mean = Array.from({ length: d }, (_, j) => X.reduce((s, row) => s + row[j], 0) / n)
  const std = Array.from({ length: d }, (_, j) => {
    const v = X.reduce((s, row) => s + (row[j] - mean[j]) ** 2, 0) / n
    return Math.sqrt(v) || 1 // constant column: avoid divide-by-zero, leaves it at 0 after centring
  })
  return { mean, std }
}

export function standardize(X: number[][], s: Standardizer): number[][] {
  return X.map(row => row.map((v, j) => (v - s.mean[j]) / s.std[j]))
}

export interface LogisticModel {
  v: 1
  features: FeatureName[]
  weights: number[]
  bias: number
  standardizer: Standardizer
  /** training diagnostics, for honest reporting alongside the model — not used at prediction time */
  trainedOn: { examples: number; positives: number; iterations: number; finalLoss: number }
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

/**
 * Batch gradient descent, L2-regularised logistic regression. Deterministic (zero init, fixed iteration
 * count) so the same inputs always produce the same model — no random seed to document or lose.
 */
export function trainLogistic(X: number[][], y: (0 | 1)[], opts: { iterations?: number; learningRate?: number; l2?: number } = {}): LogisticModel {
  const { iterations = 500, learningRate = 0.1, l2 = 0.01 } = opts
  const n = X.length
  if (n === 0) throw new Error('trainLogistic: no training examples')
  const d = X[0].length
  const standardizer = fitStandardizer(X)
  const Xs = standardize(X, standardizer)

  let weights = new Array(d).fill(0)
  let bias = 0
  let finalLoss = NaN
  for (let it = 0; it < iterations; it++) {
    const gradW = new Array(d).fill(0)
    let gradB = 0
    let loss = 0
    for (let i = 0; i < n; i++) {
      const z = Xs[i].reduce((s, x, j) => s + x * weights[j], bias)
      const p = sigmoid(z)
      const err = p - y[i]
      for (let j = 0; j < d; j++) gradW[j] += err * Xs[i][j]
      gradB += err
      const eps = 1e-12
      loss += -(y[i] * Math.log(p + eps) + (1 - y[i]) * Math.log(1 - p + eps))
    }
    for (let j = 0; j < d; j++) weights[j] -= learningRate * (gradW[j] / n + l2 * weights[j])
    bias -= learningRate * (gradB / n)
    finalLoss = loss / n
  }

  return {
    v: 1,
    features: [...FEATURE_NAMES],
    weights, bias, standardizer,
    trainedOn: { examples: n, positives: y.reduce((s: number, v) => s + v, 0), iterations, finalLoss },
  }
}

/** Probability that `o` is "elevated" over the next 72h, per the model. */
export function predict(model: LogisticModel, o: Observation): number {
  const x = standardize([featureVector(o)], model.standardizer)[0]
  const z = x.reduce((s, v, j) => s + v * model.weights[j], model.bias)
  return sigmoid(z)
}

/**
 * Splits observations by `asOf` date at `trainFraction` through the sorted, unique date list — all
 * training examples strictly before all test examples. A random split would leak information (the same
 * country's neighbouring days end up on both sides of windows that overlap), so this is time-based, the
 * only split that matches how the model would actually be used: trained on the past, scored on the future.
 */
export function timeSplit(obs: Observation[], trainFraction = 0.7): { train: Observation[]; test: Observation[] } {
  const days = [...new Set(obs.map(o => o.asOf))].sort()
  const cut = days[Math.max(1, Math.min(days.length - 1, Math.round(days.length * trainFraction)))]
  return { train: obs.filter(o => o.asOf < cut), test: obs.filter(o => o.asOf >= cut) }
}
