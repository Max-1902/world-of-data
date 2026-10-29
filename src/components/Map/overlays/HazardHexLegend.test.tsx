// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import HazardHexLegend, { hexBreaks } from './HazardHexLegend'

const cell = (value: number) => ({ id: String(value), lat: 0, lng: 1, ring: [], value, count: 1, peak: 0 })
const slice = (cells: ReturnType<typeof cell>[]) => ({ status: 'ready', data: [], fetchedAt: 0, error: null, cells }) as never
const analytics = (hexSource: 'fires' | 'quakes') => ({ hexSource, fires: slice([]), quakes: slice([]) }) as never

describe('HazardHexLegend', () => {
  it('puts the halfway colour at a quarter of the maximum, because cells are drawn on a square-root scale', () => {
    expect(hexBreaks(400)).toEqual([0, 100, 400])
  })

  it('labels the ramp with real numbers and units for wildfires', () => {
    const { container } = render(<HazardHexLegend analytics={analytics('fires')} hexSlice={slice([cell(40), cell(2000)])} onTilt={vi.fn()} />)
    const text = container.textContent!
    expect(text).toContain('500')
    expect(text).toContain('2,000')
    expect(text).toContain('MW of fire radiative power per cell')
    expect(text).not.toContain('Low')
  })

  it('counts quakes per cell, and falls back to Low / High while there is nothing to scale', () => {
    const { container, rerender } = render(<HazardHexLegend analytics={analytics('quakes')} hexSlice={slice([cell(12)])} onTilt={vi.fn()} />)
    expect(container.textContent).toContain('quakes per cell')
    rerender(<HazardHexLegend analytics={analytics('quakes')} hexSlice={slice([])} onTilt={vi.fn()} />)
    expect(container.textContent).toContain('Low')
    expect(container.textContent).toContain('High')
  })
})
