import type { NewsArticle } from '../types'
import { getCountryNewsSources, RSS_FEEDS, CRISISWATCH_FEEDS } from './newsSources'

/**
 * Feed links are third-party text rendered as <a href>. React 18 does not block javascript: URLs, so only
 * http(s) links are kept; anything else becomes '' (the headline still shows, it just doesn't link out).
 */
export function httpUrl(u: unknown): string {
  try {
    const raw = String(u ?? '').trim()
    const x = new URL(raw)
    return x.protocol === 'https:' || x.protocol === 'http:' ? raw : ''
  } catch { return '' }
}

// Feed lists moved to newsSources.ts; re-exported so existing imports keep working.
export { RSS_FEEDS, COUNTRY_NEWS_SOURCES, CRISISWATCH_FEEDS, getCountryNewsSources, type CountryNewsSource, type CountryNewsEntry } from './newsSources'

const NEWSAPI_KEY = import.meta.env.VITE_NEWSAPI_KEY || ''

// ── NewsAPI ──────────────────────────────────────────────────────────────────
export async function searchNewsAPI(query: string): Promise<NewsArticle[]> {
  if (!NEWSAPI_KEY) return []
  try {
    const url =
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}` +
      `&sortBy=publishedAt&language=en&pageSize=30&apiKey=${NEWSAPI_KEY}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`NewsAPI ${res.status}`)
    const json = await res.json()
    return (json.articles || []).map(
      (a: {
        title: string
        description: string
        url: string
        source: { name: string }
        publishedAt: string
        urlToImage?: string
      }, i: number) =>
        ({
          id: `newsapi-${i}-${Date.now()}`,
          title: a.title,
          description: a.description || '',
          url: httpUrl(a.url),
          source: a.source?.name ?? 'NewsAPI',
          publishedAt: a.publishedAt,
          imageUrl: a.urlToImage,
        } satisfies NewsArticle)
    )
  } catch (err) {
    console.warn('[NewsAPI]', err)
    return []
  }
}

// ── The Guardian ─────────────────────────────────────────────────────────────
export async function searchGuardian(query: string): Promise<NewsArticle[]> {
  try {
    const url =
      `/api/guardian/search?q=${encodeURIComponent(query)}` +
      `&show-fields=headline,trailText,thumbnail&order-by=newest&page-size=30&lang=en&production-office=uk`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Guardian ${res.status}`)
    const json = await res.json()
    return (json.response?.results || []).map(
      (a: {
        id: string
        webTitle: string
        fields?: { trailText?: string; thumbnail?: string }
        webUrl: string
        webPublicationDate: string
        sectionName: string
      }) =>
        ({
          id: `guardian-${a.id}`,
          title: a.webTitle,
          description: a.fields?.trailText || '',
          url: httpUrl(a.webUrl),
          source: 'The Guardian',
          publishedAt: a.webPublicationDate,
          imageUrl: a.fields?.thumbnail,
          category: a.sectionName,
        } satisfies NewsArticle)
    )
  } catch (err) {
    console.warn('[Guardian]', err)
    return []
  }
}

// ── New York Times ───────────────────────────────────────────────────────────
export async function searchNYT(query: string): Promise<NewsArticle[]> {
  try {
    const url =
      `/api/nyt?q=${encodeURIComponent(query)}` +
      `&sort=newest&fq=document_type:("article")`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`NYT ${res.status}`)
    const json = await res.json()
    const docs = json.response?.docs || []
    return docs.map(
      (a: {
        _id: string
        headline?: { main?: string }
        abstract?: string
        web_url: string
        pub_date: string
        multimedia?: { url: string }[]
        section_name?: string
      }) =>
        ({
          id: `nyt-${a._id}`,
          title: a.headline?.main || '',
          description: a.abstract || '',
          url: httpUrl(a.web_url),
          source: 'New York Times',
          publishedAt: a.pub_date,
          imageUrl: a.multimedia?.[0]
            ? `https://www.nytimes.com/${a.multimedia[0].url}`
            : undefined,
          category: a.section_name,
        } satisfies NewsArticle)
    )
  } catch (err) {
    console.warn('[NYT]', err)
    return []
  }
}

