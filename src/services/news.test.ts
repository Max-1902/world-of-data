import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockFetch, jsonResponse, quietConsole } from '../test/helpers'

// news.ts keeps an RSS cache and request queue at module level — reload per test.
async function load() { vi.resetModules(); return import('./news') }

/** Run a promise-returning call to completion under fake timers (RSS queue uses real setTimeout gaps). */
async function settle<T>(p: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync()
  return p
}

const rssItem = (i: number, o: Record<string, unknown> = {}) => ({
  guid: `g${i}`, title: `Title ${i}`, description: `<p>Body <b>${i}</b></p>`, link: `https://x/${i}`,
  pubDate: `2025-01-0${(i % 9) + 1} 00:00:00`, thumbnail: `https://img/${i}.jpg`, categories: ['World'], ...o,
})
const rssBody = (items: unknown[]) => jsonResponse({ items })

describe('fetchRSSFeed', () => {
  beforeEach(() => { vi.useFakeTimers(); quietConsole() })
  afterEach(() => vi.useRealTimers())

  it('maps items, strips HTML from descriptions, and tags the source', async () => {
    mockFetch(() => rssBody([rssItem(1)]))
    const { fetchRSSFeed } = await load()
    const [a] = await settle(fetchRSSFeed('https://feed/a', 'Wire'))
    expect(a).toEqual({
      id: 'rss-Wire-0', title: 'Title 1', description: 'Body 1', url: 'https://x/1',
      source: 'Wire', publishedAt: '2025-01-02 00:00:00', imageUrl: 'https://img/1.jpg', category: 'World',
    })
  })

  it('caps results at 20 and descriptions at 200 chars', async () => {
    mockFetch(() => rssBody(Array.from({ length: 35 }, (_, i) => rssItem(i, { description: 'x'.repeat(500) }))))
    const { fetchRSSFeed } = await load()
    const articles = await settle(fetchRSSFeed('https://feed/a', 'Wire'))
    expect(articles).toHaveLength(20)
    expect(articles[0].description).toHaveLength(200)
  })

  it('percent-encodes the feed URL when calling the proxy', async () => {
    const fetchMock = mockFetch(() => rssBody([]))
    const { fetchRSSFeed } = await load()
    await settle(fetchRSSFeed('https://feed/a?x=1&y=2', 'Wire'))
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/rss?url=https%3A%2F%2Ffeed%2Fa%3Fx%3D1%26y%3D2')
  })

  it('serves repeat requests from cache for 5 minutes, then refetches', async () => {
    const fetchMock = mockFetch(() => rssBody([rssItem(1)]))
    const { fetchRSSFeed } = await load()
    await settle(fetchRSSFeed('https://feed/a', 'Wire'))
    await settle(fetchRSSFeed('https://feed/a', 'Wire'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1)
    await settle(fetchRSSFeed('https://feed/a', 'Wire'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries with backoff on HTTP 429 and succeeds once the proxy recovers', async () => {
    let calls = 0
    mockFetch(() => ++calls < 3 ? jsonResponse({}, { status: 429 }) : rssBody([rssItem(1)]))
    const { fetchRSSFeed } = await load()
    const articles = await settle(fetchRSSFeed('https://feed/a', 'Wire'))
    expect(calls).toBe(3)
    expect(articles).toHaveLength(1)
  })

  it('gives up after three 429s and returns []', async () => {
    let calls = 0
    mockFetch(() => { calls++; return jsonResponse({}, { status: 429 }) })
    const { fetchRSSFeed } = await load()
    expect(await settle(fetchRSSFeed('https://feed/a', 'Wire'))).toEqual([])
    expect(calls).toBe(3)
  })

  it('returns [] on other HTTP errors and malformed payloads', async () => {
    mockFetch(() => jsonResponse({}, { status: 500 }))
    expect(await settle((await load()).fetchRSSFeed('https://feed/a', 'Wire'))).toEqual([])
    mockFetch(() => jsonResponse({}))
    expect(await settle((await load()).fetchRSSFeed('https://feed/b', 'Wire'))).toEqual([])
  })

  it('spaces requests at least 250ms apart', async () => {
    const times: number[] = []
    mockFetch(() => { times.push(Date.now()); return rssBody([]) })
    const { fetchRSSFeed } = await load()
    const all = Promise.all([fetchRSSFeed('https://f/1', 'A'), fetchRSSFeed('https://f/2', 'B'), fetchRSSFeed('https://f/3', 'C')])
    await settle(all)
    expect(times).toHaveLength(3)
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(250)
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(250)
  })
})

describe('country news', () => {
  beforeEach(() => { vi.useFakeTimers(); quietConsole() })
  afterEach(() => vi.useRealTimers())

  it('getCountryNewsSources returns that country\'s outlets, falling back to the default (first) entry', async () => {
    const { getCountryNewsSources, COUNTRY_NEWS_SOURCES } = await load()
    const gb = COUNTRY_NEWS_SOURCES.find(c => c.code === 'GB')!
    expect(getCountryNewsSources('GB')).toBe(gb.sources)
    expect(getCountryNewsSources('ZZ')).toBe(COUNTRY_NEWS_SOURCES[0].sources)
  })

  it('fetchCountryNews merges all outlets newest-first and survives individual feed failures', async () => {
    let n = 0
    mockFetch(() => {
      n++
      if (n === 2) return jsonResponse({}, { status: 500 })
      return rssBody([
        rssItem(n, { pubDate: `2025-01-0${n} 00:00:00`, title: `Old ${n}` }),
        rssItem(n + 10, { pubDate: `2025-02-0${n} 00:00:00`, title: `New ${n}` }),
      ])
    })
    const { fetchCountryNews } = await load()
    const articles = await settle(fetchCountryNews('GB'))
    const dates = articles.map(a => Date.parse(a.publishedAt))
    expect(articles.length).toBeGreaterThan(0)
    expect([...dates].sort((a, b) => b - a)).toEqual(dates)
    expect(articles.some(a => a.title === 'Old 2')).toBe(false) // the failed feed contributed nothing
  })
})

describe('CrisisWatch', () => {
  beforeEach(() => { vi.useFakeTimers(); quietConsole() })
  afterEach(() => vi.useRealTimers())

  it.each([
    ['Violence escalates sharply', 'deteriorated'],
    ['Warning of imminent collapse', 'alert'],
    ['Ceasefire holds, tensions calm', 'improved'],
    ['Situation ongoing with stalemate', 'unchanged'],
    ['Something neutral happened', 'unknown'],
  ])('classifies "%s" as %s', async (title, trend) => {
    mockFetch(() => rssBody([rssItem(1, { title, description: '' })]))
    const { fetchAllCrisisWatch } = await load()
    const [entry] = await settle(fetchAllCrisisWatch())
    expect(entry.trend).toBe(trend)
  })

  it('fetchAllCrisisWatch de-duplicates by URL, tags regions and sorts newest-first', async () => {
    mockFetch(() => rssBody([
      rssItem(1, { link: 'https://same', pubDate: '2025-01-01 00:00:00' }),
      rssItem(2, { link: 'https://new', pubDate: '2025-03-01 00:00:00' }),
    ]))
    const { fetchAllCrisisWatch, CRISISWATCH_FEEDS } = await load()
    const all = await settle(fetchAllCrisisWatch())
    expect(all.map(a => a.url)).toEqual(['https://new', 'https://same'])
    expect(CRISISWATCH_FEEDS.map(f => f.region)).toContain(all[0].region)
  })
})

describe('article search', () => {
  afterEach(() => vi.useRealTimers())
  beforeEach(() => quietConsole())

  it('searchGuardian maps the Guardian payload and encodes the query', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ response: { results: [{
      id: 'world/1', webTitle: 'Headline', fields: { trailText: 'Trail', thumbnail: 'https://t' },
      webUrl: 'https://g/1', webPublicationDate: '2025-01-01T00:00:00Z', sectionName: 'World',
    }] } }))
    const { searchGuardian } = await load()
    const [a] = await searchGuardian('war & peace')
    expect(a).toEqual({
      id: 'guardian-world/1', title: 'Headline', description: 'Trail', url: 'https://g/1',
      source: 'The Guardian', publishedAt: '2025-01-01T00:00:00Z', imageUrl: 'https://t', category: 'World',
    })
    expect(String(fetchMock.mock.calls[0][0])).toContain('q=war%20%26%20peace')
  })

  it('searchGuardian returns [] on failure', async () => {
    mockFetch(() => jsonResponse({}, { status: 500 }))
    expect(await (await load()).searchGuardian('x')).toEqual([])
    mockFetch(() => { throw new Error('offline') })
    expect(await (await load()).searchGuardian('x')).toEqual([])
  })

  it('searchNYT maps docs, builds image URLs, and tolerates missing headline/multimedia', async () => {
    mockFetch(() => jsonResponse({ response: { docs: [
      { _id: 'a', headline: { main: 'H' }, abstract: 'Abs', web_url: 'https://n/a', pub_date: '2025-01-01', multimedia: [{ url: 'images/x.jpg' }], section_name: 'World' },
      { _id: 'b', web_url: 'https://n/b', pub_date: '2025-01-02' },
    ] } }))
    const [a, b] = await (await load()).searchNYT('x')
    expect(a).toMatchObject({ id: 'nyt-a', title: 'H', description: 'Abs', imageUrl: 'https://www.nytimes.com/images/x.jpg', source: 'New York Times' })
    expect(b).toMatchObject({ id: 'nyt-b', title: '', description: '', imageUrl: undefined })
  })

  it('searchNYT returns [] on failure or when the key is unset (empty docs)', async () => {
    mockFetch(() => jsonResponse({ response: { docs: [] } }))
    expect(await (await load()).searchNYT('x')).toEqual([])
    mockFetch(() => jsonResponse({}, { status: 500 }))
    expect(await (await load()).searchNYT('x')).toEqual([])
  })

  it('searchGDELTNews maps articles and returns [] on failure', async () => {
    mockFetch(() => jsonResponse({ articles: [{ url: 'https://u', title: 'T', seendate: '20250101T000000Z', domain: 'd.com', socialimage: 'https://i', language: 'English' }] }))
    const [a] = await (await load()).searchGDELTNews('x')
    expect(a).toMatchObject({ title: 'T', url: 'https://u', source: 'd.com', publishedAt: '20250101T000000Z', imageUrl: 'https://i' })
    mockFetch(() => jsonResponse({}, { status: 500 }))
    expect(await (await load()).searchGDELTNews('x')).toEqual([])
  })

  it('searchNewsAPI is disabled (no network call) without a key, and sends it when configured', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ articles: [{ title: 'T', description: null, url: 'https://u', source: { name: 'S' }, publishedAt: '2025-01-01', urlToImage: 'https://i' }] }))
    expect(await (await load()).searchNewsAPI('x')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()

    vi.stubEnv('VITE_NEWSAPI_KEY', 'k123')
    const [a] = await (await load()).searchNewsAPI('x')
    expect(a).toMatchObject({ title: 'T', description: '', source: 'S', imageUrl: 'https://i' })
    expect(String(fetchMock.mock.calls[0][0])).toContain('apiKey=k123')
  })
})

