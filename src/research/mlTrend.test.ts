import { describe, it, expect } from 'vitest'
import { fitStandardizer, standardize, trainLogistic, predict, timeSplit, elevatedLabel, featureVector } from './mlTrend'
import { aggregateDaily, replay, type AggRow, type Observation } from './backtest'
import { FLAT_DEADZONE } from '../utils/trajectory'

const row = (event_date: string, country: string, severity: AggRow['severity'] = 'high'): AggRow => ({ event_date, country, severity, fatalities: 0 })

describe('fitStandardizer / standardize', () => {
  it('centres to zero mean and unit variance', () => {
    const X = [[1, 10], [2, 10], [3, 10]]
    const s = fitStandardizer(X)
    expect(s.mean).toEqual([2, 10])
    const Xs = standardize(X, s)
    expect(Xs.reduce((sum, row) => sum + row[0], 0)).toBeCloseTo(0)
    // constant column (std forced to 1) centres to 0 without throwing
    expect(Xs.every(row => row[1] === 0)).toBe(true)
  })
})

describe('trainLogistic / predict', () => {
  it('learns a separable rule: label is 1 exactly when feature 0 is positive', () => {
    const examples: Observation[] = []
    const y: (0 | 1)[] = []
    for (let i = -20; i <= 20; i++) { examples.push(obsWith([i, 0])); y.push(i > 0 ? 1 : 0) }
    const model = trainLogistic(examples.map(featureVector), y, { iterations: 300 })
    expect(predict(model, obsWith([15, 0]))).toBeGreaterThan(0.8)
    expect(predict(model, obsWith([-15, 0]))).toBeLessThan(0.2)
    expect(model.trainedOn.examples).toBe(41)
    expect(model.trainedOn.positives).toBe(20)
  })

  it('throws on no examples rather than silently returning a degenerate model', () => {
    expect(() => trainLogistic([], [])).toThrow()
  })
})

function obsWith(firstTwo: [number, number]): Observation {
  return {
    asOf: 'd', country: 'c', trend: 'flat', delta: 0, recent: firstTwo[0], priorPace: firstTwo[1], next: 0, shown: false,
    features: { mid: 0, recentCount: 0, priorCount: 0, shortMomentum: 0, daysSinceLast: 10 },
  }
}

describe('elevatedLabel', () => {
  it('matches the backtest definition of elevated', () => {
    const o = obsWith([0, 0])
    o.next = 10
    o.priorPace = 2
    expect(elevatedLabel(o, FLAT_DEADZONE)).toBe(1)
    o.next = 2.5
    expect(elevatedLabel(o, FLAT_DEADZONE)).toBe(0)
  })
})

describe('timeSplit', () => {
  it('puts every training example strictly before every test example by asOf date', () => {
    const rows = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05'].flatMap(d => [row(d, 'A'), row(d, 'B')])
    const agg = aggregateDaily(rows)
    const obs = replay(agg, '2025-12-20', '2026-01-10')
    const { train, test } = timeSplit(obs, 0.5)
    expect(train.length).toBeGreaterThan(0)
    expect(test.length).toBeGreaterThan(0)
    const maxTrain = Math.max(...train.map(o => Date.parse(o.asOf)))
    const minTest = Math.min(...test.map(o => Date.parse(o.asOf)))
    expect(maxTrain).toBeLessThan(minTest)
  })
})

describe('featureVector', () => {
  it('has one entry per declared feature name', () => {
    expect(featureVector(obsWith([1, 2]))).toHaveLength(7)
  })
})
