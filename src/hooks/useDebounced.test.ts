// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDebounced } from './useDebounced'

afterEach(() => { vi.useRealTimers() })

describe('useDebounced', () => {
  it('only settles once the value has been still for the delay', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ v }) => useDebounced(v, 600), { initialProps: { v: 'a' } })
    rerender({ v: 'ab' })
    act(() => { vi.advanceTimersByTime(400) })
    rerender({ v: 'abc' })
    act(() => { vi.advanceTimersByTime(400) })
    expect(result.current).toBe('a') // each keystroke restarts the wait
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current).toBe('abc')
  })
})
