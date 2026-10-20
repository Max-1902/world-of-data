/**
 * The AI Analyst's data tools. The model asks for data with a `[DATA:tool|arg|arg]` line; the dashboard runs the
 * query here, in the browser, against the same free services the panels use, and hands the result back as text the
 * model must cite. Nothing in this file is model-generated: every number in a result is fetched or computed locally.
 *
 * Charts follow the same rule. A result may carry chart data; the model can only place it (`[CHART:R2]`), never
 * supply the numbers, so a chart in an answer always shows exactly what a query returned.
 *
 * Each tool returns a compact text block (kept under MAX_TEXT so a few results fit a 32k-context free model) and,
 * where the data has a shape worth seeing, a line or ranked-bar chart.
 */
import type { CrisisEvent, Flight } from '../types'
import { isBaseline, type TrajectoryEntry } from '../utils/trajectory'
import { resolveISO2, isDisputedPlace } from './worldbank'
import { sameCountry, mentionsCountry } from '../utils/countryBrief'
import { ALL_SERIES, SERIES_BY_ID, CATEGORIES, formatValue, fetchSeriesForCountries, fetchCountryDataset, pointsOf, type WbSeriesMeta } from './countryLookup'
import { INDICATORS, INDICATOR_BY_ID, fetchIndicatorAll, type IndicatorMeta } from './countryIndicators'
import { fetchEarthquakes } from './earthquakes'
import { fetchWildfires } from './wildfires'
import { fetchDisasterAlerts, DISASTER_LABELS } from './gdacs'
import { fetchOutageEvents } from './outages'
import { fetchRadarOutages, radarCauseLabel } from './radarOutages'
import { fetchGfwAll, type GfwEvent, type GfwResult } from './gfw'
import { fetchGPSJam } from './gpsjam'
import { searchAllSources, fetchTopHeadlines } from './news'
import { fetchMultipleQuotes, MARKET_HUBS } from './stocks'
import { analyzeAirspace, FIR_STATUS_LABEL } from './notam'
import { history, countrySeries } from './history'
import { getTradeProfile } from './tradeStats'
import { SANCTIONED_COUNTRIES } from './sanctions'
import { MILITARY_FACILITIES, NUCLEAR_PLANTS } from './military'
import { fetchMilitaryPersonnelRanking } from './militaryPersonnel'
import { fetchPowerGenerationRanking, POWER_SOURCES } from './powerGeneration'
import { OIL_GAS_DATA } from './oilgas'
import { getResourceProfile, fetchResourceRents } from './resources'
import { CHOKEPOINTS, oilSharePct } from './chokepoints'
import { PORTS } from './ports'
import { TOP_HOSTING, TOP_ORIGINS } from './unhcr'
import { EIA_SERIES, fetchEiaSeries } from './eia'
import { arForecast, naiveForecast, trendTest, backtestForecast, type Pt } from '../utils/econAnalysis'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChartLine { label: string; points: { t: number; v: number }[]; dashed?: boolean }
export type ToolChart =
  | { kind: 'line'; xKind: 'year' | 'time'; unit: string; series: ChartLine[]; area?: { label: string; points: { t: number; lo: number; hi: number }[] } }
  | { kind: 'rank'; unit: string; items: { label: string; value: number; text: string; detail?: string }[] }

export interface ToolOutput {
  title: string
  /** where the numbers come from, shown under the chart and given to the model */
  source: string
  /** what the model reads */
  text: string
  chart?: ToolChart
}

export interface ToolResult extends ToolOutput {
  /** R1, R2, … — what the model cites and charts */
  id: string
  call: string
  tool: string
  args: string[]
  ok: boolean
  at: number
}

export interface ToolContext {
  crises: CrisisEvent[]
  flights: Flight[]
  trajectories: TrajectoryEntry[]
  /** whether the flights / crises layers are on (off = not measured, never zero) */
  flightsLayer?: boolean
  crisesLayer?: boolean
  now?: number
}

export interface ToolDef {
  name: string
  usage: string
  describe: string
  /** overrides MAX_TEXT for a result that is useless when cut short */
  maxText?: number
  run: (args: string[], ctx: ToolContext) => Promise<ToolOutput>
}

export interface ToolCall { tool: string; args: string[]; raw: string }

export const MAX_TEXT = 2400
/** Data requests honoured per model turn; extra ones are dropped and the model is told so. */
export const MAX_CALLS_PER_STEP = 6

/** A failure the model should read as "could not fetch", not as "nothing there". */
export class ToolError extends Error {}

// ── Helpers ──────────────────────────────────────────────────────────────────

const regionName = new Intl.DisplayNames(['en'], { type: 'region' })
const nameOf = (iso2: string) => { try { return regionName.of(iso2) ?? iso2 } catch { return iso2 } }

function needCountry(arg: string | undefined): { iso2: string; name: string } {
  const a = (arg ?? '').trim()
  if (!a) throw new ToolError('a country name is required')
  if (isDisputedPlace(a)) throw new ToolError(`"${a}" is a disputed area, not a country`)
  const iso2 = resolveISO2(a)
  if (!iso2) throw new ToolError(`unknown country "${a}"`)
  return { iso2, name: nameOf(iso2) }
}

const optCountry = (arg: string | undefined) => (arg && arg.trim() ? needCountry(arg) : null)

const n0 = (v: number) => Math.round(v).toLocaleString('en-US')
const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString('en-US')
const n2 = (v: number) => (Math.round(v * 100) / 100).toLocaleString('en-US')
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
const DAY = 86_400_000

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9%$ ]+/g, ' ').split(/\s+/).filter(w => w.length > 1)

/** Best catalogue match for free text by word overlap; an exact id always wins. */
function bestMatch<T>(query: string, items: T[], id: (t: T) => string, text: (t: T) => string): T | null {
  const q = query.trim()
  const exact = items.find(i => id(i).toLowerCase() === q.toLowerCase())
  if (exact) return exact
  const qw = words(q)
  if (!qw.length) return null
  let best: { item: T; score: number } | null = null
  for (const it of items) {
    const tw = words(text(it))
    const hits = qw.filter(w => tw.some(t => t === w || (w.length >= 4 && t.startsWith(w)))).length
    const score = hits / qw.length - tw.length * 0.001 // tie-break: the shorter, more specific label
    if (hits && (!best || score > best.score)) best = { item: it, score }
  }
  return best && best.score >= 0.5 ? best.item : null
}

const findSeries = (q: string): WbSeriesMeta | null => bestMatch(q, ALL_SERIES, s => s.id, s => s.short)
const findIndicator = (q: string): IndicatorMeta | null => bestMatch(q, INDICATORS, i => i.id, i => `${i.label} ${i.short}`)

const clip = (s: string, max = MAX_TEXT) => (s.length > max ? s.slice(0, max - 20) + '\n… (truncated)' : s)

