/**
 * Runs the AI Analyst benchmark (src/services/analystBench.ts) against a real model and writes a markdown report.
 *
 * This makes model calls through the app's own /api/openrouter proxy, and the analyst's tools fetch live data, so it
 * is run on purpose and never by `npm test`. The model defaults to the free DEFAULT_MODEL; naming a paid model bills
 * the OpenRouter key in .env (and the proxy refuses it unless OPENROUTER_ALLOWED_MODELS allows it).
 *
 *   npm run dev                                           # another terminal: serves /api/*
 *   BENCH_OUT=docs/analyst-benchmark.md npm run bench:analyst
 *
 * Optional: BENCH_MODEL=<openrouter id>, BENCH_ONLY=<question-id,question-id>, BENCH_BASE=<dev server URL>.
 * It runs under Vitest only to get Vite's `import.meta.env`, which the services read.
 *
 * The browser-only inputs are empty here: no crisis or flight data and both layers off, so questions about those are
 * "not measured" (the benchmark's questions use the country, market and series tools).
 */
import fs from 'node:fs'
import { it } from 'vitest'
import { runAgent } from '../src/services/aiAgent'
import { toolCatalogue } from '../src/services/aiTools'
import { buildDashboardContext, buildSystemPrompt, DEFAULT_MODEL, type DSMessage } from '../src/services/openrouter'
import { BENCH_QUESTIONS, renderReport, scoreRun, type BenchScore } from '../src/services/analystBench'

const OUT = process.env.BENCH_OUT
const MODEL = process.env.BENCH_MODEL || DEFAULT_MODEL
const ONLY = (process.env.BENCH_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean)
// The services call relative URLs (/api/...), which a browser resolves against the page; here, against the dev server.
const BASE = process.env.BENCH_BASE ?? 'http://localhost:5173'

it('runs the analyst benchmark', async () => {
  if (!OUT) throw new Error('set BENCH_OUT to the markdown file to write, e.g. BENCH_OUT=docs/analyst-benchmark.md')
  const questions = ONLY.length ? BENCH_QUESTIONS.filter(q => ONLY.includes(q.id)) : BENCH_QUESTIONS
  if (!questions.length) throw new Error(`no benchmark question matches ${ONLY.join(', ')}`)

  const realFetch = globalThis.fetch
  globalThis.fetch = ((input, init) => realFetch(typeof input === 'string' && input.startsWith('/') ? BASE + input : input, init)) as typeof fetch

  const ctx = { crises: [], flights: [], trajectories: [], flightsLayer: false, crisesLayer: false }
  const system: DSMessage = {
    role: 'system',
    content: buildSystemPrompt(buildDashboardContext([], [], [], '', '', '', { flightsLayer: false, crisesLayer: false }), { tools: toolCatalogue() }),
  }

  const scores: BenchScore[] = []
  for (const q of questions) {
    process.stderr.write(`${q.id} … `)
    try {
      const run = await runAgent({ messages: [system, { role: 'user', content: q.question }], model: MODEL, ctx })
      const score = scoreRun(q, run)
      scores.push(score)
      process.stderr.write(score.passed ? 'ok\n' : `failed: ${score.checks.filter(c => !c.pass).map(c => c.id).join(', ')}\n`)
    } catch (e) {
      process.stderr.write(`error: ${e instanceof Error ? e.message : e}\n`)
    }
  }
  if (scores.length < questions.length) process.stderr.write(`${questions.length - scores.length} question(s) errored and are missing from the report.\n`)
  fs.writeFileSync(OUT, renderReport(scores, { model: MODEL, date: new Date().toISOString().slice(0, 10) }))
  process.stderr.write(`wrote ${OUT}\n`)
})
