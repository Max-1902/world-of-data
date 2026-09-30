import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { resolveApiRoute } from '../vite.api-dev'

const apiDir = path.resolve(__dirname, '../api')
const rel = (r: ReturnType<typeof resolveApiRoute>) => r && { file: path.relative(apiDir, r.file), params: r.params }

describe('apiDevPlugin route resolution (mirrors Vercel file routing)', () => {
  it('maps plain files', () => {
    expect(rel(resolveApiRoute(['opensky-token'], apiDir))).toEqual({ file: 'opensky-token.ts', params: {} })
    expect(rel(resolveApiRoute(['acled-token'], apiDir))).toEqual({ file: 'acled-token.ts', params: {} })
    expect(rel(resolveApiRoute(['nyt'], apiDir))).toEqual({ file: 'nyt.ts', params: {} })
  })
  it('maps [...path] catch-alls and passes the remaining segments', () => {
    expect(rel(resolveApiRoute(['opensky', 'states', 'all'], apiDir))).toEqual({ file: path.join('opensky', '[...path].ts'), params: { path: ['states', 'all'] } })
    expect(rel(resolveApiRoute(['acled', 'read'], apiDir))).toEqual({ file: path.join('acled', '[...path].ts'), params: { path: ['read'] } })
  })
  it('maps nested files', () => {
    expect(rel(resolveApiRoute(['openrouter', 'chat', 'completions'], apiDir))?.file).toBe(path.join('openrouter', 'chat', 'completions.ts'))
  })
  it('returns null for routes Vite proxies itself (gdelt, firms, …) so they fall through', () => {
    expect(resolveApiRoute(['gdelt', 'v2', 'doc', 'doc'], apiDir)).toBeNull()
    expect(resolveApiRoute(['firms', 'x'], apiDir)).toBeNull()
    expect(resolveApiRoute([], apiDir)).toBeNull()
  })
})
