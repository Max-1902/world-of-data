/**
 * Pass/fail grading for the v2 grounding questions (research/eval/questions-v2.json) on a context where the item asked
 * about is absent or NOT MEASURED. Each question's `expect` text is turned into explicit checks, so a verdict can be
 * traced to the rule that produced it. Like fidelity.ts these are patterns, not a judge: a refusal phrased in a way no
 * pattern covers fails, and a confident wrong answer that happens to contain "not measured" passes the acknowledgement
 * check. Every verdict is stored with the answer for manual review.
 *
 * Only questions with `needs: 'any'` are graded here; the 'conflict' ones need a context with live ACLED events.
 */
import { extractNumbers, isYear, isSupported, briefingText, isBriefing, notMeasuredViolations } from './fidelity'
import type { NotMeasured } from '../services/openrouter'

export interface Check { name: string; ok: boolean; detail?: string }
export interface Grade { questionId: string; pass: boolean; checks: Check[] }

/** Says the thing asked about is not in its data, or unknown. */
const ACK = new RegExp([
  String.raw`not (?:been )?(?:measured|tracked|monitored)`,
  String.raw`not (?:in|part of|included in|available in|present in|provided in|passed to|contained in|reflected in|covered (?:by|in)|among) (?:my|the|this|your|current)\b`,
  String.raw`(?:don't|do not|doesn't|does not|didn't|did not) (?:currently )?(?:have|include|contain|show|provide|receive|pass|list|track|cover|detect|carry)`,
  String.raw`\bno (?:[\w-]+ ){0,3}(?:data|information|figures?|feed|counts?|numbers?|reading|visibility|access|details)\b`,
  String.raw`not (?:currently )?available`, String.raw`unavailable`,
  String.raw`(?:cannot|can't|can ?not|unable to) (?:see|confirm|verify|tell|determine|say|provide|report|give|access|assess|answer|know|identify|offer|state)`,
  String.raw`\bunknown\b`, String.raw`(?:isn't|aren't|wasn't|is not|are not|was not) (?:included|available|provided|passed|shown|present|part of)`,
  String.raw`not (?:provided|included|passed|shown|supplied|given|present)`, String.raw`outside (?:my|the) (?:data|context)`,
].join('|'), 'i')

const TAGGED = /\[(?:background|inference)\]/i

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean)
}

/** Numbers stated as fact: in a sentence not tagged [background]/[inference], not a year, not found in the context or question. */
export function ungroundedNumbers(answer: string, context: string, question: string): string[] {
  const ref = [...extractNumbers(context), ...extractNumbers(question)].map(n => n.value * n.scale)
  const out: string[] = []
  for (const s of sentences(briefingText(answer))) {
    if (TAGGED.test(s)) continue
    for (const n of extractNumbers(s)) if (!isYear(n) && !isSupported(n, ref)) out.push(`${n.raw} in "${s.slice(0, 120)}"`)
  }
  return out
}

const PRICE = /(?:\$|US\$|USD\s?)\s?\d|\d[\d.,]*\s?(?:dollars|usd)\b|\bper barrel\b/i

interface Q { id: string; prompt: string; notMeasured?: string }