// ── GDELT article search ─────────────────────────────────────────────────────
// GDELT Article Search — free, no key, pulls from 65k+ global news sources
// GDELT's DOC API allows one request per 5 seconds per IP and answers HTTP 429 beyond that — and the app
// fires several searches at once on load. So calls are serialized with a gap, results are cached per query,
// identical in-flight queries share one request, and a 429 pauses all GDELT calls for a minute.
const GDELT_GAP_MS = 5_500
const GDELT_CACHE_TTL_MS = 10 * 60 * 1000
const GDELT_COOLDOWN_MS = 60 * 1000
const gdeltCache = new Map<string, { at: number; data: NewsArticle[] }>()
const gdeltInFlight = new Map<string, Promise<NewsArticle[]>>()
let gdeltTail: Promise<unknown> = Promise.resolve()
let gdeltCooldownUntil = 0

class GdeltRateLimited extends Error {}

/** Drops every cached news response so the next fetch hits the network (used by the manual Reload). */
export function clearNewsCaches() {
  rssCache.clear()
  gdeltCache.clear()
  gdeltCooldownUntil = 0
}

export function searchGDELTNews(query: string): Promise<NewsArticle[]> {
  const cached = gdeltCache.get(query)
  if (cached && Date.now() - cached.at < GDELT_CACHE_TTL_MS) return Promise.resolve(cached.data)
  const pending = gdeltInFlight.get(query)
  if (pending) return pending

  const run = gdeltTail.then(async () => {
    if (Date.now() < gdeltCooldownUntil) return cached?.data ?? []
    try {
      const data = await fetchGDELTNews(query)
      gdeltCache.set(query, { at: Date.now(), data })
      return data
    } catch (err) {
      if (err instanceof GdeltRateLimited) gdeltCooldownUntil = Date.now() + GDELT_COOLDOWN_MS
      console.warn('[GDELT News]', err)
      return cached?.data ?? []
    }
  })
  gdeltTail = run.then(() => sleep(GDELT_GAP_MS), () => sleep(GDELT_GAP_MS))
  gdeltInFlight.set(query, run)
  void run.finally(() => gdeltInFlight.delete(query))
  return run
}

// GDELT stamps articles "20260104T120000Z", which `new Date()` can't parse — an invalid date makes every
// newest-first sort comparison NaN and scrambles the feed, so normalise to ISO at the source.
function gdeltDateToISO(seendate: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(seendate ?? '')
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : seendate
}

async function fetchGDELTNews(query: string): Promise<NewsArticle[]> {
  const url =
    `/api/gdelt/v2/doc/doc?query=${encodeURIComponent(query + ' sourcelang:english')}` +
    `&mode=artlist&maxrecords=50&format=json&sort=DateDesc&sourcelang=english`
  const res = await fetch(url)
  if (res.status === 429) throw new GdeltRateLimited('GDELT Doc 429 (limit is one request per 5 s)')
  if (!res.ok) throw new Error(`GDELT Doc ${res.status}`)
  const json = await res.json()
  const articles = json.articles || []
  return articles.map(
    (a: {
      url: string
      title: string
      seendate: string
      socialimage?: string
      domain: string
      language: string
    }, i: number) =>
      ({
        id: `gdelt-${i}-${Date.now()}`,
        title: a.title,
        description: '',
        url: httpUrl(a.url),
        source: a.domain,
        publishedAt: gdeltDateToISO(a.seendate),
        imageUrl: a.socialimage,
      } satisfies NewsArticle)
  )
}

// ── RSS (via our own /api/rss proxy) ────────────────────────────────────────
// Feeds are fetched and parsed server-side (api/rss.ts) because most send no CORS headers. This used to go
// through api.rss2json.com, whose free tier 429'd after a few feeds on every page load. The shared cache
// and small request queue below still smooth the burst of feeds requested on load (ticker, crisiswatch, …).
const RSS_CACHE_TTL_MS = 5 * 60 * 1000
const rssCache = new Map<string, { at: number; data: NewsArticle[] }>()

let rssQueueTail: Promise<void> = Promise.resolve()
const RSS_MIN_GAP_MS = 250

