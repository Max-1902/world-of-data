import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { KEY_FIELDS, applyServerEnv, clientEnv, parseEnvFile, sanitizeKeys } from './keys'

describe('desktop key fields', () => {
  it('cover exactly the keys in .env.example', () => {
    const example = readFileSync(path.resolve(__dirname, '../.env.example'), 'utf8')
    const ids = [...example.matchAll(/^([A-Z0-9_]+)=/gm)].map(m => m[1])
    expect(KEY_FIELDS.map(f => f.id).sort()).toEqual(ids.sort())
  })

  it('only VITE_ keys are handed to the page', () => {
    for (const f of KEY_FIELDS) expect(f.client).toBe(f.id.startsWith('VITE_'))
  })
})

describe('sanitizeKeys', () => {
  it('keeps known, non-empty string values, trimmed', () => {
    expect(sanitizeKeys({ VITE_MAPBOX_TOKEN: ' pk.x ', NYT_KEY: '', EIA_API_KEY: 5, EVIL: 'x' })).toEqual({ VITE_MAPBOX_TOKEN: 'pk.x' })
  })

  it('returns {} for anything that is not an object', () => {
    for (const v of [null, undefined, 'x', 3, true]) expect(sanitizeKeys(v)).toEqual({})
  })

  it('drops oversize values', () => {
    expect(sanitizeKeys({ NYT_KEY: 'x'.repeat(5000) })).toEqual({})
  })
})

describe('parseEnvFile', () => {
  it('reads known keys, ignoring comments, blanks, unknown names and empty values', () => {
    const text = [
      '# Mapbox',
      'VITE_MAPBOX_TOKEN=pk.abc',
      'export FINNHUB_KEY="f 1"',
      "NYT_KEY='n'",
      'EIA_API_KEY=e # trailing comment',
      'OPENROUTER_KEY=',
      'SOMETHING_ELSE=x',
      '',
    ].join('\r\n')
    expect(parseEnvFile(text)).toEqual({ VITE_MAPBOX_TOKEN: 'pk.abc', FINNHUB_KEY: 'f 1', NYT_KEY: 'n', EIA_API_KEY: 'e' })
  })

  it('returns {} for an empty or unrelated file', () => {
    expect(parseEnvFile('')).toEqual({})
    expect(parseEnvFile('hello world')).toEqual({})
  })
})

describe('clientEnv / applyServerEnv', () => {
  const values = { VITE_MAPBOX_TOKEN: 'pk.x', OPENROUTER_KEY: 'sk-or', FINNHUB_KEY: 'f' }

  it('gives the page client keys only', () => {
    expect(clientEnv(values)).toEqual({ VITE_MAPBOX_TOKEN: 'pk.x' })
  })

  it('sets server keys and clears the ones the user removed, leaving other variables alone', () => {
    const env: NodeJS.ProcessEnv = { NYT_KEY: 'old', PATH: '/bin' }
    applyServerEnv(values, env)
    expect(env).toEqual({ OPENROUTER_KEY: 'sk-or', FINNHUB_KEY: 'f', PATH: '/bin' })
  })
})
