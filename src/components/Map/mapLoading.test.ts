// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { trackMapLoad, useMapLoadPending } from './mapLoading'

describe('trackMapLoad', () => {
  it('reports pending until every tracked fetch settles, resolved or rejected', async () => {
    const { result } = renderHook(() => useMapLoadPending())
    expect(result.current).toBe(false)
    let ok!: (v: number) => void, fail!: (e: Error) => void
    let a!: Promise<number>, b!: Promise<number>
    act(() => {
      a = trackMapLoad(new Promise<number>(r => { ok = r }))
      b = trackMapLoad(new Promise<number>((_, r) => { fail = r }))
    })
    expect(result.current).toBe(true)
    await act(async () => { ok(1); await a })
    expect(result.current).toBe(true)
    await act(async () => { fail(new Error('x')); await b.catch(() => {}) })
    expect(result.current).toBe(false)
  })
})
