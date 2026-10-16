import type { DSMessage } from './openrouter'
import type { ToolResult } from './aiTools'

/** One question and everything the panel shows for it — kept so a reopened conversation keeps its charts and trail. */
export interface ChatTurn {
  id: string
  question: string
  /** visible answer text ([CHART:Rn] lines included, commands stripped) */
  answer: string
  /** data the analyst fetched for this answer, in request order */
  results: ToolResult[]
  /** model prose written alongside data requests, in order */
  notes: string[]
  model?: string
  error?: string
}

export interface ChatSession {
  id: string
  startedAt: number
  updatedAt: number
  model: string
  /** the question/answer pairs sent back to the model as history */
  messages: DSMessage[]
  /** absent in sessions saved before the analyst could fetch data */
  turns?: ChatTurn[]
}

const LS_KEY = 'worldview.aiChatSessions'
const MAX_SESSIONS = 50

function readAll(): ChatSession[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(sessions: ChatSession[]) {
  // Tool results with chart data make sessions bigger than plain chat; when storage is full, drop the oldest
  // conversations until it fits rather than losing the save (and every later one).
  let keep = sessions.slice(-MAX_SESSIONS)
  while (keep.length) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(keep))
      return
    } catch {
      if (keep.length === 1) return // storage unavailable, or one session alone is too big — skip persistence
      keep = keep.slice(Math.ceil(keep.length / 2))
    }
  }
}

export function listSessions(): ChatSession[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt)
}

export function saveSession(session: ChatSession) {
  const sessions = readAll()
  const idx = sessions.findIndex(s => s.id === session.id)
  if (idx >= 0) sessions[idx] = session
  else sessions.push(session)
  writeAll(sessions)
}

export function deleteSession(id: string) {
  writeAll(readAll().filter(s => s.id !== id))
}

export function newSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
