/**
 * Every panel in one searchable list, with what it shows — so a panel can be found by what you want to see
 * ("oil", "refugees", "forecast") rather than by remembering which workspace it sits in. Opens it as a window,
 * or shows it in the dock.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { PanelRight, PictureInPicture2, Search } from 'lucide-react'
import { GROUP_ORDER, GROUP_SECTIONS, PANEL_MAP } from '../../panels/registry'
import type { PanelGroup } from '../../panels/types'
import { buildSearchCatalogue } from '../searchCatalogue'
import { rankItems } from '../../utils/paletteSearch'
import CloseButton from '../CloseButton'

interface Props {
  open: boolean
  onClose: () => void
  /** panels currently open as windows */
  openIds: Set<string>
  onOpenWindow: (id: string) => void
  onShowInDock: (id: string) => void
}

const GROUP_LABEL = Object.fromEntries(GROUP_ORDER.map(g => [g.id, g.label])) as Record<PanelGroup, string>
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

export default function PanelLibrary({ open, onClose, openIds, onOpenWindow, onShowInDock }: Props) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<PanelGroup | 'all'>('all')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const panelItems = useMemo(() => buildSearchCatalogue().catalogue.filter(i => i.kind === 'panel'), [])

  const results = useMemo(() => {
    const ranked = rankItems(panelItems, query, 200)
    return ranked
      .map(i => PANEL_MAP.get(i.id.slice('panel:'.length))!)
      .filter(d => d && (group === 'all' || d.group === group))
  }, [panelItems, query, group])

  useEffect(() => {
    if (open) { setQuery(''); setGroup('all'); setCursor(0); inputRef.current?.focus() }
  }, [open])
  useEffect(() => { setCursor(0) }, [query, group])
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' })
  }, [cursor])

  if (!open) return null

  function pick(id: string, dock: boolean) {
    if (dock) onShowInDock(id); else onOpenWindow(id)
    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    else if (e.key === 'Enter' && results[cursor]) { e.preventDefault(); pick(results[cursor].id, e.shiftKey) }
  }

  const counts = new Map<string, number>()
  for (const i of rankItems(panelItems, query, 200)) {
    const g = PANEL_MAP.get(i.id.slice('panel:'.length))?.group
    if (g) counts.set(g, (counts.get(g) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  // With no query, results stay in workspace order: show a heading wherever the workspace changes.
  const grouped = !query.trim()

  return (
    <div className="lib-backdrop" onMouseDown={onClose}>
      <div className="lib" role="dialog" aria-label="Panel library" onMouseDown={e => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="lib-search">
          <Search size={15} color="var(--text3)" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="What do you want to see? Try “oil”, “refugees”, “forecast”, “sanctions”…"
            aria-label="Search panels"
          />
          <CloseButton onClick={onClose} label="Close panel library" />
        </div>
        <div className="lib-main">
          <nav className="lib-groups" aria-label="Workspaces">
            <button className={group === 'all' ? 'on' : ''} onClick={() => setGroup('all')}>All<span>{total}</span></button>
            {GROUP_ORDER.map(g => (
              <button key={g.id} className={group === g.id ? 'on' : ''} onClick={() => setGroup(g.id)} disabled={!counts.get(g.id)}>
                {titleCase(g.label)}<span>{counts.get(g.id) ?? 0}</span>
              </button>
            ))}
          </nav>
          <div className="lib-list" role="listbox" ref={listRef} aria-label="Panels">
            {results.length === 0 && <div className="lib-empty">No panel matches “{query}”. Try a broader word, or pick a workspace on the left.</div>}
            {results.map((d, i) => {
              const heading = grouped && d.group !== results[i - 1]?.group
              const section = GROUP_SECTIONS[d.group].find(s => s.id === d.section)
              const isOpen = openIds.has(d.id)
              return (
                <div key={d.id}>
                  {heading && <div className="lib-heading">{GROUP_LABEL[d.group]}</div>}
                  <div
                    role="option"
                    data-panel-id={d.id}
                    aria-selected={i === cursor}
                    className={`lib-row${i === cursor ? ' cur' : ''}`}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => pick(d.id, false)}
                  >
                    <div className="lib-row-text">
                      <div className="lib-row-title">
                        {d.dotColor && <span className={`live-dot ${d.dotColor}`} />}
                        {d.title}
                        {isOpen && <span className="lib-pill">open</span>}
                        <small>{titleCase(GROUP_LABEL[d.group])}{section ? ` · ${section.title}` : ''}</small>
                      </div>
                      <div className="lib-row-desc">{d.desc}</div>
                    </div>
                    <button className="pw-btn wide" onClick={e => { e.stopPropagation(); pick(d.id, false) }} title={isOpen ? 'Bring its window to the front' : 'Open as a window'}>
                      <PictureInPicture2 size={12} /> {isOpen ? 'Show' : 'Window'}
                    </button>
                    <button className="pw-btn" aria-label={`Show ${d.title} in the dock`} onClick={e => { e.stopPropagation(); pick(d.id, true) }} title="Show it in the right-hand dock">
                      <PanelRight size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="lib-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>Enter</kbd> open as window</span>
          <span><kbd>Shift</kbd>+<kbd>Enter</kbd> show in dock</span>
          <span><kbd>P</kbd> opens this from anywhere</span>
        </div>
      </div>
    </div>
  )
}
