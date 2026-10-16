/**
 * Offline eval harness for the AI Analyst. Sends a fixed question set against frozen contexts, with the
 * app's own system prompt and sampling settings, and scores every answer for number fidelity and for
 * NOT MEASURED violations (src/research/fidelity.ts). "Offline" = the inputs are frozen files, not live feeds;
 * the model call itself goes to OpenRouter.
 *
 *   npx tsx scripts/research/eval.ts --contexts research/data/dashboard [--repeats 3] [--questions probe-flights,probe-trend]
 *   npx tsx scripts/research/eval.ts --contexts ai-runs-2026-10-08.jsonl     # contexts from the panel's "Export runs"
 *   npx tsx scripts/research/eval.ts --contexts research/data/dashboard --question-set v2   # 34-prompt grounding set
 *
 * Cost guard: only `:free` models run unless --allow-paid is passed explicitly (DEFAULT_MODEL is free).
 * Writes research/eval/results/<stamp>_<model>.jsonl (every answer) and .summary.json.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, basename, dirname } from 'node:path'
import { buildSystemPrompt, CHAT_PARAMS, DEFAULT_MODEL } from '../../src/services/openrouter'
import type { NotMeasured } from '../../src/services/openrouter'
import { scoreFidelity, notMeasuredViolations, parseNotMeasured, briefingText, isBriefing } from '../../src/research/fidelity'
import { ROOT, loadEnv, writeJson, arg, flag } from './lib'

/** --question-set v2 reads research/eval/questions-v2.json; the default stays the frozen v1 set. */
function questionSetPath(): string {
  const v = arg('question-set')
  return v && v !== 'v1' ? `research/eval/questions-${v}.json` : 'research/eval/questions.json'
}

interface Ctx {
  id: string
  context: string
  /** full system message to send verbatim (e.g. a pre-fix prompt for an A/B); default buildSystemPrompt(context) */
  system?: string
  /** ground truth of what was not measured; default: parsed from the context's NOT MEASURED block */
  notMeasured?: NotMeasured[]
}
interface Question { id: string; kind: string; prompt: string }

const CONTEXT_START = '=== WORLD SURVEILLANCE DASHBOARD'

/** Frozen contexts from recorder files (a dir or one .json) or from a JSONL export of logged AI runs. */
function loadContexts(path: string): Ctx[] {
  const abs = resolve(process.cwd(), path)
  if (statSync(abs).isDirectory()) {
    return readdirSync(abs).filter(f => f.endsWith('.json')).sort().flatMap(f => loadContexts(resolve(abs, f)))
  }
  if (abs.endsWith('.jsonl')) {
    return readFileSync(abs, 'utf8').split('\n').filter(Boolean).flatMap(line => {
      const run = JSON.parse(line) as { id: string; messages: { role: string; content: string }[] }
      const sys = run.messages.find(m => m.role === 'system')?.content ?? ''
      const i = sys.indexOf(CONTEXT_START)
      return i === -1 ? [] : [{ id: `run:${run.id}`, context: sys.slice(i) }]
    })
  }
  const file = JSON.parse(readFileSync(abs, 'utf8')) as Omit<Ctx, 'id'>
  return file.context ? [{ id: basename(abs, '.json'), context: file.context, system: file.system, notMeasured: file.notMeasured }] : []
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const GAP_MS = 4000 // OpenRouter free tier allows ~20 requests/min

interface Answer { answer: string; reasoning: string | null; modelAnswered: string | null; usage: unknown; error?: string }

async function ask(model: string, system: string, prompt: string): Promise<Answer> {
  const fail = (error: string): Answer => ({ answer: '', reasoning: null, modelAnswered: null, usage: null, error })
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], ...CHAT_PARAMS }),
      signal: AbortSignal.timeout(180_000),
    }).catch((e: Error) => e)
    if (res instanceof Error) return fail(res.message)
    const json = await res.json().catch(() => ({})) as { model?: string; usage?: unknown; error?: { code?: number; message?: string }; choices?: { message?: { content?: string; reasoning?: string } }[] }
    // Free models share an upstream pool; a 429 can arrive as the HTTP status or inside a 200 body.
    if (res.status === 429 || json.error?.code === 429) { await sleep(20_000 * (attempt + 1)); continue }
    if (!res.ok || json.error) return fail(`HTTP ${res.status}: ${json.error?.message ?? ''}`.slice(0, 300))
    const msg = json.choices?.[0]?.message
    return { answer: msg?.content ?? '', reasoning: msg?.reasoning ?? null, modelAnswered: json.model ?? null, usage: json.usage ?? null }
  }
  return fail('rate-limited after 4 attempts')
}

/** Scores derived from a stored answer — kept separate so --rescore can recompute them after a scorer change. */
function score(answer: string, context: string, question: string, missing: NotMeasured[]) {
  return {
    briefing: isBriefing(answer),
    fidelity: answer ? scoreFidelity(answer, context, question) : null,
    violations: answer ? notMeasuredViolations(briefingText(answer), missing) : [],
  }
}

