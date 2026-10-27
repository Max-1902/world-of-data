import CloseButton from './CloseButton'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MapViewMode, PanelState } from '../types'
import { rankItems, type PaletteItem } from '../utils/paletteSearch'
import { buildSearchCatalogue } from './searchCatalogue'
import type { Screen } from './Windows/screens'

interface Props {
  open: boolean
  onClose: () => void
  panelState: PanelState
  onOpenPanel: (id: string) => void
  onToggleLayer: (id: keyof PanelState) => void
  onViewMode: (m: MapViewMode) => void
  onGeoSearch: (q: string) => void
  /** named window layouts — listed first, so an empty palette doubles as a screen switcher */
  screens?: Screen[]
  onLoadScreen?: (id: string) => void
  onOpenLibrary?: () => void
  /** shade the map's countries by a catalogue indicator */
  onColorCountries?: (indicatorId: string) => void
}

const KIND_LABEL: Record<PaletteItem['kind'], string> = {
  panel: 'Panel', layer: 'Layer', view: 'Map style', chokepoint: 'Chokepoint', search: 'Search map', screen: 'Screen', action: 'Browse', indicator: 'Colour map',
}

/** Cmd/Ctrl+K palette over the panel registry, map layers, map styles and chokepoints. */
export default function CommandPalette({ open, onClose, panelState, onOpenPanel, onToggleLayer, onViewMode, onGeoSearch, screens = [], onLoadScreen, onOpenLibrary, onColorCountries }: Props) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const { catalogue: base } = useMemo(buildSearchCatalogue, [])
  const catalogue = useMemo<PaletteItem[]>(() => [
    ...screens.map((s, i) => ({ id: `screen:${s.id}`, kind: 'screen' as const, label: s.name, hint: `${s.desc ?? `${s.wins.length} windows`}${i < 9 ? ` · Alt+${i + 1}` : ''}`, keywords: 'screen layout workspace' })),
    ...(onOpenLibrary ? [{ id: 'action:library', kind: 'action' as const, label: 'All panels…', hint: 'Browse and search every panel (P)', keywords: 'panels library browse list find' }] : []),
    ...(onColorCountries ? base : base.filter(i => i.kind !== 'indicator')),
  ], [screens, onOpenLibrary, onColorCountries, base])

  const results = useMemo(() => {
    const ranked = rankItems(catalogue, query)
    const q = query.trim()
    // Anything else typed falls through to the existing map geocoder (countries, cities, places).
    return q ? [...ranked, { id: `search:${q}`, kind: 'search' as const, label: `Fly to “${q}”` }] : ranked
  }, [catalogue, query])

  useEffect(() => {
    if (open) { setQuery(''); setCursor(0); inputRef.current?.focus() }
  }, [open])
  useEffect(() => { setCursor(0) }, [query])

  if (!open) return null

  function run(item: PaletteItem) {
    const key = item.id.slice(item.id.indexOf(':') + 1)
    if (item.kind === 'panel') onOpenPanel(key)
    else if (item.kind === 'screen') onLoadScreen?.(key)
    else if (item.kind === 'action') onOpenLibrary?.()
    else if (item.kind === 'layer') onToggleLayer(key as keyof PanelState)
    else if (item.kind === 'view') onViewMode(key as MapViewMode)
    else if (item.kind === 'indicator') onColorCountries?.(key)
    else if (item.kind === 'chokepoint' || item.kind === 'search') onGeoSearch(key)
    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    else if (e.key === 'Enter' && results[cursor]) { e.preventDefault(); run(results[cursor]) }
  }

  return (
    <div
      onMouseDown={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(2,7,11,0.72)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '12vh' }}
    >
      <div
        role="dialog"
        aria-label="Command palette"
        onMouseDown={e => e.stopPropagation()}
        style={{ position: 'relative', width: 'min(560px, calc(100vw - 32px))', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 14, boxShadow: 'var(--shadow-lg)', overflow: 'hidden', fontFamily: 'Inter, -apple-system, sans-serif' }}
      >
        <CloseButton corner onClick={onClose} label="Close command palette" style={{ top: 12 }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Switch screen, jump to a panel, toggle a layer, or fly to a place…"
          aria-label="Search commands"
          style={{ width: '100%', boxSizing: 'border-box', padding: '14px 44px 14px 16px', fontSize: 13, border: 'none', borderBottom: '1px solid var(--border)', outline: 'none', background: 'transparent', color: 'var(--text1)' }}
        />
        <div role="listbox" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
          {results.length === 0 && (
            <div style={{ padding: 16, fontSize: 12, color: 'var(--text3)' }}>No matches</div>
          )}
          {results.map((item, i) => {
            const isLayer = item.kind === 'layer'
            const layerOn = isLayer && panelState[item.id.slice(6) as keyof PanelState]
            return (
              <div
                key={item.id}
                role="option"
                aria-selected={i === cursor}
                onMouseEnter={() => setCursor(i)}
                onClick={() => run(item)}
                style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 16px', cursor: 'pointer', background: i === cursor ? 'var(--surface2)' : 'transparent', boxShadow: i === cursor ? 'inset 2px 0 var(--accent)' : 'none' }}
              >
                <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text3)', width: 74, flexShrink: 0 }}>{KIND_LABEL[item.kind]}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text1)', flexShrink: 0 }}>{item.label}</span>
                {isLayer && <span style={{ fontSize: 10, color: layerOn ? 'var(--green)' : 'var(--text3)' }}>{layerOn ? 'on' : 'off'}</span>}
                {item.hint && <span style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.hint}</span>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
