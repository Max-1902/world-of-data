// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FlightFilter from './FlightFilter'
import OverlayMenu from './OverlayMenu'
import type { Flight, PanelState } from '../../../types'
import { ALL_TYPES } from '../flightLayer'

const flight = (over: Partial<Flight>): Flight => ({
  icao24: 'abc123', callsign: 'TST1', country: 'Germany', longitude: 8, latitude: 50, altitude: 10000, velocity: 220, heading: 90, onGround: false, ...over,
} as Flight)

describe('FlightFilter', () => {
  const setup = (over: Partial<React.ComponentProps<typeof FlightFilter>> = {}) => {
    const setFilterQuery = vi.fn()
    const setFilterTypes = vi.fn()
    const props = {
      flights: [flight({ icao24: 'a1' }), flight({ icao24: 'a2', callsign: 'RCH123' })],
      filteredCount: 2, filterQuery: '', setFilterQuery, filterTypes: new Set(ALL_TYPES), setFilterTypes, ...over,
    }
    render(<FlightFilter {...props} />)
    return { ...props, setFilterQuery, setFilterTypes }
  }

  it('starts collapsed and shows the filtered count on its button', () => {
    setup({ filteredCount: 1234 })
    expect(screen.getByRole('button', { name: /FILTER/ }).textContent).toContain('1,234')
    expect(screen.queryByPlaceholderText(/callsign/)).toBeNull()
  })

  it('opens, forwards the search text, and clears it', () => {
    const p = setup({ filterQuery: 'RCH' })
    fireEvent.click(screen.getByRole('button', { name: /FILTER/ }))
    fireEvent.change(screen.getByPlaceholderText(/callsign/), { target: { value: 'RCH1' } })
    expect(p.setFilterQuery).toHaveBeenCalledWith('RCH1')
    fireEvent.click(screen.getByRole('button', { name: '×' }))
    expect(p.setFilterQuery).toHaveBeenCalledWith('')
  })

  it('toggles a flight type by updater and selects a size group', () => {
    const p = setup()
    fireEvent.click(screen.getByRole('button', { name: /FILTER/ }))
    fireEvent.click(screen.getByRole('button', { name: /MIL/ }))
    const updater = p.setFilterTypes.mock.calls[0][0] as (prev: Set<string>) => Set<string>
    expect(updater(new Set(['military', 'cargo'])).has('military')).toBe(false)   // was on → off
    expect(updater(new Set(['cargo'])).has('military')).toBe(true)                // was off → on

    fireEvent.click(screen.getByRole('button', { name: 'SMALL' }))
    expect([...(p.setFilterTypes.mock.calls[1][0] as Set<string>)].sort()).toEqual(['private', 'unknown'])
  })
})

