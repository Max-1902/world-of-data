// Popup HTML for the incident layers: internet outages by country (IODA, Cloudflare Radar) and disaster alerts (GDACS). Everything from a
// feed is escaped, and every popup says what its severity label means and how precise the pin is, so the
// map never presents a country-level or region-level signal as a street address.
import { esc } from './geoPopups'
import { OUTAGE_SOURCES, SEVERITY_LABEL, type OutageSeverity } from '../../services/outages'
import { RADAR_UNREST_CAUSES, radarCauseLabel } from '../../services/radarOutages'
import type { OutageCountry } from './layers/outages'
import { ALERT_MEANING, DISASTER_LABELS, type DisasterAlert } from '../../services/gdacs'

export const OUTAGE_COLORS: Record<OutageSeverity | 'recovered', string> = {
  severe: '#dc2626', major: '#f97316', minor: '#eab308', recovered: '#64748b',
}
/** Country outline for an outage Cloudflare Radar has confirmed: red for deliberate/conflict causes. */
export const OUTAGE_CONFIRMED_COLORS = { deliberate: '#f43f5e', other: '#e2e8f0' } as const
export const DISASTER_COLORS: Record<DisasterAlert['alert'], string> = { Red: '#dc2626', Orange: '#f97316' }

export const SEVERITY_MEANING: Record<OutageSeverity, string> = {
  severe: 'signal 50 % or more below normal — most of the area offline',
  major: 'signal 20–49 % below normal',
  minor: 'signal under 20 % below normal — a partial or localised drop',
}

const BOX = "padding:10px;font-family:'Inter',-apple-system,sans-serif;min-width:220px;max-width:300px;font-size:11px;color:#14161a;line-height:1.5;"
const MUTED = 'color:#6b7280'
const row = (k: string, v: string) => `<div><span style="${MUTED}">${k}:</span> ${v}</div>`
const badge = (text: string, color: string) =>
  `<span style="font-size:10px;font-weight:700;letter-spacing:.08em;color:${color};border:1px solid ${color}66;padding:1px 5px;white-space:nowrap">${esc(text)}</span>`

