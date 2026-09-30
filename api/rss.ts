// Vercel serverless function — fetches an RSS/Atom feed server-side (most news feeds send no
// CORS headers) and returns it as JSON: { items: [{ title, description, link, pubDate, thumbnail, categories }] }.
// This replaces api.rss2json.com, whose free tier 429'd after a handful of feeds on every page load.
// No key, no paid service. Only the news hosts the app already reads may be fetched, so this can't be
// used as an open proxy — a test (tests/api/rss.test.ts) fails if a feed in src/ isn't listed here.
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const ALLOWED_FEED_HOSTS = new Set([
  'feeds.bbci.co.uk', 'www.bbc.com', 'feeds.feedburner.com', 'feeds.folha.uol.com.br', 'feeds.npr.org',
  'feeds.skynews.com', 'g1.globo.com', 'oglobo.globo.com', 'globalnews.ca', 'indianexpress.com',
  'meduza.io', 'nationalpost.com', 'newsfeed.zeit.de', 'rss.dw.com', 'rss.nytimes.com',
  'timesofindia.indiatimes.com', 'www.abc.net.au', 'www.aljazeera.com', 'www.asahi.com', 'www.cbc.ca',
  'www.cgtn.com', 'www.citizen.co.za', 'www.crisisgroup.org', 'www.dailymaverick.co.za', 'www.france24.com',
  'www.ft.com', 'www.globaltimes.cn', 'www.hindustantimes.com', 'www.japantimes.co.jp', 'www.jpost.com',
  'www.kyivpost.com', 'www.lefigaro.fr', 'www.lemonde.fr', 'www.rfi.fr', 'www.rt.com', 'www.scmp.com',
  'www.smh.com.au', 'www.spiegel.de', 'www.tagesschau.de', 'www.theguardian.com', 'www.thehindu.com',
  'www.themoscowtimes.com', 'www.timesofisrael.com', 'www.ukrinform.net', 'www.xinhuanet.com',
  'www.ynetnews.com', 'www3.nhk.or.jp',
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
    const xml = await upstream.text()
    if (xml.length > MAX_BYTES) return res.status(502).json({ error: 'feed too large' })

    const items = parseFeed(xml)
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ status: 'ok', items })
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : 'feed fetch failed' })
  }
}