/** Recompute scores for a stored results file (no model calls) and rewrite it and its summary. */
function rescore(file: string) {
  const abs = resolve(process.cwd(), file)
  const { questions } = JSON.parse(readFileSync(resolve(ROOT, questionSetPath()), 'utf8')) as { questions: Question[] }
  const contexts = new Map<string, Ctx>()
  for (const c of loadContexts(resolve(ROOT, 'research/eval/contexts'))) contexts.set(c.id, c)
  const rows = readFileSync(abs, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as Record<string, any>)
  for (const r of rows) {
    const ctx = contexts.get(r.contextId)
    if (!ctx) throw new Error(`context ${r.contextId} not found in research/eval/contexts`)
    Object.assign(r, score(r.answer, ctx.context, questions.find(q => q.id === r.questionId)?.prompt ?? '', r.notMeasured))
  }
  writeFileSync(abs, rows.map(r => JSON.stringify(r)).join('\n') + '\n')
  const base = abs.replace(/\.jsonl$/, '')
  const old = JSON.parse(readFileSync(`${base}.summary.json`, 'utf8'))
  writeJson(`${base}.summary.json`, summarise(rows, { model: old.model, contexts: old.contexts, repeats: old.repeats, ranAt: old.ranAt, rescoredAt: new Date().toISOString() }))
  console.log(`rescored ${rows.length} answers in ${file}`)
}

async function main() {
  loadEnv()
  const toRescore = arg('rescore')
  if (toRescore) return rescore(toRescore)
  const model = arg('model') ?? DEFAULT_MODEL
  if (!model.endsWith(':free') && !flag('allow-paid')) {
    console.error(`${model} is not a :free model and would bill the OpenRouter account. Pass --allow-paid to run it anyway.`)
    process.exit(1)
  }
  if (!process.env.OPENROUTER_KEY) { console.error('OPENROUTER_KEY not set'); process.exit(1) }
  const contextsPath = arg('contexts')
  if (!contextsPath) { console.error('--contexts <dir|file.json|runs.jsonl> is required'); process.exit(1) }

  const contexts = loadContexts(contextsPath)
  const only = arg('questions')?.split(',')
  const { questions } = JSON.parse(readFileSync(resolve(ROOT, questionSetPath()), 'utf8')) as { questions: Question[] }
  const qs = only ? questions.filter(q => only.includes(q.id)) : questions
  const repeats = Number(arg('repeats') ?? 3)
  const total = contexts.length * qs.length * repeats
  console.log(`${contexts.length} context(s) × ${qs.length} question(s) × ${repeats} repeat(s) = ${total} calls to ${model}`)

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const base = resolve(ROOT, 'research/eval/results', `${stamp}_${model.replace(/[^\w.-]+/g, '_')}`)
  const results: Record<string, unknown>[] = []
  let i = 0
  for (const ctx of contexts) {
    const system = ctx.system ?? buildSystemPrompt(ctx.context)
    const missing = ctx.notMeasured ?? parseNotMeasured(ctx.context)
    for (const q of qs) {
      for (let r = 0; r < repeats; r++) {
        if (i++) await sleep(GAP_MS)
        const t0 = Date.now()
        const out = await ask(model, system, q.prompt)
        const sc = score(out.answer, ctx.context, q.prompt, missing)
        results.push({
          contextId: ctx.id, questionId: q.id, repeat: r, modelRequested: model, modelAnswered: out.modelAnswered,
          params: CHAT_PARAMS, ms: Date.now() - t0, usage: out.usage, error: out.error ?? null,
          answer: out.answer, reasoning: out.reasoning, notMeasured: missing, ...sc,
        })
        console.log(`[${i}/${total}] ${ctx.id} ${q.id} #${r}: ${out.error ? `ERROR ${out.error}` : `${sc.briefing ? 'briefing' : 'NO BRIEFING'}, fidelity ${sc.fidelity?.score == null ? 'n/a' : sc.fidelity.score.toFixed(2)} (${sc.fidelity?.unsupported.length} unsupported), ${sc.violations.length} violation(s)`}`)
      }
    }
  }
  mkdirSync(dirname(base), { recursive: true })
  writeFileSync(`${base}.jsonl`, results.map(r => JSON.stringify(r)).join('\n') + '\n')
  writeJson(`${base}.summary.json`, summarise(results, { model, contexts: contexts.map(c => c.id), repeats, ranAt: new Date().toISOString() }))
  console.log(`\nwrote ${base}.jsonl and .summary.json`)
}

type Row = { contextId: string; questionId: string; error?: string | null; answer: string; briefing?: boolean; fidelity: ReturnType<typeof scoreFidelity> | null; violations: unknown[] }

function summarise(rows: Record<string, unknown>[], meta: Record<string, unknown>) {
  const stats = (rs: Row[]) => {
    const ok = rs.filter(r => !r.error && r.answer.trim())
    const briefings = ok.filter(r => r.briefing)
    const scored = briefings.filter(r => r.fidelity?.score != null)
    return {
      calls: rs.length,
      answered: ok.length,
      // Fidelity and violations are only meaningful for answers that contain a briefing at all.
      briefings: briefings.length,
      withNumbers: scored.length,
      meanFidelity: scored.length ? scored.reduce((s, r) => s + r.fidelity!.score!, 0) / scored.length : null,
      answersWithUnsupported: scored.filter(r => r.fidelity!.unsupported.length > 0).length,
      unsupportedNumbers: scored.reduce((s, r) => s + r.fidelity!.unsupported.length, 0),
      checkedNumbers: scored.reduce((s, r) => s + r.fidelity!.checked, 0),
      briefingsWithViolations: briefings.filter(r => r.violations.length > 0).length,
    }
  }
  const rs = rows as unknown as Row[]
  const group = (key: 'contextId' | 'questionId') => Object.fromEntries([...new Set(rs.map(r => r[key]))].map(id => [id, stats(rs.filter(r => r[key] === id))]))
  return { ...meta, overall: stats(rs), byContext: group('contextId'), byQuestion: group('questionId') }
}

main().catch(e => { console.error(e); process.exit(1) })
