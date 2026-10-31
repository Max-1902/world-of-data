/**
 * The AI Analyst's investigation loop. One user question can take several model turns: a turn that asks for data
 * (`[DATA:…]` lines, see services/aiTools.ts) gets those queries run locally and the results sent back, and the model
 * continues until it writes an answer without further requests, or the round limit forces it to.
 *
 * Model-agnostic on purpose: a text protocol instead of provider tool-calling, so the free models (several of which
 * do not support function calling on OpenRouter) and paid ones behave the same, and the server proxy keeps its fixed
 * request shape (api/openrouter/chat/completions.ts).
 */
import { streamAIWithFallback, visibleText, type DSMessage } from './openrouter'
import { parseToolCalls, runTool, formatToolResults, MAX_CALLS_PER_STEP, type ToolCall, type ToolContext, type ToolResult } from './aiTools'

/** Data rounds before the model must answer. Each round is one model call; the answer is one more. (Paid models; free ones get fewer, see analystTiers.ts.) */
export const MAX_DATA_ROUNDS = 4

export type AgentEvent =
  | { type: 'step'; step: number }
  | { type: 'text'; step: number; raw: string }
  | { type: 'tools'; step: number; calls: ToolCall[] }
  | { type: 'result'; step: number; result: ToolResult }
  | { type: 'fallback'; from: string; to: string; why: 'rate-limited' | 'unavailable' }

export interface AgentRun {
  /** raw text of the final turn (command and chart lines included) */
  answer: string
  /** model that wrote the final turn */
  answeredBy: string | null
  /** everything sent and received, in order: the input messages, then each data round (assistant request + results) */
  transcript: DSMessage[]
  results: ToolResult[]
  /** model calls made */
  steps: number
}

export interface AgentOptions {
  messages: DSMessage[]
  model: string
  ctx: ToolContext
  signal?: AbortSignal
  onEvent?: (e: AgentEvent) => void
  maxRounds?: number
  /** data requests honoured per round (default MAX_CALLS_PER_STEP) */
  perRound?: number
  /** injectable for tests */
  stream?: typeof streamAIWithFallback
  run?: typeof runTool
}

export const LAST_ROUND_NOTE = 'That was the last data round. Write the final answer now from the data you have, with no further [DATA:…] requests.'
/** Sent once when a final turn has no answer text (only data requests, a tool-call block, or nothing after hidden reasoning). */
export const EMPTY_ANSWER_NOTE = 'Your last reply contained no answer text. Write the answer to my question now, in plain text, from the data above. Do not request more data.'

export async function runAgent(o: AgentOptions): Promise<AgentRun> {
  const stream = o.stream ?? streamAIWithFallback
  const run = o.run ?? runTool
  const maxRounds = o.maxRounds ?? MAX_DATA_ROUNDS
  const perRound = o.perRound ?? MAX_CALLS_PER_STEP
  let nudged = false
  const transcript = [...o.messages]
  const results: ToolResult[] = []
  // same query twice in one investigation → same result (and id); ids are assigned before any await so they never collide
  const byKey = new Map<string, Promise<ToolResult>>()
  let model = o.model
  let answeredBy: string | null = null

  for (let step = 0; ; step++) {
    o.onEvent?.({ type: 'step', step })
    let raw = ''
    answeredBy = await stream(
      transcript,
      t => { raw += t; o.onEvent?.({ type: 'text', step, raw }) },
      o.signal, model, undefined,
      (from, to, why) => o.onEvent?.({ type: 'fallback', from, to, why }),
    )
    // a rate-limit fallback moved to another free model: stay on it for the rest of this investigation
    model = answeredBy
    const calls = step < maxRounds && !nudged ? parseToolCalls(raw) : []
    if (!calls.length) {
      // small models sometimes end on data requests past the limit, a native tool-call block, or nothing at all:
      // ask once more for the answer itself rather than showing the reader an empty reply
      if (visibleText(raw).trim() || nudged) return { answer: raw, answeredBy, transcript, results, steps: step + 1 }
      nudged = true
      if (raw.trim()) transcript.push({ role: 'assistant', content: raw })
      transcript.push({ role: 'user', content: EMPTY_ANSWER_NOTE })
      continue
    }

    const take = calls.slice(0, perRound)
    o.onEvent?.({ type: 'tools', step, calls: take })
    const round = await Promise.all(take.map(c => {
      const key = `${c.tool}|${c.args.join('|').toLowerCase()}`
      let p = byKey.get(key)
      if (!p) { p = run(c, `R${byKey.size + 1}`, o.ctx); byKey.set(key, p) }
      return p
    }))
    for (const r of round) {
      if (!results.includes(r)) { results.push(r); o.onEvent?.({ type: 'result', step, result: r }) }
    }
    if (o.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    transcript.push(
      { role: 'assistant', content: raw },
      { role: 'user', content: formatToolResults(round, calls.length - take.length, perRound) + (step + 1 >= maxRounds ? `\n\n${LAST_ROUND_NOTE}` : '') },
    )
  }
}
