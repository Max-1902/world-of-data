import { describe, it, expect, beforeEach } from 'vitest'
import { listSessions, saveSession, deleteSession, newSessionId, type ChatSession } from './chatHistory'
import { installLocalStorage } from '../test/helpers'

const LS_KEY = 'worldview.aiChatSessions'

function session(id: string, updatedAt: number, overrides: Partial<ChatSession> = {}): ChatSession {
  return { id, startedAt: updatedAt - 10, updatedAt, model: 'm', messages: [{ role: 'user', content: `hi ${id}` }], ...overrides }
}

describe('chatHistory', () => {
  let ctx: ReturnType<typeof installLocalStorage>
  beforeEach(() => { ctx = installLocalStorage() })

  it('starts empty', () => {
    expect(listSessions()).toEqual([])
  })

  it('persists a session and returns it', () => {
    saveSession(session('a', 100))
    expect(listSessions()).toEqual([session('a', 100)])
  })

  it('lists sessions newest-updated first', () => {
    saveSession(session('old', 100))
    saveSession(session('new', 300))
    saveSession(session('mid', 200))
    expect(listSessions().map(s => s.id)).toEqual(['new', 'mid', 'old'])
  })

  it('updates an existing session in place rather than duplicating it', () => {
    saveSession(session('a', 100))
    saveSession(session('a', 500, { messages: [{ role: 'user', content: 'edited' }] }))
    const all = listSessions()
    expect(all).toHaveLength(1)
    expect(all[0].updatedAt).toBe(500)
    expect(all[0].messages[0].content).toBe('edited')
  })

  it('deletes only the requested session; unknown ids are a no-op', () => {
    saveSession(session('a', 1))
    saveSession(session('b', 2))
    deleteSession('a')
    expect(listSessions().map(s => s.id)).toEqual(['b'])
    deleteSession('does-not-exist')
    expect(listSessions().map(s => s.id)).toEqual(['b'])
  })

  it('keeps only the 50 most recently added sessions', () => {
    for (let i = 0; i < 55; i++) saveSession(session(`s${i}`, i))
    const ids = listSessions().map(s => s.id)
    expect(ids).toHaveLength(50)
    expect(ids).toContain('s54')
    expect(ids).not.toContain('s0')
    expect(ids).not.toContain('s4')
    expect(ids).toContain('s5')
  })

  it('trims by last update, so a reopened old conversation that was just saved is kept', () => {
    for (let i = 0; i < 50; i++) saveSession(session(`s${i}`, i + 10))
    saveSession(session('s0', 1000)) // the oldest-created one, reopened and continued
    saveSession(session('new', 1001))
    const ids = listSessions().map(s => s.id)
    expect(ids).toHaveLength(50)
    expect(ids).toContain('s0')
    expect(ids).not.toContain('s1')
  })

  it('recovers from corrupted JSON in storage', () => {
    ctx.store.set(LS_KEY, '{not json')
    expect(listSessions()).toEqual([])
    saveSession(session('a', 1)) // and can still write afterwards
    expect(listSessions()).toHaveLength(1)
  })

  it('ignores a non-array value in storage', () => {
    ctx.store.set(LS_KEY, JSON.stringify({ hello: 'world' }))
    expect(listSessions()).toEqual([])
  })

  it('does not throw when storage is full or unavailable', () => {
    installLocalStorage({ throwOnSet: true })
    expect(() => saveSession(session('a', 1))).not.toThrow()
    expect(() => deleteSession('a')).not.toThrow()
    expect(listSessions()).toEqual([])
  })

  it('generates distinct, non-empty session ids', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newSessionId()))
    expect(ids.size).toBe(200)
    for (const id of ids) expect(id).toMatch(/^\d+-[a-z0-9]+$/)
  })

  it('keeps turns with their tool results so a reopened conversation still has its charts', () => {
    const turns = [{ id: 't1', question: 'q', answer: 'a\n[CHART:R1]', notes: [], results: [{ id: 'R1', call: '[DATA:quakes]', tool: 'quakes', args: [], ok: true, at: 1, title: 'Quakes', source: 'USGS', text: 'x', chart: { kind: 'rank' as const, unit: 'n', items: [{ label: 'A', value: 1, text: '1' }] } }] }]
    saveSession(session('a', 100, { turns }))
    expect(listSessions()[0].turns).toEqual(turns)
  })

  it('drops the oldest conversations when storage is full instead of losing the save', () => {
    let calls = 0
    const setItem = ctx.storage.setItem
    ctx.storage.setItem = (k: string, v: string) => {
      calls++
      if (JSON.parse(v).length > 2) throw new Error('QuotaExceededError')
      setItem(k, v)
    }
    for (let i = 0; i < 2; i++) saveSession(session(`s${i}`, i))
    saveSession(session('s2', 2))
    expect(calls).toBeGreaterThan(3)
    expect(listSessions().map(s => s.id)).toContain('s2')
  })
})
