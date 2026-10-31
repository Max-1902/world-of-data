import { describe, it, expect, vi } from 'vitest'
import { runAgent, LAST_ROUND_NOTE, EMPTY_ANSWER_NOTE, type AgentEvent } from './aiAgent'
import type { ToolCall, ToolResult, ToolContext } from './aiTools'
import type { DSMessage } from './openrouter'

const ctx: ToolContext = { crises: [], flights: [], trajectories: [] }
const base: DSMessage[] = [{ role: 'system', content: 'SYS' }, { role: 'user', content: 'Q' }]

/** A fake model: answers each call with the next scripted reply, streamed in two chunks. */
function scripted(replies: string[], model = 'm:free') {
  const sent: DSMessage[][] = []
  const stream = vi.fn(async (messages: DSMessage[], onToken: (t: string) => void) => {
    sent.push([...messages])
    const r = replies[sent.length - 1] ?? 'fallthrough'
    onToken(r.slice(0, 3)); onToken(r.slice(3))
    return model
  })
  return { stream, sent }
}

const fakeRun = vi.fn(async (c: ToolCall, id: string): Promise<ToolResult> =>
  ({ id, call: c.raw, tool: c.tool, args: c.args, ok: true, at: 0, title: c.tool, source: 'test', text: `data for ${c.args.join(',') || c.tool}` }))

describe('runAgent', () => {
  it('answers in one call when the model asks for no data', async () => {
    const { stream } = scripted(['Plain answer.'])
    const run = await runAgent({ messages: base, model: 'm:free', ctx, stream, run: fakeRun })
    expect(run).toMatchObject({ answer: 'Plain answer.', steps: 1, results: [] })
    expect(run.transcript).toEqual(base)
  })

  it('runs requested tools, sends the results back, and returns the next turn as the answer', async () => {
    const { stream, sent } = scripted(['Checking.\n[DATA:conflict|Sudan]\n[DATA:quakes]', 'Sudan is worse (R1).\n[CHART:R1]'])
    const events: AgentEvent['type'][] = []
    const run = await runAgent({ messages: base, model: 'm:free', ctx, stream, run: fakeRun, onEvent: e => events.push(e.type) })
    expect(run.answer).toBe('Sudan is worse (R1).\n[CHART:R1]')
    expect(run.steps).toBe(2)
    expect(run.results.map(r => [r.id, r.call])).toEqual([['R1', '[DATA:conflict|Sudan]'], ['R2', '[DATA:quakes]']])
    // second call carried the model's request and the results
    expect(sent[1].slice(-2).map(m => m.role)).toEqual(['assistant', 'user'])
    expect(sent[1][sent[1].length - 1].content).toMatch(/^TOOL RESULTS[\s\S]*--- R1 · \[DATA:conflict\|Sudan\][\s\S]*data for Sudan/)
    expect(events).toEqual(expect.arrayContaining(['step', 'text', 'tools', 'result']))
  })

  it('forces an answer after the last data round and says so to the model', async () => {
    const { stream, sent } = scripted(['[DATA:news|a]', '[DATA:news|b]', '[DATA:news|c] and my answer'])
    const run = await runAgent({ messages: base, model: 'm:free', ctx, stream, run: fakeRun, maxRounds: 2 })
    expect(run.steps).toBe(3)
    expect(run.answer).toBe('[DATA:news|c] and my answer') // the third request is not honoured
    expect(run.results).toHaveLength(2)
    expect(sent[2][sent[2].length - 1].content).toContain(LAST_ROUND_NOTE)
    expect(sent[1][sent[1].length - 1].content).not.toContain(LAST_ROUND_NOTE)
  })

  it('asks once more when the final turn has no answer text, and returns that answer', async () => {
    const { stream, sent } = scripted(['[DATA:news|a]', '[DATA:news|b]', 'The answer.'])
    const run = await runAgent({ messages: base, model: 'm:free', ctx, stream, run: fakeRun, maxRounds: 1 })
    expect(run.answer).toBe('The answer.')
    expect(run.steps).toBe(3)
    expect(run.results).toHaveLength(1) // the request after the limit is still not honoured
    expect(sent[2][sent[2].length - 1].content).toBe(EMPTY_ANSWER_NOTE)
  })

  it('asks only once: a second empty reply is returned as it is', async () => {
    const { stream } = scripted(['', ''])
    const run = await runAgent({ messages: base, model: 'm:free', ctx, stream, run: fakeRun })
    expect(run).toMatchObject({ answer: '', steps: 2 })
    expect(stream).toHaveBeenCalledTimes(2)
  })

  it('honours the per-round limit it is given and tells the model what was dropped', async () => {
    const { stream, sent } = scripted(['[DATA:news|a]\n[DATA:news|b]\n[DATA:news|c]', 'done'])
    const run = await runAgent({ messages: base, model: 'm:free', ctx, stream, run: fakeRun, perRound: 2 })
    expect(run.results).toHaveLength(2)
    expect(sent[1][sent[1].length - 1].content).toContain('1 further request dropped: at most 2 per turn')
  })

  it('reuses a result when the same query is repeated, so ids stay unique and stable', async () => {
    const { stream } = scripted(['[DATA:conflict|Sudan]\n[DATA:quakes]', '[DATA:conflict|sudan]\n[DATA:fires]', 'done'])
    const run = vi.fn(fakeRun)
    const out = await runAgent({ messages: base, model: 'm:free', ctx, stream, run })
    expect(out.results.map(r => r.id)).toEqual(['R1', 'R2', 'R3'])
    expect(run).toHaveBeenCalledTimes(3)
  })

  it('caps requests per round and tells the model how many were dropped', async () => {
    const many = Array.from({ length: 9 }, (_, i) => `[DATA:news|q${i}]`).join('\n')
    const { stream, sent } = scripted([many, 'answer'])
    const out = await runAgent({ messages: base, model: 'm:free', ctx, stream, run: fakeRun })
    expect(out.results).toHaveLength(6)
    expect(sent[1][sent[1].length - 1].content).toContain('3 further requests dropped')
  })

  it('stays on the model a rate-limit fallback switched to', async () => {
    const models: string[] = []
    const stream = vi.fn(async (_m: DSMessage[], onToken: (t: string) => void, _s: AbortSignal | undefined, model: string) => {
      models.push(model)
      onToken(models.length === 1 ? '[DATA:quakes]' : 'ok')
      return 'other:free'
    })
    const out = await runAgent({ messages: base, model: 'first:free', ctx, stream, run: fakeRun })
    expect(models).toEqual(['first:free', 'other:free'])
    expect(out.answeredBy).toBe('other:free')
  })
})
