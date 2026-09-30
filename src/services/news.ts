import type { NewsArticle } from '../types'

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
          url: a.url,
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
          url: a.webUrl,
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
          url: a.web_url,
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
        url: a.url,
        source: a.domain,
        publishedAt: a.seendate,
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
          url: item.link,
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

export const RSS_FEEDS = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC News' },
  { url: 'https://rss.dw.com/xml/rss-en-world', name: 'DW News' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera English' },
  { url: 'https://www.france24.com/en/rss', name: 'France 24 English' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', name: 'NYT World' },
  { url: 'https://www.theguardian.com/world/rss', name: 'Guardian World' },
]

// ── Per-country news sources ─────────────────────────────────────────────────
// The 5 most reliable/widely-cited outlets per country (RSS-based), used to
// let the news panel be filtered to a specific country's press. US is default.
export interface CountryNewsSource {
  name: string
  url: string
}

export interface CountryNewsEntry {
  code: string
  label: string
  sources: CountryNewsSource[]
}

export const COUNTRY_NEWS_SOURCES: CountryNewsEntry[] = [
  {
    code: 'US', label: 'United States', sources: [
      { name: 'NYT',              url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
      { name: 'NPR',              url: 'https://feeds.npr.org/1001/rss.xml' },
      { name: 'BBC News',         url: 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml' },
      { name: 'Al Jazeera',       url: 'https://www.aljazeera.com/xml/rss/all.xml' },
      { name: 'The Guardian US',  url: 'https://www.theguardian.com/us-news/rss' },
    ],
  },
  {
    code: 'GB', label: 'United Kingdom', sources: [
      { name: 'BBC News',   url: 'https://feeds.bbci.co.uk/news/rss.xml' },
      { name: 'The Guardian', url: 'https://www.theguardian.com/uk/rss' },
      { name: 'Financial Times', url: 'https://www.ft.com/rss/home/uk' },
      { name: 'Sky News',   url: 'https://feeds.skynews.com/feeds/rss/uk.xml' },
      { name: 'DW News',    url: 'https://rss.dw.com/xml/rss-en-all' },
    ],
  },
  {
    code: 'DE', label: 'Germany', sources: [
      { name: 'DW News (EN)',  url: 'https://rss.dw.com/xml/rss-en-all' },
      { name: 'DW News (DE)',  url: 'https://rss.dw.com/rdf/rss-de-all' },
      { name: 'Der Spiegel',   url: 'https://www.spiegel.de/international/index.rss' },
      { name: 'Tagesschau',    url: 'https://www.tagesschau.de/xml/rss2' },
      { name: 'Die Zeit',      url: 'https://newsfeed.zeit.de/index' },
    ],
  },
  {
    code: 'FR', label: 'France', sources: [
      { name: 'France 24',   url: 'https://www.france24.com/en/rss' },
      { name: 'France 24 (France)', url: 'https://www.france24.com/en/france/rss' },
      { name: 'Le Monde',    url: 'https://www.lemonde.fr/rss/une.xml' },
      { name: 'RFI',         url: 'https://www.rfi.fr/en/rss' },
      { name: 'Le Figaro',   url: 'https://www.lefigaro.fr/rss/figaro_actualites.xml' },
    ],
  },
  {
    code: 'JP', label: 'Japan', sources: [
      { name: 'NHK World',      url: 'https://www3.nhk.or.jp/rss/news/cat0.xml' },
      { name: 'The Japan Times', url: 'https://www.japantimes.co.jp/feed/' },
      { name: 'Asahi Shimbun',  url: 'https://www.asahi.com/rss/asahi/newsheadlines.rdf' },
      { name: 'BBC News',       url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
      { name: 'Al Jazeera',     url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'CN', label: 'China', sources: [
      { name: 'Xinhua',    url: 'http://www.xinhuanet.com/english/rss/worldrss.xml' },
      { name: 'CGTN',      url: 'https://www.cgtn.com/subscribe/rss/section/world.xml' },
      { name: 'Global Times', url: 'https://www.globaltimes.cn/rss/outbrain.xml' },
      { name: 'South China Morning Post', url: 'https://www.scmp.com/rss/91/feed' },
      { name: 'BBC News (Asia)', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
    ],
  },
  {
    code: 'IN', label: 'India', sources: [
      { name: 'The Hindu',        url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
      { name: 'Times of India',   url: 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms' },
      { name: 'NDTV',             url: 'https://feeds.feedburner.com/ndtvnews-top-stories' },
      { name: 'Hindustan Times',  url: 'https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml' },
      { name: 'Indian Express',   url: 'https://indianexpress.com/section/india/feed/' },
    ],
  },
  {
    code: 'RU', label: 'Russia', sources: [
      { name: 'RT',          url: 'https://www.rt.com/rss/' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
      { name: 'Meduza (EN)', url: 'https://meduza.io/rss/en/all' },
      { name: 'The Moscow Times', url: 'https://www.themoscowtimes.com/rss/news' },
      { name: 'DW News',     url: 'https://rss.dw.com/xml/rss-en-all' },
    ],
  },
  {
    code: 'IL', label: 'Israel', sources: [
      { name: 'The Jerusalem Post', url: 'https://www.jpost.com/rss/rssfeedsfrontpage.aspx' },
      { name: 'Times of Israel',   url: 'https://www.timesofisrael.com/feed/' },
      { name: 'Ynetnews',          url: 'https://www.ynetnews.com/Integration/StoryRss3082.xml' },
      { name: 'BBC News (MidEast)', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml' },
      { name: 'Al Jazeera',        url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'AU', label: 'Australia', sources: [
      { name: 'ABC News AU', url: 'https://www.abc.net.au/news/feed/51120/rss.xml' },
      { name: 'The Guardian AU', url: 'https://www.theguardian.com/australia-news/rss' },
      { name: 'Sydney Morning Herald', url: 'https://www.smh.com.au/rss/feed.xml' },
      { name: 'BBC News (Australia)', url: 'https://feeds.bbci.co.uk/news/world/australia/rss.xml' },
      { name: 'DW News', url: 'https://rss.dw.com/xml/rss-en-all' },
    ],
  },
  {
    code: 'CA', label: 'Canada', sources: [
      { name: 'CBC News',    url: 'https://www.cbc.ca/cmlink/rss-topstories' },
      { name: 'Global News',  url: 'https://globalnews.ca/feed/' },
      { name: 'National Post', url: 'https://nationalpost.com/feed' },
      { name: 'BBC News (Canada)', url: 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml' },
      { name: 'DW News',      url: 'https://rss.dw.com/xml/rss-en-all' },
    ],
  },
  {
    code: 'BR', label: 'Brazil', sources: [
      { name: 'Folha de S.Paulo', url: 'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml' },
      { name: 'G1',               url: 'https://g1.globo.com/rss/g1/' },
      { name: 'O Globo',          url: 'https://oglobo.globo.com/rss.xml' },
      { name: 'BBC Brasil',       url: 'https://www.bbc.com/portuguese/index.xml' },
      { name: 'BBC News (LatAm)', url: 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml' },
    ],
  },
  {
    code: 'ZA', label: 'South Africa', sources: [
      { name: 'Daily Maverick', url: 'https://www.dailymaverick.co.za/dmrss/' },
      { name: 'The Citizen',   url: 'https://www.citizen.co.za/feed/' },
      { name: 'BBC News (Africa)', url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml' },
      { name: 'Al Jazeera',    url: 'https://www.aljazeera.com/xml/rss/all.xml' },
      { name: 'DW News',       url: 'https://rss.dw.com/xml/rss-en-all' },
    ],
  },
  {
    code: 'UA', label: 'Ukraine', sources: [
      { name: 'Kyiv Post',        url: 'https://www.kyivpost.com/feed' },
      { name: 'Ukrinform',        url: 'https://www.ukrinform.net/rss/block-lastnews' },
      { name: 'Meduza (EN)',      url: 'https://meduza.io/rss/en/all' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
      { name: 'DW News',          url: 'https://rss.dw.com/xml/rss-en-all' },
    ],
  },
]

export function getCountryNewsSources(code: string): CountryNewsSource[] {
  return (COUNTRY_NEWS_SOURCES.find(c => c.code === code) ?? COUNTRY_NEWS_SOURCES[0]).sources
}

export async function fetchCountryNews(code: string): Promise<NewsArticle[]> {
  const sources = getCountryNewsSources(code)
  const results = await Promise.allSettled(
    sources.map(s => fetchRSSFeed(s.url, s.name))
  )
  const articles: NewsArticle[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') articles.push(...r.value)
  }
  return articles.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
}

// ── CrisisWatch (International Crisis Group) ──────────────────────────────────
// Monthly conflict monitoring across 70+ countries — no API key required
export const CRISISWATCH_FEEDS = [
  { url: 'https://www.crisisgroup.org/rss.xml',          name: 'CrisisWatch',     region: 'Global'  },
  { url: 'https://www.crisisgroup.org/rss/1',            name: 'ICG Africa',      region: 'Africa'  },
  { url: 'https://www.crisisgroup.org/rss/30',           name: 'ICG Asia',        region: 'Asia'    },
  { url: 'https://www.crisisgroup.org/rss/56',           name: 'ICG Europe',      region: 'Europe'  },
  { url: 'https://www.crisisgroup.org/rss/81',           name: 'ICG MENA',        region: 'MENA'    },
  { url: 'https://www.crisisgroup.org/rss/73',           name: 'ICG LatAm',       region: 'LatAm'   },
]

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

export async function fetchTopHeadlines(): Promise<NewsArticle[]> {
  return searchAllSources('world war conflict politics economy')
}
