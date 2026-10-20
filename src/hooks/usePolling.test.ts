// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePolling } from './usePolling'

function deferred<T>() {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const flush = () => act(async () => { await Promise.resolve() })

afterEach(() => { vi.useRealTimers() })

describe('usePolling', () => {
  it('loads on mount and on every interval', async () => {
    vi.useFakeTimers()
    let n = 0
    const fetcher = vi.fn(async () => ++n)
    const { result } = renderHook(() => usePolling(fetcher, { initial: 0, intervalMs: 1000 }))
    expect(result.current.loading).toBe(true)
    await flush()
    expect(result.current.data).toBe(1)
    expect(result.current.loading).toBe(false)
    expect(result.current.lastUpdated).toBeInstanceOf(Date)
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(result.current.data).toBe(2)
  })

  it('does nothing while disabled', async () => {
    const fetcher = vi.fn(async () => 1)
    const { result } = renderHook(() => usePolling(fetcher, { initial: 0, intervalMs: 1000, enabled: false }))
    await flush()
    expect(fetcher).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
    await act(() => result.current.refresh())
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('resets on disable and drops a response that lands afterwards', async () => {
    const d = deferred<string[]>()
    const { result, rerender } = renderHook(({ on }) => usePolling(() => d.promise, { initial: [] as string[], intervalMs: 1000, enabled: on }), { initialProps: { on: true } })
    rerender({ on: false })
    await act(async () => { d.resolve(['late']); await d.promise })
    expect(result.current.data).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('keeps the last good data and reports the error when a poll throws', async () => {
    let fail = false
    const { result } = renderHook(() => usePolling(async () => { if (fail) throw new Error('boom'); return 'ok' }, { initial: '', intervalMs: 1000 }))
    await flush()
    fail = true
    await act(() => result.current.refresh())
    expect(result.current.data).toBe('ok')
    expect(result.current.error).toContain('boom')
  })

  it('lets only the newest of two overlapping requests write', async () => {
    const first = deferred<string>(), second = deferred<string>()
    const queue = [first.promise, second.promise]
    const { result } = renderHook(() => usePolling(() => queue.shift()!, { initial: '', intervalMs: 60_000 }))
    let manual!: Promise<void>
    act(() => { manual = result.current.refresh() })
    await act(async () => { second.resolve('new'); await manual })
    await act(async () => { first.resolve('old'); await first.promise })
    expect(result.current.data).toBe('new')
  })

  it('skips interval ticks while a poll is still running', async () => {
    vi.useFakeTimers()
    const d = deferred<number>()
    const fetcher = vi.fn(() => d.promise)
    renderHook(() => usePolling(fetcher, { initial: 0, intervalMs: 1000 }))
    await act(async () => { await vi.advanceTimersByTimeAsync(3500) })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('reloads when the key changes', async () => {
    const fetcher = vi.fn(async () => 1)
    const { rerender } = renderHook(({ k }) => usePolling(fetcher, { initial: 0, intervalMs: 60_000, key: k }), { initialProps: { k: 7 } })
    await flush()
    rerender({ k: 14 })
    await flush()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
