import type { NewsArticle } from '../types'

export type KeyEventCategory = 'political' | 'economic' | 'humanitarian' | 'other'

export interface KeyEvent {
  category: KeyEventCategory
  article: NewsArticle
}

export interface KeyEventSummary {
  total: number
  byCategory: Record<KeyEventCategory, number>
  events: KeyEvent[]
}

// Rule-based, title-only: a headline counts as a high-importance event when it names an unambiguous
// high-impact development. Descriptions are skipped on purpose — they're long and full of incidental words.
// Order matters: the first matching category wins, so the sharper humanitarian/economic signals are tested
// before the broad political and "other" lists.
const RULES: { category: KeyEventCategory; re: RegExp }[] = [
  { category: 'humanitarian', re: /\b(famine|starvation|refugees?|displaced|humanitarian|death toll|civilians? killed|massacre|cholera|epidemic|outbreak|pandemic|aid (?:convoy|workers?|blockade)|evacuat\w+)\b/i },
  { category: 'economic',     re: /\b(central bank|interest rates?|rate (?:cut|hike)|recession|inflation|default(?:s|ed)?|debt crisis|bailout|tariffs?|trade war|sanctions?|stock market|markets? (?:plunge|tumble|crash|rally)|oil price|currency (?:crisis|collapse)|bankruptcy|gdp)\b/i },
  { category: 'political',    re: /\b(election|elections|coup|resign\w*|impeach\w*|prime minister|president|parliament|summit|treaty|referendum|protesters?|protests?|no-confidence|snap vote|cabinet|ceasefire talks|peace (?:deal|talks))\b/i },
  { category: 'other',        re: /\b(war|invasion|airstrike|air strikes?|missile|drone attack|bombing|explosion|terror\w*|attack(?:s|ed)?|ceasefire|nuclear|earthquake|hurricane|typhoon|cyclone|tsunami|volcano|wildfire|floods?|hostages?|shooting|cyberattack|blackout)\b/i },
]

const WINDOW_MS = 48 * 60 * 60 * 1000
const normTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60)

export function classifyKeyEvent(title: string): KeyEventCategory | null {
  for (const rule of RULES) if (rule.re.test(title)) return rule.category
  return null
}

/** High-importance events detected in the last 48 h of headlines, de-duplicated across outlets. */
export function summarizeKeyEvents(articles: NewsArticle[], now = Date.now()): KeyEventSummary {
  const byCategory: Record<KeyEventCategory, number> = { political: 0, economic: 0, humanitarian: 0, other: 0 }
  const events: KeyEvent[] = []
  const seen = new Set<string>()
  for (const article of articles) {
    const t = Date.parse(article.publishedAt)
    if (!Number.isFinite(t) || t < now - WINDOW_MS || t > now + 60 * 60 * 1000) continue
    const category = classifyKeyEvent(article.title ?? '')
    if (!category) continue
    const key = normTitle(article.title)
    if (!key || seen.has(key)) continue
    seen.add(key)
    byCategory[category]++
    events.push({ category, article })
  }
  return { total: events.length, byCategory, events }
}
