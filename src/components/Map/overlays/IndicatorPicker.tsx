import { useEffect, useMemo, useRef, useState } from 'react'
import { INDICATORS, INDICATOR_GROUPS, type IndicatorMeta } from '../../../services/countryIndicators'

/** Indicators matching every word of `query` in their label, short label, theme or source; all of them for an empty query. */
export function matchIndicators(query: string, list: readonly IndicatorMeta[] = INDICATORS): IndicatorMeta[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...list]
  return list.filter(i => {
    const hay = `${i.label} ${i.short} ${i.group} ${i.source}`.toLowerCase()
    return words.every(w => hay.includes(w))
  })
}

/** Search box over the indicator catalogue, grouped by theme. Enter takes the highlighted row, Escape closes. */
export function IndicatorPicker({ value, onPick, onClose, exclude }: {
  value: string
  onPick: (id: string) => void
  onClose: () => void
  /** an indicator that can't be picked here (the other axis of a comparison) */
  exclude?: string
}) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => { setCursor(0) }, [query])

  const matches = useMemo(() => matchIndicators(query).filter(i => i.id !== exclude), [query, exclude])
  // listed theme by theme, so the cursor walks the rows in the order they are shown
  const ordered = useMemo(() => INDICATOR_GROUPS.flatMap(g => matches.filter(i => i.group === g)), [matches])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, ordered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    else if (e.key === 'Enter' && ordered[cursor]) { e.preventDefault(); onPick(ordered[cursor].id) }
  }

  return (
    <div>
      <input
        ref={inputRef}
        className="cc-search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={`Search ${INDICATORS.length} indicators…`}
        aria-label="Search indicators"
      />
      <div className="cc-list" role="listbox" aria-label="Indicators">
        {ordered.length === 0 && <div className="cc-empty">No indicator matches “{query}”.</div>}
        {INDICATOR_GROUPS.map(g => {
          const rows = ordered.filter(i => i.group === g)
          if (rows.length === 0) return null
          return (
            <div key={g}>
              <div className="cc-group">{g}</div>
              {rows.map(i => (
                <button
                  key={i.id}
                  role="option"
                  aria-selected={i.id === value}
                  className={`cc-opt ${ordered[cursor] === i ? 'hl' : ''}`}
                  onMouseEnter={() => setCursor(ordered.indexOf(i))}
                  onClick={() => onPick(i.id)}
                >
                  <span>{i.label}</span><small>{i.source}</small>
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
