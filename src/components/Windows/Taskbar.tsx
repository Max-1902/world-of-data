/**
 * The strip along the bottom of the map: screen tabs (one click switches the whole layout), saving your own
 * screens, the panel library, and the open windows with the layout tools.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronUp, Columns3, ExternalLink, Layers, LayoutGrid, Pencil, PictureInPicture2, Rows3, Save, Search, Trash2, X } from 'lucide-react'
import { PANEL_MAP } from '../../panels/registry'
import { popups } from './PanelWindow'
import { MAX_NAME } from './screens'
import type { ScreensApi } from './useScreens'
import { MAX_WINDOWS, type WindowLayout } from './useWindowLayout'

/** A menu that opens upwards from the taskbar; closes on Escape or a click outside it. */
function Popover({ label, trigger, className, children }: {
  label: string
  trigger: (open: boolean, toggle: () => void) => ReactNode
  className?: string
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div className="tb-pop-anchor" ref={ref}>
      {trigger(open, () => setOpen(o => !o))}
      {open && <div className={`tb-pop ${className ?? ''}`} role="dialog" aria-label={label}>{children(() => setOpen(false))}</div>}
    </div>
  )
}

function ScreenManager({ api, close }: { api: ScreensApi; close: () => void }) {
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const mine = api.screens.filter(s => !s.builtin)
  const active = api.screens.find(s => s.id === api.activeId)
  return (
    <>
      <div className="tb-pop-head">SAVE THIS LAYOUT</div>
      <form className="tb-save-row" onSubmit={e => { e.preventDefault(); if (api.save(name)) { setName(''); close() } }}>
        <input
          autoFocus
          value={name}
          maxLength={MAX_NAME}
          onChange={e => setName(e.target.value)}
          placeholder="Name it — e.g. Oil watch"
          aria-label="Screen name"
        />
        <button type="submit" className="pw-btn wide" disabled={!name.trim()}><Save size={12} /> Save</button>
      </form>
      <p className="tb-pop-note">Saves the windows open in the dashboard and the map layers that are on. Separate browser windows are not part of a screen.</p>
      {active && !active.builtin && (
        <button className="tb-pop-item" onClick={() => { api.update(active.id); close() }}>
          <Save size={12} /> Update “{active.name}” with this layout
        </button>
      )}
      <div className="tb-pop-head">YOUR SCREENS</div>
      {mine.length === 0 && <p className="tb-pop-note">None yet. Arrange some windows, then name and save the layout above.</p>}
      {mine.map(s => (
        <div key={s.id} className="tb-screen-row">
          {editing?.id === s.id ? (
            <form className="tb-save-row" onSubmit={e => { e.preventDefault(); api.rename(s.id, editing.name); setEditing(null) }}>
              <input autoFocus value={editing.name} maxLength={MAX_NAME} onChange={e => setEditing({ id: s.id, name: e.target.value })} aria-label={`New name for ${s.name}`} />
              <button type="submit" className="pw-btn" aria-label="Save name"><Check size={13} /></button>
              <button type="button" className="pw-btn" aria-label="Cancel rename" onClick={() => setEditing(null)}><X size={13} /></button>
            </form>
          ) : (
            <>
              <button className="tb-pop-item grow" onClick={() => { api.load(s.id); close() }}>
                {s.name}<small>{s.wins.length} {s.wins.length === 1 ? 'window' : 'windows'}</small>
              </button>
              <button className="pw-btn" aria-label={`Rename ${s.name}`} title="Rename" onClick={() => setEditing({ id: s.id, name: s.name })}><Pencil size={12} /></button>
              <button className="pw-btn" aria-label={`Delete ${s.name}`} title="Delete" onClick={() => api.remove(s.id)}><Trash2 size={12} /></button>
            </>
          )}
        </div>
      ))}
    </>
  )
}