/** Daily counts over the last `days` days, oldest first, as chart points at UTC midnight. */
function dailyCounts(times: number[], days: number, now: number): { t: number; v: number }[] {
  const end = Math.floor(now / DAY) * DAY
  const pts = Array.from({ length: days }, (_, i) => ({ t: end - (days - 1 - i) * DAY, v: 0 }))
  for (const t of times) {
    const i = days - 1 - Math.floor((end - Math.floor(t / DAY) * DAY) / DAY)
    if (i >= 0 && i < days) pts[i].v++
  }
  return pts
}

function rankItems(rows: { label: string; value: number }[], fmt: (v: number) => string, n = 12) {
  return rows.slice(0, n).map(r => ({ label: r.label, value: r.value, text: fmt(r.value) }))
}

// ── Tools ────────────────────────────────────────────────────────────────────

const TOOLS: ToolDef[] = [
  {
    name: 'catalog',
    usage: '[DATA:catalog]',
    describe: 'List every World Bank series (for series/forecast/profile) and every cross-country indicator (for rank).',
    // ~7k chars; at the default cap the model never saw the rank indicators or half the series
    maxText: 9000,
    async run() {
      const series = CATEGORIES.map(c => `${c.title}: ${c.series.map(s => `${s.short} [${s.id}]`).join('; ')}`).join('\n')
      const ranks = INDICATORS.map(i => `${i.label} [${i.id}]`).join('; ')
      return {
        title: 'Data catalogue', source: 'World Bank WDI/WGI/HCI, Our World in Data, Ember',
        text: `PER-COUNTRY TIME SERIES (use with series / forecast):\n${series}\n\nCROSS-COUNTRY INDICATORS (use with rank):\n${ranks}`,
      }
    },
  },
  {
    name: 'conflict',
    usage: '[DATA:conflict] or [DATA:conflict|Country]',
    describe: 'Live ACLED conflict events already on the map (last 14 days): totals, types, severity, daily counts, worst events. Without a country: ranking by country.',
    async run(args, ctx) {
      if (ctx.crisesLayer === false) throw new ToolError('the crises layer is switched off, so conflict events are not measured')
      const live = ctx.crises.filter(c => !isBaseline(c))
      if (!live.length) throw new ToolError('no events received from ACLED, so conflict events are not measured')
      const now = ctx.now ?? Date.now()
      const c = optCountry(args[0])
      if (!c) {
        const by = new Map<string, number>()
        for (const e of live) by.set(e.country, (by.get(e.country) ?? 0) + 1)
        const rows = [...by].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
        return {
          title: 'Conflict events by country', source: 'ACLED via the dashboard, last 14 days, merged within ~50 km',
          text: `Live events: ${live.length} in ${rows.length} countries.\nTop: ${rows.slice(0, 15).map(r => `${r.label} ${r.value}`).join(', ')}`,
          chart: { kind: 'rank', unit: 'events', items: rankItems(rows, n0) },
        }
      }
      const ev = live.filter(e => sameCountry(e.country, c.name))
      if (!ev.length) return { title: `Conflict events — ${c.name}`, source: 'ACLED via the dashboard', text: `No live ACLED events for ${c.name} in the loaded 14-day window (the feed itself delivered ${live.length} events elsewhere).` }
      const count = <K extends string>(f: (e: CrisisEvent) => K) => { const m: Record<string, number> = {}; for (const e of ev) m[f(e)] = (m[f(e)] ?? 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]) }
      const fatal = ev.reduce((s, e) => s + (e.fatalities ?? 0), 0)
      const worst = [...ev].sort((a, b) => (b.fatalities ?? 0) - (a.fatalities ?? 0)).slice(0, 6)
      const traj = ctx.trajectories.find(t => sameCountry(t.country, c.name))
      return {
        title: `Conflict events — ${c.name}`, source: 'ACLED via the dashboard, last 14 days',
        text: [
          `${c.name}: ${ev.length} live events, ${fatal} reported fatalities.`,
          `By type: ${count(e => e.type).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
          `By severity: ${count(e => e.severity).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
          traj ? `Trend rule: ${traj.trend} — ${traj.reason}` : 'Trend rule: not among the tracked trajectories.',
          'Worst events:', ...worst.map(e => `  • ${e.date} ${e.title.slice(0, 90)}${e.fatalities ? ` (${e.fatalities} fatalities)` : ''}`),
        ].join('\n'),
        chart: { kind: 'line', xKind: 'time', unit: 'events/day', series: [{ label: `${c.name} events per day`, points: dailyCounts(ev.map(e => Date.parse(e.date)).filter(Number.isFinite), 14, now) }] },
      }
    },
  },
  {
    name: 'history',
    usage: '[DATA:history|Country]',
    describe: "Up to 30 days of this browser's own snapshots of a country's conflict severity score (recorded every 30 min while the app was open).",
    async run(args) {
      const c = needCountry(args[0])
      await history.load()
      const snaps = history.getSnapshots()
      if (!snaps.length) throw new ToolError('no snapshots recorded in this browser yet')
      const key = Object.keys(snaps[snaps.length - 1].countries).concat(...snaps.map(s => Object.keys(s.countries))).find(k => sameCountry(k, c.name))
      const pts = key ? countrySeries(snaps, key) : []
      if (pts.length < 2) return { title: `Severity history — ${c.name}`, source: 'local snapshots', text: `Fewer than 2 snapshots include ${c.name} (it may not have been in the top 40 countries).` }
      const first = pts[0], last = pts[pts.length - 1]
      return {
        title: `Severity history — ${c.name}`, source: 'Local snapshots (this browser), severity-weighted ACLED events; gaps = app closed',
        text: `${pts.length} snapshots from ${iso(first.t)} to ${iso(last.t)}. Score first ${n0(first.v)}, latest ${n0(last.v)}, max ${n0(Math.max(...pts.map(p => p.v)))}, min ${n0(Math.min(...pts.map(p => p.v)))}.`,
        chart: { kind: 'line', xKind: 'time', unit: 'score', series: [{ label: `${c.name} severity score`, points: pts }] },
      }
    },
  },
  {
    name: 'flights',
    usage: '[DATA:flights] or [DATA:flights|Country]',
    describe: 'Live OpenSky aircraft: count and top countries of registration; with a country, its aircraft airborne vs on ground.',
    async run(args, ctx) {
      if (ctx.flightsLayer === false) throw new ToolError('the flights layer is switched off, so air traffic is not measured')
      if (!ctx.flights.length) throw new ToolError('no flight data received from OpenSky, so air traffic is not measured')
      const c = optCountry(args[0])
      const set = c ? ctx.flights.filter(f => sameCountry(f.origin_country, c.name)) : ctx.flights
      const by = new Map<string, number>()
      for (const f of ctx.flights) by.set(f.origin_country, (by.get(f.origin_country) ?? 0) + 1)
      const rows = [...by].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
      return {
        title: c ? `Aircraft registered in ${c.name}` : 'Air traffic by country of registration',
        source: 'OpenSky Network ADS-B, latest poll (country = registration, not location)',
        text: c
          ? `${set.length} aircraft registered in ${c.name} (${set.filter(f => !f.on_ground).length} airborne) out of ${ctx.flights.length} tracked worldwide.`
          : `${ctx.flights.length} aircraft tracked (${ctx.flights.filter(f => !f.on_ground).length} airborne). Top registrations: ${rows.slice(0, 12).map(r => `${r.label} ${r.value}`).join(', ')}.`,
        chart: c ? undefined : { kind: 'rank', unit: 'aircraft', items: rankItems(rows, n0) },
      }
    },
  },
  {
    name: 'airspace',
    usage: '[DATA:airspace]',
    describe: 'Low-traffic heuristic over hand-drawn FIR boxes (not NOTAMs, not closures).',
    async run(_args, ctx) {
      if (ctx.flightsLayer === false || !ctx.flights.length) throw new ToolError('air traffic is not measured, so the airspace heuristic cannot run')
      const { statuses, feedOk } = analyzeAirspace(ctx.flights, ctx.now)
      if (!feedOk) throw new ToolError('too few located aircraft for the heuristic to be meaningful')
      const flagged = statuses.filter(s => s.status === 'low' || s.status === 'very_low')
      return {
        title: 'Airspace low-traffic heuristic', source: 'OpenSky counts vs hand-set references per FIR box; a heuristic, not NOTAMs',
        text: `${statuses.length} FIR boxes assessed. Flagged: ${flagged.length ? flagged.map(s => `${s.region} (${s.icao}) — ${FIR_STATUS_LABEL[s.status]}: ${s.reason}`).join('; ') : 'none'}.`,
      }
    },
  },
  {
    name: 'quakes',
    usage: '[DATA:quakes] or [DATA:quakes|Country or region]',
    describe: 'USGS earthquakes M4.5+ over the last 7 days: count, strongest, daily counts.',
    async run(args, ctx) {
      const all = await fetchEarthquakes('week', '4.5')
      if (!all.length) throw new ToolError('USGS returned no data')
      const q = (args[0] ?? '').trim()
      const set = q ? all.filter(e => mentionsCountry(e.place, q) || e.place.toLowerCase().includes(q.toLowerCase())) : all
      const top = [...set].sort((a, b) => b.magnitude - a.magnitude).slice(0, 8)
      return {
        title: q ? `Earthquakes M4.5+ — ${q}` : 'Earthquakes M4.5+, last 7 days', source: 'USGS earthquake feed (M4.5+, past week)',
        text: `${set.length} earthquakes${q ? ` matching "${q}"` : ''} (of ${all.length} worldwide).${top.length ? `\nStrongest:\n${top.map(e => `  • M${e.magnitude.toFixed(1)} ${e.place}, ${iso(e.time)}, depth ${n0(e.depth)} km`).join('\n')}` : ''}`,
        chart: set.length ? { kind: 'line', xKind: 'time', unit: 'quakes/day', series: [{ label: 'M4.5+ per day', points: dailyCounts(set.map(e => e.time), 7, ctx.now ?? Date.now()) }] } : undefined,
      }
    },
  },
  {
    name: 'fires',
    usage: '[DATA:fires]',
    describe: 'NASA FIRMS VIIRS active-fire detections, last 24 h: totals and the most intense 1° cells.',
    async run() {
      const fires = await fetchWildfires()
      if (!fires.length) throw new ToolError('FIRMS returned no detections (feed may be unavailable)')
      const cells = new Map<string, { n: number; frp: number }>()
      for (const f of fires) {
        const k = `${Math.round(f.latitude)}°, ${Math.round(f.longitude)}°`
        const c = cells.get(k) ?? { n: 0, frp: 0 }
        c.n++; c.frp += f.frp
        cells.set(k, c)
      }
      const rows = [...cells].map(([label, c]) => ({ label, value: c.n, frp: c.frp })).sort((a, b) => b.value - a.value)
      return {
        title: 'Active fire detections, last 24 h', source: 'NASA FIRMS, NOAA-20 VIIRS (cells are 1° lat/lng, not countries)',
        text: `${fires.length} detections (${fires.filter(f => f.confidence === 'high').length} high confidence). Densest 1° cells (lat, lng): ${rows.slice(0, 10).map(r => `${r.label} ${r.value} detections / ${n0(r.frp)} MW FRP`).join('; ')}.`,
        chart: { kind: 'rank', unit: 'detections', items: rankItems(rows, n0, 10) },
      }
    },
  },
  {
    name: 'disasters',
    usage: '[DATA:disasters] or [DATA:disasters|Country]',
    describe: 'GDACS orange/red disaster alerts, last 14 days (earthquakes, cyclones, floods, volcanoes, droughts, fires).',
    async run(args) {
      const all = await fetchDisasterAlerts(14)
      const c = optCountry(args[0])
      const set = c ? all.filter(a => a.affectedCountries.some(x => sameCountry(x, c.name)) || sameCountry(a.country, c.name)) : all
      return {
        title: c ? `Disaster alerts — ${c.name}` : 'GDACS disaster alerts, last 14 days', source: 'GDACS (orange/red only)',
        text: set.length
          ? `${set.length} alerts (${set.filter(a => a.alert === 'Red').length} red):\n${set.slice(0, 12).map(a => `  • ${a.alert} ${DISASTER_LABELS[a.type]} — ${a.name.length > 90 ? a.name.slice(0, 89) + "…" : a.name}, ${a.country}${a.isCurrent ? ' (ongoing)' : ''}: ${a.severityText}`).join('\n')}`
          : `No orange/red GDACS alerts${c ? ` for ${c.name}` : ''} in the last 14 days.`,
      }
    },
  },
  {
    name: 'outages',
    usage: '[DATA:outages] or [DATA:outages|Country]',
    describe: 'Internet outages: IODA automatic alerts, last 24 h (networks/regions, ongoing or recovered, signal drop), plus Cloudflare Radar verified outages, last 7 days, with the cause Cloudflare states (e.g. government-directed shutdown, power outage, cable cut, military action).',
    async run(args) {
      const [all, radar] = await Promise.all([fetchOutageEvents(24), fetchRadarOutages('7d')])
      const c = optCountry(args[0])
      const set = c ? all.filter(o => o.entityCode === c.iso2 || sameCountry(o.entityName, c.name) || (o.location?.label ? mentionsCountry(o.location.label, c.name) : false)) : all
      const rows = [...set].sort((a, b) => b.dropPct - a.dropPct)
      const verified = radar.status === 'ok' ? radar.outages.filter(o => !c || o.countries.some(x => x.code === c.iso2 || sameCountry(x.name, c.name))) : []
      const radarText = radar.status !== 'ok'
        ? `Cloudflare Radar verified outages: NOT AVAILABLE (${radar.status === 'not_configured' ? 'no token configured' : radar.message}).`
        : verified.length
          ? `Cloudflare Radar verified outages, last 7 days (${verified.length}; cause is Cloudflare's own attribution):\n${verified.slice(0, 12).map(o => `  • ${o.countries.map(x => x.name).join(', ') || o.asns.map(a => a.name || `AS${a.asn}`).join(', ') || '—'}${o.scope ? ` (${o.scope})` : ''} — ${radarCauseLabel(o.cause)}${o.type ? `, ${o.type.toLowerCase()}` : ''}, began ${iso(o.start)}, ${o.end === null ? 'no end time recorded' : `ended ${iso(o.end)}`}${o.description ? `: ${o.description.length > 140 ? o.description.slice(0, 139) + '…' : o.description}` : ''}`).join('\n')}`
          : `Cloudflare Radar: no verified outages${c ? ` for ${c.name}` : ''} in the last 7 days.`
      return {
        title: c ? `Internet outages — ${c.name}` : 'Internet outages, last 24 h', source: 'IODA (Georgia Tech) alerts, last 24 h; Cloudflare Radar Outage Center, last 7 days',
        text: (rows.length
          ? `${rows.length} IODA outage events (${rows.filter(o => o.status === 'ongoing').length} ongoing):\n${rows.slice(0, 12).map(o => `  • ${o.entityName}${o.org ? ` (${o.org})` : ''} [${o.entityType}] — ${o.status}, ${o.severity}, drop ${n0(o.dropPct)}% since ${iso(o.start * 1000)}`).join('\n')}`
          : `No IODA outage alerts${c ? ` for ${c.name}` : ''} in the last 24 h.`) + `\n${radarText}`,
        chart: rows.length > 1 ? { kind: 'rank', unit: '% drop', items: rows.slice(0, 10).map(o => ({ label: o.entityName, value: o.dropPct, text: `${n0(o.dropPct)}%`, detail: o.status })) } : undefined,
      }
    },
  },
  {
    name: 'gpsjam',
    usage: '[DATA:gpsjam]',
    describe: 'GPS interference (GPSJAM) for the latest day: affected H3 cells and worst areas.',
    async run() {
      const d = await fetchGPSJam()
      if (!d.cells.length) throw new ToolError('GPSJAM returned no cells')
      const worst = [...d.cells].sort((a, b) => b.percentBad - a.percentBad).slice(0, 10)
      return {
        title: `GPS interference, ${d.date}`, source: 'GPSJAM.org (aircraft reporting degraded GPS accuracy, ~22 km cells)',
        text: `${d.cells.length} cells with interference (${d.cells.filter(c => c.severity === 'high').length} high >10%). Worst cells (lat, lng): ${worst.map(c => `${n1(c.lat)}, ${n1(c.lng)} ${n0(c.percentBad)}% of ${c.good + c.bad} aircraft`).join('; ')}.`,
      }
    },
  },
  {
    name: 'darkships',
    usage: '[DATA:darkships] or [DATA:darkships|ISO3 flag, e.g. CHN]',
    describe: 'Global Fishing Watch, last 30 days: vessels that switched AIS off (likely intentional per GFW\'s model) and encounters at sea (possible transshipment), with GFW\'s potential-risk flag. Optional filter by vessel flag (ISO3).',
    async run(args) {
      const flag = (args[0] ?? '').trim().toUpperCase()
      if (flag && !/^[A-Z]{3}$/.test(flag)) throw new ToolError('the flag filter must be an ISO3 code, e.g. CHN, RUS, PAN')
      const { gaps, encounters } = await fetchGfwAll(30)
      const pick = (r: GfwResult) => (r.status === 'ok' ? r.events.filter(e => !flag || e.vessel.flag === flag || e.other?.flag === flag) : [])
      const g = pick(gaps), en = pick(encounters), risky = en.filter(e => e.potentialRisk)
      const status = (r: GfwResult, what: string) => r.status === 'not_configured' ? `${what}: NOT AVAILABLE (no GFW token configured).`
        : r.status === 'error' ? `${what}: NOT AVAILABLE (${r.message}).`
        : r.capped ? `${what}: only the first ${r.events.length} of ${r.total ?? 'more'} events loaded, so counts below are a sample, not totals.` : ''
      const flags = (ev: GfwEvent[]) => {
        const by = new Map<string, number>()
        for (const e of ev) if (e.vessel.flag) by.set(e.vessel.flag, (by.get(e.vessel.flag) ?? 0) + 1)
        return [...by].sort((a, b) => b[1] - a[1]).slice(0, 8)
      }
      const line = (e: GfwEvent) => `  • ${e.vessel.name || 'unnamed'}${e.vessel.flag ? ` (${e.vessel.flag}${e.vessel.type ? `, ${e.vessel.type}` : ''})` : ''}${e.other ? ` met ${e.other.name || 'unnamed'}${e.other.flag ? ` (${e.other.flag}${e.other.type ? `, ${e.other.type}` : ''})` : ''}` : ''} at ${n1(e.lat)}, ${n1(e.lon)} — ${iso(e.start)}, ${n0(e.durationHours)} h, ${e.highSeas ? 'high seas' : 'inside an EEZ'}${e.potentialRisk ? ', GFW potential-risk flag' : ''}`
      const newest = [gaps, encounters].map(r => (r.status === 'ok' ? r.newest : null)).filter((t): t is number => t !== null)
      const gapFlags = flags(g)
      const text = [
        status(gaps, 'AIS-off events'), status(encounters, 'Encounters'),
        gaps.status === 'ok' ? `AIS-off events${flag ? ` involving ${flag}-flagged vessels` : ''}: ${g.length}. Most common flags: ${gapFlags.map(([f, c]) => `${f} ${c}`).join(', ') || '—'}.` : '',
        encounters.status === 'ok' ? `Encounters: ${en.length}, of which ${risky.length} carry GFW's potential-risk flag (no matching public authorisation, checked only outside EEZs).` : '',
        newest.length ? `Newest event in GFW's data: ${iso(Math.max(...newest))} (GFW processes AIS in batches, so this is not live).` : '',
        'Caveats: an AIS gap is GFW\'s model of likely intentional disabling, not proof of illegal activity; GFW calls the dataset a prototype.',
        risky.length ? `Flagged encounters (latest first):\n${risky.slice(0, 8).map(line).join('\n')}` : '',
        g.length ? `Longest AIS-off events:\n${[...g].sort((a, b) => b.durationHours - a.durationHours).slice(0, 8).map(line).join('\n')}` : '',
      ].filter(Boolean).join('\n')
      return {
        title: flag ? `Dark ships & encounters — ${flag} flag` : 'Dark ships & encounters, last 30 days',
        source: 'Global Fishing Watch Events API (AIS off, encounters), last 30 days',
        text,
        chart: gapFlags.length > 1 ? { kind: 'rank', unit: 'AIS-off events', items: gapFlags.map(([f, c]) => ({ label: f, value: c, text: n0(c) })) } : undefined,
      }
    },
  },
  {
    name: 'news',
    usage: '[DATA:news] or [DATA:news|search terms]',
    describe: 'Recent headlines from the dashboard news sources (RSS, Google News, NYT, NewsAPI, GDELT). Use specific terms.',
    async run(args) {
      const q = (args[0] ?? '').trim()
      const items = q ? await searchAllSources(q) : await fetchTopHeadlines()
      if (!items.length) throw new ToolError('no headlines returned by the news sources')
      return {
        title: q ? `Headlines: "${q}"` : 'Top headlines', source: 'Dashboard news feeds (titles only; unverified reporting)',
        text: items.slice(0, 14).map(a => `  • ${a.publishedAt.slice(0, 10)} ${a.source}: ${a.title.slice(0, 140)}`).join('\n'),
      }
    },
  },
  {
    name: 'markets',
    usage: '[DATA:markets] or [DATA:markets|SYM,SYM]',
    describe: 'Latest quotes (Finnhub): default is the regional equity ETFs (SPY, QQQ, EWG, EWJ, FXI, …); or any tickers, e.g. USO,GLD,XLE.',
    async run(args) {
      const syms = (args[0] ? args[0].split(/[,\s]+/) : MARKET_HUBS.map(h => h.symbol)).map(s => s.trim().toUpperCase()).filter(s => /^[A-Z.^=-]{1,10}$/.test(s)).slice(0, 12)
      if (!syms.length) throw new ToolError('no valid ticker symbols')
      const quotes = await fetchMultipleQuotes(syms)
      if (!quotes.length) throw new ToolError('no quotes returned (market data feed unavailable or symbols unknown)')
      return {
        title: 'Market snapshot', source: 'Finnhub quotes; change is vs previous close (on weekends: Friday)',
        text: quotes.map(q => `  • ${q.name} (${q.symbol}): ${n2(q.price)} ${q.currency}, ${q.changePercent >= 0 ? '+' : ''}${n2(q.changePercent)}% (last trade ${q.lastUpdated.slice(0, 16).replace('T', ' ')} UTC)`).join('\n'),
        chart: { kind: 'rank', unit: 'abs. % change', items: [...quotes].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).map(q => ({ label: q.symbol, value: Math.abs(q.changePercent), text: `${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%`, detail: q.name })) },
      }
    },
  },
  {
    name: 'profile',
    usage: '[DATA:profile|Country]',
    describe: 'Economic snapshot of a country: latest value and the value 10 years earlier for ~20 key World Bank series.',
    async run(args) {
      const c = needCountry(args[0])
      const d = await fetchCountryDataset(c.iso2)
      const KEY = ['NY.GDP.MKTP.CD', 'NY.GDP.PCAP.CD', 'NY.GDP.MKTP.KD.ZG', 'FP.CPI.TOTL.ZG', 'SL.UEM.TOTL.ZS', 'GC.DOD.TOTL.GD.ZS', 'GC.NLD.TOTL.GD.ZS', 'BN.CAB.XOKA.GD.ZS', 'NE.TRD.GNFS.ZS', 'FI.RES.TOTL.MO', 'BX.KLT.DINV.WD.GD.ZS', 'MS.MIL.XPND.GD.ZS', 'SP.POP.TOTL', 'SP.POP.GROW', 'SP.DYN.LE00.IN', 'SI.POV.DDAY', 'EG.ELC.ACCS.ZS', 'IT.NET.USER.ZS', 'PA.NUS.FCRF', 'FR.INR.LEND']
      const lines: string[] = []
      for (const id of KEY) {
        const m = SERIES_BY_ID.get(id)
        const pts = pointsOf(d, id)
        if (!m || !pts.length) continue
        const last = pts[pts.length - 1]
        const ago = pts.find(p => p.x === last.x - 10)
        lines.push(`  • ${m.short}: ${formatValue(m.kind, last.y)} (${last.x})${ago ? `; ${formatValue(m.kind, ago.y)} in ${ago.x}` : ''}`)
      }
      if (!lines.length) throw new ToolError(`the World Bank returned no data for ${c.name}`)
      return {
        title: `Economic profile — ${d.name}`, source: `World Bank Open Data${d.failedBatches ? ` (${d.failedBatches} of ${d.totalBatches} requests failed; some series missing)` : ''}`,
        text: `${d.name} (World Bank, latest year reported per series):\n${lines.join('\n')}`,
      }
    },
  },
  {
    name: 'series',
    usage: '[DATA:series|Country[,Country…]|indicator|fromYear?]',
    describe: 'Annual World Bank time series for up to 5 countries, e.g. [DATA:series|Germany,France|GDP growth|2000]. Indicator = name or id from catalog.',
    async run(args) {
      const countries = (args[0] ?? '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 5).map(needCountry)
      if (!countries.length) throw new ToolError('at least one country is required')
      const meta = findSeries(args[1] ?? '')
      if (!meta) throw new ToolError(`unknown indicator "${args[1] ?? ''}" — request [DATA:catalog] for the list`)
      const from = Math.max(1960, Math.min(new Date().getUTCFullYear() - 3, Number(args[2]) || 2000))
      const data = await fetchSeriesForCountries(countries.map(c => c.iso2), meta.id, from)
      const lines: string[] = []
      const series: ChartLine[] = []
      for (const c of countries) {
        const pts = data[c.iso2]?.points ?? []
        if (!pts.length) { lines.push(`${c.name}: no data`); continue }
        series.push({ label: c.name, points: pts.map(p => ({ t: p.x, v: p.y })) })
        const t = trendTest(pts)
        const step = Math.max(1, Math.ceil(pts.length / 14)) // keep the text short: every value for short series, thinned for long
        const shown = pts.filter((_, i) => i % step === 0 || i === pts.length - 1)
        lines.push(`${c.name}: ${shown.map(p => `${p.x} ${formatValue(meta.kind, p.y)}`).join(', ')}${t ? ` | trend ${t.from}–${t.to}: ${t.direction} (Sen slope ${n2(t.slope)}/yr, p=${n2(t.p)})` : ''}`)
      }
      if (!series.length) throw new ToolError(`the World Bank has no ${meta.short} values for ${countries.map(c => c.name).join(', ')} since ${from}`)
      return {
        title: `${meta.short}${countries.length > 1 ? '' : ` — ${countries[0].name}`}`, source: `World Bank Open Data, ${meta.id}; trend = Mann–Kendall/Sen, autocorrelation-corrected`,
        text: `${data[countries[0].iso2]?.name ?? meta.short}, ${from}–latest:\n${lines.join('\n')}`,
        chart: { kind: 'line', xKind: 'year', unit: meta.short, series },
      }
    },
  },
  {
    name: 'forecast',
    usage: '[DATA:forecast|Country|indicator]',
    describe: 'Statistical 3-year forecast of one World Bank series: AR(2) with 95% interval, naive baseline, and an out-of-sample backtest of both.',
    async run(args) {
      const c = needCountry(args[0])
      const meta = findSeries(args[1] ?? '')
      if (!meta) throw new ToolError(`unknown indicator "${args[1] ?? ''}" — request [DATA:catalog] for the list`)
      const pts: Pt[] = (await fetchSeriesForCountries([c.iso2], meta.id, 1960))[c.iso2]?.points ?? []
      const ar = arForecast(pts, 2, 3)
      const naive = naiveForecast(pts, 3)
      if (!ar || !naive) throw new ToolError(`too little unbroken history of ${meta.short} for ${c.name} to fit a forecast`)
      const bt = backtestForecast(pts, train => arForecast(train, 2, 1), 12)
      const f = (v: number) => formatValue(meta.kind, v)
      const last = pts[pts.length - 1]
      const verdict = !bt || bt.mae == null || bt.baselineMae == null ? 'backtest not possible (too short)'
        : `backtest over ${bt.folds} one-year-ahead folds: AR(2) mean abs. error ${n2(bt.mae)} vs naive ${n2(bt.baselineMae)}${bt.dm ? ` (Diebold–Mariano p=${n2(bt.dm.p)}${bt.dm.p < 0.05 ? ', significant' : ', not significant'})` : ''}`
      return {
        title: `${meta.short} forecast — ${c.name}`, source: 'Computed locally from World Bank data: AR(2) by OLS on the latest unbroken run; intervals ignore parameter uncertainty',
        text: [
          `${c.name} ${meta.short}: last observed ${f(last.y)} (${last.x}), n=${ar.n}.`,
          `AR(2): ${ar.points.map(p => `${p.year} ${f(p.value)} [95% ${f(p.lo)} to ${f(p.hi)}]`).join('; ')}${ar.longRun != null ? `; long-run level ${f(ar.longRun)}` : ''}.`,
          `Naive (no change): ${f(naive.points[0].value)} each year.`,
          `Skill: ${verdict}. A model that does not beat naive out of sample should not be presented as informative.`,
        ].join('\n'),
        chart: {
          kind: 'line', xKind: 'year', unit: meta.short,
          series: [
            { label: `${c.name} (observed)`, points: pts.slice(-25).map(p => ({ t: p.x, v: p.y })) },
            { label: 'AR(2) forecast', dashed: true, points: [{ t: last.x, v: last.y }, ...ar.points.map(p => ({ t: p.year, v: p.value }))] },
          ],
          area: { label: '95% interval', points: ar.points.filter(p => Number.isFinite(p.lo)).map(p => ({ t: p.year, lo: p.lo, hi: p.hi })) },
        },
      }
    },
  },
  {
    name: 'rank',
    usage: '[DATA:rank|indicator|top or bottom|N?]',
    describe: 'Rank all countries on one indicator (latest value since 2010), e.g. [DATA:rank|military spending|top|15].',
    async run(args) {
      const meta = findIndicator(args[0] ?? '')
      if (!meta) throw new ToolError(`unknown indicator "${args[0] ?? ''}" — request [DATA:catalog] for the list`)
      const rows = await fetchIndicatorAll(meta.id)
      if (!rows.length) throw new ToolError(`${meta.source} returned no values for ${meta.label}`)
      const bottom = /^bottom|lowest|least/i.test(args[1] ?? '')
      const n = Math.max(3, Math.min(25, Number(args[2]) || 12))
      const sorted = [...rows].sort((a, b) => bottom ? a.value - b.value : b.value - a.value).slice(0, n)
      return {
        title: `${meta.label} — ${bottom ? 'lowest' : 'highest'} ${n}`, source: `${meta.source}, latest value per country since 2010 (${rows.length} countries)`,
        text: `${meta.label}, ${bottom ? 'lowest' : 'highest'} of ${rows.length} countries:\n${sorted.map((r, i) => `  ${i + 1}) ${r.name}: ${meta.format(r.value)} (${r.year})`).join('\n')}`,
        chart: { kind: 'rank', unit: meta.short, items: sorted.map(r => ({ label: r.name, value: Math.abs(r.value), text: meta.format(r.value), detail: r.year })) },
      }
    },
  },
  {
    name: 'trade',
    usage: '[DATA:trade|Country]',
    describe: 'Trade profile (UN Comtrade + World Bank): top partners and products, balance, openness, blocs, dependencies.',
    async run(args) {
      const c = needCountry(args[0])
      const p = getTradeProfile(c.name)
      if (!p) throw new ToolError(`no trade profile for ${c.name} in the dashboard dataset`)
      const pct = (xs: { name: string; pct: number }[]) => xs.map(x => `${x.name} ${n1(x.pct)}%`).join(', ')
      const partners = (xs: { country: string; pct: number }[]) => pct(xs.map(x => ({ name: x.country, pct: x.pct })))
      const products = (xs: { product: string; pct: number }[]) => pct(xs.map(x => ({ name: x.product, pct: x.pct })))
      return {
        title: `Trade profile — ${p.name}`, source: `UN Comtrade (${p.year}) and World Bank; blocs and dependencies hand-maintained`,
        text: [
          `${p.name} (${p.year}). Export partners: ${partners(p.topExportPartners)}.`,
          `Import partners: ${partners(p.topImportPartners)}.`,
          `Top exports: ${products(p.topExports)}.`,
          `Top imports: ${products(p.topImports)}.`,
          `${p.tradeBalance != null ? `Trade balance US$${n1(p.tradeBalance)}bn. ` : ''}${p.tradeToGDP != null ? `Trade ${n1(p.tradeToGDP)}% of GDP. ` : ''}${p.currentAccount != null ? `Current account ${n1(p.currentAccount)}% of GDP. ` : ''}Blocs: ${p.tradeBlocs.join(', ') || 'none listed'}.`,
          p.dependencies?.length ? `Dependencies (editorial): ${p.dependencies.join('; ')}` : '',
        ].filter(Boolean).join('\n'),
        chart: { kind: 'rank', unit: '% of exports', items: p.topExportPartners.map(x => ({ label: x.country, value: x.pct, text: `${n1(x.pct)}%` })) },
      }
    },
  },
  {
    name: 'sanctions',
    usage: '[DATA:sanctions] or [DATA:sanctions|Country]',
    describe: 'Sanctions regimes on a country (OFAC/EU/UN/UK/…): categories, severity, summary. Without a country: the full list.',
    async run(args) {
      const c = optCountry(args[0])
      if (!c) return { title: 'Sanctioned countries', source: 'Dashboard sanctions dataset (curated from official lists)', text: SANCTIONED_COUNTRIES.map(s => `  • ${s.name}: ${s.severity}, ${s.regimes.join('/')}`).join('\n') }
      const s = SANCTIONED_COUNTRIES.find(x => x.iso2 === c.iso2)
      return {
        title: `Sanctions — ${c.name}`, source: 'Dashboard sanctions dataset (curated from official lists)',
        text: s ? `${s.name}: severity ${s.severity}; regimes ${s.regimes.join(', ')}; categories ${s.categories.join(', ')}${s.since ? `; since ${s.since}` : ''}.\n${s.summary}` : `${c.name} is not in the dashboard's sanctions dataset.`,
      }
    },
  },
  {
    name: 'military',
    usage: '[DATA:military|Country]',
    describe: 'Military bases hosted in / operated by a country, nuclear power plants, and armed-forces personnel (World Bank).',
    async run(args) {
      const c = needCountry(args[0])
      const hosted = MILITARY_FACILITIES.filter(f => sameCountry(f.host, c.name))
      const abroad = MILITARY_FACILITIES.filter(f => sameCountry(f.operator, c.name) && !sameCountry(f.host, c.name))
      const plants = NUCLEAR_PLANTS.filter(p => sameCountry(p.country, c.name))
      let personnel = ''
      try {
        const e = (await fetchMilitaryPersonnelRanking()).find(x => x.iso2 === c.iso2)
        if (e) personnel = `Armed forces personnel: ${n0(e.personnel)} (${e.year}, rank ${e.rank}).`
      } catch { personnel = 'Armed forces personnel: World Bank request failed.' }
      return {
        title: `Military & nuclear — ${c.name}`, source: 'Curated facility list (not individually re-verified), World Bank MS.MIL.TOTL.P1',
        text: [
          personnel,
          `Facilities on its territory (${hosted.length}): ${hosted.slice(0, 12).map(f => `${f.name} [${f.type}, operated by ${f.operator}, ${f.status}]`).join('; ') || 'none listed'}.`,
          `Facilities it operates abroad (${abroad.length}): ${abroad.slice(0, 10).map(f => `${f.name} in ${f.host}`).join('; ') || 'none listed'}.`,
          `Nuclear power plants (${plants.length}): ${plants.slice(0, 10).map(p => `${p.name} ${p.reactors} reactors, ${n0(p.capacity)} MWe, ${p.status}`).join('; ') || 'none listed'}.`,
        ].join('\n'),
      }
    },
  },
  {
    name: 'energy',
    usage: '[DATA:energy|Country]',
    describe: "Electricity generation mix (Ember) plus oil and gas reserves/production (CIA World Factbook).",
    async run(args) {
      const c = needCountry(args[0])
      const lines: string[] = []
      let chart: ToolChart | undefined
      try {
        const e = (await fetchPowerGenerationRanking()).find(x => sameCountry(x.country, c.name))
        if (e) {
          const mix = POWER_SOURCES.map(s => ({ label: s.label, value: e.bySource[s.id] })).filter(r => r.value > 0).sort((a, b) => b.value - a.value)
          lines.push(`Electricity ${e.year}: ${n1(e.totalTwh)} TWh total, ${n1(e.lowCarbonPct)}% low-carbon. Mix: ${mix.map(r => `${r.label} ${n1(r.value)} TWh`).join(', ')}.`)
          chart = { kind: 'rank', unit: 'TWh', items: rankItems(mix, v => `${n1(v)} TWh`) }
        }
      } catch { lines.push('Electricity: Ember request failed.') }
      const og = OIL_GAS_DATA.find(x => x.iso2 === c.iso2)
      if (og) lines.push(`Oil reserves ${n1(og.oilReserves)} bn bbl; oil production ${n2(og.oilProduction)} mb/d; gas reserves ${n2(og.gasReserves)} tcm; gas production ${n1(og.gasProduction)} bcm/yr (Factbook years: ${Object.entries(og.years).map(([k, y]) => `${k} ${y}`).join(', ')}).`)
      if (!lines.length) throw new ToolError(`no energy data for ${c.name}`)
      return { title: `Energy — ${c.name}`, source: 'Ember yearly electricity data; CIA World Factbook', text: lines.join('\n'), chart }
    },
  },
  {
    name: 'resources',
    usage: '[DATA:resources|Country]',
    describe: 'Critical minerals profile (USGS/BGS shares and ranks) and World Bank natural-resource rents (% of GDP).',
    async run(args) {
      const c = needCountry(args[0])
      const p = getResourceProfile(c.iso2)
      const rents = await fetchResourceRents(c.iso2).catch(() => [])
      if (!p && !rents.length) throw new ToolError(`no resource data for ${c.name}`)
      return {
        title: `Resources — ${c.name}`, source: 'USGS Mineral Commodity Summaries / BGS (approximate shares); World Bank rents',
        text: [
          p ? `Minerals: ${p.resources.map(r => `${r.mineral}${r.rank ? ` #${r.rank}` : ''}${r.shareOfWorld ? ` ${n1(r.shareOfWorld)}% of world` : ''}`).join('; ')}.${p.strategic ? ` Strategic note (editorial): ${p.strategic}` : ''}` : 'No minerals profile.',
          rents.length ? `Resource rents: ${rents.map(r => `${r.label} ${n2(r.value)}% of GDP (${r.year})`).join('; ')}.` : 'Resource rents: unavailable.',
        ].join('\n'),
      }
    },
  },
  {
    name: 'chokepoints',
    usage: '[DATA:chokepoints]',
    describe: 'Maritime chokepoints: oil flows (EIA) and average daily transits (IMF PortWatch), risks.',
    async run() {
      const rows = CHOKEPOINTS.filter(c => c.oilFlowMbd != null).map(c => ({ label: c.name, value: c.oilFlowMbd! }))
      return {
        title: 'Maritime chokepoints', source: 'EIA World Oil Transit Chokepoints; IMF PortWatch transit averages; risks editorial',
        text: CHOKEPOINTS.map(c => `  • ${c.name} (${c.controlledBy}): ${c.oilFlowMbd != null ? `${n1(c.oilFlowMbd)} mb/d oil (${oilSharePct(c)}% of seaborne)` : 'oil flow n/a'}${c.transits ? `, ${n0(c.transits.avgDaily)} transits/day (${n0(c.transits.avgDailyTankers)} tankers, ${c.transits.year})` : ''}. Risks: ${c.risks.slice(0, 2).join('; ')}`).join('\n'),
        chart: rows.length ? { kind: 'rank', unit: 'mb/d', items: rankItems(rows.sort((a, b) => b.value - a.value), v => `${n1(v)} mb/d`) } : undefined,
      }
    },
  },
  {
    name: 'ports',
    usage: '[DATA:ports|Country]',
    describe: 'Major ports of a country with annual port calls and trade volume (IMF PortWatch).',
    async run(args) {
      const c = needCountry(args[0])
      const ps = PORTS.filter(p => sameCountry(p.country, c.name))
      if (!ps.length) return { title: `Ports — ${c.name}`, source: 'IMF PortWatch', text: `No ports for ${c.name} in the dashboard's port list.` }
      return {
        title: `Ports — ${c.name}`, source: 'IMF PortWatch annual activity',
        text: ps.map(p => `  • ${p.name} (${p.type}): ${p.activity ? `${n0(p.activity.portCalls)} port calls, ${n1(p.activity.tradeMt)} Mt trade (${p.activity.year})` : 'no activity data'}; top industry ${p.topIndustry}`).join('\n'),
        chart: ps.some(p => p.activity) ? { kind: 'rank', unit: 'Mt', items: rankItems(ps.filter(p => p.activity).map(p => ({ label: p.name, value: p.activity!.tradeMt })).sort((a, b) => b.value - a.value), v => `${n1(v)} Mt`) } : undefined,
      }
    },
  },
  {
    name: 'refugees',
    usage: '[DATA:refugees]',
    describe: 'Largest refugee-hosting and origin countries (UNHCR end-2023 figures).',
    async run() {
      return {
        title: 'Displacement (UNHCR)', source: 'UNHCR Refugee Data Finder, end-2023',
        text: `Top hosting: ${TOP_HOSTING.slice(0, 10).map(s => `${s.country} ${n0(s.total)}`).join(', ')}.\nTop origins: ${TOP_ORIGINS.slice(0, 10).map(s => `${s.country} ${n0(s.total)}`).join(', ')}.`,
        chart: { kind: 'rank', unit: 'people', items: rankItems(TOP_ORIGINS.map(s => ({ label: s.country, value: s.total })), n0, 10) },
      }
    },
  },
  {
    name: 'inventories',
    usage: '[DATA:inventories|crude or gasoline or distillate or gas or spr]',
    describe: 'US weekly energy inventories (EIA): last 52 weeks with the latest weekly change.',
    async run(args) {
      const key = (args[0] ?? 'crude').trim().toLowerCase()
      const def = EIA_SERIES.find(s => s.key === key) ?? EIA_SERIES[0]
      const r = await fetchEiaSeries(def.id)
      if (r.status === 'not_configured') throw new ToolError('the EIA key is not configured on this deployment')
      if (r.status === 'error') throw new ToolError(r.message)
      const pts = r.points.slice(-52)
      if (pts.length < 2) throw new ToolError('EIA returned too few points')
      const last = pts[pts.length - 1], prev = pts[pts.length - 2]
      return {
        title: `US ${def.label}`, source: `EIA ${def.report} (${def.unit})`,
        text: `${def.label}: ${n0(last.value)} ${def.unit} in the week of ${last.period} (${last.value >= prev.value ? '+' : ''}${n0(last.value - prev.value)} vs prior week). 52-week range ${n0(Math.min(...pts.map(p => p.value)))}–${n0(Math.max(...pts.map(p => p.value)))}.`,
        chart: { kind: 'line', xKind: 'time', unit: def.unit, series: [{ label: def.label, points: pts.map(p => ({ t: p.t, v: p.value })) }] },
      }
    },
  },
]

