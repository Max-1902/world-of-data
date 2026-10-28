// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const useAnalystWindow = vi.fn()
vi.mock('../panels/aiAnalyst/AnalystWindow', () => ({ useAnalystWindow: () => useAnalystWindow() }))

const { AskAnalyst, offersAnalyst } = await import('./AskAnalyst')

describe('offersAnalyst', () => {
  it('is offered on the forecasts and shock-exposure banners only', () => {
    expect(offersAnalyst('analysis', 'forecasts')).toBe(true)
    expect(offersAnalyst('markets', 'exposure')).toBe(true)
    expect(offersAnalyst('analysis', 'ai')).toBe(false)
    expect(offersAnalyst('markets', 'trade')).toBe(false)
    expect(offersAnalyst('security', 'forecasts')).toBe(false)
  })
})

describe('AskAnalyst', () => {
  beforeEach(() => useAnalystWindow.mockReset())

  it('floats the analyst over the dashboard', () => {
    const popOut = vi.fn(), reveal = vi.fn()
    useAnalystWindow.mockReturnValue({ mode: 'dock', popOut, reveal })
    render(<AskAnalyst />)
    fireEvent.click(screen.getByRole('button', { name: /Ask the AI analyst/ }))
    expect(popOut).toHaveBeenCalledOnce()
    expect(reveal).not.toHaveBeenCalled()
  })

  it('brings a separate analyst window forward instead of pulling it back in', () => {
    const popOut = vi.fn(), reveal = vi.fn()
    useAnalystWindow.mockReturnValue({ mode: 'window', popOut, reveal })
    render(<AskAnalyst />)
    fireEvent.click(screen.getByRole('button', { name: /Ask the AI analyst/ }))
    expect(reveal).toHaveBeenCalledOnce()
    expect(popOut).not.toHaveBeenCalled()
  })

  it('renders nothing without the analyst provider', () => {
    useAnalystWindow.mockReturnValue(null)
    const { container } = render(<AskAnalyst />)
    expect(container.innerHTML).toBe('')
  })
})
