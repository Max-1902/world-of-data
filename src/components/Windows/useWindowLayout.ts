/**
 * State for the floating panel windows: which panels are popped out, where, in what stacking order, and which
 * are minimised, maximised or moved to a separate browser window. Persisted, so a layout survives reloads.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PANEL_MAP } from '../../panels/registry'
import { cascadeLayout, clampRect, placeNew, tileLayout, MIN_H, MIN_W, type Point, type Rect, type TileMode } from './geometry'

export interface PanelWin {
  id: string
  rect: Rect
  minimized: boolean
  maximized: boolean
  /** shown in its own browser window (session-only: pop-ups can't be reopened without a click) */
  external: boolean
}

export const MAX_WINDOWS = 12
const LS_KEY = 'ws-windows'
/** the strip at the bottom of the map that lists open windows (WindowTaskbar) */
export const TASKBAR_H = 30

/** The area windows live in: everything under the top bar and ticker, above the taskbar. */
export function workspaceBounds(): Rect {
  const el = typeof document !== 'undefined' ? document.querySelector('.dashboard-main') : null
  const r = el?.getBoundingClientRect()
  if (r && r.width > 0 && r.height > 0) return { x: r.left, y: r.top, w: r.width, h: Math.max(MIN_H, r.height - TASKBAR_H) }
  const w = typeof window !== 'undefined' ? window.innerWidth : 1280
  const h = typeof window !== 'undefined' ? window.innerHeight : 800
  return { x: 0, y: 0, w, h: Math.max(MIN_H, h - TASKBAR_H) }
}

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

export function loadWindows(): PanelWin[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    const seen = new Set<string>()
    const out: PanelWin[] = []
    for (const w of raw) {
      if (!w || typeof w.id !== 'string' || !PANEL_MAP.has(w.id) || seen.has(w.id)) continue
      const r = w.rect
      if (!r || ![r.x, r.y, r.w, r.h].every(isNum) || r.w < MIN_W || r.h < MIN_H) continue
      seen.add(w.id)
      out.push({ id: w.id, rect: { x: r.x, y: r.y, w: r.w, h: r.h }, minimized: w.minimized === true, maximized: w.maximized === true, external: false })
      if (out.length >= MAX_WINDOWS) break
    }
    return out
  } catch { return [] }
}

/** Stable for the life of the hook, so windows can be memoised on it. */
export interface WindowActions {
  /** pop a panel out (or bring it forward if it already is); `at` = drop point, `rect` = exact placement */
  open: (id: string, opts?: { at?: Point; rect?: Rect }) => void
  /** pop several out at once and tile them */
  openMany: (ids: string[]) => void
  /** return to the dock */
  close: (id: string) => void
  closeAll: () => void
  focus: (id: string) => void
  setRects: (rects: Map<string, Rect>) => void
  toggleMinimize: (id: string) => void
  toggleMaximize: (id: string) => void
  setExternal: (id: string, external: boolean) => void
  arrange: (mode: TileMode | 'cascade') => void
}

export interface WindowLayout {
  /** back-to-front: the last one is on top */
  wins: PanelWin[]
  ids: Set<string>
  full: boolean
  actions: WindowActions
}

