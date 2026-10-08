/**
 * Shared helpers for the research scripts (record / eval / backtest). Node only — run with `npx tsx`.
 * Every external call here is free: ACLED (free non-commercial account) and OpenRouter `:free` models.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const DATA_DIR = resolve(ROOT, 'research/data')

/** Reads .env when present (local runs); in GitHub Actions the secrets arrive as env vars instead. */
export function loadEnv(): void {
  const file = resolve(ROOT, '.env')
  if (existsSync(file)) process.loadEnvFile(file)
}

export function writeJson(path: string, value: unknown, pretty = true): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(value, null, pretty ? 2 : undefined) + '\n')
}

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}
export const flag = (name: string) => process.argv.includes(`--${name}`)

export const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10)

// ── ACLED ──────────────────────────────────────────────────────────────────
// One login per script run. ACLED locks an account after repeated failed logins and every attempt while
// locked can extend the lock, so a failed login is reported, never retried.

const ACLED_TOKEN_URL = 'https://acleddata.com/oauth/token'
const ACLED_READ_URL = 'https://acleddata.com/api/acled/read'

export class AcledError extends Error {}

export async function acledToken(): Promise<string> {
  const { ACLED_EMAIL: username, ACLED_PASSWORD: password } = process.env
  if (!username || !password) throw new AcledError('ACLED_EMAIL / ACLED_PASSWORD not set')
  const res = await fetch(ACLED_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password, grant_type: 'password', client_id: 'acled', scope: 'authenticated' }),
    signal: AbortSignal.timeout(30_000),
  })
  const data = await res.json().catch(() => ({})) as { access_token?: string; error?: string; error_description?: string }
  if (!res.ok || !data.access_token) throw new AcledError(`ACLED login failed (HTTP ${res.status}${data.error ? `, ${data.error}` : ''})`)
  return data.access_token
}

export async function acledRead(token: string, params: URLSearchParams): Promise<Record<string, string>[]> {
  const res = await fetch(`${ACLED_READ_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new AcledError(`ACLED read failed (HTTP ${res.status})`)
  const json = await res.json() as { status?: number; data?: unknown; error?: unknown }
  if (json.status !== 200 || !Array.isArray(json.data)) throw new AcledError(`ACLED read error: ${JSON.stringify(json.error ?? json.status).slice(0, 200)}`)
  return json.data as Record<string, string>[]
}

const PAGE = 5000

/** Every event dated from..to (inclusive), paged. Throws rather than returning a silently partial window. */
export async function acledAll(token: string, from: string, to: string, fields: string): Promise<Record<string, string>[]> {
  const out: Record<string, string>[] = []
  for (let page = 1; page <= 200; page++) {
    const rows = await acledRead(token, new URLSearchParams({
      _format: 'json', event_date: `${from}|${to}`, event_date_where: 'BETWEEN', fields, limit: String(PAGE), page: String(page),
    }))
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
  throw new AcledError('ACLED paging did not end after 200 pages')
}
