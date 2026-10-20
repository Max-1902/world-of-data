/**
 * The AI Analyst's investigation loop. One user question can take several model turns: a turn that asks for data
 * (`[DATA:…]` lines, see services/aiTools.ts) gets those queries run locally and the results sent back, and the model
 * continues until it writes an answer without further requests, or the round limit forces it to.
 *
 * Model-agnostic on purpose: a text protocol instead of provider tool-calling, so the free models (several of which
 * do not support function calling on OpenRouter) and paid ones behave the same, and the server proxy keeps its fixed
 * request shape (api/openrouter/chat/completions.ts).
 */
import { streamAIWithFallback, type DSMessage } from './openrouter'
import { parseToolCalls, runTool, formatToolResults, MAX_CALLS_PER_STEP, type ToolCall, type ToolContext, type ToolResult } from './aiTools'

/** Data rounds before the model must answer. Each round is one model call; the answer is one more. */
export const MAX_DATA_ROUNDS = 4

export type AgentEvent =
  | { type: 'step'; step: number }
  | { type: 'text'; step: number; raw: string }
  | { type: 'tools'; step: number; calls: ToolCall[] }
  | { type: 'result'; step: number; result: ToolResult }
  | { type: 'fallback'; from: string; to: string }

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
  /** injectable for tests */
  stream?: typeof streamAIWithFallback
  run?: typeof runTool
}

export const LAST_ROUND_NOTE = 'That was the last data round. Write the final answer now from the data you have, with no further [DATA:…] requests.'

export async function runAgent(o: AgentOptions): Promise<AgentRun> {
  const stream = o.stream ?? streamAIWithFallback
  const run = o.run ?? runTool
  const maxRounds = o.maxRounds ?? MAX_DATA_ROUNDS
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
      (from, to) => o.onEvent?.({ type: 'fallback', from, to }),
    )
    // a rate-limit fallback moved to another free model: stay on it for the rest of this investigation
    model = answeredBy
    const calls = step < maxRounds ? parseToolCalls(raw) : []
    if (!calls.length) return { answer: raw, answeredBy, transcript, results, steps: step + 1 }

    const take = calls.slice(0, MAX_CALLS_PER_STEP)
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
      { role: 'user', content: formatToolResults(round, calls.length - take.length) + (step + 1 >= maxRounds ? `\n\n${LAST_ROUND_NOTE}` : '') },
    )
  }
}