export default function Taskbar({ layout, screens, onOpenLibrary }: { layout: WindowLayout; screens: ScreensApi; onOpenLibrary: () => void }) {
  const { wins, actions } = layout
  const topId = [...wins].reverse().find(w => !w.minimized && !w.external)?.id

  function onWindow(id: string) {
    const w = wins.find(x => x.id === id)
    if (!w) return
    // like an OS taskbar: restore, else bring forward, else (already in front) minimise
    if (w.external) popups.get(id)?.focus()
    else if (w.minimized || id === topId) actions.toggleMinimize(id)
    else actions.focus(id)
  }

  return (
    <div className="pw-taskbar" role="toolbar" aria-label="Screens and windows">
      <span className="pw-taskbar-label">SCREENS</span>
      <div className="pw-chips" role="tablist" aria-label="Screens">
        {screens.screens.map((s, i) => {
          const on = s.id === screens.activeId
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={on}
              className={`pw-chip${on ? ' active' : ''}${s.builtin ? '' : ' mine'}`}
              onClick={() => screens.load(s.id)}
              title={`${s.desc ?? `${s.wins.length} windows`}${i < 9 ? ` — Alt+${i + 1}` : ''}${on && screens.modified ? ' (changed since loaded — click to reset)' : ''}`}
            >
              {s.name}{on && screens.modified && <span className="pw-chip-mod" aria-label="changed">•</span>}
            </button>
          )
        })}
      </div>
      {/* outside the scrolling tab strip, whose overflow would clip the menu */}
      <Popover
          label="Save and manage screens"
          className="wide"
          trigger={(open, toggle) => (
            <button className={`pw-chip add${open ? ' active' : ''}`} onClick={toggle} aria-expanded={open} title="Save this layout as a screen, or rename and delete yours">
              <Save size={11} /> Save
            </button>
          )}
        >
          {close => <ScreenManager api={screens} close={close} />}
        </Popover>

      <span className="pw-tools">
        <button className="pw-btn wide accent" onClick={onOpenLibrary} title="Find any panel and open it as a window (P)">
          <Search size={12} /> Panels
        </button>
        <Popover
          label="Open windows"
          trigger={(open, toggle) => (
            <button className={`pw-btn wide${open ? ' on' : ''}`} onClick={toggle} aria-expanded={open} title="Open windows and layout tools">
              Windows <b>{wins.length}</b>/{MAX_WINDOWS} <ChevronUp size={12} />
            </button>
          )}
        >
          {close => (
            <>
              <div className="tb-pop-head">OPEN WINDOWS</div>
              {wins.length === 0 && (
                <p className="tb-pop-note">
                  None. Pick a screen, use <b>Panels</b>, or click <PictureInPicture2 size={10} style={{ verticalAlign: '-1px' }} /> in a dock panel's header — or drag the header onto the map.
                </p>
              )}
              {wins.map(w => {
                const def = PANEL_MAP.get(w.id)
                if (!def) return null
                return (
                  <div key={w.id} className="tb-screen-row">
                    <button className={`tb-pop-item grow${w.id === topId ? ' on' : ''}`} onClick={() => onWindow(w.id)}>
                      {w.external && <ExternalLink size={11} />}
                      {def.title}
                      <small>{w.external ? 'separate window' : w.minimized ? 'minimised' : w.id === topId ? 'in front' : ''}</small>
                    </button>
                    <button className="pw-btn" aria-label={`Return ${def.title} to the dock`} title="Return to the dock" onClick={() => actions.close(w.id)}><X size={12} /></button>
                  </div>
                )
              })}
              {wins.length > 0 && (
                <>
                  <div className="tb-pop-head">ARRANGE</div>
                  <div className="tb-arrange">
                    <button className="pw-btn wide" onClick={() => actions.arrange('grid')}><LayoutGrid size={12} /> Grid</button>
                    <button className="pw-btn wide" onClick={() => actions.arrange('columns')}><Columns3 size={12} /> Side by side</button>
                    <button className="pw-btn wide" onClick={() => actions.arrange('rows')}><Rows3 size={12} /> Stacked</button>
                    <button className="pw-btn wide" onClick={() => actions.arrange('cascade')}><Layers size={12} /> Cascade</button>
                  </div>
                  <button className="tb-pop-item" onClick={() => { actions.closeAll(); close() }}><X size={12} /> Return every window to the dock</button>
                </>
              )}
            </>
          )}
        </Popover>
      </span>
    </div>
  )
}