export function useWindowLayout(): WindowLayout {
  const [wins, setWins] = useState<PanelWin[]>(loadWindows)

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(wins.map(({ id, rect, minimized, maximized }) => ({ id, rect, minimized, maximized })))) } catch {}
  }, [wins])

  // Keep windows inside the workspace when it changes: the browser window shrinks, or the ticker appears above it.
  useEffect(() => {
    const onResize = () => {
      const b = workspaceBounds()
      setWins(prev => {
        const next = prev.map(w => {
          const rect = clampRect(w.rect, b)
          return rect.x === w.rect.x && rect.y === w.rect.y && rect.w === w.rect.w && rect.h === w.rect.h ? w : { ...w, rect }
        })
        return next.some((w, i) => w !== prev[i]) ? next : prev
      })
    }
    window.addEventListener('resize', onResize)
    const main = document.querySelector('.dashboard-main')
    const ro = main && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null
    if (main) ro?.observe(main)
    return () => { window.removeEventListener('resize', onResize); ro?.disconnect() }
  }, [])

  const toFront = (prev: PanelWin[], id: string, patch: Partial<PanelWin> = {}) => {
    const w = prev.find(x => x.id === id)
    if (!w) return prev
    return [...prev.filter(x => x.id !== id), { ...w, ...patch }]
  }

  const open = useCallback((id: string, opts: { at?: Point; rect?: Rect } = {}) => {
    if (!PANEL_MAP.has(id)) return
    setWins(prev => {
      const b = workspaceBounds()
      if (prev.some(w => w.id === id)) {
        return toFront(prev, id, { minimized: false, ...(opts.rect || opts.at ? { maximized: false, rect: opts.rect ? clampRect(opts.rect, b) : placeNew(b, 0, opts.at) } : {}) })
      }
      if (prev.length >= MAX_WINDOWS) return prev
      const rect = opts.rect ? clampRect(opts.rect, b) : placeNew(b, prev.length, opts.at)
      return [...prev, { id, rect, minimized: false, maximized: false, external: false }]
    })
  }, [])

  const openMany = useCallback((ids: string[]) => {
    setWins(prev => {
      const have = new Set(prev.map(w => w.id))
      const add = ids.filter(id => PANEL_MAP.has(id) && !have.has(id)).slice(0, MAX_WINDOWS - prev.length)
      const all = [...prev.map(w => ({ ...w, minimized: false, maximized: false })), ...add.map(id => ({ id, rect: { x: 0, y: 0, w: MIN_W, h: MIN_H }, minimized: false, maximized: false, external: false }))]
      const floating = all.filter(w => !w.external)
      const rects = tileLayout(floating.length, workspaceBounds(), 'grid')
      return all.map(w => (w.external ? w : { ...w, rect: rects[floating.indexOf(w)] }))
    })
  }, [])

  const close = useCallback((id: string) => setWins(prev => prev.filter(w => w.id !== id)), [])
  const closeAll = useCallback(() => setWins([]), [])
  const focus = useCallback((id: string) => setWins(prev => (prev[prev.length - 1]?.id === id ? prev : toFront(prev, id))), [])

  const setRects = useCallback((rects: Map<string, Rect>) => {
    setWins(prev => prev.map(w => (rects.has(w.id) ? { ...w, rect: rects.get(w.id)!, maximized: false } : w)))
  }, [])

  const toggleMinimize = useCallback((id: string) => {
    setWins(prev => {
      const w = prev.find(x => x.id === id)
      if (!w) return prev
      return w.minimized ? toFront(prev, id, { minimized: false }) : prev.map(x => (x.id === id ? { ...x, minimized: true } : x))
    })
  }, [])

  const toggleMaximize = useCallback((id: string) => {
    setWins(prev => {
      const w = prev.find(x => x.id === id)
      return w ? toFront(prev, id, { maximized: !w.maximized, minimized: false }) : prev
    })
  }, [])

  const setExternal = useCallback((id: string, external: boolean) => {
    setWins(prev => prev.map(w => (w.id === id ? { ...w, external, minimized: false } : w)))
  }, [])

  const arrange = useCallback((mode: TileMode | 'cascade') => {
    setWins(prev => {
      const floating = prev.filter(w => !w.external)
      const b = workspaceBounds()
      const rects = mode === 'cascade' ? cascadeLayout(floating.length, b) : tileLayout(floating.length, b, mode)
      return prev.map(w => (w.external ? w : { ...w, rect: rects[floating.indexOf(w)], minimized: false, maximized: false }))
    })
  }, [])

  const ids = useMemo(() => new Set(wins.map(w => w.id)), [wins])
  const actions = useMemo<WindowActions>(
    () => ({ open, openMany, close, closeAll, focus, setRects, toggleMinimize, toggleMaximize, setExternal, arrange }),
    [open, openMany, close, closeAll, focus, setRects, toggleMinimize, toggleMaximize, setExternal, arrange],
  )
  return { wins, ids, full: wins.length >= MAX_WINDOWS, actions }
}
