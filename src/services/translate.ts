// Machine translation of headlines/summaries to English, via the public web endpoint behind Google Translate
// (translate.googleapis.com/translate_a/single, client=gtx).
// Cost: free and keyless — no account, no billing, nothing to meter. It is an unofficial endpoint (not a
// documented, supported API), so every failure path degrades to "show the original text" and a rate-limit
// answer pauses all translation for a minute. Source language is auto-detected; text already in English
// comes back unchanged. Each answer is cached (memory + localStorage), so an article is translated once
// per browser, not once per render.

export interface Translation {
  text: string
  /** Detected source language (ISO 639-1-ish, as reported by the service). */
  from: string
}

const ENDPOINT = 'https://translate.googleapis.com/translate_a/single'
const LS_KEY = 'ws-translate-v1'
const MAX_CACHED = 800
const MAX_CHARS = 1_000
const MAX_CONCURRENT = 3
const REQUEST_GAP_MS = 80
const COOLDOWN_MS = 60_000

const cache = new Map<string, Translation>()
const inFlight = new Map<string, Promise<Translation | null>>()
let hydrated = false
let blockedUntil = 0
let active = 0
const waiting: (() => void)[] = []

function hydrate() {
  if (hydrated) return
  hydrated = true
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return
    for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, Translation>)) {
      if (v && typeof v.text === 'string' && typeof v.from === 'string') cache.set(k, v)
    }
  } catch { /* corrupt or unavailable storage: start empty */ }
}

function persist() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries(cache))) } catch { /* quota / private mode */ }
}

function remember(key: string, value: Translation) {
  cache.set(key, value)
  // Maps iterate in insertion order, so the first key is the oldest.
  while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value as string)
  persist()
}

async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>(resolve => waiting.push(resolve))
  active++
  try { return await fn() } finally {
    await new Promise(r => setTimeout(r, REQUEST_GAP_MS))
    active--
    waiting.shift()?.()
  }
}

/** Pulls the translated text and detected language out of the endpoint's nested-array payload. */
export function parseTranslation(json: unknown): Translation | null {
  if (!Array.isArray(json) || !Array.isArray(json[0])) return null
  const text = (json[0] as unknown[])
    .map(seg => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
    .join('')
    .trim()
  if (!text) return null
  return { text, from: typeof json[2] === 'string' ? json[2] : 'auto' }
}

/** Anything non-ASCII, or a feed marked as non-English, might need translating; plain-ASCII text without a hint is assumed English. */
export function mayNeedTranslation(text: string, lang?: string): boolean {
  if (!text.trim()) return false
  if (lang) return lang !== 'en'
  return /[\u0080-\uFFFF]/.test(text)
}

/** Translates `text` to English. Resolves to null when the service is unavailable (callers show the original). Never throws. */
export function translateToEnglish(text: string): Promise<Translation | null> {
  hydrate()
  const input = text.trim().slice(0, MAX_CHARS)
  if (!input) return Promise.resolve(null)
  const hit = cache.get(input)
  if (hit) return Promise.resolve(hit)
  const pending = inFlight.get(input)
  if (pending) return pending

  const run = slot(async (): Promise<Translation | null> => {
    if (Date.now() < blockedUntil) return null
    try {
      const res = await fetch(`${ENDPOINT}?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(input)}`)
      if (res.status === 429) { blockedUntil = Date.now() + COOLDOWN_MS; return null }
      if (!res.ok) return null
      const parsed = parseTranslation(await res.json())
      if (!parsed) return null
      // Already English: remember that, with the text untouched, so it's never asked again.
      const result = parsed.from === 'en' ? { text: input, from: 'en' } : parsed
      remember(input, result)
      return result
    } catch {
      return null
    }
  })
  inFlight.set(input, run)
  void run.finally(() => inFlight.delete(input))
  return run
}

/** Test hook: forget everything, including the persisted cache and any rate-limit pause. */
export function resetTranslateCache() {
  cache.clear(); inFlight.clear(); hydrated = false; blockedUntil = 0; active = 0; waiting.length = 0
  try { localStorage.removeItem(LS_KEY) } catch { /* ignore */ }
}
