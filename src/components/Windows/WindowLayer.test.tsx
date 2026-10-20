// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { installLocalStorage } from '../../test/helpers'
import type { PanelProps } from '../../panels/types'
import type { WindowLayout } from './useWindowLayout'
import type { PanelState } from '../../types'

// Two stand-in panels instead of the real registry (whose panels fetch live data).
vi.mock('../../panels/registry', () => {
  const defs = [
    { id: 'alpha', title: 'Alpha', group: 'overview', section: 's', desc: '', map: 'none', render: () => <div>alpha body</div> },
    { id: 'beta', title: 'Beta', group: 'overview', section: 's', desc: '', map: 'none', render: () => <div>beta body</div> },
  ]
  return { PANEL_MAP: new Map(defs.map(d => [d.id, d])), GROUP_ORDER: [], GROUP_SECTIONS: {}, panelsForGroup: () => [] }
})

const panelProps = { crises: [], flights: [], panelState: {}, onToggleLayer: () => {}, deepstateMode: false, onDeepstateToggle: () => {} } as unknown as PanelProps

async function setup() {
  const { useWindowLayout } = await import('./useWindowLayout')
  const { useScreens } = await import('./useScreens')
  const { default: WindowLayer } = await import('./WindowLayer')
  const { default: Taskbar } = await import('./Taskbar')
  const applyLayers = vi.fn()
  const onOpenLibrary = vi.fn()
  let layout!: WindowLayout
  function Harness() {
    layout = useWindowLayout()
    const screens = useScreens(layout, { flights: true, crises: false } as unknown as PanelState, applyLayers)
    return <><Taskbar layout={layout} screens={screens} onOpenLibrary={onOpenLibrary} /><WindowLayer layout={layout} panelProps={panelProps} /></>
  }
  const utils = render(<Harness />)
  return { ...utils, applyLayers, onOpenLibrary, get layout() { return layout } }
}

/** open the taskbar's Windows menu and return it */
function windowsMenu() {
  fireEvent.click(screen.getByRole('button', { name: /^Windows/ }))
  return within(screen.getByRole('dialog', { name: 'Open windows' }))
}

/** A stand-in pop-up: a real document (an iframe's, so it has a window) and the Window methods the code uses. */
function fakePopup() {
  const frame = document.createElement('iframe')
  document.body.appendChild(frame)
  return {
    document: frame.contentDocument!, closed: false,
    focus: vi.fn(), close() { this.closed = true },
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }
}

// by attribute: a minimised (display:none) window has no accessible name for role queries
const win = (title: string) => document.querySelector<HTMLElement>(`[role="dialog"][aria-label="${title} window"]`)

