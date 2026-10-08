import { describe, it, expect, vi } from 'vitest'
import { createRunLog, createMemoryRunStore, MAX_RUNS, type AIRun } from './aiRuns'

const run = (i: number, o: Partial<AIRun> = {}): AIRun => ({
  v: 1, id: `r${i}`, startedAt: i, finishedAt: i + 1, modelRequested: 'm:free', modelAnswered: 'm:free',
  params: { temperature: 0.65, max_tokens: 4000 }, messages: [{ role: 'system', content: 'ctx' }, { role: 'user', content: 'q' }],
  response: 'a', outcome: 'ok', notMeasured: [], ...o,
})

describe('run log', () => {
  it('keeps every field of a run and exports one JSON object per line, oldest first', async () => {
    const log = createRunLog(createMemoryRunStore())
    await log.record(run(2, { outcome: 'error', error: 'boom', modelAnswered: null }))
    await log.record(run(1, { notMeasured: [{ what: 'Air traffic', why: 'flights layer switched off' }] }))
    const lines = (await log.exportJsonl()).split('\n').map(l => JSON.parse(l))
    expect(lines.map(r => r.id)).toEqual(['r1', 'r2'])
    expect(lines[0]).toEqual(run(1, { notMeasured: [{ what: 'Air traffic', why: 'flights layer switched off' }] }))
    expect(lines[1]).toMatchObject({ outcome: 'error', error: 'boom', modelAnswered: null })
  })

  it('drops only the oldest runs beyond MAX_RUNS', async () => {
    const log = createRunLog(createMemoryRunStore())
    for (let i = 0; i <= MAX_RUNS; i++) await log.record(run(i))
    const all = await log.getAll()
    expect(all).toHaveLength(MAX_RUNS)
    expect(all[0].id).toBe('r1')
  })

  it('never throws when storage fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const log = createRunLog({ getAll: async () => [], put: async () => { throw new Error('quota') }, delete: async () => {} })
    await expect(log.record(run(1))).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
  })
})
