import type { CrisisEvent, NewsArticle } from '../types'
import { classifyKeyEvent, type KeyEventCategory } from './keyEvents'

export interface BriefHeadline {
  article: NewsArticle
  category: KeyEventCategory | null
}

const HOUR = 60 * 60 * 1000
const normTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60)
// Match reports, transfers and fixtures swamp country searches ("USA 4-1 Peru"); they're rarely the news that matters.
const SPORTS_RE = /\b(vs\.?|v\.?|match recap|highlights|friendly|fixture|full[- ]time|half[- ]time|world cup|league|goalkeeper|striker|midfielder|transfer window|olympic\w*|tennis|cricket|rugby|nba|nfl|fifa|uefa|grand prix|box score|\d+-\d+)\b/i
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Whole-word mention of the country name (so "Niger" doesn't match "Nigeria"). */
export function mentionsCountry(text: string, country: string): boolean {
  const name = country.trim()
  if (name.length < 3) return false
  return new RegExp(`(^|[^a-z])${escapeRe(name)}([^a-z]|$)`, 'i').test(text)
}

/** Names agree if equal or one contains the other as whole words ("Congo" ~ "Democratic Republic of the Congo", not "Mali" ~ "Somalia"). */
export function sameCountry(a: string, b: string): boolean {
  const x = a.toLowerCase().trim()
  const y = b.toLowerCase().trim()
  if (!x || !y) return false
  if (x === y) return true
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  return short.length >= 4 && mentionsCountry(long, short)
}

/**
 * Picks the few headlines worth reading: de-duplicated across outlets, with high-impact developments
 * (war, election, outbreak, sanctions…) and fresh stories ranked first, then newest.
 * `fromSearch` is already about the country; `global` is the app-wide feed and is kept only if it names it.
 */
export function pickCountryHeadlines(
  country: string,
  fromSearch: NewsArticle[],
  global: NewsArticle[],
  limit = 5,
  now = Date.now(),
): BriefHeadline[] {
  const pool = [
    ...fromSearch,
    ...global.filter(a => mentionsCountry(`${a.title} ${a.description}`, country)),
  ]
  const seen = new Set<string>()
  const scored: { item: BriefHeadline; score: number; t: number }[] = []
  for (const article of pool) {
    const key = normTitle(article.title ?? '')
    if (!key || seen.has(key)) continue
    seen.add(key)
    const parsed = Date.parse(article.publishedAt)
    const t = Number.isFinite(parsed) ? parsed : 0
    if (t > now + HOUR) continue
    const age = now - t
    const category = classifyKeyEvent(article.title)
    const score =
      (category ? 2 : 0) +
      (t === 0 ? 0 : age <= 48 * HOUR ? 2 : age <= 5 * 24 * HOUR ? 1 : 0) +
      (mentionsCountry(article.title, country) ? 1 : 0) -
      (SPORTS_RE.test(article.title) ? 4 : 0)
    scored.push({ item: { article, category }, score, t })
  }
  return scored.sort((a, b) => b.score - a.score || b.t - a.t).slice(0, limit).map(s => s.item)
}

const SEVERITY_RANK: Record<CrisisEvent['severity'], number> = { critical: 3, high: 2, medium: 1, low: 0 }

/** Tracked crisis events for a country, worst then newest first. Synthetic baseline markers are skipped. */
export function linkedCrisisEvents(crises: CrisisEvent[], country: string, limit = 3): { total: number; top: CrisisEvent[] } {
  const all = crises.filter(c => c.source !== 'Baseline' && !c.id.startsWith('baseline-') && sameCountry(c.country, country))
  const top = [...all]
    .sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0) || Date.parse(b.date) - Date.parse(a.date))
    .slice(0, limit)
  return { total: all.length, top }
}