export const TOOL_BY_NAME = new Map(TOOLS.map(t => [t.name, t]))
export const TOOL_NAMES = TOOLS.map(t => t.name)

/** The tool list as it appears in the system prompt. */
export function toolCatalogue(): string {
  return TOOLS.map(t => `${t.usage} — ${t.describe}`).join('\n')
}

// ── Parsing ──────────────────────────────────────────────────────────────────

export const DATA_LINE = /^\[DATA:([a-z_]+)(?:\|([^\]]*))?\]$/i
export const CHART_LINE = /^\[CHART:(R\d+)\]$/i

/**
 * Data requests in a model turn: `[DATA:tool|arg|arg]` lines, plus model-native tool-call blocks
 * (`<|tool_call_start|>[news(query='Sudan')]<|tool_call_end|>`) when they name one of our tools — the default
 * free model emits those instead of our syntax. Unknown tools are ignored; duplicates collapse.
 */
export function parseToolCalls(text: string): ToolCall[] {
  const out: ToolCall[] = []
  const seen = new Set<string>()
  const push = (tool: string, args: string[], raw: string) => {
    const t = tool.toLowerCase()
    if (!TOOL_BY_NAME.has(t)) return
    const key = `${t}|${args.join('|').toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ tool: t, args, raw })
  }
  for (const line of text.split('\n')) {
    const m = line.trim().match(DATA_LINE)
    if (m) push(m[1], m[2] ? m[2].split('|').map(s => s.trim()) : [], line.trim())
  }
  for (const m of text.matchAll(/<\|tool_call_start\|>\s*\[?\s*([a-z_]+)\s*\(([^)]*)\)\s*\]?\s*<\|tool_call_end\|>/gi)) {
    const args = [...m[2].matchAll(/(?:\w+\s*=\s*)?(?:'([^']*)'|"([^"]*)")/g)].map(a => (a[1] ?? a[2]).trim())
    push(m[1], args, m[0])
  }
  return out
}

/** Runs one call. Never throws: a failure is a result the model reads, so it says "could not fetch", not "none". */
export async function runTool(call: ToolCall, id: string, ctx: ToolContext): Promise<ToolResult> {
  const base = { id, call: call.raw, tool: call.tool, args: call.args, at: Date.now() }
  const def = TOOL_BY_NAME.get(call.tool)
  if (!def) return { ...base, ok: false, title: call.tool, source: '', text: `Unknown tool "${call.tool}".` }
  try {
    const out = await def.run(call.args, ctx)
    return { ...base, ...out, text: clip(out.text, def.maxText), ok: true }
  } catch (e) {
    const why = e instanceof ToolError ? e.message : `request failed (${e instanceof Error ? e.message.slice(0, 120) : 'unknown error'})`
    return { ...base, ok: false, title: `${call.tool}${call.args.length ? ` · ${call.args.join(' · ')}` : ''}`, source: '', text: `NOT AVAILABLE: ${why}. Treat this as unknown, not as zero or absent.` }
  }
}

/** The tool results as the model reads them, in one user message. */
export function formatToolResults(results: ToolResult[], dropped = 0): string {
  return [
    'TOOL RESULTS — fetched or computed by the dashboard just now (not model-generated). Cite their numbers with [dashboard]. Place a chart of a result on its own line with [CHART:<id>].',
    ...results.map(r => `--- ${r.id} · ${r.call}${r.ok ? ` · ${r.title} · source: ${r.source}${r.chart ? ' · chartable' : ''}` : ''}\n${r.text}`),
    dropped ? `(${dropped} further request${dropped === 1 ? '' : 's'} dropped: at most ${MAX_CALLS_PER_STEP} per turn.)` : '',
  ].filter(Boolean).join('\n\n')
}

/** Series catalogue entries matching an indicator query — exported for tests. */
export const _test = { findSeries, findIndicator, dailyCounts, INDICATOR_BY_ID }
