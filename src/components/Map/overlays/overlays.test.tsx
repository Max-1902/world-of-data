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

  it('counts enabled layers and toggles one by key', () => {
    const onToggleLayer = vi.fn()
    render(<OverlayMenu panelState={state} onToggleLayer={onToggleLayer} top={52} />)
    expect(screen.getByRole('button', { name: /OVERLAYS/ }).textContent).toContain('2')
    expect(screen.queryByRole('button', { name: /SANCTIONS/ })).toBeNull()   // collapsed until opened

    fireEvent.click(screen.getByRole('button', { name: /OVERLAYS/ }))
    fireEvent.click(screen.getByRole('button', { name: /SANCTIONS/ }))
    expect(onToggleLayer).toHaveBeenCalledWith('sanctions')
  })

  it('has a button for every layer key the sections list, so none can be un-toggleable', async () => {
    const { LAYER_SECTIONS } = await import('../../../utils/layerSections')
    render(<OverlayMenu panelState={{} as PanelState} onToggleLayer={() => {}} top={52} />)
    fireEvent.click(screen.getByRole('button', { name: /OVERLAYS/ }))
    const keys = LAYER_SECTIONS.flatMap(s => s.keys)
    expect(keys.length).toBeGreaterThan(20)
    // each key renders one toggle (the menu would throw on a key missing from OVERLAY_ITEMS)
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(keys.length + 1)
  })
})
