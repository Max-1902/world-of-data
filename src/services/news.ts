import type { NewsArticle } from '../types'

const NEWSAPI_KEY = import.meta.env.VITE_NEWSAPI_KEY || ''
const GUARDIAN_KEY = import.meta.env.VITE_GUARDIAN_KEY || ''
const NYT_KEY = import.meta.env.VITE_NYT_KEY || ''

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
  if (!GUARDIAN_KEY) return []
  try {
    const url =
      `https://content.guardianapis.com/search?q=${encodeURIComponent(query)}` +
      `&show-fields=headline,trailText,thumbnail&order-by=newest&page-size=30&lang=en&api-key=${GUARDIAN_KEY}`
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
  if (!NYT_KEY) return []
  try {
    const url =
      `https://api.nytimes.com/svc/search/v2/articlesearch.json?q=${encodeURIComponent(query)}` +
      `&sort=newest&api-key=${NYT_KEY}`
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

// ── BBC RSS via GDELT ────────────────────────────────────────────────────────
// GDELT Article Search — free, no key, pulls from 65k+ global news sources
export async function searchGDELTNews(query: string): Promise<NewsArticle[]> {
  try {
    const url =
      `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query + ' sourcelang:english')}` +
      `&mode=artlist&maxrecords=50&format=json&sort=DateDesc`
    const res = await fetch(url)
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
  } catch (err) {
    console.warn('[GDELT News]', err)
    return []
  }
}

// ── Reuters RSS (via Feedjsonapi proxy) ────────────────────────────────────
export async function fetchRSSFeed(feedUrl: string, sourceName: string): Promise<NewsArticle[]> {
  try {
    const proxy = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`
    const res = await fetch(proxy)
    if (!res.ok) throw new Error(`RSS ${res.status}`)
    const json = await res.json()
    return (json.items || []).slice(0, 20).map(
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
  } catch (err) {
    console.warn(`[RSS:${sourceName}]`, err)
    return []
  }
}

export const RSS_FEEDS = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC News' },
  { url: 'https://feeds.reuters.com/reuters/worldNews', name: 'Reuters' },
  { url: 'https://rss.dw.com/xml/rss-en-world', name: 'DW News' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera' },
  { url: 'https://www.france24.com/en/rss', name: 'France 24' },
]

// ── CrisisWatch (International Crisis Group) ──────────────────────────────────
// Monthly conflict monitoring across 70+ countries — no API key required
export const CRISISWATCH_FEEDS = [
  { url: 'https://www.crisisgroup.org/rss/crisiswatch',  name: 'CrisisWatch',     region: 'Global'  },
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

export async function fetchCrisisWatch(region = 'Global'): Promise<CrisisWatchEntry[]> {
  const feed = CRISISWATCH_FEEDS.find(f => f.region === region) ?? CRISISWATCH_FEEDS[0]
  try {
    const articles = await fetchRSSFeed(feed.url, feed.name)
    return articles.map(a => ({
      ...a,
      trend:  detectTrend((a.title || '') + ' ' + (a.description || '')),
      region: feed.region,
    }))
  } catch (err) {
    console.warn('[CrisisWatch]', err)
    return []
  }
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

  // Deduplicate by title similarity + sort by date
  const seen = new Set<string>()
  return articles
    .filter((a) => {
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
