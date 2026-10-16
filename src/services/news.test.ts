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

  it('tags articles from non-English feeds with their language (so they can be translated) and leaves English ones alone', async () => {
    mockFetch(() => rssBody([rssItem(1, { title: 'Tytuł' })]))
    const { fetchCountryNews, COUNTRY_NEWS_SOURCES } = await load()
    const pl = COUNTRY_NEWS_SOURCES.find(c => c.code === 'PL')!
    const articles = await settle(fetchCountryNews('PL'))
    const hinted = new Set(pl.sources.filter(s => s.lang).map(s => s.name))
    expect(hinted.size).toBeGreaterThan(0)
    for (const a of articles) {
      if (hinted.has(a.source)) expect(a.lang, a.source).toBe('pl')
      else expect(a.lang, a.source).toBeUndefined()
    }
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

  it('searchGoogleNewsHeadlines queries Google News via the RSS proxy and splits the outlet out of the title', async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetch(() => rssBody([{ title: 'Ceasefire talks resume in Geneva - Reuters', link: 'https://n/1', pubDate: '2025-01-01 00:00:00' }]))
    const { searchGoogleNewsHeadlines } = await load()
    const [a] = await settle(searchGoogleNewsHeadlines('war & peace'))
    expect(a).toMatchObject({ title: 'Ceasefire talks resume in Geneva', source: 'Reuters', url: 'https://n/1', description: '' })
    const feed = decodeURIComponent(decodeURIComponent(String(fetchMock.mock.calls[0][0])))
    expect(feed).toContain('news.google.com/rss/search?q=war & peace when:7d')
  })

  it('searchGoogleNewsHeadlines returns [] for a blank query or a failed feed', async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetch(() => jsonResponse({}, { status: 500 }))
    const news = await load()
    expect(await news.searchGoogleNewsHeadlines('  ')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await settle(news.searchGoogleNewsHeadlines('x'))).toEqual([])
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

  it('searchNYT sends no fq filter (it matches nothing upstream) and drops non-article docs', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ response: { docs: [
      { _id: 'a', document_type: 'article', web_url: 'https://n/a', pub_date: '2025-01-01' },
      { _id: 'm', document_type: 'multimedia', web_url: 'https://n/m', pub_date: '2025-01-01' },
    ] } }))
    const res = await (await load()).searchNYT('x')
    expect(res.map(a => a.id)).toEqual(['nyt-a'])
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('fq=')
  })

  it('searchNYT serializes requests, caches per query, and backs off for a minute after a 429', async () => {
    vi.useFakeTimers()
    try {
      let status = 200
      const fetchMock = mockFetch(() => status === 200
        ? jsonResponse({ response: { docs: [{ _id: 'a', web_url: 'https://n/a', pub_date: '2025-01-01' }] } })
        : jsonResponse({}, { status }))
      const news = await load()
      expect(await news.searchNYT('a')).toHaveLength(1)
      const b = news.searchNYT('b')
      await vi.advanceTimersByTimeAsync(5_000)
      expect(fetchMock).toHaveBeenCalledTimes(1) // 'b' waits for NYT's 5-per-minute gap
      await vi.runAllTimersAsync(); await b
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(await news.searchNYT('a')).toHaveLength(1) // cached
      expect(fetchMock).toHaveBeenCalledTimes(2)

      status = 429
      const c = news.searchNYT('c'); await vi.runAllTimersAsync(); expect(await c).toEqual([])
      const d = news.searchNYT('d'); await vi.runAllTimersAsync(); expect(await d).toEqual([])
      expect(fetchMock).toHaveBeenCalledTimes(3) // 'd' skipped during the cooldown
    } finally {
      vi.useRealTimers()
    }
  })

  it('searchGDELTNews maps articles and returns [] on failure', async () => {
    mockFetch(() => jsonResponse({ articles: [{ url: 'https://u', title: 'T', seendate: '20250101T000000Z', domain: 'd.com', socialimage: 'https://i', language: 'English' }] }))
    const [a] = await (await load()).searchGDELTNews('x')
    expect(a).toMatchObject({ title: 'T', url: 'https://u', source: 'd.com', publishedAt: '2025-01-01T00:00:00Z', imageUrl: 'https://i' })
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
      if (url.includes('news.google.com')) return rssBody([
        { title: 'Shared headline about the war', link: 'https://g/1', pubDate: '2025-01-01T00:00:00Z' },
        { title: 'Новости из Москвы сегодня', link: 'https://g/2', pubDate: '2025-06-01T00:00:00Z' },
        { title: 'Éléàèù âêîôû éàèùç ûîôâ', link: 'https://g/3', pubDate: '2025-06-02T00:00:00Z' },
      ])
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
    mockFetch(url => url.startsWith('/api/nyt')
      ? jsonResponse({ response: { docs: Array.from({ length: 150 }, (_, i) => ({ _id: `${i}`, headline: { main: `Unique english headline number ${i}` }, web_url: `u${i}`, pub_date: '2025-01-01T00:00:00Z' })) } })
      : url.startsWith('/api/gdelt') ? jsonResponse({ articles: [] })
      : rssBody([]))
    const result = await settle((await load()).searchAllSources('x'))
    expect(result).toHaveLength(100)
  })

  it('still returns results when some sources fail outright', async () => {
    mockFetch(url => {
      if (url.includes('news.google.com')) throw new Error('offline')
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

describe('manual reload and headline freshness', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-04T12:00:00Z')); quietConsole() })
  afterEach(() => vi.useRealTimers())

  it('clearNewsCaches makes the next RSS request hit the network instead of the 5-minute cache', async () => {
    const fetchMock = mockFetch(() => rssBody([rssItem(1)]))
    const { fetchRSSFeed, clearNewsCaches } = await load()
    await settle(fetchRSSFeed('https://feed/a', 'Wire'))
    clearNewsCaches()
    await settle(fetchRSSFeed('https://feed/a', 'Wire'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('fetchTopHeadlines keeps only the last 48 h when enough fresh articles exist', async () => {
    const fresh = Array.from({ length: 10 }, (_, i) => ({ _id: `f${i}`, headline: { main: `Fresh story ${i}` }, web_url: `u${i}`, pub_date: '2026-10-04T10:00:00Z' }))
    const stale = { _id: 's', headline: { main: 'Stale story' }, web_url: 'us', pub_date: '2026-09-29T10:00:00Z' }
    mockFetch(url => url.startsWith('/api/nyt') ? jsonResponse({ response: { docs: [...fresh, stale] } }) : url.startsWith('/api/gdelt') ? jsonResponse({ articles: [] }) : rssBody([]))
    const { fetchTopHeadlines } = await load()
    const result = await settle(fetchTopHeadlines())
    expect(result).toHaveLength(10)
    expect(result.some(a => a.title === 'Stale story')).toBe(false)
  })

  it('fetchTopHeadlines falls back to the newest available when almost nothing is fresh', async () => {
    mockFetch(url => url.startsWith('/api/nyt') ? jsonResponse({ response: { docs: [{ _id: 's', headline: { main: 'Stale story' }, web_url: 'us', pub_date: '2026-09-29T10:00:00Z' }] } }) : url.startsWith('/api/gdelt') ? jsonResponse({ articles: [] }) : rssBody([]))
    const { fetchTopHeadlines } = await load()
    const result = await settle(fetchTopHeadlines())
    expect(result.map(a => a.title)).toEqual(['Stale story'])
  })

  it('normalises GDELT seendate stamps so they sort against ISO dates from other sources', async () => {
    mockFetch(url => url.startsWith('/api/gdelt')
      ? jsonResponse({ articles: [{ url: 'g', title: 'Gdelt newest story', seendate: '20261004T110000Z', domain: 'd.com', language: 'English' }] })
      : url.startsWith('/api/nyt') ? jsonResponse({ response: { docs: [{ _id: 'n', headline: { main: 'Older nyt story' }, web_url: 'n', pub_date: '2026-10-03T00:00:00Z' }] } })
      : rssBody([]))
    const { searchAllSources } = await load()
    const result = await settle(searchAllSources('x'))
    expect(result.map(a => a.title)).toEqual(['Gdelt newest story', 'Older nyt story'])
  })
})

describe('country headlines', () => {
  beforeEach(() => { vi.useFakeTimers(); quietConsole() })
  afterEach(() => vi.useRealTimers())

  it('splits the outlet back out of a Google News title', async () => {
    const { splitGoogleNewsTitle } = await load()
    expect(splitGoogleNewsTitle('Floods hit the north - Reuters')).toEqual({ title: 'Floods hit the north', source: 'Reuters' })
    expect(splitGoogleNewsTitle('Talks collapse - again, say officials - The Daily Star')).toEqual({ title: 'Talks collapse - again, say officials', source: 'The Daily Star' })
    expect(splitGoogleNewsTitle('No outlet suffix at all')).toEqual({ title: 'No outlet suffix at all', source: 'Google News' })
  })

  it('quotes the name, narrows ambiguous ones, and bounds the age', async () => {
    const { countryNewsQuery } = await load()
    expect(countryNewsQuery('Peru')).toBe('"Peru" when:14d')
    expect(countryNewsQuery('Chad')).toContain('Chadian')
    expect(countryNewsQuery('Georgia')).toContain('Tbilisi')
  })

  it('fetches through the RSS proxy and returns clean articles', async () => {
    const fetchMock = mockFetch(() => rssBody([rssItem(1, { title: 'Quake hits Peru - BBC News' }), rssItem(2, { link: '' })]))
    const { fetchCountryHeadlines } = await load()
    const out = await settle(fetchCountryHeadlines('Peru'))
    const url = decodeURIComponent(decodeURIComponent(String(fetchMock.mock.calls[0][0])))
    expect(url).toContain('/api/rss?url=https://news.google.com/rss/search?q="Peru" when:14d')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ title: 'Quake hits Peru', source: 'BBC News', description: '' })
  })

  it('returns [] on HTTP failure or a blank name without throwing', async () => {
    mockFetch(() => new Response('nope', { status: 502 }))
    const { fetchCountryHeadlines } = await load()
    expect(await settle(fetchCountryHeadlines('Peru'))).toEqual([])
    expect(await fetchCountryHeadlines('  ')).toEqual([])
  })
})

describe('place headlines', () => {
  beforeEach(() => { vi.useFakeTimers(); quietConsole() })
  afterEach(() => vi.useRealTimers())

  it('quotes the city and its state, and bounds the age', async () => {
    const { placeNewsQuery } = await load()
    expect(placeNewsQuery('New Orleans', 'Louisiana')).toBe('"New Orleans" "Louisiana" when:14d')
    expect(placeNewsQuery('Paris')).toBe('"Paris" when:14d')
  })

  it('widens to the bare name when the state-qualified search finds little, without duplicates', async () => {
    const fetchMock = mockFetch(url => decodeURIComponent(decodeURIComponent(url)).includes('"Louisiana"')
      ? rssBody([rssItem(1, { title: 'Levee repair - WWL' })])
      : rssBody([rssItem(1, { title: 'Levee repair - WWL' }), rssItem(2, { title: 'Saints win at the Superdome - NOLA.com' })]))
    const { fetchPlaceHeadlines } = await load()
    const out = await settle(fetchPlaceHeadlines('New Orleans', 'Louisiana'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(out.map(a => a.title)).toEqual(['Levee repair', 'Saints win at the Superdome'])
  })

  it('does not search twice when the first search already has enough stories', async () => {
    const fetchMock = mockFetch(() => rssBody([1, 2, 3, 4, 5].map(i => rssItem(i))))
    const { fetchPlaceHeadlines } = await load()
    await settle(fetchPlaceHeadlines('New Orleans', 'Louisiana'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns [] on HTTP failure or a blank name without throwing', async () => {
    mockFetch(() => new Response('nope', { status: 502 }))
    const { fetchPlaceHeadlines } = await load()
    expect(await settle(fetchPlaceHeadlines('New Orleans', 'Louisiana'))).toEqual([])
    expect(await fetchPlaceHeadlines('  ')).toEqual([])
  })
})

describe('httpUrl (feed links rendered as <a href>)', () => {
  it('keeps http(s) links and drops javascript:, data: and garbage', async () => {
    const { httpUrl } = await import('./news')
    expect(httpUrl('https://example.org/a?b=1')).toBe('https://example.org/a?b=1')
    expect(httpUrl('http://example.org/')).toBe('http://example.org/')
    expect(httpUrl('javascript:alert(1)')).toBe('')
    expect(httpUrl('data:text/html,<script>x</script>')).toBe('')
    expect(httpUrl('not a url')).toBe('')
    expect(httpUrl(undefined)).toBe('')
  })
})
