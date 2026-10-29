/**
 * A question handed to the AI Analyst from elsewhere in the app ("Ask the analyst" on a forecast or a country).
 * It is only ever placed in the analyst's input for the reader to edit and send; it is never sent for them.
 * Held until the analyst is mounted and takes it, so it works whether or not the panel was already open.
 */
let pending: string | null = null
const listeners = new Set<() => void>()

export function setAnalystDraft(text: string) {
  pending = text
  listeners.forEach(l => l())
}

/** The waiting draft, once; null when there is none. */
export function takeAnalystDraft(): string | null {
  const t = pending
  pending = null
  return t
}

export function onAnalystDraft(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
