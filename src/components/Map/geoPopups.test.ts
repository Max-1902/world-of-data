import { describe, it, expect } from 'vitest'
import { newsPinHTML, marketPinHTML, safeUrl, looksLikeVideo, ageLabel } from './geoPopups'
import type { GeoNewsPin } from '../../utils/geoNews'
import type { Stock } from '../../types'

const pin = (over: Partial<GeoNewsPin['items'][0]['article']> = {}, precision: GeoNewsPin['precision'] = 'city'): GeoNewsPin => ({
  id: 'p', lat: 1, lng: 1, place: 'Kyiv', country: 'Ukraine', precision,
  items: [{ category: 'other', article: { id: '1', title: 'Blast <b>hits</b> Kyiv', description: 'd', url: 'https://bbc.test/news/videos/abc', source: 'BBC', publishedAt: '2026-10-04T10:00:00Z', ...over } }],
})

describe('newsPinHTML', () => {
  it('escapes headlines and drops unsafe links', () => {
    const html = newsPinHTML(pin({ url: 'javascript:alert(1)', imageUrl: 'data:text/html,x' }))
    expect(html).not.toContain('<b>hits')
    expect(html).toContain('&lt;b&gt;hits')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('data:text')
  })
  it('flags video links and country-level precision', () => {
    expect(newsPinHTML(pin())).toContain('▶ Video')
    expect(newsPinHTML(pin({ url: 'https://bbc.test/news/world-1' }))).not.toContain('▶ Video')
    expect(newsPinHTML(pin({}, 'country'))).toContain('country-level')
  })
})

describe('helpers', () => {
  it('safeUrl / looksLikeVideo / ageLabel', () => {
    expect(safeUrl('https://a.test/x')).toBe('https://a.test/x')
    expect(safeUrl('ftp://a')).toBeNull()
    expect(safeUrl(undefined)).toBeNull()
    expect(looksLikeVideo('https://www.youtube.com/watch?v=1')).toBe(true)
    expect(looksLikeVideo('https://x.test/news/article')).toBe(false)
    expect(ageLabel('2026-10-04T09:00:00Z', Date.parse('2026-10-04T10:00:00Z'))).toBe('1 h ago')
    expect(ageLabel('garbage')).toBe('')
  })
})

describe('marketPinHTML', () => {
  const hub = { symbol: 'SPY', name: 'US', exchange: 'NYSE' }
  it('shows the quote, or says it is unavailable', () => {
    const q = { symbol: 'SPY', name: 's', price: 500, change: -2, changePercent: -0.4, high: 505, low: 495, open: 1, previousClose: 502, currency: 'USD', exchange: '', lastUpdated: '' } as Stock
    expect(marketPinHTML(hub, q)).toContain('▼')
    expect(marketPinHTML(hub, undefined)).toContain('Quote unavailable')
  })
})
