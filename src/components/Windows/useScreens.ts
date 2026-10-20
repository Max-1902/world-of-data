import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PanelState } from '../../types'
import { BUILTIN_SCREENS, fromFractions, loadUserScreens, saveUserScreens, screenLayers, toFractions, MAX_NAME, type Screen } from './screens'
import { workspaceBounds, type WindowLayout } from './useWindowLayout'

const LS_ACTIVE = 'ws-active-screen'

export interface ScreensApi {
  /** built-in first, then yours; Alt+1–9 follow this order */
  screens: Screen[]
  activeId: string | null
  /** the active screen's panels differ from what is open now */
  modified: boolean
  load: (id: string) => void
  /** save the current layout (and map layers) as a new screen; returns its id */
  save: (name: string) => string | null
  /** overwrite one of your screens with the current layout */
  update: (id: string) => void
  rename: (id: string, name: string) => void
  remove: (id: string) => void
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

export function useScreens(
  layout: WindowLayout,
  panelState: PanelState,
  applyLayers: (layers: (keyof PanelState)[], exact: boolean) => void,
): ScreensApi {
  const [mine, setMine] = useState<Screen[]>(loadUserScreens)
  const [activeId, setActiveId] = useState<string | null>(() => {
    try { return localStorage.getItem(LS_ACTIVE) } catch { return null }
  })
  const screens = useMemo(() => [...BUILTIN_SCREENS, ...mine], [mine])

  useEffect(() => { saveUserScreens(mine) }, [mine])
  useEffect(() => {
    try { if (activeId) localStorage.setItem(LS_ACTIVE, activeId); else localStorage.removeItem(LS_ACTIVE) } catch {}
  }, [activeId])
  // a deleted screen (or one from an old save) can't stay active
  const active = screens.find(s => s.id === activeId) ?? null

  const { wins, actions } = layout
  const load = useCallback((id: string) => {
    const s = screens.find(x => x.id === id)
    if (!s) return
    const b = workspaceBounds()
    actions.replace(s.wins.map(w => ({ id: w.id, rect: fromFractions(w.f, b, !!s.builtin), minimized: w.minimized })))
    const { layers, exact } = screenLayers(s)
    if (layers.length || exact) applyLayers(layers, exact)
    setActiveId(id)
  }, [screens, actions, applyLayers])

  // What a screen saves: the in-dashboard windows (separate browser windows stay independent) and the map layers.
  const snapshot = useCallback(() => {
    const b = workspaceBounds()
    return {
      wins: wins.filter(w => !w.external).map(w => ({ id: w.id, f: toFractions(w.maximized ? b : w.rect, b), ...(w.minimized ? { minimized: true } : {}) })),
      layers: (Object.keys(panelState) as (keyof PanelState)[]).filter(k => panelState[k]),
    }
  }, [wins, panelState])

  const save = useCallback((name: string) => {
    const n = name.trim().slice(0, MAX_NAME)
    if (!n) return null
    const id = `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    setMine(prev => [...prev, { id, name: n, ...snapshot() }])
    setActiveId(id)
    return id
  }, [snapshot])

  const update = useCallback((id: string) => {
    setMine(prev => prev.map(s => (s.id === id ? { ...s, ...snapshot() } : s)))
    setActiveId(id)
  }, [snapshot])

  const rename = useCallback((id: string, name: string) => {
    const n = name.trim().slice(0, MAX_NAME)
    if (n) setMine(prev => prev.map(s => (s.id === id ? { ...s, name: n } : s)))
  }, [])

  const remove = useCallback((id: string) => {
    setMine(prev => prev.filter(s => s.id !== id))
    setActiveId(a => (a === id ? null : a))
  }, [])

  // Alt+1…9: the n-th screen. By physical key, since Alt+digit types a symbol on macOS.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.metaKey || e.ctrlKey || isTyping(e.target)) return
      const m = /^Digit([1-9])$/.exec(e.code)
      if (!m) return
      const s = screens[Number(m[1]) - 1]
      if (!s) return
      e.preventDefault()
      load(s.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screens, load])

  const modified = useMemo(() => {
    if (!active) return false
    const now = wins.filter(w => !w.external).map(w => w.id).sort().join()
    return now !== active.wins.map(w => w.id).sort().join()
  }, [active, wins])

  return { screens, activeId: active?.id ?? null, modified, load, save, update, rename, remove }
}
