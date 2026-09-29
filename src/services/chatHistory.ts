import type { DSMessage } from './openrouter'

export interface ChatSession {
  id: string
  startedAt: number
  updatedAt: number
  model: string
  messages: DSMessage[]
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
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(sessions.slice(-MAX_SESSIONS)))
  } catch {
    // storage full or unavailable — silently skip persistence
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

export function clearAllSessions() {
  try { localStorage.removeItem(LS_KEY) } catch {}
}

export function newSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