describe('searchAllSources', () => {
  beforeEach(() => { vi.useFakeTimers(); quietConsole() })
  afterEach(() => vi.useRealTimers())

  it('merges sources, drops non-English titles, de-duplicates by title and sorts newest-first', async () => {
    mockFetch(url => {
      if (url.startsWith('/api/guardian')) return jsonResponse({ response: { results: [
        { id: '1', webTitle: 'Shared headline about the war', webUrl: 'u1', webPublicationDate: '2025-01-01T00:00:00Z', sectionName: 'w' },
        { id: '2', webTitle: 'Новости из Москвы сегодня', webUrl: 'u2', webPublicationDate: '2025-06-01T00:00:00Z', sectionName: 'w' },
        { id: '3', webTitle: 'Éléàèù âêîôû éàèùç ûîôâ', webUrl: 'u3', webPublicationDate: '2025-06-02T00:00:00Z', sectionName: 'w' },
      ] } })
      if (url.startsWith('/api/nyt')) return jsonResponse({ response: { docs: [
        { _id: 'x', headline: { main: 'shared headline about the war' }, web_url: 'u4', pub_date: '2025-05-01T00:00:00Z' },
        { _id: 'y', headline: { main: 'A newer unique headline' }, web_url: 'u5', pub_date: '2025-04-01T00:00:00Z' },
      ] } })
      if (url.startsWith('/api/gdelt')) return jsonResponse({ articles: [] })
      return rssBody([])
    })
    const { searchAllSources } = await load()
    const result = await settle(searchAllSources('war'))
    expect(result.map(a => a.title)).toEqual(['A newer unique headline', 'Shared headline about the war'])
  })

  it('caps the result at 100 articles', async () => {
    mockFetch(url => url.startsWith('/api/guardian')
      ? jsonResponse({ response: { results: Array.from({ length: 150 }, (_, i) => ({ id: `${i}`, webTitle: `Unique english headline number ${i}`, webUrl: `u${i}`, webPublicationDate: '2025-01-01T00:00:00Z', sectionName: 'w' })) } })
      : url.startsWith('/api/nyt') ? jsonResponse({ response: { docs: [] } })
      : url.startsWith('/api/gdelt') ? jsonResponse({ articles: [] })
      : rssBody([]))
    const result = await settle((await load()).searchAllSources('x'))
    expect(result).toHaveLength(100)
  })

  it('still returns results when some sources fail outright', async () => {
    mockFetch(url => {
      if (url.startsWith('/api/guardian')) throw new Error('offline')
      if (url.startsWith('/api/nyt')) return jsonResponse({}, { status: 500 })
      if (url.startsWith('/api/gdelt')) return jsonResponse({ articles: [{ url: 'u', title: 'Surviving english headline', seendate: '2025-01-01', domain: 'd', language: 'English' }] })
      return jsonResponse({}, { status: 500 })
    })
    const result = await settle((await load()).searchAllSources('x'))
    expect(result.map(a => a.title)).toEqual(['Surviving english headline'])
  })
})

