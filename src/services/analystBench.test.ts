import { describe, it, expect } from 'vitest'
import { BENCH_QUESTIONS, TIME_AWARE_TOOLS, renderReport, scoreRun, type BenchQuestion, type BenchRun } from './analystBench'
import { TOOL_BY_NAME } from './aiTools'

const result = (id: string, tool: string, text: string, over: Partial<BenchRun['results'][number]> = {}) =>
  ({ id, tool, ok: true, call: `[DATA:${tool}]`, title: `${tool} result`, text, ...over })
const q = (over: Partial<BenchQuestion> = {}): BenchQuestion => ({ id: 'q', category: 'rate', question: '?', ...over })
const checkOf = (s: ReturnType<typeof scoreRun>, id: string) => s.checks.find(c => c.id === id)

describe('question set', () => {
  it('has unique ids, covers every category, and asks only for tools that exist', () => {
    expect(new Set(BENCH_QUESTIONS.map(x => x.id)).size).toBe(BENCH_QUESTIONS.length)
    expect(new Set(BENCH_QUESTIONS.map(x => x.category))).toEqual(new Set(['rate', 'period', 'cross-country', 'level']))
    for (const t of TIME_AWARE_TOOLS) expect(TOOL_BY_NAME.has(t), t).toBe(true)
  })
  it('gives every change or period question something checkable', () => {
    for (const x of BENCH_QUESTIONS.filter(y => y.category === 'rate' || y.category === 'period')) {
      expect(x.needsChange || x.period?.length || x.countries?.length, x.id).toBeTruthy()
    }
  })
})

describe('time-aware evidence (the documented failure: asked about change, answered with levels)', () => {
  const answer = 'Highest inflation: Argentina 211.4 (R1) [dashboard].'
  it('fails a change question answered only from a ranking of current levels', () => {
    const s = scoreRun(q({ needsChange: true }), { answer, results: [result('R1', 'rank', 'Argentina 211.4')] })
    expect(checkOf(s, 'time-aware-evidence')?.pass).toBe(false)
    expect(checkOf(s, 'time-aware-evidence')?.detail).toContain('only snapshot data')
    expect(s.passed).toBe(false)
  })
  it('passes once a time series was fetched', () => {
    const s = scoreRun(q({ needsChange: true }), { answer, results: [result('R1', 'rank', 'Argentina 211.4'), result('R2', 'series', 'Argentina 2022 94.8')] })
    expect(checkOf(s, 'time-aware-evidence')?.pass).toBe(true)
  })
  it('does not count a failed fetch as evidence, and does not apply to questions that are not about change', () => {
    const failed = scoreRun(q({ needsChange: true }), { answer, results: [result('R1', 'series', 'could not fetch', { ok: false })] })
    expect(checkOf(failed, 'time-aware-evidence')?.pass).toBe(false)
    expect(failed.toolFailures).toBe(1)
    expect(checkOf(scoreRun(q(), { answer, results: [] }), 'time-aware-evidence')).toBeUndefined()
  })
})

describe('citations', () => {
  it('requires at least one cited result and no citation of a result that was never fetched', () => {
    const results = [result('R1', 'rank', 'x')]
    expect(checkOf(scoreRun(q(), { answer: 'No citation here.', results }), 'cites-evidence')?.pass).toBe(false)
    const bad = checkOf(scoreRun(q(), { answer: 'See (R1) and (R7).', results }), 'cites-evidence')
    expect(bad?.pass).toBe(false)
    expect(bad?.detail).toContain('R7')
    expect(checkOf(scoreRun(q(), { answer: 'See (R1).', results }), 'cites-evidence')?.pass).toBe(true)
  })
})

describe('grounded numbers', () => {
  const results = [result('R1', 'series', 'Germany GDP growth: 2023: -0.3%, 2024: -0.2%, 2025: 0.46%. Population 83,200,000.')]
  const grounded = (answer: string) => checkOf(scoreRun(q(), { answer, results }), 'grounded-numbers')!

  it('accepts figures that appear in a result, rounded, with thousands separators or a scale word', () => {
    expect(grounded('Growth was -0.3% in 2023 (R1) [dashboard]. It reached 0.5% in 2025 (R1) [dashboard].').pass).toBe(true)
    expect(grounded('Population is 83,200,000 (R1); about 83.2 million (R1).').pass).toBe(true)
  })
  it('flags a figure the model was not given', () => {
    const c = grounded('Growth was 1.9% in 2024 (R1) [dashboard].')
    expect(c.pass).toBe(false)
    expect(c.detail).toContain('1.9')
  })
  it('ignores citation ids, years, list numbers, chart commands and small counts', () => {
    expect(grounded('1. Germany (R1)\n2. France (R1)\n[CHART:R1]\nIn 2023 and 2024 there were 3 declines (R1).').pass).toBe(true)
  })
  it('leaves out sentences the answer labels [background] or [inference]', () => {
    expect(grounded('The gap is 0.76 points [inference].\nThe war began in 2022 with 190000 troops [background].').pass).toBe(true)
    expect(grounded('| Germany | 0.76 | inference |').pass).toBe(true)
  })
  it('only checks results that were actually fetched', () => {
    const s = scoreRun(q(), { answer: 'Growth was 0.46% (R1) [dashboard].', results: [result('R1', 'series', 'Germany 0.46', { ok: false })] })
    expect(checkOf(s, 'grounded-numbers')?.pass).toBe(false)
  })
})

describe('countries and period', () => {
  const results = [result('R1', 'series', 'Poland 2015 3.8; Czechia 2015 5.4; Hungary 2015 3.7')]
  it('requires each country in the answer and in the fetched data', () => {
    const question = q({ countries: ['Poland', 'Czechia', 'Hungary'] })
    expect(checkOf(scoreRun(question, { answer: 'Poland and Czechia grew (R1).', results }), 'covers-countries')?.detail).toContain('never names Hungary')
    expect(checkOf(scoreRun(question, { answer: 'Poland, Czechia, Hungary (R1).', results: [result('R1', 'series', 'Poland 3.8; Czechia 5.4')] }), 'covers-countries')?.detail).toContain('no fetched result mentions Hungary')
    expect(checkOf(scoreRun(question, { answer: 'Poland, Czechia, Hungary (R1).', results }), 'covers-countries')?.pass).toBe(true)
  })
  it('requires the period asked about to be stated', () => {
    const question = q({ period: ['2022', '2023'] })
    expect(checkOf(scoreRun(question, { answer: 'Inflation in 2023 was 4.3 (R1).', results }), 'states-period')?.detail).toContain('2022')
    expect(checkOf(scoreRun(question, { answer: 'From 2022 to 2023 (R1).', results }), 'states-period')?.pass).toBe(true)
  })
})

describe('renderReport', () => {
  it('summarises per category, lists each failed check with its reason, and states the limits', () => {
    const rate = scoreRun(q({ id: 'rate-1', needsChange: true }), { answer: 'Argentina 211.4 (R1).', results: [result('R1', 'rank', 'Argentina 211.4')] })
    const level = scoreRun(q({ id: 'level-1', category: 'level' }), { answer: 'Argentina 211.4 (R1).', results: [result('R1', 'rank', 'Argentina 211.4')] })
    const md = renderReport([rate, level], { model: 'm:free', date: '2026-10-28' })
    expect(md).toContain('| rate | 1 | 0 |')
    expect(md).toContain('| level | 1 | 1 |')
    expect(md).toContain('`rate-1` — uses time-aware data for a change question: asked about change')
    expect(md).toContain('not an accuracy figure')
    expect(renderReport([level], { model: 'm', date: 'd' })).toContain('None.')
  })
})
