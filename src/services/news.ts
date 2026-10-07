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
        url: a.url,
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
  /** ISO 639-1 language of the feed when it isn't English; those articles are machine-translated for display. */
  lang?: string
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
  {
    code: 'PL', label: 'Poland', sources: [
      { name: 'TVN24', url: 'https://tvn24.pl/najnowsze.xml', lang: 'pl' },
      { name: 'Polsat News', url: 'https://www.polsatnews.pl/rss/wszystkie.xml', lang: 'pl' },
      { name: 'RMF24', url: 'https://www.rmf24.pl/fakty/feed', lang: 'pl' },
      { name: 'Onet', url: 'https://wiadomosci.onet.pl/.feed', lang: 'pl' },
      { name: 'Notes from Poland', url: 'https://notesfrompoland.com/feed/' },
    ],
  },
  {
    code: 'IT', label: 'Italy', sources: [
      { name: 'La Repubblica', url: 'https://www.repubblica.it/rss/homepage/rss2.0.xml', lang: 'it' },
      { name: 'Il Fatto Quotidiano', url: 'https://www.ilfattoquotidiano.it/feed/', lang: 'it' },
      { name: 'Rai News', url: 'https://www.rainews.it/rss/tutti', lang: 'it' },
      { name: 'ANSA', url: 'https://www.ansa.it/sito/ansait_rss.xml', lang: 'it' },
      { name: 'Il Sole 24 Ore', url: 'https://www.ilsole24ore.com/rss/italia.xml', lang: 'it' },
    ],
  },
  {
    code: 'ES', label: 'Spain', sources: [
      { name: 'El País', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', lang: 'es' },
      { name: 'El Mundo', url: 'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml', lang: 'es' },
      { name: 'ABC', url: 'https://www.abc.es/rss/2.0/portada/', lang: 'es' },
      { name: '20minutos', url: 'https://www.20minutos.es/rss/', lang: 'es' },
      { name: 'La Vanguardia', url: 'https://www.lavanguardia.com/rss/home.xml', lang: 'es' },
    ],
  },
  {
    code: 'NL', label: 'Netherlands', sources: [
      { name: 'NOS', url: 'https://feeds.nos.nl/nosnieuwsalgemeen', lang: 'nl' },
      { name: 'NU.nl', url: 'https://www.nu.nl/rss/Algemeen', lang: 'nl' },
      { name: 'NRC', url: 'https://www.nrc.nl/rss/', lang: 'nl' },
      { name: 'de Volkskrant', url: 'https://www.volkskrant.nl/voorpagina/rss.xml', lang: 'nl' },
      { name: 'DutchNews.nl', url: 'https://www.dutchnews.nl/feed/' },
    ],
  },
  {
    code: 'BE', label: 'Belgium', sources: [
      { name: 'VRT NWS', url: 'https://www.vrt.be/vrtnws/nl.rss.articles.xml', lang: 'nl' },
      { name: 'RTBF', url: 'https://rss.rtbf.be/article/rss/highlight_rtbf_info.xml', lang: 'fr' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
    ],
  },
  {
    code: 'SE', label: 'Sweden', sources: [
      { name: 'SVT Nyheter', url: 'https://www.svt.se/nyheter/rss.xml', lang: 'sv' },
      { name: 'Dagens Nyheter', url: 'https://www.dn.se/rss/', lang: 'sv' },
      { name: 'Aftonbladet', url: 'https://rss.aftonbladet.se/rss2/small/pages/sections/senastenytt/', lang: 'sv' },
    ],
  },
  {
    code: 'NO', label: 'Norway', sources: [
      { name: 'NRK', url: 'https://www.nrk.no/toppsaker.rss', lang: 'no' },
      { name: 'VG', url: 'https://www.vg.no/rss/feed', lang: 'no' },
      { name: 'Aftenposten', url: 'https://www.aftenposten.no/rss', lang: 'no' },
    ],
  },
  {
    code: 'FI', label: 'Finland', sources: [
      { name: 'Yle Uutiset', url: 'https://yle.fi/rss/uutiset/paauutiset', lang: 'fi' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
    ],
  },
  {
    code: 'DK', label: 'Denmark', sources: [
      { name: 'DR Nyheder', url: 'https://www.dr.dk/nyheder/service/feeds/allenyheder', lang: 'da' },
      { name: 'Politiken', url: 'https://politiken.dk/rss/senestenyt.rss', lang: 'da' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
    ],
  },
  {
    code: 'CZ', label: 'Czechia', sources: [
      { name: 'iDNES.cz', url: 'https://servis.idnes.cz/rss.aspx?c=zpravodaj', lang: 'cs' },
      { name: 'Novinky.cz', url: 'https://www.novinky.cz/rss', lang: 'cs' },
      { name: 'ČT24', url: 'https://ct24.ceskatelevize.cz/rss/hlavni-zpravy', lang: 'cs' },
    ],
  },
  {
    code: 'RO', label: 'Romania', sources: [
      { name: 'Digi24', url: 'https://www.digi24.ro/rss', lang: 'ro' },
      { name: 'HotNews', url: 'https://hotnews.ro/feed', lang: 'ro' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
    ],
  },
  {
    code: 'HU', label: 'Hungary', sources: [
      { name: 'HVG', url: 'https://hvg.hu/rss', lang: 'hu' },
      { name: 'Hungary Today', url: 'https://hungarytoday.hu/feed/' },
      { name: 'Daily News Hungary', url: 'https://dailynewshungary.com/feed/' },
    ],
  },
  {
    code: 'GR', label: 'Greece', sources: [
      { name: 'in.gr', url: 'https://www.in.gr/feed/', lang: 'el' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
      { name: 'DW News', url: 'https://rss.dw.com/xml/rss-en-all' },
    ],
  },
  {
    code: 'PT', label: 'Portugal', sources: [
      { name: 'Observador', url: 'https://observador.pt/feed/', lang: 'pt' },
      { name: 'RTP Notícias', url: 'https://www.rtp.pt/noticias/rss', lang: 'pt' },
      { name: 'Público', url: 'https://feeds.feedburner.com/PublicoRSS', lang: 'pt' },
      { name: 'Portugal Resident', url: 'https://www.portugalresident.com/feed/' },
    ],
  },
  {
    code: 'AT', label: 'Austria', sources: [
      { name: 'ORF', url: 'https://rss.orf.at/news.xml', lang: 'de' },
      { name: 'Der Standard', url: 'https://www.derstandard.at/rss', lang: 'de' },
      { name: 'DW News', url: 'https://rss.dw.com/xml/rss-en-all' },
    ],
  },
  {
    code: 'CH', label: 'Switzerland', sources: [
      { name: 'SRF News', url: 'https://www.srf.ch/news/bnf/rss/1646', lang: 'de' },
      { name: 'NZZ', url: 'https://www.nzz.ch/recent.rss', lang: 'de' },
      { name: '20 Minuten', url: 'https://partner-feeds.20min.ch/rss/20minuten', lang: 'de' },
    ],
  },
  {
    code: 'IE', label: 'Ireland', sources: [
      { name: 'RTÉ News', url: 'https://www.rte.ie/feeds/rss/?index=/news/' },
      { name: 'TheJournal.ie', url: 'https://www.thejournal.ie/feed/' },
      { name: 'Irish Independent', url: 'https://www.independent.ie/rss' },
    ],
  },
  {
    code: 'LT', label: 'Lithuania', sources: [
      { name: 'LRT English', url: 'https://www.lrt.lt/en/news-in-english?rss' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
      { name: 'DW News', url: 'https://rss.dw.com/xml/rss-en-all' },
    ],
  },
  {
    code: 'LV', label: 'Latvia', sources: [
      { name: 'LSM English', url: 'https://eng.lsm.lv/rss/' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
      { name: 'DW News', url: 'https://rss.dw.com/xml/rss-en-all' },
    ],
  },
  {
    code: 'EE', label: 'Estonia', sources: [
      { name: 'ERR News', url: 'https://news.err.ee/rss' },
      { name: 'ERR', url: 'https://www.err.ee/rss', lang: 'et' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
    ],
  },
  {
    code: 'RS', label: 'Serbia', sources: [
      { name: 'N1', url: 'https://n1info.rs/feed/', lang: 'sr' },
      { name: 'B92', url: 'https://www.b92.net/info/rss/vesti.xml', lang: 'sr' },
      { name: 'RTS', url: 'https://www.rts.rs/page/stories/sr/rss.html', lang: 'sr' },
    ],
  },
  {
    code: 'HR', label: 'Croatia', sources: [
      { name: 'Index.hr', url: 'https://www.index.hr/rss', lang: 'hr' },
      { name: 'Total Croatia News', url: 'https://total-croatia-news.com/feed/' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
    ],
  },
  {
    code: 'GE', label: 'Georgia', sources: [
      { name: 'Civil.ge', url: 'https://civil.ge/feed' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'TR', label: 'Turkey', sources: [
      { name: 'Daily Sabah', url: 'https://www.dailysabah.com/rssFeed/10' },
      { name: 'Anadolu Agency', url: 'https://www.aa.com.tr/en/rss/default?cat=world' },
      { name: 'Hürriyet', url: 'https://www.hurriyet.com.tr/rss/gundem', lang: 'tr' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
    ],
  },
  {
    code: 'EG', label: 'Egypt', sources: [
      { name: 'Egypt Independent', url: 'https://www.egyptindependent.com/feed/' },
      { name: 'Daily News Egypt', url: 'https://www.dailynewsegypt.com/feed/' },
      { name: 'Mada Masr', url: 'https://www.madamasr.com/en/feed/' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'SA', label: 'Saudi Arabia', sources: [
      { name: 'Arab News', url: 'https://www.arabnews.com/rss.xml' },
      { name: 'BBC News (Middle East)', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'IR', label: 'Iran', sources: [
      { name: 'Tehran Times', url: 'https://www.tehrantimes.com/rss' },
      { name: 'BBC News (Middle East)', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'MX', label: 'Mexico', sources: [
      { name: 'La Jornada', url: 'https://www.jornada.com.mx/rss/edicion.xml', lang: 'es' },
      { name: 'Mexico News Daily', url: 'https://mexiconewsdaily.com/feed/' },
      { name: 'BBC News (LatAm)', url: 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml' },
    ],
  },
  {
    code: 'AR', label: 'Argentina', sources: [
      { name: 'Infobae', url: 'https://www.infobae.com/arc/outboundfeeds/rss/', lang: 'es' },
      { name: 'Clarín', url: 'https://www.clarin.com/rss/lo-ultimo/', lang: 'es' },
      { name: 'La Nación', url: 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/', lang: 'es' },
      { name: 'Buenos Aires Times', url: 'https://www.batimes.com.ar/feed' },
    ],
  },
  {
    code: 'CO', label: 'Colombia', sources: [
      { name: 'Semana', url: 'https://www.semana.com/arc/outboundfeeds/rss/', lang: 'es' },
      { name: 'El Tiempo', url: 'https://www.eltiempo.com/rss/colombia.xml', lang: 'es' },
      { name: 'BBC News (LatAm)', url: 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml' },
    ],
  },
  {
    code: 'VE', label: 'Venezuela', sources: [
      { name: 'El Nacional', url: 'https://www.elnacional.com/feed/', lang: 'es' },
      { name: 'BBC News (LatAm)', url: 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'PK', label: 'Pakistan', sources: [
      { name: 'Dawn', url: 'https://www.dawn.com/feeds/home' },
      { name: 'The Express Tribune', url: 'https://tribune.com.pk/feed/home' },
      { name: 'BBC News (Asia)', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
    ],
  },
  {
    code: 'ID', label: 'Indonesia', sources: [
      { name: 'Tempo', url: 'https://rss.tempo.co/', lang: 'id' },
      { name: 'BBC News (Asia)', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'PH', label: 'Philippines', sources: [
      { name: 'Philippine Daily Inquirer', url: 'https://www.inquirer.net/fullfeed' },
      { name: 'Rappler', url: 'https://www.rappler.com/feed/' },
      { name: 'The Philippine Star', url: 'https://www.philstar.com/rss/headlines' },
      { name: 'GMA News', url: 'https://data.gmanetwork.com/gno/rss/news/feed.xml' },
    ],
  },
  {
    code: 'TH', label: 'Thailand', sources: [
      { name: 'Bangkok Post', url: 'https://www.bangkokpost.com/rss/data/topstories.xml' },
      { name: 'BBC News (Asia)', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'MY', label: 'Malaysia', sources: [
      { name: 'Malay Mail', url: 'https://www.malaymail.com/feed/rss/malaysia' },
      { name: 'BBC News (Asia)', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'VN', label: 'Vietnam', sources: [
      { name: 'Vietnam News', url: 'https://vietnamnews.vn/rss/politics-laws.rss' },
      { name: 'BBC News (Asia)', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'SG', label: 'Singapore', sources: [
      { name: 'The Straits Times', url: 'https://www.straitstimes.com/news/world/rss.xml' },
      { name: 'CNA', url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml' },
      { name: 'BBC News (Asia)', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
    ],
  },
  {
    code: 'TW', label: 'Taiwan', sources: [
      { name: 'Taipei Times', url: 'https://www.taipeitimes.com/xml/index.rss' },
      { name: 'BBC News (Asia)', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'KR', label: 'South Korea', sources: [
      { name: 'Yonhap', url: 'https://en.yna.co.kr/RSS/news.xml' },
      { name: 'The Korea Times', url: 'https://feed.koreatimes.co.kr/k/world.xml' },
      { name: 'Chosun Ilbo', url: 'https://www.chosun.com/arc/outboundfeeds/rss/?outputType=xml', lang: 'ko' },
      { name: 'BBC News (Asia)', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
    ],
  },
  {
    code: 'KZ', label: 'Kazakhstan', sources: [
      { name: 'The Astana Times', url: 'https://astanatimes.com/feed/' },
      { name: 'BBC News (Asia)', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'NZ', label: 'New Zealand', sources: [
      { name: 'RNZ', url: 'https://www.rnz.co.nz/rss/national.xml' },
      { name: 'NZ Herald', url: 'https://www.nzherald.co.nz/arc/outboundfeeds/rss/section/nz/?outputType=xml' },
      { name: 'Stuff', url: 'https://www.stuff.co.nz/rss' },
    ],
  },
  {
    code: 'NG', label: 'Nigeria', sources: [
      { name: 'Punch', url: 'https://rss.punchng.com/v1/category/latest_news' },
      { name: 'Premium Times', url: 'https://www.premiumtimesng.com/feed' },
      { name: 'Vanguard', url: 'https://www.vanguardngr.com/feed/' },
      { name: 'Channels TV', url: 'https://www.channelstv.com/feed/' },
    ],
  },
  {
    code: 'KE', label: 'Kenya', sources: [
      { name: 'Nation', url: 'https://nation.africa/kenya/rss.xml' },
      { name: 'The Standard', url: 'https://www.standardmedia.co.ke/rss/headlines.php' },
      { name: 'BBC News (Africa)', url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml' },
    ],
  },
  {
    code: 'GH', label: 'Ghana', sources: [
      { name: 'Graphic Online', url: 'https://www.graphic.com.gh/news/general-news.feed?type=rss' },
      { name: 'MyJoyOnline', url: 'https://www.myjoyonline.com/feed/' },
      { name: 'BBC News (Africa)', url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml' },
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
