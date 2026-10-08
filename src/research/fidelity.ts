/**
 * Number fidelity: does every number the model states appear in the context it was given?
 *
 * The analyst is told to cite only numbers present in its context (services/openrouter.ts buildSystemPrompt).
 * This scorer checks that mechanically. It is a heuristic, not a judge:
 *  - "supported" means the value (or a rounding of a context value at the answer's precision) occurs
 *    somewhere in the context or the question — not that it was used in the right place.
 *  - "unsupported" numbers may still be legitimate (a correct sum, a date, general knowledge clearly marked
 *    as such). Every unsupported number is returned with its surrounding text for manual review; the score
 *    is an upper bound on ungrounded numbers, not a count of hallucinations.
 *  - Years (1900–2100, no decimals or unit) are reported separately and excluded from the score, because the
 *    prompt allows marked background knowledge and years are its most common form.
 */
import { visibleText, type NotMeasured } from '../services/openrouter'

export interface NumberMention {
  raw: string
  value: number
  /** decimals as written — the precision a context value is rounded to before comparing */
  decimals: number
  /** 1, 1e3, 1e6, 1e9 for "k"/"thousand", "million", "bn"/"billion" */
  scale: number
  percent: boolean
  index: number
}

// No bare "m" suffix: in these answers it is as often minutes or metres as millions.
const NUM = /(?<![\p{L}\d.,])(?<!\p{L}-)([-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)(\s?(?:%|percent\b|per cent\b|k\b|thousand\b|million\b|bn\b|billion\b))?(?![\p{L}\d])/giu
const SCALE: Record<string, number> = { k: 1e3, thousand: 1e3, million: 1e6, bn: 1e9, billion: 1e9 }

/** Every number in `text`, skipping list markers ("1. ", "2) ") and digits glued to letters (G7, COVID-19, 72h). */
export function extractNumbers(text: string): NumberMention[] {
  const out: NumberMention[] = []
  for (const m of text.matchAll(NUM)) {
    const raw = m[1]
    const unit = (m[2] ?? '').trim().toLowerCase()
    const index = m.index!
    const lineStart = text.lastIndexOf('\n', index - 1) + 1
    const after = text.slice(index + m[0].length, index + m[0].length + 2)
    if (!unit && /^\s*$/.test(text.slice(lineStart, index)) && /^[.)]\s/.test(after)) continue // "1. item"
    if (!unit && /^[-–]\p{L}/u.test(after)) continue // "72-hour", "10-day": a window label, not a reading
    const clean = raw.replace(/,/g, '')
    out.push({
      raw: m[0].trim(),
      value: Number(clean),
      decimals: clean.includes('.') ? clean.split('.')[1].length : 0,
      scale: SCALE[unit] ?? 1,
      percent: unit === '%' || unit.startsWith('per'),
      index,
    })
  }
  return out
}

export function isYear(n: NumberMention): boolean {
  return n.decimals === 0 && n.scale === 1 && !n.percent && !/,/.test(n.raw) && n.value >= 1900 && n.value <= 2100
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d

/** Whether `n` matches one of the reference values, allowing the answer to round a reference value. */
export function isSupported(n: NumberMention, reference: number[]): boolean {
  const target = Math.abs(n.value)
  return reference.some(c => {
    const a = Math.abs(c)
    if (a === target * n.scale) return true
    return round(a / n.scale, n.decimals) === target
  })
}

export interface Unsupported { raw: string; snippet: string }

export interface FidelityResult {
  /** numbers checked (years excluded) */
  checked: number
  supported: number
  unsupported: Unsupported[]
  years: string[]
  /** supported / checked; null when the answer states no numbers (not a perfect score) */
  score: number | null
}

function snippet(text: string, index: number): string {
  return text.slice(Math.max(0, index - 40), index + 40).replace(/\s+/g, ' ').trim()
}

/** The prose the user actually reads (see visibleText), trimmed. */
export function briefingText(answer: string): string {
  return visibleText(answer).trim()
}

/** Fewer words than this is not a briefing (a bare list of commands, a one-line stub). */
export const MIN_BRIEFING_WORDS = 20

export function isBriefing(answer: string): boolean {
  return briefingText(answer).split(/\s+/).filter(w => /\p{L}/u.test(w)).length >= MIN_BRIEFING_WORDS
}

export function scoreFidelity(answer: string, context: string, question = ''): FidelityResult {
  const body = briefingText(answer)
  const reference = [...extractNumbers(context), ...extractNumbers(question)].map(n => n.value * n.scale)
  const res: FidelityResult = { checked: 0, supported: 0, unsupported: [], years: [], score: null }
  for (const n of extractNumbers(body)) {
    if (isYear(n)) { res.years.push(n.raw); continue }
    res.checked++
    if (isSupported(n, reference)) res.supported++
    else res.unsupported.push({ raw: n.raw, snippet: snippet(body, n.index) })
  }
  res.score = res.checked ? res.supported / res.checked : null
  return res
}

// ── NOT MEASURED violations ───────────────────────────────────────────────

/** Phrasings that state a count or an absence for an input the context marked as not measured. */
const VIOLATION: Record<string, RegExp> = {
  'Air traffic': /\b(?:\d[\d,]*|no|zero|few|low|reduced|minimal)\s+(?:airborne\s+|tracked\s+|commercial\s+|military\s+)?(?:flights?|aircraft|planes|air traffic)\b|\b(?:flights?|aircraft) tracked:?\s*\d|\babsence of (?:flights?|aircraft|air traffic)\b|\bair traffic (?:is|was|appears|remains) (?:low|absent|normal|quiet|light|minimal|reduced)\b/i,
  'Live conflict events': /\b(?:\d[\d,]*|no|zero)\s+(?:live\s+|active\s+|new\s+|recorded\s+|tracked\s+)?(?:conflict\s+)?(?:events?|incidents?)\b|\btotal events:?\s*\d/i,
}

export interface Violation { what: string; snippet: string }

/**
 * Sentences that state a count, an absence or a level for something the context marked NOT MEASURED.
 * Pattern-based: catches the "0 flights → no aircraft" failure seen in practice, not every paraphrase.
 */
export function notMeasuredViolations(answer: string, missing: NotMeasured[]): Violation[] {
  const out: Violation[] = []
  for (const m of missing) {
    const re = VIOLATION[m.what]
    if (!re) continue
    const hit = new RegExp(re.source, 'gi')
    for (const x of answer.matchAll(hit)) {
      // Saying it wasn't measured is the correct behaviour, not a violation.
      const around = snippet(answer, x.index!)
      if (/not (?:been )?measured|no (?:flight |conflict )?data|not available|unavailable|unknown/i.test(around)) continue
      out.push({ what: m.what, snippet: around })
    }
  }
  return out
}

/** NOT MEASURED items as printed in a context from buildDashboardContext (frozen contexts carry no structured copy). */
export function parseNotMeasured(context: string): NotMeasured[] {
  const block = context.match(/\nNOT MEASURED[^\n]*\n((?:  • [^\n]+\n?)+)/)
  if (!block) return []
  return block[1].trim().split('\n').map(l => {
    const [what, ...why] = l.replace(/^\s*• /, '').split(': ')
    return { what, why: why.join(': ') }
  })
}
