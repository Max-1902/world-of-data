import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import handler, { parseFeed, ALLOWED_FEED_HOSTS } from '../../api/rss'
import { mockReq, mockRes, mockUpstream } from './helpers'

const RSS = `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel><title>Channel title (not an item)</title>
    <item>
      <title><![CDATA[Ceasefire talks resume & stall]]></title>
      <link>https://example.com/a</link>
      <description><![CDATA[<p>Talks <b>resumed</b> today.</p><img src="https://img.example.com/inline.jpg">]]></description>
      <pubDate>Tue, 30 Sep 2026 12:00:00 GMT</pubDate>
      <category>World</category><category><![CDATA[Middle East]]></category>
      <media:thumbnail url="https://img.example.com/thumb.jpg" width="240"/>
      <media:title>ignored</media:title>
    </item>
    <item>
      <title>Plain &amp; escaped &#8211; title</title>
      <link>https://example.com/b</link>
      <description>Escaped &lt;b&gt;text&lt;/b&gt;</description>
      <dc:date>2026-09-29T08:00:00Z</dc:date>
      <enclosure url="https://img.example.com/enc.png" type="image/png" length="1"/>
    </item>
    <item><title>No image here</title><link>https://example.com/c</link><description>Body</description></item>
  </channel>
</rss>`

const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Feed</title>
  <entry>
    <title>Atom headline</title>
    <link rel="self" href="https://example.com/self"/>
    <link rel="alternate" href="https://example.com/atom-a?x=1&amp;y=2"/>
    <updated>2026-09-30T10:00:00Z</updated>
    <summary>Summary text</summary>
    <category term="Politics"/>
  </entry>
