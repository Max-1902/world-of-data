/**
 * A small benchmark for the AI Analyst: questions of the kinds it gets wrong in a known way (asked about change,
 * answered with levels; asked about a period, answered without it; asked to compare countries, covered only one) and
 * a scorer that checks a finished run against them. Pure and offline: the scorer reads an `AgentRun`'s answer and tool
 * results, so it is unit-tested with hand-made runs; producing a real run needs a model call (scripts/bench-analyst.ts,
 * run on purpose, never from `npm test`).
 *
 * What the checks are: detectors for specific failure classes. What they are not: a grade of whether an answer is
 * right. An answer can pass every check and still be wrong, and the number check is a heuristic that can flag a figure
 * the model legitimately derived. Pass rates over a dozen questions and one run each say where to look, not how
 * accurate the analyst is.
 */
import type { ToolResult } from './aiTools'

export type BenchCategory = 'rate' | 'period' | 'cross-country' | 'level'

export interface BenchQuestion {
  id: string
  category: BenchCategory
  question: string
  /** the question is about change or a rate: the answer must rest on a time-aware result, not a snapshot of levels */
  needsChange?: boolean
  /** every one must be named in the answer and appear in the data the model was given */
  countries?: string[]
  /** every one must be stated in the answer (a year, or the window asked about) */
  period?: string[]
}

export const BENCH_QUESTIONS: BenchQuestion[] = [
  { id: 'rate-infl-vs-growth', category: 'rate', needsChange: true,
    question: 'Which economies have inflation rising fastest relative to GDP growth?' },
  { id: 'rate-de-growth', category: 'rate', needsChange: true, countries: ['Germany'], period: ['2019'],
    question: "Is Germany's GDP growth accelerating or slowing compared with 2019?" },
  { id: 'rate-es-unemployment', category: 'rate', needsChange: true, countries: ['Spain'], period: ['2019'],
    question: 'How has unemployment in Spain changed since 2019?' },
  { id: 'rate-crude-stocks', category: 'rate', needsChange: true,
    question: 'Are US crude oil inventories building or drawing over the last several weeks?' },
  { id: 'period-jp-inflation', category: 'period', countries: ['Japan'], period: ['2022', '2023'],
    question: "Compare Japan's inflation in 2022 and 2023." },
  { id: 'period-br-growth', category: 'period', countries: ['Brazil'], period: ['2020', '2021'],
    question: "What was Brazil's GDP growth in 2020 versus 2021?" },
  { id: 'period-ca-latest', category: 'period', countries: ['Canada'],
    question: "What is Canada's most recent GDP growth figure, and which year does it refer to?" },
  { id: 'cross-hormuz', category: 'cross-country', countries: ['India', 'Japan'],
    question: 'Which is more exposed to a disruption of the Strait of Hormuz, India or Japan?' },
  { id: 'cross-visegrad-growth', category: 'cross-country', needsChange: true, countries: ['Poland', 'Czechia', 'Hungary'], period: ['2015'],
    question: 'Compare GDP growth in Poland, Czechia and Hungary since 2015.' },
  { id: 'cross-debt', category: 'cross-country', countries: ['France', 'Italy', 'Spain'],
    question: 'Rank France, Italy and Spain by public debt as a share of GDP.' },
  { id: 'level-de-china-exports', category: 'level', countries: ['Germany', 'China'],
    question: "What share of Germany's exports goes to China?" },
  { id: 'level-top-inflation', category: 'level',
    question: 'Which economies have the highest inflation right now?' },
]

/** Tools whose output spans time, so a change or a rate can be read from it. The others return one snapshot. */
export const TIME_AWARE_TOOLS = new Set(['series', 'forecast', 'history', 'nowcast', 'refugees', 'inventories'])

export type CheckId = 'cites-evidence' | 'time-aware-evidence' | 'grounded-numbers' | 'covers-countries' | 'states-period'

