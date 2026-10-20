// Vercel serverless function — fetches an RSS/Atom feed server-side (most news feeds send no
// CORS headers) and returns it as JSON: { items: [{ title, description, link, pubDate, thumbnail, categories }] }.
// This replaces api.rss2json.com, whose free tier 429'd after a handful of feeds on every page load.
// No key, no paid service. Only the news hosts the app already reads may be fetched, so this can't be
// used as an open proxy — a test (tests/api/rss.test.ts) fails if a feed in src/ isn't listed here.
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const ALLOWED_FEED_HOSTS = new Set([
  'astanatimes.com', 'civil.ge', 'ct24.ceskatelevize.cz', 'dailynewshungary.com', 'data.gmanetwork.com',
  'e00-elmundo.uecdn.es', 'en.yna.co.kr', 'eng.lsm.lv', 'feed.koreatimes.co.kr', 'feeds.bbci.co.uk',
  'feeds.elpais.com', 'feeds.feedburner.com', 'feeds.folha.uol.com.br', 'feeds.nos.nl', 'feeds.npr.org',
  'feeds.skynews.com', 'g1.globo.com', 'globalnews.ca', 'hotnews.ro', 'hungarytoday.hu', 'hvg.hu',
  'indianexpress.com', 'meduza.io', 'mexiconewsdaily.com', 'n1info.rs', 'nation.africa', 'nationalpost.com',
  'news.err.ee', 'news.google.com', 'newsfeed.zeit.de', 'notesfrompoland.com', 'observador.pt',
  'oglobo.globo.com', 'partner-feeds.20min.ch', 'politiken.dk', 'rss.aftonbladet.se', 'rss.dw.com',
  'rss.nytimes.com', 'rss.orf.at', 'rss.punchng.com', 'rss.rtbf.be', 'rss.tempo.co', 'servis.idnes.cz',
  'timesofindia.indiatimes.com', 'total-croatia-news.com', 'tribune.com.pk', 'tvn24.pl', 'vietnamnews.vn',
  'wiadomosci.onet.pl', 'www.20minutos.es', 'www.aa.com.tr', 'www.abc.es', 'www.abc.net.au',
  'www.aftenposten.no', 'www.aljazeera.com', 'www.ansa.it', 'www.arabnews.com', 'www.asahi.com', 'www.b92.net',
  'www.bangkokpost.com', 'www.batimes.com.ar', 'www.bbc.com', 'www.cbc.ca', 'www.cgtn.com',
  'www.channelnewsasia.com', 'www.channelstv.com', 'www.chosun.com', 'www.citizen.co.za', 'www.clarin.com',
  'www.crisisgroup.org', 'www.dailymaverick.co.za', 'www.dailynewsegypt.com', 'www.dailysabah.com',
  'www.dawn.com', 'www.derstandard.at', 'www.digi24.ro', 'www.dn.se', 'www.dr.dk', 'www.dutchnews.nl',
  'www.egyptindependent.com', 'www.elnacional.com', 'www.eltiempo.com', 'www.err.ee', 'www.france24.com',
  'www.ft.com', 'www.globaltimes.cn', 'www.graphic.com.gh', 'www.hindustantimes.com', 'www.hurriyet.com.tr',
  'www.ilfattoquotidiano.it', 'www.ilsole24ore.com', 'www.in.gr', 'www.independent.ie', 'www.index.hr',
  'www.infobae.com', 'www.inquirer.net', 'www.japantimes.co.jp', 'www.jornada.com.mx', 'www.jpost.com',
  'www.kyivpost.com', 'www.lanacion.com.ar', 'www.lavanguardia.com', 'www.lefigaro.fr', 'www.lemonde.fr',
  'www.lrt.lt', 'www.madamasr.com', 'www.malaymail.com', 'www.myjoyonline.com', 'www.novinky.cz', 'www.nrc.nl',
  'www.nrk.no', 'www.nu.nl', 'www.nzherald.co.nz', 'www.nzz.ch', 'www.philstar.com', 'www.polsatnews.pl',
  'www.portugalresident.com', 'www.premiumtimesng.com', 'www.rainews.it', 'www.rappler.com',
  'www.repubblica.it', 'www.rfi.fr', 'www.rmf24.pl', 'www.rnz.co.nz', 'www.rt.com', 'www.rte.ie', 'www.rtp.pt',
  'www.rts.rs', 'www.scmp.com', 'www.semana.com', 'www.smh.com.au', 'www.spiegel.de', 'www.srf.ch',
  'www.standardmedia.co.ke', 'www.straitstimes.com', 'www.stuff.co.nz', 'www.svt.se', 'www.tagesschau.de',
  'www.taipeitimes.com', 'www.tehrantimes.com', 'www.theguardian.com', 'www.thehindu.com', 'www.thejournal.ie',
  'www.themoscowtimes.com', 'www.timesofisrael.com', 'www.ukrinform.net', 'www.vanguardngr.com', 'www.vg.no',
  'www.volkskrant.nl', 'www.vrt.be', 'www.xinhuanet.com', 'www.ynetnews.com', 'www3.nhk.or.jp', 'yle.fi',
])

