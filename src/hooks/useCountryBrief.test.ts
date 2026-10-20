// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const m = vi.hoisted(() => ({ headlines: vi.fn(), profile: vi.fn(), econ: vi.fn() }))
vi.mock('../services/news', () => ({ fetchCountryHeadlines: m.headlines }))
vi.mock('../services/worldbank', () => ({ fetchCountryProfile: m.profile, fetchCountryEcon: m.econ }))

const { useCountryBrief } = await import('./useCountryBrief')

function deferred<T>() {
  let resolve!: (v: T) => void
  return { promise: new Promise<T>(r => { resolve = r }), resolve }
}

beforeEach(() => { for (const f of Object.values(m)) f.mockReset() })

describe('useCountryBrief', () => {
  it('is empty and idle without a country', () => {
    const { result } = renderHook(() => useCountryBrief(null))
    expect(result.current).toEqual({ headlines: [], profile: null, econ: null, loading: false })
    expect(m.headlines).not.toHaveBeenCalled()
  })

  it('fills in each lookup as it arrives and stops loading once all three settle, even if one fails', async () => {
    const h = deferred<unknown[]>()
    m.headlines.mockReturnValue(h.promise)
    m.profile.mockResolvedValue({ name: 'Chad' })
    m.econ.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useCountryBrief('Chad'))
    await waitFor(() => expect(result.current.profile).toEqual({ name: 'Chad' }))
    expect(result.current.loading).toBe(true)
    await act(async () => { h.resolve([{ id: 'a' }]); await h.promise })
    expect(result.current).toMatchObject({ headlines: [{ id: 'a' }], econ: null, loading: false })
  })

  it('drops results for a country that is no longer selected', async () => {
    const old = deferred<unknown>()
    m.headlines.mockResolvedValue([])
    m.econ.mockResolvedValue(null)
    m.profile.mockReturnValueOnce(old.promise).mockResolvedValue({ name: 'Mali' })
    const { result, rerender } = renderHook(({ c }) => useCountryBrief(c), { initialProps: { c: 'Chad' } })
    rerender({ c: 'Mali' })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { old.resolve({ name: 'Chad' }); await old.promise })
    expect(result.current.profile).toEqual({ name: 'Mali' })
  })
})