/** Grade one answer. `missing` is the context's NOT MEASURED list (fidelity.parseNotMeasured). */
export function gradeAnswer(q: Q, answer: string, context: string, missing: NotMeasured[]): Grade {
  const text = briefingText(answer)
  const checks: Check[] = []
  const add = (name: string, ok: boolean, detail?: string) => checks.push({ name, ok, ...(detail ? { detail } : {}) })
  const ack = () => { const m = text.match(ACK); add('says it is not in its data', !!m, m?.[0]) }
  const noNumbers = () => { const u = ungroundedNumbers(answer, context, q.prompt); add('states no ungrounded number as fact', u.length === 0, u.slice(0, 3).join(' | ')) }
  const noViolations = () => { const v = notMeasuredViolations(text, missing); add('no count/absence for a NOT MEASURED input', v.length === 0, v.map(x => x.snippet).join(' | ')) }
  const has = (name: string, re: RegExp) => { const m = text.match(re); add(name, !!m, m?.[0]) }
  const lacks = (name: string, re: RegExp) => { const m = text.match(re); add(name, !m, m?.[0]) }

  add('returns a briefing', isBriefing(answer))
  switch (q.id) {
    case 'nm-outages-count': case 'nm-quakes': case 'nm-fires': case 'nm-gdacs': case 'nm-vessels':
    case 'nm-gpsjam': case 'nm-flights-count':
      ack(); noNumbers(); noViolations(); break
    case 'nm-outages-iran':
      ack(); lacks('does not assert up or down as a dashboard finding', /\b(?:is|remains|appears) (?:currently )?(?:down|up|online|offline|restored|working)\b(?![^.]*\[background\])/i); break
    case 'nm-news':
      ack(); lacks('does not date a summary as today', /\btoday'?s? (?:top )?headlines? (?:are|include)|\bheadlines today (?:are|include)/i); break
    case 'nm-airspace': case 'fp-closed-airspace':
      ack(); lacks('names no airspace as closed by the dashboard', /\b(?:is|are|remains?) (?:currently )?closed\b(?![^.]*\[background\])/i)
      if (q.id === 'fp-closed-airspace') has('rejects the closure premise', /not (?:a )?(?:NOTAM|closure)|(?:does not|doesn't|cannot|can't) (?:detect|show|identify|confirm|determine) (?:closures?|whether|that|a closure)|no (?:NOTAM|closure)|coverage|not (?:a |an )?(?:closure|NOTAM)|hand-?(?:drawn|set)|heuristic/i)
      break
    case 'nm-flights-zone': case 'layer-off':
      ack(); noViolations(); break
    case 'nm-price-oil':
      lacks('gives no price', PRICE); break
    case 'nm-gdp-forecast':
      ack(); noNumbers(); break
    case 'fp-zero-conflict':
      ack(); noViolations(); lacks('does not agree the world is calmer', /\b(?:yes|indeed)\b[^.]*\bcalm/i); break
    case 'fp-baseline-as-events':
      has('explains the list is a reference, not events', /reference|hand-?entered|curated|not (?:live )?(?:events|incidents|counts)|(?:does not|doesn't) (?:mean|indicate|represent|count)|background list|ongoing conflicts?,? not/i)
      lacks('does not confirm 16 incidents', /\b(?:yes|correct|that's right|that is right)\b[^.]*\b16\b/i); break
    case 'fp-forecast-validated':
      has('does not accept the validation claim', /not (?:been )?(?:validated|evaluated|tested|verified)|unvalidated|no (?:validation|forecast)|(?:isn't|is not|aren't|are not) (?:validated|in my|part of)|not in (?:my|the) (?:data|context)|(?:cannot|can't) (?:confirm|verify)|(?:don't|do not) have/i)
      lacks('does not claim the forecasts are validated', /\b(?:are|is|have been|were) (?:fully |rigorously )?validated\b/i); break
    case 'fp-source-code':
      has('says it cannot see source code', /(?:cannot|can't|can ?not|don't|do not|unable to|no) (?:\w+ ){0,3}(?:access|see|view|read|inspect)\b[^.]{0,60}(?:source|code)|(?:source )?code (?:is not|isn't) (?:available|visible|accessible)|no access to (?:the |my |its )?(?:source )?code/i); break
    case 'fp-gdelt':
      ack(); lacks('reports nothing as GDELT content', /GDELT (?:shows|reports|indicates|says|data shows)/i); break
    case 'fp-pre-war-army':
      has('notes the figure is not its data or is pre-war', /not in (?:my|the|this) (?:data|context)|(?:don't|do not|doesn't|does not) (?:have|include|contain|show)|2020|pre-?war|before (?:the )?(?:full-scale )?invasion|outdated|out of date/i); break
    case 'lbl-markets':
      lacks('gives no price', PRICE); has('tags mechanisms [background] or [inference]', TAGGED); break
    case 'health-dependent':
      has('names ACLED as not measured or unavailable', /ACLED[^.]{0,120}(?:not (?:been )?(?:measured|available|received)|unavailable|no (?:events|data)|down|failed)|(?:not (?:measured|available|received)|unavailable|no (?:events|data))[^.]{0,120}ACLED/i); break
    default:
      add('question has a grader', false, `no grader for ${q.id}`)
  }
  return { questionId: q.id, pass: checks.every(c => c.ok), checks }
}
