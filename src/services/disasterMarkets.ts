// Disasters × markets: how each affected country's stock-market fund moved after a GDACS Orange/Red alert, against
// the world market and against its own ordinary weeks (utils/eventStudy.ts). Recent alerts come from the live GDACS
// feed, the history behind the base rates from GDACS's archive; prices from Yahoo Finance (services/priceHistory.ts).

import { loadAlertHistory, loadDisasterAlerts, SUDDEN_ONSET, type DisasterAlert } from './gdacs'
import { BENCHMARK, fundFor, type CountryFund } from './countryFunds'
import { fetchPriceHistory, type PriceSeries } from './priceHistory'
import { alignReturns, eventStudy, HORIZONS, summarise, type GroupSummary, type Horizon, type StudyResult } from '../utils/eventStudy'

/** The benchmark starts trading in March 2008 and the model needs a year of returns before an event. */
export const HISTORY_FROM_YEAR = 2009
export const RECENT_DAYS = 30
/** Alerts hitting the same fund within this many days of an earlier one are folded into it (aftershocks, a storm's
 *  second landfall): their trading days overlap, so counting both would count one market move twice. */
export const MERGE_DAYS = 30

export interface Reaction {
  event: DisasterAlert
  country: string
  fund: CountryFund
  study: StudyResult
  /** later alerts folded into this one, by name */
  merged: string[]
}

export interface Unmatched {
  event: DisasterAlert
  /** why there is no reaction for it */
  reason: string
}

/** GDACS dates carry no zone; they are UTC. */
export function eventSeconds(iso: string): number {
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
  return Number.isNaN(t) ? NaN : t / 1000
}

function countriesOf(a: DisasterAlert): string[] {
  const names = a.affectedCountries.length ? a.affectedCountries : a.country.split(',')
  return [...new Set(names.map(n => n.trim()).filter(Boolean))]
}

interface Pair { event: DisasterAlert; country: string; fund: CountryFund; merged: string[] }

/** One pair per (event, fund); for history, later alerts on the same fund within MERGE_DAYS fold into the first. */
export function pairEvents(alerts: DisasterAlert[], merge: boolean): { pairs: Pair[]; unmatched: Unmatched[] } {
  const pairs: Pair[] = []
  const unmatched: Unmatched[] = []
  // Red before Orange on the same day, so a fold keeps the bigger alert's name
  const ordered = [...alerts].sort((a, b) => a.from.localeCompare(b.from) || (a.alert === b.alert ? 0 : a.alert === 'Red' ? -1 : 1))
  const lastBy = new Map<string, Pair>()
  for (const event of ordered) {
    const t = eventSeconds(event.from)
    if (!Number.isFinite(t)) { unmatched.push({ event, reason: 'GDACS gave no usable start date' }); continue }
    const found = countriesOf(event).flatMap(c => { const f = fundFor(c); return f ? [{ country: c, fund: f }] : [] })
    if (found.length === 0) {
      unmatched.push({ event, reason: countriesOf(event).length ? 'no US-listed single-country fund for the affected countries' : 'GDACS lists no affected country' })
      continue
    }
    const seen = new Set<string>()
    for (const { country, fund } of found) {
      if (seen.has(fund.symbol)) continue
      seen.add(fund.symbol)
      const prev = lastBy.get(fund.symbol)
      if (merge && prev && t - eventSeconds(prev.event.from) < MERGE_DAYS * 86_400) { prev.merged.push(event.name); continue }
      const pair = { event, country, fund, merged: [] }
      lastBy.set(fund.symbol, pair)
      pairs.push(pair)
    }
  }
  return { pairs, unmatched }
}

async function pricesFor(symbols: string[]): Promise<Map<string, PriceSeries>> {
  const out = new Map<string, PriceSeries>()
  const list = [...new Set(symbols)]
  for (let i = 0; i < list.length; i += 4) {
    const got = await Promise.all(list.slice(i, i + 4).map(fetchPriceHistory))
    got.forEach((s, k) => { if (s) out.set(list[i + k], s) })
  }
  return out
}

