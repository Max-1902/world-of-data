// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { SelectedPlace } from '../types'

const m = vi.hoisted(() => ({ headlines: vi.fn(), civil: vi.fn(), plants: vi.fn() }))
vi.mock('../services/news', () => ({ fetchPlaceHeadlines: m.headlines }))
vi.mock('../services/civilFacilities', () => ({ fetchCivilFacilitiesAround: m.civil }))
vi.mock('../services/infrastructure', () => ({ fetchPowerPlantsNear: m.plants }))

const { usePlaceBrief } = await import('./usePlaceBrief')

const lyon: SelectedPlace = { name: 'Lyon', region: 'Auvergne-Rhône-Alpes', country: 'France', lat: 45.76, lng: 4.84 }
const fac = (id: string, lat: number) => ({ id, name: id, type: 'hospital', lat, lng: 4.84 })

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset()
  m.headlines.mockResolvedValue([])
  m.plants.mockResolvedValue([])
})

describe('usePlaceBrief', () => {
  it('sorts facilities nearest first and searches news by name and region', async () => {
    m.civil.mockResolvedValue([fac('far', 45.9), fac('near', 45.761), fac('mid', 45.8)])
    const { result } = renderHook(() => usePlaceBrief(lyon))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.civil.map(f => f.id)).toEqual(['near', 'mid', 'far'])
    expect(m.headlines).toHaveBeenCalledWith('Lyon', 'Auvergne-Rhône-Alpes')
  })

  it('a failed lookup leaves its list empty but still finishes loading', async () => {
    m.civil.mockRejectedValue(new Error('Overpass down'))
    const { result } = renderHook(() => usePlaceBrief(lyon))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.civil).toEqual([])
  })

  it('does not refetch when the same place arrives as a new object', async () => {
    m.civil.mockResolvedValue([])
    const { rerender, result } = renderHook(({ p }) => usePlaceBrief(p), { initialProps: { p: lyon } })
    await waitFor(() => expect(result.current.loading).toBe(false))
    rerender({ p: { ...lyon } })
    expect(m.civil).toHaveBeenCalledTimes(1)
  })
})