describe('searchGDELTNews rate limiting (GDELT allows one request per 5 s)', () => {
  beforeEach(() => { vi.useFakeTimers(); quietConsole() })
  afterEach(() => vi.useRealTimers())

  const article = { url: 'https://n/1', title: 'Headline', seendate: '20250101T000000Z', domain: 'n', language: 'English' }
  const gdelt = () => jsonResponse({ articles: [article] })

  it('caches per query for 10 minutes, then refetches', async () => {
    const fetchMock = mockFetch(gdelt)
    const { searchGDELTNews } = await load()
    await settle(searchGDELTNews('iran'))
    await settle(searchGDELTNews('iran'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 1)
    await settle(searchGDELTNews('iran'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('lets concurrent identical queries share a single request', async () => {
    const fetchMock = mockFetch(gdelt)
    const { searchGDELTNews } = await load()
    const results = await settle(Promise.all([searchGDELTNews('iran'), searchGDELTNews('iran'), searchGDELTNews('iran')]))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(results.every(r => r.length === 1)).toBe(true)
  })

  it('spaces different queries at least 5.5 s apart', async () => {
    const times: number[] = []
    mockFetch(() => { times.push(Date.now()); return gdelt() })
    const { searchGDELTNews } = await load()
    await settle(Promise.all([searchGDELTNews('a'), searchGDELTNews('b'), searchGDELTNews('c')]))
    expect(times).toHaveLength(3)
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(5500)
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(5500)
  })

  it('pauses all GDELT calls for a minute after a 429, then resumes', async () => {
    let status = 429
    const fetchMock = mockFetch(() => status === 429 ? jsonResponse({}, { status }) : gdelt())
    const { searchGDELTNews } = await load()
    expect(await settle(searchGDELTNews('a'))).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)

    status = 200
    expect(await settle(searchGDELTNews('b'))).toEqual([])          // still cooling down: no request made
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(60 * 1000 + 1)
    expect(await settle(searchGDELTNews('b'))).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('serves the last good results when a later refresh fails', async () => {
    let fail = false
    mockFetch(() => fail ? jsonResponse({}, { status: 500 }) : gdelt())
    const { searchGDELTNews } = await load()
    expect(await settle(searchGDELTNews('iran'))).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 1)
    fail = true
    expect(await settle(searchGDELTNews('iran'))).toHaveLength(1)
  })
})