</feed>`

describe('parseFeed', () => {
  it('parses RSS 2.0: CDATA verbatim, entities decoded elsewhere, channel title ignored', () => {
    const items = parseFeed(RSS)
    expect(items).toHaveLength(3)
    expect(items[0]).toMatchObject({
      title: 'Ceasefire talks resume & stall',
      link: 'https://example.com/a',
      pubDate: 'Tue, 30 Sep 2026 12:00:00 GMT',
      categories: ['World', 'Middle East'],
    })
    expect(items[0].description).toBe('<p>Talks <b>resumed</b> today.</p><img src="https://img.example.com/inline.jpg">')
    expect(items[1].title).toBe('Plain & escaped – title')
    expect(items[1].description).toBe('Escaped <b>text</b>')
    expect(items[1].pubDate).toBe('2026-09-29T08:00:00Z')
  })

  it('finds thumbnails: media:thumbnail, then image enclosure, then an <img> in the description, else none', () => {
    const [a, b, c] = parseFeed(RSS)
    expect(a.thumbnail).toBe('https://img.example.com/thumb.jpg')
    expect(b.thumbnail).toBe('https://img.example.com/enc.png')
    expect(c.thumbnail).toBeUndefined()
    const inline = parseFeed('<rss><channel><item><title>t</title><description><![CDATA[<img src="https://i/x.jpg">]]></description></item></channel></rss>')
    expect(inline[0].thumbnail).toBe('https://i/x.jpg')
    // NPR-style: plain-text description, image only in content:encoded; and entity-escaped HTML
    const npr = parseFeed('<rss><channel><item><title>t</title><description>Plain text</description><content:encoded><![CDATA[<p><img src="https://npr/img.jpg"/></p>]]></content:encoded></item></channel></rss>')
    expect(npr[0].thumbnail).toBe('https://npr/img.jpg')
    const escaped = parseFeed('<rss><channel><item><title>t</title><description>&lt;img src=&quot;https://esc/i.png&quot;&gt;</description></item></channel></rss>')
    expect(escaped[0].thumbnail).toBe('https://esc/i.png')
  })

  it('parses Atom entries, preferring the alternate link and reading term-style categories', () => {
    const [e] = parseFeed(ATOM)
    expect(e).toMatchObject({
      title: 'Atom headline', link: 'https://example.com/atom-a?x=1&y=2',
      pubDate: '2026-09-30T10:00:00Z', description: 'Summary text', categories: ['Politics'],
    })
  })

  it('caps at 25 items and returns [] for non-feed input', () => {
    const many = `<rss><channel>${Array.from({ length: 40 }, (_, i) => `<item><title>t${i}</title></item>`).join('')}</channel></rss>`
    expect(parseFeed(many)).toHaveLength(25)
    expect(parseFeed('<html><body>not a feed</body></html>')).toEqual([])
    expect(parseFeed('')).toEqual([])
  })
})

describe('/api/rss handler', () => {
  const call = async (url: unknown) => {
    const out = mockRes()
    await handler(mockReq({ query: { url: url as string } }), out.res)
    return out
  }

  it('rejects a missing or malformed url with 400', async () => {
    mockUpstream()
    expect((await call(undefined)).statusCode()).toBe(400)
    expect((await call('not a url')).statusCode()).toBe(400)
    expect((await call('ftp://feeds.bbci.co.uk/x')).statusCode()).toBe(400)
  })

  it('refuses hosts outside the allowlist with 403, without making any upstream request', async () => {
    const fetchMock = mockUpstream(RSS)
    for (const url of ['https://evil.example.com/rss', 'http://169.254.169.254/latest/meta-data', 'http://localhost:3000/', 'https://feeds.bbci.co.uk.evil.com/rss']) {
      expect((await call(url)).statusCode()).toBe(403)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches an allowed feed and returns parsed items with cache headers', async () => {
    const fetchMock = mockUpstream(RSS, { headers: { 'Content-Type': 'application/rss+xml' } })
    const out = await call('https://feeds.bbci.co.uk/news/world/rss.xml')
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe('https://feeds.bbci.co.uk/news/world/rss.xml')
    expect(out.statusCode()).toBe(200)
    expect((out.body() as { items: unknown[] }).items).toHaveLength(3)
    expect(out.headers()['cache-control']).toMatch(/s-maxage=300/)
  })

  it('returns 502 when the feed errors, is too large, or redirects to a disallowed host', async () => {
    mockUpstream('nope', { status: 503 })
    expect((await call('https://rss.dw.com/xml/rss-en-world')).statusCode()).toBe(502)

    mockUpstream('x'.repeat(2_000_001))
    expect((await call('https://rss.dw.com/xml/rss-en-world')).statusCode()).toBe(502)

    vi.stubGlobal('fetch', vi.fn(async () => Object.defineProperty(new Response(RSS), 'url', { value: 'https://evil.example.com/feed' })))
    const redirected = await call('https://rss.dw.com/xml/rss-en-world')
    expect(redirected.statusCode()).toBe(502)
    expect(JSON.stringify(redirected.body())).toMatch(/not allowed/)
  })

  it('returns 502 (not a crash) when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNRESET') }))
    const out = await call('https://rss.dw.com/xml/rss-en-world')
    expect(out.statusCode()).toBe(502)
    expect(JSON.stringify(out.body())).toMatch(/ECONNRESET/)
  })
})

describe('allowlist stays in sync with the feeds the app reads', () => {
  const root = path.resolve(__dirname, '../..')
  const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')
  // Panel implementations live in several files under src/components/panels/.
  const readPanels = () => fs.readdirSync(path.join(root, 'src/components/panels'))
    .filter(f => f.endsWith('.tsx')).map(f => read(`src/components/panels/${f}`)).join('\n')

  it('every RSS feed URL in src/ is on the proxy allowlist', () => {
    const urls = new Set<string>([
      ...[...read('src/services/news.ts').matchAll(/url:\s*'(https?:\/\/[^']+)'/g)].map(m => m[1]),
      ...[...readPanels().matchAll(/fetchRSSFeed\(\s*'(https?:\/\/[^']+)'/g)].map(m => m[1]),
    ])
    expect(urls.size).toBeGreaterThan(50)   // guards against the regexes silently matching nothing
    const missing = [...urls].map(u => new URL(u).hostname).filter(h => !ALLOWED_FEED_HOSTS.has(h))
    expect([...new Set(missing)]).toEqual([])
  })

  it('has no stale hosts that no feed uses', () => {
    const src = read('src/services/news.ts') + readPanels()
    const unused = [...ALLOWED_FEED_HOSTS].filter(h => !src.includes(`//${h}/`))
    expect(unused).toEqual([])
  })
})