function scheduleRSSRequest<T>(fn: () => Promise<T>): Promise<T> {
  const run = rssQueueTail.then(fn)
  rssQueueTail = run.then(
    () => new Promise(resolve => setTimeout(resolve, RSS_MIN_GAP_MS)),
    () => new Promise(resolve => setTimeout(resolve, RSS_MIN_GAP_MS))
  )
  return run
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function fetchRSSFeed(feedUrl: string, sourceName: string): Promise<NewsArticle[]> {
  const cached = rssCache.get(feedUrl)
  if (cached && Date.now() - cached.at < RSS_CACHE_TTL_MS) return cached.data

  try {
    const proxy = `/api/rss?url=${encodeURIComponent(feedUrl)}`
    const json = await scheduleRSSRequest(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(proxy)
        if (res.status === 429) {
          await sleep(800 * (attempt + 1))
          continue
        }
        if (!res.ok) throw new Error(`RSS ${res.status}`)
        return res.json()
      }
      throw new Error('RSS 429')
    })
    const articles: NewsArticle[] = (json.items || []).slice(0, 20).map(
      (item: {
        guid: string
        title: string
        description: string
        link: string
        pubDate: string
        thumbnail?: string
        categories?: string[]
      }, i: number) =>
        ({
          id: `rss-${sourceName}-${i}`,
          title: item.title,
          description: item.description?.replace(/<[^>]*>/g, '').slice(0, 200) || '',
          url: httpUrl(item.link),
          source: sourceName,
          publishedAt: item.pubDate,
          imageUrl: item.thumbnail,
          category: item.categories?.[0],
        } satisfies NewsArticle)
    )
    rssCache.set(feedUrl, { at: Date.now(), data: articles })
    return articles
  } catch (err) {
    console.warn(`[RSS:${sourceName}]`, err)
    if (cached) return cached.data
    return []
  }
}

export async function fetchCountryNews(code: string): Promise<NewsArticle[]> {
  const sources = getCountryNewsSources(code)
  const results = await Promise.allSettled(
    sources.map(s => fetchRSSFeed(s.url, s.name))
  )
  const articles: NewsArticle[] = []
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') return
    const lang = sources[i].lang
    articles.push(...(lang ? r.value.map(a => ({ ...a, lang })) : r.value))
  })
  return articles.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
}

// ── Country headlines (Google News RSS search — free, no key, any country) ──────
// Names that are also people / US states / generic words, so a bare quoted name would drag in unrelated
// stories. Each is paired with a term only the country has (its capital or its demonym).
const AMBIGUOUS_COUNTRY_QUERIES: Record<string, string> = {
  georgia: 'Tbilisi OR "Georgian government" OR "Georgian President"',
  chad: "N'Djamena OR Chadian OR \"Chad's government\"",
  jordan: 'Jordan Amman OR Jordanian OR "King Abdullah"',
  niger: 'Niger Niamey OR Nigerien',
  guinea: 'Guinea Conakry OR Guinean',
  turkey: 'Turkey Ankara OR Turkish OR Erdogan',
  mali: 'Mali Bamako OR Malian',
  lebanon: 'Lebanon Beirut OR Lebanese',
}

export function countryNewsQuery(country: string): string {
  const name = country.trim()
  const special = AMBIGUOUS_COUNTRY_QUERIES[name.toLowerCase()]
  return `${special ?? `"${name}"`} when:14d`
}

/** "Headline - Outlet" is how Google News packs the outlet into the title; split it back apart. */
export function splitGoogleNewsTitle(raw: string): { title: string; source: string } {
  const i = raw.lastIndexOf(' - ')
  if (i > 10 && raw.length - i < 60) return { title: raw.slice(0, i).trim(), source: raw.slice(i + 3).trim() }
  return { title: raw.trim(), source: 'Google News' }
}

/** Newest-first recent headlines mentioning one country, from any outlet Google News indexes. [] on failure. */
export async function fetchCountryHeadlines(country: string): Promise<NewsArticle[]> {
  if (!country.trim()) return []
  const feed = `https://news.google.com/rss/search?q=${encodeURIComponent(countryNewsQuery(country))}&hl=en-US&gl=US&ceid=US:en`
  const items = await fetchRSSFeed(feed, 'Google News')
  return items
    .filter(a => a.title && a.url)
    .map((a, i) => {
      const { title, source } = splitGoogleNewsTitle(a.title)
      return { ...a, id: `gnews-${country}-${i}`, title, source, description: '' }
    })
}

/** Google News search for a city: "Name" plus its state/province (when known) to keep namesakes out. */
export function placeNewsQuery(name: string, region?: string): string {
  return `"${name.trim()}"${region?.trim() ? ` "${region.trim()}"` : ''} when:14d`
}

async function searchGoogleNews(query: string, idPrefix: string): Promise<NewsArticle[]> {
  const feed = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
  const items = await fetchRSSFeed(feed, 'Google News')
  return items
    .filter(a => a.title && a.url)
    .map((a, i) => {
      const { title, source } = splitGoogleNewsTitle(a.title)
      return { ...a, id: `${idPrefix}-${i}`, title, source, description: '' }
    })
}

/**
 * Recent headlines about a city. Tries the name + state/province first; if that finds almost nothing
 * (many stories only say "New Orleans"), widens to the bare name. [] on failure.
 */