export function timeAgo(epochMs: number, now = Date.now()): string {
  const m = Math.floor((now - epochMs) / 60_000)
  if (!Number.isFinite(m)) return ''
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} d ago`
}
const utc = (epochMs: number) => new Date(epochMs).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'

const ENTITY_SHORT: Record<string, string> = { country: 'country-wide', region: 'region', asn: 'network', geoasn: 'network in region' }
const regionNames = (() => { try { return new Intl.DisplayNames(['en'], { type: 'region' }) } catch { return null } })()
const countryName = (iso2: string) => { try { return regionNames?.of(iso2) ?? iso2 } catch { return iso2 } }

/** Popup for one shaded country: IODA's measured ongoing outages, then Cloudflare Radar's confirmed ones. */
export function outageCountryPopupHtml(c: OutageCountry, now = Date.now()): string {
  const head = c.severity
    ? badge(`${SEVERITY_LABEL[c.severity]} · ${c.countryWide ? 'country-wide' : 'partial'}`.toUpperCase(), OUTAGE_COLORS[c.severity])
    : badge('CONFIRMED', c.deliberate ? OUTAGE_CONFIRMED_COLORS.deliberate : '#6b7280')
  const measured = c.events.slice(0, 6).map(o => {
    const live = o.signals.filter(s => s.level === 'critical').map(s => OUTAGE_SOURCES[s.source]?.label ?? s.source)
    return `<div style="margin-top:4px">
      <b>${esc(o.entityType === 'country' ? 'Whole country' : o.location?.precision === 'region' ? o.location.label : o.entityName)}</b>
      <span style="${MUTED}">${esc(ENTITY_SHORT[o.entityType] ?? o.entityType)}${o.org ? ` · ${esc(o.org)}` : ''}</span>
      <div><b style="color:${OUTAGE_COLORS[o.severity]}">${o.dropPct}% below normal</b> <span style="${MUTED}">since ${timeAgo(o.start * 1000, now)}${live.length ? ` · ${esc(live.join(', '))}` : ''}</span></div>
    </div>`
  }).join('')
  const confirmed = c.confirmed.map(r => {
    const color = RADAR_UNREST_CAUSES.has(r.cause) ? OUTAGE_CONFIRMED_COLORS.deliberate : '#14161a'
    return `<div style="margin-top:4px">
      <b style="color:${color}">${esc(radarCauseLabel(r.cause))}</b>
      <span style="${MUTED}">${esc([r.type.toLowerCase(), r.scope].filter(Boolean).join(' · '))} · since ${timeAgo(r.start, now)}</span>
      ${r.description ? `<div style="font-size:10.5px">${esc(r.description)}</div>` : ''}
      ${r.linkedUrl ? `<a href="${esc(r.linkedUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:10px">Cloudflare write-up ↗</a>` : ''}
    </div>`
  }).join('')
  return `<div style="${BOX}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb">
      <span style="font-size:13px;font-weight:800">${esc(countryName(c.iso2))}</span>${head}
    </div>
    ${c.events.length ? `<div style="${MUTED};font-size:10px;letter-spacing:.06em">MEASURED · IODA</div>${measured}${c.events.length > 6 ? `<div style="${MUTED};margin-top:3px">+${c.events.length - 6} more in the Connectivity panel</div>` : ''}` : ''}
    ${c.confirmed.length ? `<div style="${MUTED};font-size:10px;letter-spacing:.06em;margin-top:${c.events.length ? 8 : 0}px">CONFIRMED · CLOUDFLARE RADAR</div>${confirmed}` : ''}
    <div style="margin-top:7px;font-size:10px;color:#9ca3af">${c.severity && !c.countryWide ? 'Shading covers the whole country, but IODA only reports a region or network inside it. ' : ''}${c.severity ? `${SEVERITY_LABEL[c.severity]} = ${SEVERITY_MEANING[c.severity]} (this app's bands on IODA's baseline). ` : ''}${c.confirmed.length ? 'Causes are Cloudflare\'s own attribution.' : ''}</div>
  </div>`
}

export function disasterPopupHtml(a: DisasterAlert, now = Date.now()): string {
  const color = DISASTER_COLORS[a.alert]
  const from = Date.parse(a.from + 'Z'), to = Date.parse(a.to + 'Z')
  const countries = a.affectedCountries.length ? a.affectedCountries.join(', ') : a.country
  return `<div style="${BOX}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb">
      <span style="font-size:13px;font-weight:800">${esc(a.name)}</span>
      ${badge(`${a.alert.toUpperCase()} ALERT`, color)}
    </div>
    <div style="font-size:10.5px;color:${color};font-weight:600;margin-bottom:4px">${esc(ALERT_MEANING[a.alert])}</div>
    ${row('Type', esc(DISASTER_LABELS[a.type]))}
    ${a.severityText ? row('Severity', `<b>${esc(a.severityText)}</b>`) : ''}
    ${countries ? row('Affected', esc(countries)) : ''}
    ${Number.isFinite(from) ? row('Period', `${utc(from).slice(0, 10)} → ${Number.isFinite(to) ? utc(to).slice(0, 10) : '?'}${Number.isFinite(to) ? ` <span style="${MUTED}">(updated ${timeAgo(to, now)})</span>` : ''}`) : ''}
    ${row('Status', a.isCurrent ? 'Active' : 'Ended')}
    ${row('GDACS score', `${a.score} <span style="${MUTED}">(used by GDACS to set the alert level)</span>`)}
    <div style="margin-top:4px;font-size:10px;color:#9ca3af;font-family:monospace">${a.latitude.toFixed(3)}°, ${a.longitude.toFixed(3)}°</div>
    <div style="margin-top:6px;font-size:10px;color:#9ca3af">Source: GDACS (EU JRC / UN OCHA)${a.source ? `, event data from ${esc(a.source)}` : ''}. Pin = the point GDACS gives for the event: an earthquake's epicentre; for storms, floods and droughts a representative point of the affected area, not its full extent.</div>
    ${a.reportUrl ? `<a href="${esc(a.reportUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:6px;font-size:11px;color:#2563eb">GDACS report →</a>` : ''}
  </div>`
}
