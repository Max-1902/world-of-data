import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockFetch, jsonResponse, installLocalStorage } from '../test/helpers'

async function load() { vi.resetModules(); return import('./translate') }
// Shape of the real endpoint's answer: [[[translated, original, …]], null, detectedLang, …]
const answer = (text: string, from: string) => jsonResponse([[[text, 'x', null, null, 1]], null, from])

describe('parseTranslation', () => {
  it('joins the translated segments and reads the detected language', async () => {
    const { parseTranslation } = await load()
    expect(parseTranslation([[['Hello ', 'Cześć '], ['world', 'świat']], null, 'pl'])).toEqual({ text: 'Hello world', from: 'pl' })
  })
  it('rejects malformed payloads', async () => {
    const { parseTranslation } = await load()
    expect(parseTranslation(null)).toBeNull()
    expect(parseTranslation({})).toBeNull()
    expect(parseTranslation([[], null, 'pl'])).toBeNull()
    expect(parseTranslation([[[null]], null, 'pl'])).toBeNull()
  })
})

describe('mayNeedTranslation', () => {
  it('trusts the feed language hint; without one, only non-ASCII text is a candidate', async () => {
    const { mayNeedTranslation } = await load()
    expect(mayNeedTranslation('Rosja zaatakowała', 'pl')).toBe(true)
    expect(mayNeedTranslation('Plain English headline', 'en')).toBe(false)
    expect(mayNeedTranslation('Plain English headline')).toBe(false)
    expect(mayNeedTranslation('Rosja zaatakowała Kijów')).toBe(true)
    expect(mayNeedTranslation('   ', 'pl')).toBe(false)
  })
})

describe('translateToEnglish', () => {
  beforeEach(() => { installLocalStorage() })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('calls the keyless endpoint with auto-detect → English and returns text + source language', async () => {
    const f = mockFetch(() => answer('Russia attacked Kyiv', 'pl'))
    const { translateToEnglish } = await load()
    expect(await translateToEnglish('Rosja zaatakowała Kijów')).toEqual({ text: 'Russia attacked Kyiv', from: 'pl' })
    const url = String(f.mock.calls[0][0])
    expect(url).toContain('translate.googleapis.com/translate_a/single')
    expect(url).toContain('sl=auto')
    expect(url).toContain('tl=en')
    expect(url).toContain(encodeURIComponent('Rosja zaatakowała Kijów'))
    expect(url).not.toMatch(/key=/i)
  })

  it('caches answers (also across a reload via localStorage) and shares identical in-flight requests', async () => {
    const f = mockFetch(() => answer('Hello', 'de'))
    let mod = await load()
    await Promise.all([mod.translateToEnglish('Hallo'), mod.translateToEnglish('Hallo')])
    await mod.translateToEnglish('Hallo')
    expect(f).toHaveBeenCalledTimes(1)
    mod = await load() // fresh module, same localStorage
    expect(await mod.translateToEnglish('Hallo')).toEqual({ text: 'Hello', from: 'de' })
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('returns text that is already English untouched', async () => {
    mockFetch(() => answer('Different wording', 'en'))
    const { translateToEnglish } = await load()
    expect(await translateToEnglish('Already English')).toEqual({ text: 'Already English', from: 'en' })
  })

  it('returns null — never throws — on HTTP errors, network failure and bad payloads, and does not cache them', async () => {
    const f = mockFetch(() => jsonResponse({}, { status: 500 }))
    const { translateToEnglish } = await load()
    expect(await translateToEnglish('Witaj')).toBeNull()
    f.mockImplementation(async () => { throw new Error('offline') })
    expect(await translateToEnglish('Witaj')).toBeNull()
    f.mockImplementation(async () => jsonResponse({ nope: true }))
    expect(await translateToEnglish('Witaj')).toBeNull()
    f.mockImplementation(async () => answer('Welcome', 'pl'))
    expect(await translateToEnglish('Witaj')).toEqual({ text: 'Welcome', from: 'pl' })
  })

  it('pauses all translation for a minute after an HTTP 429', async () => {
    vi.useFakeTimers()
    const f = mockFetch(() => jsonResponse({}, { status: 429 }))
    const { translateToEnglish } = await load()
    const p1 = translateToEnglish('Jeden')
    await vi.advanceTimersByTimeAsync(200)
    expect(await p1).toBeNull()
    expect(f).toHaveBeenCalledTimes(1)
    const p2 = translateToEnglish('Dwa')
    await vi.advanceTimersByTimeAsync(200)
    expect(await p2).toBeNull()
    expect(f).toHaveBeenCalledTimes(1) // paused: no new request
    f.mockImplementation(async () => answer('Three', 'pl'))
    await vi.advanceTimersByTimeAsync(61_000)
    const p3 = translateToEnglish('Trzy')
    await vi.advanceTimersByTimeAsync(200)
    expect(await p3).toEqual({ text: 'Three', from: 'pl' })
  })

  it('ignores empty input without a request, and truncates very long text', async () => {
    const f = mockFetch(() => answer('ok', 'pl'))
    const { translateToEnglish } = await load()
    expect(await translateToEnglish('   ')).toBeNull()
    expect(f).not.toHaveBeenCalled()
    await translateToEnglish('ł'.repeat(5000))
    expect(decodeURIComponent(String(f.mock.calls[0][0]).split('&q=')[1]).length).toBe(1000)
  })

  it('works when localStorage is unavailable or full', async () => {
    installLocalStorage({ throwOnSet: true })
    mockFetch(() => answer('Hi', 'pl'))
    const { translateToEnglish } = await load()
    expect(await translateToEnglish('Cześć')).toEqual({ text: 'Hi', from: 'pl' })
  })
})