export interface Check { id: CheckId; pass: boolean; detail: string }
export interface BenchScore {
  id: string
  category: BenchCategory
  checks: Check[]
  /** every applicable check passed */
  passed: boolean
  /** tool requests that failed (the model was told "could not fetch") */
  toolFailures: number
}

/** The part of an `AgentRun` the scorer needs. */
export interface BenchRun { answer: string; results: Pick<ToolResult, 'id' | 'tool' | 'ok' | 'call' | 'title' | 'text'>[] }

// ── Numbers ──────────────────────────────────────────────────────────────────

const SCALE: Record<string, number> = { thousand: 1e3, k: 1e3, million: 1e6, m: 1e6, mn: 1e6, billion: 1e9, bn: 1e9, b: 1e9, trillion: 1e12, tn: 1e12 }
const NUM = /(-?\d[\d,]*(?:\.\d+)?)(?:\s*(thousand|million|billion|trillion|mn|bn|tn|k|m|b)\b)?/gi

interface Figure { value: number; decimals: number; scaled: boolean }

function figures(text: string): Figure[] {
  const out: Figure[] = []
  for (const m of text.matchAll(NUM)) {
    const raw = m[1].replace(/,/g, '')
    const value = Number(raw)
    if (!Number.isFinite(value)) continue
    const scale = m[2] ? SCALE[m[2].toLowerCase()] : 1
    out.push({ value: value * scale, decimals: (raw.split('.')[1] ?? '').length, scaled: scale !== 1 })
  }
  return out
}

/** The numbers in a line that make a claim: not citation ids, chart commands, list numbers, years or small counts. */
function claimedFigures(line: string): Figure[] {
  const cleaned = line
    .replace(/\[(?:CHART|DATA|FLY|COUNTRY)[^\]]*\]/gi, ' ')
    .replace(/\bR\d+\b/g, ' ')
    .replace(/\b(?:COVID-19|G-?20|G-?7)\b/gi, ' ')
    .replace(/^\s*(?:[-*]\s+|\d+[.)]\s+|#+\s+)/, '')
    .replace(/\b(?:19|20)\d{2}\b(?!\.\d)/g, ' ')
  return figures(cleaned).filter(f => f.scaled || f.decimals > 0 || f.value > 10)
}

function grounded(f: Figure, source: Figure[]): boolean {
  return source.some(s => {
    if (f.scaled || s.value === 0) return Math.abs(s.value - f.value) <= Math.abs(f.value) * 0.005
    // the model rounded a longer figure: 3.46 → 3.5
    const k = 10 ** f.decimals
    return Math.round(s.value * k) / k === f.value
  })
}

/** A sentence or table row the answer itself labels as not read off the dashboard data. */
const NOT_DASHBOARD = /\[(?:background|inference)\]|\binference\b|\bown arithmetic\b|\bfrom (?:my|general) knowledge\b/i

// ── Scoring ──────────────────────────────────────────────────────────────────

const has = (hay: string, needle: string) => hay.toLowerCase().includes(needle.toLowerCase())