describe('OverlayMenu', () => {
  const state = { flights: true, crises: false, military: true } as unknown as PanelState
  const open = () => fireEvent.click(screen.getByRole('button', { name: /Map layers/ }))

  it('counts enabled layers and toggles one by key', () => {
    const onToggleLayer = vi.fn()
    render(<OverlayMenu panelState={state} onToggleLayer={onToggleLayer} top={52} />)
    expect(screen.getByRole('button', { name: /Map layers/ }).textContent).toContain('2')
    expect(screen.queryByRole('button', { name: /Sanctions/ })).toBeNull()   // closed until opened

    open()
    fireEvent.click(screen.getByRole('button', { name: /Sanctions/ }))
    expect(onToggleLayer).toHaveBeenCalledWith('sanctions')
  })

  it('turns every layer off with one button, disabled when none are on', () => {
    const onClearLayers = vi.fn()
    const { unmount } = render(<OverlayMenu panelState={state} onToggleLayer={() => {}} onClearLayers={onClearLayers} top={52} />)
    open()
    fireEvent.click(screen.getByRole('button', { name: /Turn all layers off/ }))
    expect(onClearLayers).toHaveBeenCalledTimes(1)
    unmount()

    render(<OverlayMenu panelState={{ flights: false } as unknown as PanelState} onToggleLayer={() => {}} onClearLayers={onClearLayers} top={52} />)
    open()
    expect((screen.getByRole('button', { name: /Turn all layers off/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('has a toggle for every layer key the sections list, so none can be un-toggleable', async () => {
    const { LAYER_SECTIONS } = await import('../../../utils/layerSections')
    render(<OverlayMenu panelState={{} as PanelState} onToggleLayer={() => {}} top={52} />)
    open()
    const keys = LAYER_SECTIONS.flatMap(s => s.keys)
    expect(keys.length).toBeGreaterThan(20)
    // each key renders one pressable toggle (the menu would throw on a key missing from OVERLAY_ITEMS)
    expect(screen.getAllByRole('button').filter(b => b.hasAttribute('aria-pressed'))).toHaveLength(keys.length)
  })

  it('folds and unfolds a section, showing how many of its layers are on', () => {
    render(<OverlayMenu panelState={{ vessels: true, stocks: true } as unknown as PanelState} onToggleLayer={() => {}} top={52} />)
    open()
    const head = screen.getByRole('button', { name: /MARKETS & TRADE/ })
    expect(head.textContent).toContain('2 on')
    expect(head.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(head)
    expect(screen.queryByRole('button', { name: /Vessels/ })).toBeNull()
    fireEvent.click(head)
    expect(screen.getByRole('button', { name: /Vessels/ })).toBeTruthy()
  })

  it('tags layers nothing computes from as map only, inside their own theme', () => {
    render(<OverlayMenu panelState={{} as PanelState} onToggleLayer={() => {}} top={52} />)
    open()
    const vessels = screen.getByRole('button', { name: /Vessels/ })
    expect(vessels.textContent).toContain('map only')
    expect(vessels.getAttribute('title')).toMatch(/plotted, not analysed/)
    expect(screen.getByRole('button', { name: /Chokepoints/ }).textContent).not.toContain('map only')
  })

  it("lists the open workspace's layers first, and shows the ones still off in one click", () => {
    const onToggleLayer = vi.fn()
    render(<OverlayMenu panelState={{ stocks: true } as unknown as PanelState} onToggleLayer={onToggleLayer} top={52}
      suggested={{ workspace: 'ECONOMY', layers: ['stocks', 'tradeStats', 'resources'] }} />)
    open()
    expect(screen.getByText(/For this workspace · ECONOMY/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }))
    expect(onToggleLayer.mock.calls.map(c => c[0])).toEqual(['tradeStats', 'resources'])
  })

  it('hides the workspace section when the workspace draws nothing, and "show all" once everything is on', () => {
    const { unmount } = render(<OverlayMenu panelState={{} as PanelState} onToggleLayer={() => {}} top={52} suggested={{ workspace: 'COUNTRY LOOKUP', layers: [] }} />)
    open()
    expect(screen.queryByText(/For this workspace/)).toBeNull()
    unmount()
    render(<OverlayMenu panelState={{ stocks: true } as unknown as PanelState} onToggleLayer={() => {}} top={52} suggested={{ workspace: 'ECONOMY', layers: ['stocks'] }} />)
    open()
    expect(screen.queryByRole('button', { name: 'Show all' })).toBeNull()
  })

  it('lists DeepState as a toggle that reports its state, and is not counted as a map layer', () => {
    const onToggleDeepstate = vi.fn()
    const base = { panelState: { flights: false } as unknown as PanelState, onToggleLayer: () => {}, top: 52 }
    const { unmount } = render(<OverlayMenu {...base} onToggleDeepstate={onToggleDeepstate} />)
    open()
    const row = screen.getByRole('button', { name: /DeepState Ukraine/ })
    expect(row.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(row)
    expect(onToggleDeepstate).toHaveBeenCalledTimes(1)
    unmount()

    render(<OverlayMenu {...base} deepstateMode onToggleDeepstate={onToggleDeepstate} />)
    open()
    expect(screen.getByRole('button', { name: /DeepState Ukraine/ }).getAttribute('aria-pressed')).toBe('true')
    // DeepState is a split view, not a PanelState layer, so it is not counted
    expect(screen.getByRole('button', { name: /Map layers/ }).textContent).toContain('0')
  })

  it('hides the DeepState row when no toggle is wired', () => {
    render(<OverlayMenu panelState={{} as PanelState} onToggleLayer={() => {}} top={52} />)
    open()
    expect(screen.queryByRole('button', { name: /DeepState/ })).toBeNull()
  })
})
