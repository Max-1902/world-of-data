/**
 * Pass/fail grading of stored eval answers against the v2 grounding expectations (src/research/grounding.ts).
 * No model calls: reads results written by eval.ts.
 *
 *   npm run research:grade -- research/eval/results/<stamp>_<model>.jsonl [more.jsonl …]
 *
 * Writes <file>.grades.json next to each results file and prints pass rates per question and per model.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gradeAnswer, type Grade } from '../../src/research/grounding'
import { ROOT, writeJson } from './lib'

interface Row { contextId: string; questionId: string; repeat: number; modelRequested: string; error: string | null; answer: string; notMeasured: { what: string; why: string }[] }

const { questions } = JSON.parse(readFileSync(resolve(ROOT, 'research/eval/questions-v2.json'), 'utf8')) as { questions: { id: string; prompt: string; needs: string }[] }
const contextOf = (id: string) => (JSON.parse(readFileSync(resolve(ROOT, 'research/data/dashboard', `${id}.json`), 'utf8')) as { context: string }).context

const files = process.argv.slice(2)
if (!files.length) { console.error('pass one or more results .jsonl files'); process.exit(1) }
for (const file of files) {
  const rows = readFileSync(resolve(process.cwd(), file), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as Row)
  const graded = rows.map(r => {
    const q = questions.find(x => x.id === r.questionId)
    if (!q) throw new Error(`${r.questionId} is not in questions-v2.json`)
    const g: Grade = r.error
      ? { questionId: q.id, pass: false, checks: [{ name: 'model call succeeded', ok: false, detail: r.error }] }
      : gradeAnswer(q, r.answer, contextOf(r.contextId), r.notMeasured)
    return { contextId: r.contextId, repeat: r.repeat, error: r.error, ...g }
  })
  const byQuestion = Object.fromEntries([...new Set(graded.map(g => g.questionId))].map(id => {
    const gs = graded.filter(g => g.questionId === id)
    return [id, { pass: gs.filter(g => g.pass).length, of: gs.length, failedChecks: [...new Set(gs.flatMap(g => g.checks.filter(c => !c.ok).map(c => c.name)))] }]
  }))
  const failedCheck: Record<string, number> = {}
  for (const g of graded) for (const c of g.checks) if (!c.ok) failedCheck[c.name] = (failedCheck[c.name] ?? 0) + 1
  const summary = {
    model: rows[0]?.modelRequested, answers: graded.length, errors: graded.filter(g => g.error).length,
    pass: graded.filter(g => g.pass).length, failedCheck, byQuestion,
  }
  writeJson(resolve(process.cwd(), file.replace(/\.jsonl$/, '.grades.json')), { summary, graded })
  console.log(`\n${summary.model}: ${summary.pass}/${summary.answers} pass (${summary.errors} call errors)`)
  console.log('failed checks:', failedCheck)
  for (const [id, s] of Object.entries(byQuestion)) console.log(`  ${id}: ${s.pass}/${s.of}${s.failedChecks.length ? `  ✗ ${s.failedChecks.join('; ')}` : ''}`)
}