export function scoreRun(q: BenchQuestion, run: BenchRun): BenchScore {
  const ok = run.results.filter(r => r.ok)
  const checks: Check[] = []

  // 1. The answer rests on evidence it can point to.
  const cited = [...new Set(run.answer.match(/\bR\d+\b/g) ?? [])]
  const known = new Set(run.results.map(r => r.id))
  const unknown = cited.filter(id => !known.has(id))
  checks.push({
    id: 'cites-evidence',
    pass: cited.length > 0 && unknown.length === 0,
    detail: !cited.length ? 'the answer cites no result id' : unknown.length ? `cites ${unknown.join(', ')}, which were never fetched` : `cites ${cited.join(', ')}`,
  })

  // 2. A question about change or a rate needs data that has more than one point in time.
  if (q.needsChange) {
    const tools = [...new Set(ok.filter(r => TIME_AWARE_TOOLS.has(r.tool)).map(r => r.tool))]
    checks.push({
      id: 'time-aware-evidence',
      pass: tools.length > 0,
      detail: tools.length ? `used ${tools.join(', ')}` : `asked about change, but only snapshot data was fetched (${[...new Set(ok.map(r => r.tool))].join(', ') || 'nothing'})`,
    })
  }

  // 3. Every figure the answer states as dashboard data is one the model was given.
  const evidence = ok.flatMap(r => figures(`${r.title}\n${r.text}`))
  const ungrounded: string[] = []
  for (const line of run.answer.split('\n')) {
    if (NOT_DASHBOARD.test(line)) continue
    for (const f of claimedFigures(line)) if (!grounded(f, evidence)) ungrounded.push(String(f.scaled ? f.value : f.value.toFixed(f.decimals)))
  }
  checks.push({
    id: 'grounded-numbers',
    pass: ungrounded.length === 0,
    detail: ungrounded.length ? `not in any fetched result and not labelled [background] or [inference]: ${[...new Set(ungrounded)].join(', ')}` : 'every stated figure appears in a fetched result',
  })

  // 4. A comparison covers each country it was asked about, in the answer and in the data.
  if (q.countries?.length) {
    const corpus = ok.map(r => `${r.call}\n${r.title}\n${r.text}`).join('\n')
    const missingInAnswer = q.countries.filter(c => !has(run.answer, c))
    const missingInData = q.countries.filter(c => !has(corpus, c))
    checks.push({
      id: 'covers-countries',
      pass: !missingInAnswer.length && !missingInData.length,
      detail: missingInAnswer.length ? `answer never names ${missingInAnswer.join(', ')}` : missingInData.length ? `no fetched result mentions ${missingInData.join(', ')}` : `covers ${q.countries.join(', ')}`,
    })
  }

  // 5. The period asked about is the period the answer talks about.
  if (q.period?.length) {
    const missing = q.period.filter(p => !has(run.answer, p))
    checks.push({
      id: 'states-period',
      pass: missing.length === 0,
      detail: missing.length ? `answer never states ${missing.join(', ')}` : `states ${q.period.join(', ')}`,
    })
  }

  return { id: q.id, category: q.category, checks, passed: checks.every(c => c.pass), toolFailures: run.results.length - ok.length }
}

// ── Reporting ────────────────────────────────────────────────────────────────

const CHECK_LABEL: Record<CheckId, string> = {
  'cites-evidence': 'cites fetched evidence',
  'time-aware-evidence': 'uses time-aware data for a change question',
  'grounded-numbers': 'figures appear in fetched results',
  'covers-countries': 'covers every country asked about',
  'states-period': 'states the period asked about',
}

/** A markdown report: what was run, per-category pass counts, every failed check with its reason, and the limits. */
export function renderReport(scores: BenchScore[], meta: { model: string; date: string }): string {
  const cats = [...new Set(scores.map(s => s.category))]
  const lines = [
    `# AI Analyst benchmark — ${meta.date}`,
    '',
    `Model: \`${meta.model}\`. ${scores.length} questions, one run each. The checks detect specific failure classes (see \`src/services/analystBench.ts\`); passing them does not mean an answer is correct, and with this few runs the counts below are a place to look, not an accuracy figure.`,
    '',
    '| Category | Questions | Passed every check |',
    '|---|---|---|',
    ...cats.map(c => { const s = scores.filter(x => x.category === c); return `| ${c} | ${s.length} | ${s.filter(x => x.passed).length} |` }),
    '',
    '## Failed checks',
    '',
  ]
  const failed = scores.flatMap(s => s.checks.filter(c => !c.pass).map(c => `- \`${s.id}\` — ${CHECK_LABEL[c.id]}: ${c.detail}`))
  lines.push(...(failed.length ? failed : ['None.']))
  const failures = scores.filter(s => s.toolFailures > 0)
  if (failures.length) lines.push('', '## Tool requests that failed', '', ...failures.map(s => `- \`${s.id}\`: ${s.toolFailures}`))
  return lines.join('\n') + '\n'
}
