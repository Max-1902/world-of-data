// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MapLoadingOverlay, { LOADING_OVERLAY_DELAY_MS, LOADING_OVERLAY_MAX_MS } from './MapLoadingOverlay'

describe('MapLoadingOverlay', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('stays hidden for loads shorter than the delay', () => {
    const { rerender } = render(<MapLoadingOverlay busy />)
    act(() => { vi.advanceTimersByTime(LOADING_OVERLAY_DELAY_MS - 1) })
    rerender(<MapLoadingOverlay busy={false} />)
    act(() => { vi.advanceTimersByTime(LOADING_OVERLAY_DELAY_MS) })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('appears once a load passes the delay and hides when it ends', () => {
    const { rerender } = render(<MapLoadingOverlay busy />)
    act(() => { vi.advanceTimersByTime(LOADING_OVERLAY_DELAY_MS) })
    expect(screen.getByRole('status').textContent).toContain('Loading map data')
    rerender(<MapLoadingOverlay busy={false} />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('hides after the maximum time even if the load is still running', () => {
    render(<MapLoadingOverlay busy />)
    act(() => { vi.advanceTimersByTime(LOADING_OVERLAY_DELAY_MS) })
    expect(screen.getByRole('status')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(LOADING_OVERLAY_MAX_MS - 1) })
    expect(screen.getByRole('status')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.queryByRole('status')).toBeNull()
  })
})