export async function fetchPlaceHeadlines(name: string, region?: string): Promise<NewsArticle[]> {
  if (!name.trim()) return []
  const id = `gplace-${name}`
  const specific = region?.trim() ? await searchGoogleNews(placeNewsQuery(name, region), id) : []
  if (specific.length >= 5) return specific
  const broad = await searchGoogleNews(placeNewsQuery(name), id)
  const seen = new Set(specific.map(a => a.url))
  return [...specific, ...broad.filter(a => !seen.has(a.url))]
}

// ── CrisisWatch (International Crisis Group) ──────────────────────────────────
// Monthly conflict monitoring across 70+ countries — no API key required

export interface CrisisWatchEntry extends NewsArticle {
  trend:  'deteriorated' | 'improved' | 'unchanged' | 'alert' | 'unknown'
  region: string
}

function detectTrend(text: string): CrisisWatchEntry['trend'] {
  const t = text.toLowerCase()
  if (/deteriorat|escalat|worsen|intensif|spike|surge|outbreak|clashes erupted|conflict spread/.test(t)) return 'deteriorated'
  if (/alert|warning|risk of|imminent|crisis point|danger/.test(t))                                        return 'alert'
  if (/improv|ceasefire|peace talks|reduction|calm|stabiliz|positiv|withdrawal/.test(t))                   return 'improved'
  if (/unchanged|continued|ongoing|persist|no significant|stalemate/.test(t))                              return 'unchanged'
  return 'unknown'
}

export async function fetchAllCrisisWatch(): Promise<CrisisWatchEntry[]> {
  const results = await Promise.allSettled(
    CRISISWATCH_FEEDS.map(f =>
      fetchRSSFeed(f.url, f.name).then(articles =>
        articles.map(a => ({
          ...a,
          trend:  detectTrend((a.title || '') + ' ' + (a.description || '')),
          region: f.region,
        } as CrisisWatchEntry))
      )
    )
  )
  const seen = new Set<string>()
  const all: CrisisWatchEntry[] = []
  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    for (const a of r.value) {
      if (seen.has(a.url)) continue
      seen.add(a.url)
      all.push(a)
    }
  }
  return all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
}

// ── English detection (fast heuristic) ───────────────────────────────────────
// Rejects titles that are clearly non-English based on character sets and
// common non-English patterns. Allows through anything that looks Latin-script.
const NON_LATIN_RE = /[\u0400-\u04FF\u0600-\u06FF\u0980-\u09FF\u0A00-\u0A7F\u0E00-\u0E7F\u3000-\u9FFF\uAC00-\uD7AF\u1100-\u11FF]/
function looksEnglish(text: string): boolean {
  if (!text || text.length < 4) return false
  // Reject if title contains non-Latin scripts (Cyrillic, Arabic, CJK, etc.)
  if (NON_LATIN_RE.test(text)) return false
  // Reject if majority of chars are accented / non-ASCII Latin (likely French/German/etc.)
  const ascii = text.replace(/[^a-zA-Z]/g, '').length
  const letters = text.replace(/[^a-zA-ZÀ-ÿ]/g, '').length
  if (letters > 0 && ascii / letters < 0.75) return false
  return true
}

// ── Aggregate Search ─────────────────────────────────────────────────────────
export async function searchAllSources(query: string): Promise<NewsArticle[]> {
  const results = await Promise.allSettled([
    searchNewsAPI(query),
    searchGuardian(query),
    searchNYT(query),
    searchGDELTNews(query),
    ...RSS_FEEDS.map((f) => fetchRSSFeed(f.url, f.name)),
  ])

  const articles: NewsArticle[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') articles.push(...r.value)
  }

  // English-only + deduplicate by title similarity + sort by date
  const seen = new Set<string>()
  return articles
    .filter((a) => {
      // Drop non-English articles
      if (!looksEnglish(a.title)) return false
      const key = a.title.slice(0, 60).toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    .slice(0, 100)
}

// Headlines are a keyword search, and the keyword sources (NYT especially) mix in items days old. Keep what
// was published in the last 48 h; only if that leaves too little fall back to the newest of what we have.
const HEADLINES_MAX_AGE_MS = 48 * 60 * 60 * 1000
const HEADLINES_MIN_FRESH = 10

export async function fetchTopHeadlines(): Promise<NewsArticle[]> {
  const all = await searchAllSources('world war conflict politics economy')
  const cutoff = Date.now() - HEADLINES_MAX_AGE_MS
  const fresh = all.filter(a => new Date(a.publishedAt).getTime() >= cutoff)
  return fresh.length >= HEADLINES_MIN_FRESH ? fresh : all
}