describe('floating panel windows', () => {
  let store: Map<string, string>
  beforeEach(() => {
    vi.resetModules()
    store = installLocalStorage().store
  })
  afterEach(() => vi.unstubAllGlobals())

  it('opens a panel as a window, listed in the taskbar', async () => {
    const h = await setup()
    expect(windowsMenu().getByText(/None\. Pick a screen/)).toBeTruthy()
    act(() => h.layout.actions.open('alpha'))
    expect(win('Alpha')).toBeTruthy()
    expect(await screen.findByText('alpha body')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Windows/ }).textContent).toContain('1/12')
    expect(within(screen.getByRole('dialog', { name: 'Open windows' })).getByText('Alpha')).toBeTruthy()
    expect(h.layout.ids.has('alpha')).toBe(true)
  })

  it('ignores unknown panel ids', async () => {
    const h = await setup()
    act(() => h.layout.actions.open('nope'))
    expect(h.layout.wins).toEqual([])
  })

  it('minimises to the taskbar and restores from it, keeping the panel mounted', async () => {
    const h = await setup()
    act(() => h.layout.actions.open('alpha'))
    fireEvent.click(within(win('Alpha')!).getByRole('button', { name: 'Minimise' }))
    expect(win('Alpha')!.style.display).toBe('none')
    expect(screen.getByText('alpha body')).toBeTruthy()
    expect(windowsMenu().getByText('minimised')).toBeTruthy()
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Open windows' })).getByText('Alpha'))
    expect(win('Alpha')!.style.display).toBe('')
  })

  it('the close button returns the panel to the dock', async () => {
    const h = await setup()
    act(() => h.layout.actions.open('alpha'))
    fireEvent.click(screen.getByRole('button', { name: 'Return Alpha to the dock' }))
    expect(win('Alpha')).toBeNull()
    expect(h.layout.ids.size).toBe(0)
  })

  it('focus brings a window to the front', async () => {
    const h = await setup()
    act(() => { h.layout.actions.open('alpha'); h.layout.actions.open('beta') })
    expect(win('Beta')!.className).toContain('top')
    fireEvent.mouseDown(screen.getByText('alpha body'))
    expect(win('Alpha')!.className).toContain('top')
    expect(Number(win('Alpha')!.style.zIndex)).toBeGreaterThan(Number(win('Beta')!.style.zIndex))
  })

  it('tiling places windows side by side', async () => {
    const h = await setup()
    act(() => { h.layout.actions.open('alpha'); h.layout.actions.open('beta') })
    fireEvent.click(windowsMenu().getByRole('button', { name: /Side by side/ }))
    const [a, b] = h.layout.wins.map(w => w.rect)
    expect(a.y).toBe(b.y)
    expect(a.x + a.w).toBeLessThanOrEqual(b.x)
  })

  it('remembers the layout across reloads and drops entries it cannot trust', async () => {
    store.set('ws-windows', JSON.stringify([
      { id: 'alpha', rect: { x: 10, y: 20, w: 400, h: 300 }, minimized: true },
      { id: 'removed-panel', rect: { x: 0, y: 0, w: 400, h: 300 } },
      { id: 'beta', rect: { x: 'x', y: 0, w: 400, h: 300 } },
      { id: 'alpha', rect: { x: 0, y: 0, w: 400, h: 300 } },
    ]))
    const h = await setup()
    expect(h.layout.wins).toEqual([{ id: 'alpha', rect: { x: 10, y: 20, w: 400, h: 300 }, minimized: true, maximized: false, external: false }])
    act(() => h.layout.actions.open('beta'))
    expect(JSON.parse(store.get('ws-windows')!).map((w: { id: string }) => w.id)).toEqual(['alpha', 'beta'])
  })

  it('survives corrupt saved state', async () => {
    store.set('ws-windows', '{nope')
    const h = await setup()
    expect(h.layout.wins).toEqual([])
  })

  it('says so when the browser blocks the separate window', async () => {
    vi.stubGlobal('open', vi.fn(() => null))
    const h = await setup()
    act(() => h.layout.actions.open('alpha'))
    fireEvent.click(screen.getByRole('button', { name: 'Open in a separate window' }))
    expect(screen.getByRole('status').textContent).toMatch(/Pop-up blocked/)
    expect(win('Alpha')).toBeTruthy()
  })

  it('moves a panel into a separate browser window and back', async () => {
    const popup = fakePopup()
    const popupDoc = popup.document
    vi.stubGlobal('open', vi.fn(() => popup))
    const h = await setup()
    act(() => h.layout.actions.open('alpha'))
    fireEvent.click(screen.getByRole('button', { name: 'Open in a separate window' }))

    expect(win('Alpha')).toBeNull()
    expect(h.layout.wins[0].external).toBe(true)
    expect(popupDoc.title).toBe('Alpha — World of Data')
    expect(await within(popupDoc.body).findByText('alpha body')).toBeTruthy()

    fireEvent.click(within(popupDoc.body).getByRole('button', { name: /Back to dashboard/ }))
    expect(win('Alpha')).toBeTruthy()
    expect(h.layout.wins[0].external).toBe(false)
    expect(popup.closed).toBe(true)
  })

  it('a window the user closes comes back into the dashboard', async () => {
    vi.useFakeTimers()
    const popup = fakePopup()
    vi.stubGlobal('open', vi.fn(() => popup))
    const h = await setup()
    act(() => h.layout.actions.open('alpha'))
    fireEvent.click(screen.getByRole('button', { name: 'Open in a separate window' }))
    popup.closed = true
    act(() => { vi.advanceTimersByTime(1000) })
    expect(h.layout.wins[0].external).toBe(false)
    expect(win('Alpha')).toBeTruthy()
    vi.useRealTimers()
  })

  describe('screens', () => {
    const tab = (name: string) => screen.getByRole('tab', { name: new RegExp(`^${name}`) })
    function saveAs(name: string) {
      fireEvent.click(screen.getByRole('button', { name: /^Save$/ }))
      fireEvent.change(screen.getByRole('textbox', { name: 'Screen name' }), { target: { value: name } })
      fireEvent.submit(screen.getByRole('textbox', { name: 'Screen name' }).closest('form')!)
    }

    it('lists the built-in screens as tabs', async () => {
      await setup()
      for (const n of ['Map', 'Crisis', 'Markets', 'Security', 'Disruptions', 'Newsroom', 'Analysis']) expect(tab(n)).toBeTruthy()
      expect(tab('Crisis').getAttribute('title')).toMatch(/Alt\+2$/)
    })

    it('saves the current layout and map layers, and brings them back in one click', async () => {
      const h = await setup()
      act(() => { h.layout.actions.open('alpha', { rect: { x: 10, y: 20, w: 400, h: 300 } }); h.layout.actions.open('beta') })
      saveAs('Mine')
      expect(tab('Mine').getAttribute('aria-selected')).toBe('true')
      const saved = JSON.parse(store.get('ws-screens')!)
      expect(saved).toHaveLength(1)
      expect(saved[0]).toMatchObject({ name: 'Mine', layers: ['flights'] })
      expect(saved[0].wins.map((w: { id: string }) => w.id)).toEqual(['alpha', 'beta'])

      fireEvent.click(tab('Map'))
      expect(h.layout.wins).toEqual([])
      expect(tab('Map').getAttribute('aria-selected')).toBe('true')
      expect(h.applyLayers).not.toHaveBeenCalled()

      fireEvent.click(tab('Mine'))
      expect(h.layout.wins.map(w => w.id)).toEqual(['alpha', 'beta'])
      const alpha = h.layout.wins[0].rect
      for (const [k, v] of Object.entries({ x: 10, y: 20, w: 400, h: 300 })) expect(Math.abs(alpha[k as keyof typeof alpha] - v)).toBeLessThanOrEqual(1)
      expect(h.applyLayers).toHaveBeenCalledWith(['flights'], true)
    })

    it('keeps screens across reloads', async () => {
      const h = await setup()
      act(() => h.layout.actions.open('alpha'))
      saveAs('Kept')
      h.unmount()
      vi.resetModules()
      await setup()
      expect(tab('Kept').getAttribute('aria-selected')).toBe('true')
    })

    it('marks the active screen as changed when its windows differ', async () => {
      const h = await setup()
      act(() => { h.layout.actions.open('alpha'); h.layout.actions.open('beta') })
      saveAs('Pair')
      expect(screen.queryByLabelText('changed')).toBeNull()
      act(() => h.layout.actions.close('beta'))
      expect(screen.getByLabelText('changed')).toBeTruthy()
      fireEvent.click(tab('Pair'))
      expect(screen.queryByLabelText('changed')).toBeNull()
    })

    it('updates, renames and deletes your screens', async () => {
      const h = await setup()
      act(() => h.layout.actions.open('alpha'))
      saveAs('First')
      act(() => h.layout.actions.open('beta'))
      fireEvent.click(screen.getByRole('button', { name: /^Save$/ }))
      fireEvent.click(screen.getByRole('button', { name: /Update “First”/ }))
      expect(JSON.parse(store.get('ws-screens')!)[0].wins).toHaveLength(2)

      fireEvent.click(screen.getByRole('button', { name: /^Save$/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Rename First' }))
      fireEvent.change(screen.getByRole('textbox', { name: 'New name for First' }), { target: { value: 'Renamed' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save name' }))
      expect(tab('Renamed')).toBeTruthy()

      fireEvent.click(screen.getByRole('button', { name: 'Delete Renamed' }))
      expect(screen.queryByRole('tab', { name: /^Renamed/ })).toBeNull()
      expect(JSON.parse(store.get('ws-screens')!)).toEqual([])
    })

    it('does not save a screen without a name', async () => {
      await setup()
      saveAs('   ')
      expect(JSON.parse(store.get('ws-screens') ?? '[]')).toEqual([])
    })

    it('Alt+number switches screens, but not while typing', async () => {
      const h = await setup()
      act(() => h.layout.actions.open('alpha'))
      const input = document.createElement('input')
      document.body.appendChild(input)
      fireEvent.keyDown(input, { code: 'Digit1', altKey: true })
      expect(h.layout.wins).toHaveLength(1)
      fireEvent.keyDown(window, { code: 'Digit1', altKey: true })
      expect(h.layout.wins).toHaveLength(0)
      expect(tab('Map').getAttribute('aria-selected')).toBe('true')
      input.remove()
    })

    it('leaves windows on another monitor in place when switching', async () => {
      const popup = fakePopup()
      vi.stubGlobal('open', vi.fn(() => popup))
      const h = await setup()
      act(() => { h.layout.actions.open('alpha'); h.layout.actions.open('beta') })
      fireEvent.click(within(win('Alpha')!).getByRole('button', { name: 'Open in a separate window' }))
      fireEvent.click(tab('Map'))
      expect(h.layout.wins.map(w => [w.id, w.external])).toEqual([['alpha', true]])
      expect(popup.closed).toBe(false)
    })

    it('the Panels button opens the library', async () => {
      const h = await setup()
      fireEvent.click(screen.getByRole('button', { name: /Panels/ }))
      expect(h.onOpenLibrary).toHaveBeenCalled()
    })
  })
})