async function study(pairs: Pair[]): Promise<{ reactions: Reaction[]; missing: Pair[] }> {
  const prices = await pricesFor([BENCHMARK.symbol, ...pairs.map(p => p.fund.symbol)])
  const market = prices.get(BENCHMARK.symbol)
  if (!market) throw new Error(`${BENCHMARK.symbol} price history could not be loaded from Yahoo Finance`)
  const returns = new Map<string, ReturnType<typeof alignReturns>>()
  const reactions: Reaction[] = []
  const missing: Pair[] = []
  for (const p of pairs) {
    const fund = prices.get(p.fund.symbol)
    if (!fund) { missing.push(p); continue }
    if (!returns.has(p.fund.symbol)) returns.set(p.fund.symbol, alignReturns(fund.points, market.points))
    const s = eventStudy(returns.get(p.fund.symbol)!, eventSeconds(p.event.from))
    if (s) reactions.push({ ...p, study: s })
    else missing.push(p)
  }
  return { reactions, missing }
}

export interface RecentResult {
  reactions: Reaction[]
  /** recent alerts with no reaction to show, and why */
  unmatched: Unmatched[]
}

/** Orange/Red sudden-onset alerts of the last RECENT_DAYS days and how each affected country's fund has moved since. */
export async function loadRecentReactions(): Promise<RecentResult> {
  const alerts = (await loadDisasterAlerts(RECENT_DAYS)).filter(a => SUDDEN_ONSET.includes(a.type))
  // the live feed lists one row per episode; a reaction is per event
  const byEvent = new Map<string, DisasterAlert>()
  for (const a of alerts) { const s = byEvent.get(a.eventKey); if (!s || a.from < s.from) byEvent.set(a.eventKey, a) }
  const { pairs, unmatched } = pairEvents([...byEvent.values()], false)
  const { reactions, missing } = await study(pairs)
  for (const m of missing) unmatched.push({ event: m.event, reason: `${m.fund.symbol} has no trading day after the alert yet, or its prices could not be loaded` })
  return { reactions: reactions.sort((a, b) => b.event.from.localeCompare(a.event.from)), unmatched }
}

export interface HistoryResult {
  reactions: Reaction[]
  /** archive alerts none of whose affected countries has a fund */
  noFund: number
  /** alert–fund pairs left out because the fund has under a year of prices before the alert, or none loaded */
  noHistory: number
  folded: number
  fromYear: number
}

export async function loadHistoricalReactions(now = new Date()): Promise<HistoryResult> {
  const alerts = await loadAlertHistory(HISTORY_FROM_YEAR, now)
  const { pairs, unmatched } = pairEvents(alerts, true)
  const { reactions, missing } = await study(pairs)
  return {
    reactions,
    noFund: unmatched.length,
    noHistory: missing.length,
    folded: pairs.reduce((s, p) => s + p.merged.length, 0),
    fromYear: HISTORY_FROM_YEAR,
  }
}

/** Completed windows of horizon `h` (an event still inside its window is left out). */
export function completed(reactions: Reaction[], h: Horizon) {
  return reactions.flatMap(r => { const w = r.study.windows[h]; return w && w.days === h ? [w] : [] })
}

export interface BaseRate { key: string; label: string; byHorizon: Partial<Record<Horizon, GroupSummary>> }

export function baseRates(reactions: Reaction[], groupOf: (r: Reaction) => { key: string; label: string } | null): BaseRate[] {
  const groups = new Map<string, { label: string; items: Reaction[] }>()
  for (const r of reactions) {
    const g = groupOf(r)
    if (!g) continue
    const e = groups.get(g.key) ?? { label: g.label, items: [] }
    e.items.push(r)
    groups.set(g.key, e)
  }
  return [...groups.entries()].map(([key, { label, items }]) => {
    const byHorizon: BaseRate['byHorizon'] = {}
    for (const h of HORIZONS) { const s = summarise(completed(items, h)); if (s) byHorizon[h] = s }
    return { key, label, byHorizon }
  })
}
