// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { installLocalStorage } from '../../test/helpers'
import type { PanelProps } from '../../panels/types'
import type { WindowLayout } from './useWindowLayout'

// Two stand-in panels instead of the real registry (whose panels fetch live data).
vi.mock('../../panels/registry', () => {
  const defs = [
    { id: 'alpha', title: 'Alpha', group: 'overview', section: 's', desc: '', map: 'none', render: () => <div>alpha body</div> },
    { id: 'beta', title: 'Beta', group: 'overview', section: 's', desc: '', map: 'none', render: () => <div>beta body</div> },
  ]
  return { PANEL_MAP: new Map(defs.map(d => [d.id, d])) }
})

const panelProps = { crises: [], flights: [], panelState: {}, onToggleLayer: () => {}, deepstateMode: false, onDeepstateToggle: () => {} } as unknown as PanelProps

async function setup() {
  const { useWindowLayout } = await import('./useWindowLayout')
  const { default: WindowLayer, WindowTaskbar } = await import('./WindowLayer')
  let layout!: WindowLayout
  function Harness() {
    layout = useWindowLayout()
    return <><WindowTaskbar layout={layout} /><WindowLayer layout={layout} panelProps={panelProps} /></>
  }
  const utils = render(<Harness />)
  return { ...utils, get layout() { return layout } }
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
    expect(screen.getByText(/Pop out any panel/)).toBeTruthy()
    act(() => h.layout.actions.open('alpha'))
    expect(win('Alpha')).toBeTruthy()
    expect(await screen.findByText('alpha body')).toBeTruthy()
    expect(within(screen.getByRole('toolbar', { name: 'Windows' })).getByText('Alpha')).toBeTruthy()
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
    fireEvent.click(within(screen.getByRole('toolbar', { name: 'Windows' })).getByText('Alpha'))
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
    fireEvent.click(screen.getByRole('button', { name: 'Side by side' }))
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
})
