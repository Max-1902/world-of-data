/** Ranking for the Cmd+K command palette and the top-bar search. Pure so it can be tested without a DOM. */

export interface PaletteItem {
  id: string
  kind: 'panel' | 'layer' | 'view' | 'chokepoint' | 'search'
  label: string
  hint?: string
  /** Extra words that should match but aren't shown (aliases: "ai", "forecast", the workspace name…). */
  keywords?: string
}

export interface ScoredItem { item: PaletteItem; score: number; /** every token hit the label or an alias, not just the hint */ strong: boolean }

/** Optimal-string-alignment distance (Levenshtein + adjacent transposition), bailing out once it exceeds `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const prev2: number[] = []
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1)
      cur.push(v)
      rowMin = Math.min(rowMin, v)
    }
    if (rowMin > max) return max + 1
    prev2.splice(0, prev2.length, ...prev)
    prev = cur
  }
  return prev[b.length]
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

/**
 * A typo of some word or of its start (so "prection" finds "predictions"): 1 edit allowed for 4–6 letters,
 * 2 from 7 letters up. Shorter tokens must match exactly.
 */
function fuzzyHit(token: string, ws: string[]): boolean {
  if (token.length < 4) return false
  const max = token.length >= 7 ? 2 : 1
  return ws.some(w => {
    for (let len = Math.max(1, token.length - max); len <= Math.min(w.length, token.length + max); len++) {
      if (editDistance(token, w.slice(0, len), max) <= max) return true
    }
    return false
  })
}

/**
 * Every whitespace-separated query token must match somewhere in label/hint/keywords.
 * Per token: label prefix 3, alias word 3, label substring 2, label typo 1.5, hint/alias substring 1, alias typo 0.5.
 * Ties keep input order.
 */
export function scoreItems(items: PaletteItem[], query: string, limit = 50): ScoredItem[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return items.slice(0, limit).map(item => ({ item, score: 0, strong: false }))

  const scored: (ScoredItem & { idx: number })[] = []
  items.forEach((item, idx) => {
    const label = item.label.toLowerCase()
    const keywords = (item.keywords ?? '').toLowerCase()
    const hay = `${label} ${(item.hint ?? '').toLowerCase()} ${keywords}`
    const labelWords = words(label)
    const keywordWords = words(keywords)
    let score = 0
    let strong = true
    for (const t of tokens) {
      if (label.startsWith(t) || labelWords.some(w => w.startsWith(t) && t.length >= 2)) score += 3
      else if (keywordWords.includes(t)) score += 3
      else if (label.includes(t)) score += 2
      else if (fuzzyHit(t, labelWords)) score += 1.5
      else if (hay.includes(t)) { score += 1; strong = false }
      else if (fuzzyHit(t, keywordWords)) { score += 0.5; strong = false }
      else return
    }
    scored.push({ item, score, strong, idx })
  })
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx)
  return scored.slice(0, limit).map(({ item, score, strong }) => ({ item, score, strong }))
}

export function rankItems(items: PaletteItem[], query: string, limit = 50): PaletteItem[] {
  return scoreItems(items, query, limit).map(s => s.item)
}
