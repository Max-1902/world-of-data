// HTML for the hover cards on news pins and market pins. Everything that comes from a feed or an API is
// escaped — headlines are untrusted text and these strings go through Popup.setHTML.
import type { GeoNewsPin } from '../../utils/geoNews'
import type { KeyEventCategory } from '../../utils/keyEvents'
import type { Stock } from '../../types'

export const NEWS_COLORS: Record<KeyEventCategory, string> = {
  political: '#6366f1', economic: '#d97706', humanitarian: '#e11d48', other: '#dc2626',
}
const CATEGORY_LABEL: Record<KeyEventCategory, string> = {
  political: 'Political', economic: 'Economic', humanitarian: 'Humanitarian', other: 'Security / disaster',
}

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** Only http(s) links are allowed through; anything else (javascript:, data:) is dropped. */
export function safeUrl(url: string | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch { return null }
}

const VIDEO_URL_RE = /(youtube\.com\/watch|youtu\.be\/|vimeo\.com\/|\/videos?\/|\/video-|\/av\/|\/live\/)/i
export const looksLikeVideo = (url: string) => VIDEO_URL_RE.test(url)

export function ageLabel(iso: string, now = Date.now()): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const mins = Math.max(0, Math.round((now - t) / 60_000))
  if (mins < 60) return `${mins || 1} min ago`
  const hours = Math.round(mins / 60)
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`
}

const FONT = "font-family:'Inter',-apple-system,sans-serif;"

export function newsPinHTML(pin: GeoNewsPin, now = Date.now()): string {
  const [lead, ...rest] = pin.items
  const color = NEWS_COLORS[lead.category]
  const url = safeUrl(lead.article.url)
  const img = safeUrl(lead.article.imageUrl)
  const video = looksLikeVideo(lead.article.url)
  const where = pin.precision === 'country'
    ? `${esc(pin.place)} <span style="color:#9ca3af">· country-level location</span>`
    : pin.precision === 'capital'
      ? `${esc([pin.place, pin.country].filter(Boolean).join(', '))} <span style="color:#9ca3af">· nearest known location (capital)</span>`
      : esc([pin.place, pin.country].filter(Boolean).join(', '))
  const watch = `https://www.youtube.com/results?search_query=${encodeURIComponent(lead.article.title)}`

  const more = rest.slice(0, 4).map(i => {
    const u = safeUrl(i.article.url)
    const title = esc(i.article.title)
    return `<li style="margin:3px 0;line-height:1.35;">${u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;">${title}</a>` : title}
      <span style="color:#9ca3af;font-size:9px;"> ${esc(i.article.source)}</span></li>`
  }).join('')

  return `<div style="${FONT}width:290px;color:#14161a;">
    ${img ? `<div style="height:120px;background:#e5e7eb url('${esc(img)}') center/cover;border-radius:6px 6px 0 0;"></div>` : ''}
    <div style="padding:10px 12px;">
      <div style="display:flex;gap:6px;align-items:center;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">
        <span style="color:${color};">● ${CATEGORY_LABEL[lead.category]}</span>
        ${video ? '<span style="background:#111827;color:#fff;padding:1px 5px;border-radius:3px;">▶ Video</span>' : ''}
      </div>
      <div style="font-size:12.5px;font-weight:600;line-height:1.3;margin:5px 0 3px;">${esc(lead.article.title)}</div>
      ${lead.article.description ? `<div style="font-size:10.5px;color:#4b5563;line-height:1.4;margin-bottom:4px;">${esc(lead.article.description.slice(0, 160))}</div>` : ''}
      <div style="font-size:10px;color:#6b7280;">◉ ${where}</div>
      <div style="font-size:10px;color:#6b7280;">${esc(lead.article.source)} · ${esc(ageLabel(lead.article.publishedAt, now))}</div>
      <div style="display:flex;gap:10px;margin-top:8px;font-size:11px;font-weight:600;">
        ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="color:${color};text-decoration:none;">${video ? '▶ Watch' : 'Read article'} ↗</a>` : ''}
        <a href="${esc(watch)}" target="_blank" rel="noopener noreferrer" style="color:#6b7280;text-decoration:none;">Find video ↗</a>
      </div>
      ${more ? `<div style="border-top:1px solid #e5e7eb;margin-top:8px;padding-top:6px;font-size:10.5px;"><div style="font-size:9px;font-weight:700;letter-spacing:.08em;color:#6b7280;">ALSO HERE · ${rest.length}</div><ul style="margin:3px 0 0;padding-left:14px;">${more}</ul></div>` : ''}
    </div></div>`
}

export interface MarketHub { symbol: string; name: string; exchange: string }

export function marketPinHTML(hub: MarketHub, quote: Stock | undefined): string {
  const up = quote ? quote.change >= 0 : true
  const color = up ? '#16a34a' : '#dc2626'
  const num = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const body = quote
    ? `<div style="font-size:18px;font-weight:700;margin-top:4px;">${num(quote.price)} <span style="font-size:11px;color:${color};">${up ? '▲' : '▼'} ${num(Math.abs(quote.changePercent))}%</span></div>
       <div style="font-size:10px;color:#6b7280;margin-top:2px;">Day range ${num(quote.low)} – ${num(quote.high)} · prev close ${num(quote.previousClose)}</div>`
    : `<div style="font-size:11px;color:#6b7280;margin-top:4px;">Quote unavailable (Finnhub offline or rate-limited).</div>`
  return `<div style="${FONT}padding:10px 12px;width:230px;color:#14161a;">
    <div style="font-size:9px;font-weight:700;letter-spacing:.08em;color:#6b7280;">${esc(hub.exchange)}</div>
    <div style="font-size:12.5px;font-weight:600;">${esc(hub.name)}</div>
    ${body}
    <div style="font-size:9px;color:#9ca3af;margin-top:4px;">Tracked via ${esc(hub.symbol)} · USD · Finnhub</div></div>`
}
