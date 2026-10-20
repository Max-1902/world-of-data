// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const fetchIndicatorAll = vi.hoisted(() => vi.fn())
vi.mock('../services/countryIndicators', async orig => ({ ...await orig<typeof import('../services/countryIndicators')>(), fetchIndicatorAll }))

const { useCountryAnalytics } = await import('./useCountryAnalytics')

// ten countries where y = 2x, so the pair analysis has enough points and a clean positive fit
const rows = (k: number) => Array.from({ length: 10 }, (_, i) => ({ iso3: `C${i}A`, name: `C${i}`, value: (i + 1) * k, year: '2023' }))

describe('useCountryAnalytics', () => {
  it('loads both selected indicators plus extras, then analyses the pair', async () => {
    fetchIndicatorAll.mockImplementation(async (id: string) => rows(id === 'extra' ? 5 : 2))
    const { result } = renderHook(() => useCountryAnalytics(true, ['extra']))
    const { x, y } = result.current.state.selection
    await waitFor(() => expect(result.current.analysis).not.toBeNull())
    expect(fetchIndicatorAll.mock.calls.map(c => c[0]).sort()).toEqual([x, y, 'extra'].sort())
    expect(result.current.analysis!.n).toBe(10)
    expect(result.current.analysis!.spearman).toBeCloseTo(1)
  })

  it('loads nothing while disabled', () => {
    fetchIndicatorAll.mockClear()
    renderHook(() => useCountryAnalytics(false, ['other']))
    expect(fetchIndicatorAll).not.toHaveBeenCalled()
  })
})
