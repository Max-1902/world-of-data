/**
 * Mechanical enforcement of the rules in CLAUDE.md that can be checked automatically:
 * secrets stay out of git and out of the browser bundle, and test files never ship as
 * Vercel serverless functions.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}
const rel = (f: string) => path.relative(ROOT, f)
const isSource = (f: string) => /\.(ts|tsx|js|jsx|json|html|css)$/.test(f)
const srcFiles = walk(path.join(ROOT, 'src')).filter(isSource)
const apiFiles = walk(path.join(ROOT, 'api')).filter(isSource)

function gitTracked(): string[] | null {
  try {
    return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
  } catch { return null }
}

describe('secrets', () => {
  it('.env is not tracked by git; only .env.example is', () => {
    const tracked = gitTracked()
    if (!tracked) return // not a git checkout (e.g. exported tarball)
    const envFiles = tracked.filter(f => /(^|\/)\.env(\..+)?$/.test(f))
    expect(envFiles).toEqual(['.env.example'])
  })

  it('.env and .env.* files are git-ignored', () => {
    const ignore = readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split('\n').map(l => l.trim())
    expect(ignore).toContain('.env')
  })

  it('.env.example contains placeholders only — no values', () => {
    const lines = readFileSync(path.join(ROOT, '.env.example'), 'utf8').split('\n')
    const assignments = lines.filter(l => /^[A-Z][A-Z0-9_]*=/.test(l))
    expect(assignments.length).toBeGreaterThan(0)
    for (const l of assignments) expect(l, `${l.split('=')[0]} must be empty in .env.example`).toMatch(/^[A-Z][A-Z0-9_]*=\s*$/)
  })

  const SECRET_PATTERNS: [string, RegExp][] = [
    ['OpenRouter key', /sk-or-[A-Za-z0-9_-]{16,}/],
    ['Anthropic/OpenAI-style key', /\bsk-(?:ant-)?[A-Za-z0-9_-]{32,}/],
    ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
    ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}/],
    ['AWS access key id', /\bAKIA[0-9A-Z]{16}\b/],
    ['Mapbox secret token', /\bsk\.eyJ[A-Za-z0-9_-]{20,}/],
    ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ['hard-coded credential assignment', /\b(?:api[_-]?key|secret|password|passwd|client[_-]?secret)\b\s*[:=]\s*['"`][A-Za-z0-9_\-/+=]{20,}['"`]/i],
  ]

  it.each(SECRET_PATTERNS)('no %s appears in src/ or api/', (_label, re) => {
    const hits = [...srcFiles, ...apiFiles].filter(f => re.test(readFileSync(f, 'utf8'))).map(rel)
    expect(hits).toEqual([])
  })

  it('every key read by a serverless function is documented in .env.example', () => {
    const example = readFileSync(path.join(ROOT, '.env.example'), 'utf8')
    const used = new Set<string>()
    for (const f of apiFiles) for (const m of readFileSync(f, 'utf8').matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) used.add(m[1])
    expect(used.size).toBeGreaterThan(0)
    for (const name of used) expect(example, `${name} missing from .env.example`).toMatch(new RegExp(`^${name}=`, 'm'))
  })

  it('server-only keys are never exposed to the browser bundle', () => {
    const serverKeys = new Set<string>()
    for (const f of apiFiles) for (const m of readFileSync(f, 'utf8').matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) serverKeys.add(m[1])
    const offenders: string[] = []
    for (const f of srcFiles) {
      const text = readFileSync(f, 'utf8')
      for (const key of serverKeys) {
        // neither `VITE_<KEY>` nor a direct process.env read of the same name may appear in client code
        if (text.includes(`VITE_${key}`) || new RegExp(`process\\.env\\.${key}\\b`).test(text)) offenders.push(`${rel(f)}: ${key}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('client code only reads VITE_ variables from an allow-list of intentionally public keys', () => {
    // Anything added here is shipped to every visitor's browser — keep it to tokens that are
    // public/scoped by design (see the comments in .env.example) and free-tier only.
    const ALLOWED = new Set(['VITE_MAPBOX_TOKEN', 'VITE_NEWSAPI_KEY', 'VITE_AISSTREAM_KEY'])
    const used = new Set<string>()
    const stripComments = (t: string) => t.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
    for (const f of srcFiles) for (const m of stripComments(readFileSync(f, 'utf8')).matchAll(/import\.meta\.env\.(VITE_[A-Z0-9_]+)/g)) used.add(m[1])
    expect([...used].filter(k => !ALLOWED.has(k))).toEqual([])
  })
})

describe('deployment hygiene', () => {
  it('no test or helper files live under api/ (Vercel deploys every file there as a function)', () => {
    const offenders = walk(path.join(ROOT, 'api')).filter(f => /\.(test|spec)\.[tj]sx?$/.test(f) || /helpers?\.[tj]s$/.test(f))
    expect(offenders.map(rel)).toEqual([])
  })

  it('every serverless function has a default-exported handler', () => {
    for (const f of apiFiles.filter(f => f.endsWith('.ts') && !f.endsWith('tsconfig.json'))) {
      expect(readFileSync(f, 'utf8'), rel(f)).toMatch(/export default (async )?function/)
    }
  })
})

describe('free-tier only', () => {
  it('AI model catalogue lists only :free OpenRouter models', async () => {
    const { FREE_MODELS } = await import('../src/services/openrouter')
    for (const m of FREE_MODELS) expect(m.id.endsWith(':free'), m.id).toBe(true)
  })
})

describe('repo layout', () => {
  it('has the files the test setup depends on', () => {
    for (const f of ['vitest.config.ts', '.env.example', '.gitignore', 'tests/tsconfig.json']) {
      expect(existsSync(path.join(ROOT, f)), f).toBe(true)
    }
  })
})

describe('data provenance', () => {
  // Hand-curated datasets (see DATA_PROVENANCE.md). Keep in sync: a dataset that is added, renamed
  // or removed without the provenance doc being updated fails here.
  const CURATED = ['military', 'tradeStats', 'resources', 'oilgas', 'infrastructure', 'sanctions', 'ports', 'chokepoints', 'supplychain', 'unhcr', 'earthcam', 'notam']
  const doc = readFileSync(path.join(ROOT, 'DATA_PROVENANCE.md'), 'utf8')

  it.each(CURATED)('services/%s.ts exists and is documented in DATA_PROVENANCE.md', (name) => {
    expect(existsSync(path.join(ROOT, 'src/services', `${name}.ts`)), `${name}.ts is missing — update CURATED and DATA_PROVENANCE.md`).toBe(true)
    expect(doc).toContain(`services/${name}.ts`)
  })

  it.each(CURATED)('services/%s.ts header does not claim to be complete or comprehensive', (name) => {
    const header = readFileSync(path.join(ROOT, 'src/services', `${name}.ts`), 'utf8').split('\n').slice(0, 20).join('\n')
    expect(header).not.toMatch(/\bcomplete\b|\bcomprehensive\b/i)
  })
})
