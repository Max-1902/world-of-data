/**
 * Research log of every AI Analyst run. Each record freezes exactly what the model was sent (the full
 * message list, including the system prompt with the live dashboard context), the sampling settings, the
 * model asked for and the model that answered, and the raw answer — so a run can be re-read, re-scored
 * or replayed later (scripts/research/eval.ts reads the JSONL export) even though the live feeds moved on.
 *
 * Stored in IndexedDB in this browser only (free, no account). Nothing is sent anywhere; the panel's
 * "Export runs" button downloads the log as JSONL.
 */
import type { DSMessage, NotMeasured } from './openrouter'

export interface AIRun {
  /** schema version, bumped if the shape changes */
  v: 1
  id: string
  startedAt: number
  finishedAt: number
  /** model selected in the picker */
  modelRequested: string
  /** model that produced the answer (differs after a rate-limit fallback); null if none answered */
  modelAnswered: string | null
  params: { temperature: number; max_tokens: number }
  /** everything sent, in order: system prompt (with context), prior turns, the question */
  messages: DSMessage[]
  /** raw model output, command lines included */
  response: string
  outcome: 'ok' | 'empty' | 'error' | 'aborted'
  error?: string
  /** inputs the context marked as NOT MEASURED */
  notMeasured: NotMeasured[]
}

export interface RunStore {
  getAll(): Promise<AIRun[]>
  put(r: AIRun): Promise<void>
  delete(id: string): Promise<void>
}

/** Oldest runs beyond this are dropped. Generous on purpose: a run is ~10–20 KB. */
export const MAX_RUNS = 2000

export function createMemoryRunStore(): RunStore {
  const rows = new Map<string, AIRun>()
  return {
    getAll: async () => [...rows.values()].sort((a, b) => a.startedAt - b.startedAt),
    put: async r => { rows.set(r.id, r) },
    delete: async id => { rows.delete(id) },
  }
}

const DB_NAME = 'ws-ai-runs'
const STORE = 'runs'

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

export function createIdbRunStore(): RunStore | null {
  if (typeof indexedDB === 'undefined') return null
  let dbPromise: Promise<IDBDatabase> | null = null
  const open = () => dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' })
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => { dbPromise = null; reject(r.error) }
  })
  return {
    async getAll() {
      const db = await open()
      const rows = await req(db.transaction(STORE).objectStore(STORE).getAll() as IDBRequest<AIRun[]>)
      return rows.sort((a, b) => a.startedAt - b.startedAt)
    },
    async put(r) {
      const db = await open()
      await req(db.transaction(STORE, 'readwrite').objectStore(STORE).put(r))
    },
    async delete(id) {
      const db = await open()
      await req(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id))
    },
  }
}

export function createRunLog(store: RunStore) {
  return {
    /** Never throws: a failed write must not break the chat. */
    async record(run: AIRun): Promise<void> {
      try {
        await store.put(run)
        const all = await store.getAll()
        for (const old of all.slice(0, Math.max(0, all.length - MAX_RUNS))) await store.delete(old.id)
      } catch (e) {
        console.warn('[aiRuns] could not persist run:', e)
      }
    },
    getAll: () => store.getAll(),
    /** One JSON object per line, oldest first. */
    async exportJsonl(): Promise<string> {
      return (await store.getAll()).map(r => JSON.stringify(r)).join('\n')
    },
  }
}

export const runLog = createRunLog(createIdbRunStore() ?? createMemoryRunStore())

/** Offer the JSONL export as a file download. */
export async function downloadRuns(): Promise<number> {
  const runs = await runLog.getAll()
  const blob = new Blob([runs.map(r => JSON.stringify(r)).join('\n')], { type: 'application/x-ndjson' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ai-runs-${new Date().toISOString().slice(0, 10)}.jsonl`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return runs.length
}
