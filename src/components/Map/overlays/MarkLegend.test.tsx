// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import MarkLegend, { type MarkLegendLayers } from './MarkLegend'
import { SHAPES } from '../layers/markShapes'
import { FACILITY_COLORS } from '../../../services/military'
import { INFRA_COLORS } from '../../../services/infrastructure'
import { PORT_TYPE_COLORS } from '../../../services/ports'
import { FACILITY_TYPE_COLORS } from '../../../services/supplychain'
import { PLANT_STATUS_COLORS } from '../../../services/military'

const off: MarkLegendLayers = { crises: false, flights: false, military: false, infrastructure: false, nuclear: false, ports: false, supplyChain: false, humanitarian: false, sanctions: false }

describe('MarkLegend', () => {
  it('renders nothing when no categorical layer is on', () => {
    const { container } = render(<MarkLegend layers={off} />)
    expect(container.firstChild).toBeNull()
  })

  it('lists only the layers that are on, each category in words', () => {
    render(<MarkLegend layers={{ ...off, crises: true, humanitarian: true }} />)
    const key = screen.getByRole('region', { name: 'Map key' })
    expect(within(key).getByText('Terrorism')).toBeTruthy()
    expect(within(key).getByText('Restricted')).toBeTruthy()
    expect(within(key).queryByText('Aircraft')).toBeNull()
  })

  it('collapses', () => {
    render(<MarkLegend layers={{ ...off, flights: true }} />)
    expect(screen.getByText('Cargo')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Map key/ }))
    expect(screen.queryByText('Cargo')).toBeNull()
  })

  it('has a distinct shape for every category of each facility layer', () => {
    for (const colors of [FACILITY_COLORS, INFRA_COLORS, PORT_TYPE_COLORS, FACILITY_TYPE_COLORS, PLANT_STATUS_COLORS]) {
      expect(Object.keys(colors).length).toBeLessThanOrEqual(SHAPES.length)
    }
  })
})
