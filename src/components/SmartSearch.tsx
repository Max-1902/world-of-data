import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { MapViewMode, PanelState } from '../types'
import { scoreItems, type PaletteItem } from '../utils/paletteSearch'
import { buildSearchCatalogue, GROUP_LABEL } from './searchCatalogue'

interface Props {
  /** The committed location query (drives the map fly-to and the Briefing filter). */
  searchQuery: string
  onSearch: (q: string) => void
  onOpenPanel: (id: string) => void
  onToggleLayer: (id: keyof PanelState) => void
  onViewMode: (m: MapViewMode) => void
}

type Row = PaletteItem & { sub?: string }

const KIND_LABEL: Record<PaletteItem['kind'], string> = {
  panel: 'Panel', layer: 'Layer', view: 'Map style', chokepoint: 'Place', search: 'Location',
}

/** Shown before anything is typed, so it's obvious the box finds more than places. */
const SUGGESTED = ['panel:analyst', 'panel:predictions', 'panel:watchlist', 'panel:countryLookup']
const MAX_ROWS = 7

/**
 * Top-bar search: one box for places *and* the dashboard itself. Typing suggests panels (AI analyst, Predictions…),
 * map layers, map styles and chokepoints, plus "Fly to …" for anything else, which goes to the map geocoder.
 * Only a picked/entered location is committed — typing no longer geocodes on every keystroke.
 */
export default function SmartSearch({ searchQuery, onSearch, onOpenPanel, onToggleLayer, onViewMode }: Props) {
  const { catalogue, groupOfPanel } = useMemo(buildSearchCatalogue, [])
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  const [cursor, setCursor] = useState(0)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const rows = useMemo<Row[]>(() => {
    const withSub = (item: PaletteItem): Row => {
      const key = item.id.slice(item.id.indexOf(':') + 1)
      return item.kind === 'panel' ? { ...item, sub: GROUP_LABEL[groupOfPanel.get(key) ?? ''] } : item
    }
    const q = draft.trim()
    if (!q) return SUGGESTED.map(id => catalogue.find(c => c.id === id)).filter((c): c is PaletteItem => !!c).map(withSub)
    const scored = scoreItems(catalogue, q, MAX_ROWS - 1)
    const fly: Row = { id: `search:${q}`, kind: 'search', label: `Fly to “${q}”`, sub: 'country, city, address or “lat, lon”' }
    const matches = scored.map(s => withSub(s.item))
    // A query that names a panel/layer (or a typo of one) lists those first; anything else is most likely a place.
    return scored[0]?.strong ? [...matches, fly] : [fly, ...matches]
  }, [catalogue, groupOfPanel, draft])

  useEffect(() => { setCursor(0) }, [draft])
  useEffect(() => {
    if (!expanded) return
    inputRef.current?.focus()
    const place = () => setAnchor(wrapRef.current?.getBoundingClientRect() ?? null)
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [expanded])

  function close() { setExpanded(false); setDraft('') }

  function run(row: Row) {
    const key = row.id.slice(row.id.indexOf(':') + 1)
    if (row.kind === 'panel') onOpenPanel(key)
    else if (row.kind === 'layer') onToggleLayer(key as keyof PanelState)
    else if (row.kind === 'view') onViewMode(key as MapViewMode)
    else onSearch(key) // chokepoint or free-text location
    close()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); close(); inputRef.current?.blur() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, rows.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    else if (e.key === 'Enter' && rows[cursor]) { e.preventDefault(); run(rows[cursor]) }
  }

  return (
    <div ref={wrapRef} className="search-wrap" style={{ minWidth: expanded ? 240 : 'auto' }}>
      <Search size={13} style={{ color: searchQuery ? 'var(--accent)' : 'var(--text3)', flexShrink: 0 }} />
      {expanded ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={close}
          placeholder="Place, panel, layer…"
          aria-label="Search places, panels and layers"
          role="combobox"
          aria-expanded={rows.length > 0}
          aria-controls="smart-search-list"
          aria-activedescendant={rows[cursor] ? `smart-search-${cursor}` : undefined}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontSize: 11, color: 'var(--text1)', fontFamily: 'Inter, -apple-system, sans-serif',
            minWidth: 190,
          }}
        />
      ) : (
        <button
          onClick={() => setExpanded(true)}
          title="Search places, panels (AI analyst, Predictions…) and map layers"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 11, padding: 0, fontFamily: 'Inter, -apple-system, sans-serif' }}
        >
          {searchQuery || 'Search'}
        </button>
      )}
      {searchQuery && !expanded && (
        <button onClick={() => onSearch('')} aria-label="Clear location search" className="smart-search-clear">
          <X size={12} />
        </button>
      )}

      {expanded && anchor && rows.length > 0 && (
        <div
          id="smart-search-list"
          role="listbox"
          className="smart-search-list"
          // mousedown, not click: keeps the input from blurring (and closing the list) before the pick registers
          onMouseDown={e => e.preventDefault()}
          style={{ top: anchor.bottom + 6, right: Math.max(8, window.innerWidth - anchor.right), width: Math.max(320, anchor.width) }}
        >
          {!draft.trim() && <div className="smart-search-heading">Jump to</div>}
          {rows.map((row, i) => (
            <div
              key={row.id}
              id={`smart-search-${i}`}
              role="option"
              aria-selected={i === cursor}
              className={`smart-search-row${i === cursor ? ' active' : ''}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => run(row)}
            >
              <span className="smart-search-kind">{KIND_LABEL[row.kind]}</span>
              <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span className="smart-search-label">{row.label}</span>
                {(row.sub || row.hint) && <span className="smart-search-sub">{row.sub ?? row.hint}</span>}
              </span>
            </div>
          ))}
          <div className="smart-search-foot">↑↓ to move · Enter to open · ⌘K for all commands</div>
        </div>
      )}
    </div>
  )
}
