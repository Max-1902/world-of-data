// Popup HTML for the incident pins: internet outages (IODA) and disaster alerts (GDACS). Everything from a
// feed is escaped, and every popup says what its severity label means and how precise the pin is, so the
// map never presents a country-level or region-level signal as a street address.
import { esc } from './geoPopups'
import { OUTAGE_SOURCES, SEVERITY_LABEL, type OutageEvent, type OutageSeverity } from '../../services/outages'
import { ALERT_MEANING, DISASTER_LABELS, type DisasterAlert } from '../../services/gdacs'

export const OUTAGE_COLORS: Record<OutageSeverity | 'recovered', string> = {
  severe: '#dc2626', major: '#f97316', minor: '#eab308', recovered: '#64748b',
}
export const DISASTER_COLORS: Record<DisasterAlert['alert'], string> = { Red: '#dc2626', Orange: '#f97316' }

export const SEVERITY_MEANING: Record<OutageSeverity, string> = {
  severe: 'signal 50 % or more below normal — most of the area offline',
  major: 'signal 20–49 % below normal',
  minor: 'signal under 20 % below normal — a partial or localised drop',
}

const ENTITY_KIND: Record<string, string> = {
  country: 'Whole country', region: 'Region', asn: 'Network operator', geoasn: 'Network operator in one region',
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

export function outagePopupHtml(o: OutageEvent, now = Date.now()): string {
  const ongoing = o.status === 'ongoing'
  const color = ongoing ? OUTAGE_COLORS[o.severity] : OUTAGE_COLORS.recovered
  const status = ongoing ? `${SEVERITY_LABEL[o.severity]} · ongoing` : 'Recovered'
  const kind = ENTITY_KIND[o.entityType] ?? o.entityType
  const where = o.location
    ? o.location.precision === 'region'
      ? `pin marks the region (${esc(o.location.label)}) — IODA has no finer location`
      : 'pin marks the country — IODA only reports it country-wide'
    : 'no location in the IODA data'

  const signals = o.signals.map(s => {
    const src = OUTAGE_SOURCES[s.source]
    const live = s.level === 'critical'
    return `<div style="margin-top:3px">
      <b>${esc(src?.label ?? s.source)}</b>
      ${live ? `<span style="color:${color};font-weight:700">${s.dropPct}% below normal</span>` : '<span style="color:#16a34a">back to normal</span>'}
      <span style="${MUTED}">(${s.value.toLocaleString()} vs ${s.baseline.toLocaleString()} usual)</span>
      ${src ? `<div style="font-size:10px;${MUTED}">${esc(src.meaning)}</div>` : ''}
    </div>`
  }).join('')

  return `<div style="${BOX}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid #e5e7eb">
      <span style="font-size:13px;font-weight:800">Internet outage · ${esc(o.entityName)}</span>
      ${badge(status.toUpperCase(), color)}
    </div>
    ${row('What', `${esc(kind)}${o.org ? ` — ${esc(o.org)}` : ''}`)}
    ${row('Drop', `<b style="color:${color}">${o.dropPct}%</b> below IODA's normal level${ongoing ? '' : ' (worst seen)'}`)}
    ${ongoing ? `<div style="font-size:10px;${MUTED}">${SEVERITY_LABEL[o.severity]} = ${SEVERITY_MEANING[o.severity]}</div>` : ''}
    ${row('Started', `${timeAgo(o.start * 1000, now)} <span style="${MUTED}">(${utc(o.start * 1000)})</span>`)}
    ${row(ongoing ? 'Last update' : 'Recovered', timeAgo(o.lastAlert * 1000, now))}
    <div style="margin-top:6px;padding-top:5px;border-top:1px solid #e5e7eb"><span style="${MUTED}">Measured by:</span>${signals}</div>
    <div style="margin-top:6px;font-size:10px;color:#9ca3af">Source: IODA, Georgia Tech · ${where}. Severity bands are this app's grading of the drop; IODA itself flags any signal past its threshold as "critical".</div>
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
