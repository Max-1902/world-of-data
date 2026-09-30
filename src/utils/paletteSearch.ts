/** Ranking for the Cmd+K command palette. Pure so it can be tested without a DOM. */

export interface PaletteItem {
  id: string
  kind: 'panel' | 'layer' | 'view' | 'chokepoint' | 'search'
  label: string
  hint?: string
  /** Extra words that should match but aren't shown. */
  keywords?: string
}

/**
 * Every whitespace-separated query token must appear somewhere in label/hint/keywords.
 * Label-prefix hits rank first, then label substring, then the rest; ties keep input order.
 */
export function rankItems(items: PaletteItem[], query: string, limit = 50): PaletteItem[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return items.slice(0, limit)

  const scored: { item: PaletteItem; score: number; idx: number }[] = []
  items.forEach((item, idx) => {
    const label = item.label.toLowerCase()
    const hay = `${label} ${(item.hint ?? '').toLowerCase()} ${(item.keywords ?? '').toLowerCase()}`
    let score = 0
    for (const t of tokens) {
      if (label.startsWith(t)) score += 3
      else if (label.includes(t)) score += 2
      else if (hay.includes(t)) score += 1
      else return
    }
    scored.push({ item, score, idx })
  })
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx)
  return scored.slice(0, limit).map(s => s.item)
}
