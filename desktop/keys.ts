// The keys the desktop app asks its user for, mirroring .env.example. Client keys reach the page
// (desktop/preload.ts → src/runtimeEnv.ts); server keys stay in the main process, where the api/
// handlers read them from process.env exactly as they do on a server.

export interface KeyField {
  id: string
  label: string
  help: string
  /** Where to get the key (free tier, no billing account). */
  url?: string
  /** Handed to the page (VITE_ keys); everything else stays in the main process. */
  client: boolean
  /** Shown masked in the key window. */
  secret: boolean
  required?: boolean
}

export const KEY_FIELDS: KeyField[] = [
  { id: 'VITE_MAPBOX_TOKEN', label: 'Mapbox token', help: 'Draws the map. A public token (pk.…) from a free account.', url: 'https://console.mapbox.com', client: true, secret: true, required: true },
  { id: 'OPENROUTER_KEY', label: 'OpenRouter key', help: 'AI Analyst. Free models need no credit; paid models bill your own OpenRouter account.', url: 'https://openrouter.ai/keys', client: false, secret: true },
  { id: 'OPENROUTER_ALLOWED_MODELS', label: 'OpenRouter paid models', help: 'Optional. Comma-separated model ids allowed on top of :free ones, or * for all. Empty = free models only.', client: false, secret: false },
  { id: 'FINNHUB_KEY', label: 'Finnhub key', help: 'Market data (free: 60 requests/min).', url: 'https://finnhub.io', client: false, secret: true },
  { id: 'EIA_API_KEY', label: 'US EIA key', help: 'Energy inventories (free key by email).', url: 'https://www.eia.gov/opendata/register.php', client: false, secret: true },
  { id: 'CLOUDFLARE_RADAR_TOKEN', label: 'Cloudflare Radar token', help: 'Confirmed internet outages (custom token with Account › Radar › Read).', url: 'https://dash.cloudflare.com/profile/api-tokens', client: false, secret: true },
  { id: 'NYT_KEY', label: 'New York Times key', help: 'NYT article search.', url: 'https://developer.nytimes.com', client: false, secret: true },
  { id: 'ACLED_EMAIL', label: 'ACLED email', help: 'Conflict events (free for non-commercial use).', url: 'https://acleddata.com', client: false, secret: false },
  { id: 'ACLED_PASSWORD', label: 'ACLED password', help: '', client: false, secret: true },
  { id: 'OPENSKY_USER', label: 'OpenSky client id', help: 'Live flights (OAuth2 client credentials).', url: 'https://opensky-network.org', client: false, secret: false },
  { id: 'OPENSKY_PASS', label: 'OpenSky client secret', help: '', client: false, secret: true },
  { id: 'VITE_NEWSAPI_KEY', label: 'NewsAPI key', help: 'General news search (free: 100 requests/day).', url: 'https://newsapi.org', client: true, secret: true },
  { id: 'VITE_AISSTREAM_KEY', label: 'AISStream key', help: 'Live vessel tracking.', url: 'https://aisstream.io', client: true, secret: true },
]

export type KeyValues = Record<string, string>

const MAX_LEN = 4096

/** Keeps only known ids with non-empty string values, trimmed. Anything from disk or IPC goes through here. */
export function sanitizeKeys(input: unknown): KeyValues {
  const out: KeyValues = {}
  if (!input || typeof input !== 'object') return out
  for (const f of KEY_FIELDS) {
    const v = (input as Record<string, unknown>)[f.id]
    if (typeof v === 'string' && v.trim() && v.length <= MAX_LEN) out[f.id] = v.trim()
  }
  return out
}

/** Reads KEY=value lines from a .env file (comments, blanks and surrounding quotes handled), known keys only. */
export function parseEnvFile(text: string): KeyValues {
  const raw: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (!m) continue
    const v = m[2]
    raw[m[1]] = /^(['"]).*\1$/.test(v) ? v.slice(1, -1) : v.replace(/\s+#.*$/, '')
  }
  return sanitizeKeys(raw)
}

/** The keys the page may see. */
export function clientEnv(values: KeyValues): KeyValues {
  const out: KeyValues = {}
  for (const f of KEY_FIELDS) if (f.client && values[f.id]) out[f.id] = values[f.id]
  return out
}

/** Sets the server keys in `env` for the api/ handlers, and clears the ones the user removed. */
export function applyServerEnv(values: KeyValues, env: NodeJS.ProcessEnv = process.env): void {
  for (const f of KEY_FIELDS) {
    if (f.client) continue
    if (values[f.id]) env[f.id] = values[f.id]
    else delete env[f.id]
  }
}