const MAX_ITEMS = 25
const MAX_BYTES = 2_000_000
const TIMEOUT_MS = 8_000

export interface FeedItem {
  title: string
  description: string
  link: string
  pubDate: string
  thumbnail?: string
  categories: string[]
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

/** Inner text of a tag: CDATA is taken verbatim, plain text has entities decoded. */
function unwrap(inner: string): string {
  const cdata = inner.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/)
  return (cdata ? cdata[1] : decodeEntities(inner)).trim()
}

function tagText(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))
  return m ? unwrap(m[1]) : ''
}

function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'))
  return decodeEntities(m ? (m[2] ?? m[3] ?? '') : '')
}

function firstLink(block: string): string {
  const text = tagText(block, 'link')
  if (text) return text
  // Atom: <link rel="alternate" href="…"/> (self-closing, possibly several)
  const links = [...block.matchAll(/<link\b[^>]*>/gi)].map(m => m[0])
  const pick = links.find(l => /rel\s*=\s*["']alternate["']/i.test(l)) ?? links.find(l => !/rel\s*=/i.test(l)) ?? links[0]
  return pick ? attr(pick, 'href') : ''
}

function thumbnail(block: string): string | undefined {
  for (const m of block.matchAll(/<media:(?:thumbnail|content)\b[^>]*>/gi)) {
    const tag = m[0]
    const url = attr(tag, 'url')
    const isThumbnail = /^<media:thumbnail/i.test(tag)
    const kind = `${attr(tag, 'medium')} ${attr(tag, 'type')}`
    if (url && (isThumbnail || kind.includes('image') || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url))) return url
  }
  for (const m of block.matchAll(/<enclosure\b[^>]*>/gi)) {
    if (/image\//i.test(attr(m[0], 'type'))) return attr(m[0], 'url') || undefined
  }
  // Last resort: the first <img> anywhere in the item's body (description, content:encoded, CDATA or
  // entity-escaped HTML all count).
  const body = decodeEntities(block.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))
  const img = body.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i)
  return img ? decodeEntities(img[1]) : undefined
}

/** Tolerant RSS 2.0 / Atom parser — enough for headline lists, no dependency. */
export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = []
  for (const m of xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)) {
    const block = m[2]
    const rawDescription = (() => {
      const hit = block.match(/<(?:description|summary|content:encoded|content)(?:\s[^>]*)?>([\s\S]*?)<\/(?:description|summary|content:encoded|content)>/i)
      return hit ? unwrap(hit[1]) : ''
    })()
    const categories = [...block.matchAll(/<category\b([^>]*?)(?:\/>|>([\s\S]*?)<\/category>)/gi)]
      .map(c => (c[2] !== undefined ? unwrap(c[2]) : attr(c[1], 'term')))
      .filter(Boolean)
    items.push({
      title: tagText(block, 'title'),
      description: rawDescription,
      link: firstLink(block),
      pubDate: tagText(block, 'pubDate') || tagText(block, 'dc:date') || tagText(block, 'published') || tagText(block, 'updated'),
      thumbnail: thumbnail(block),
      categories,
    })
    if (items.length >= MAX_ITEMS) break
  }
  return items
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url
  let target: URL
  try { target = new URL(raw ?? '') } catch { return res.status(400).json({ error: 'url query parameter is required' }) }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return res.status(400).json({ error: 'only http(s) feeds are supported' })
  if (!ALLOWED_FEED_HOSTS.has(target.hostname)) return res.status(403).json({ error: `host not allowed: ${target.hostname}` })

  try {
    const upstream = await fetch(target, {
      headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*', 'User-Agent': 'WorldMap/1.0 (+news reader)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    // Redirects are followed, but the final host must still be one we allow.
    if (upstream.url && !ALLOWED_FEED_HOSTS.has(new URL(upstream.url).hostname)) return res.status(502).json({ error: 'feed redirected to a host that is not allowed' })
    if (!upstream.ok) return res.status(502).json({ error: `feed returned HTTP ${upstream.status}` })
    // refuse before reading when the size is declared; the length check below covers chunked replies
    if (Number(upstream.headers.get('content-length')) > MAX_BYTES) return res.status(502).json({ error: 'feed too large' })
    const xml = await upstream.text()
    if (xml.length > MAX_BYTES) return res.status(502).json({ error: 'feed too large' })

    const items = parseFeed(xml)
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ status: 'ok', items })
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : 'feed fetch failed' })
  }
}
