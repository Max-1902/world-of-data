// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AskAnalystButton, AskAnalystContext } from './AskAnalyst'

describe('AskAnalystButton', () => {
  it('is not drawn outside the app, where there is no analyst to open', () => {
    render(<AskAnalystButton draft="Explain X" />)
    expect(screen.queryByRole('button', { name: /Ask the analyst/ })).toBeNull()
  })

  it('hands its question to the app, and says nothing is sent', () => {
    const ask = vi.fn()
    render(<AskAnalystContext.Provider value={ask}><AskAnalystButton draft="Explain X" /></AskAnalystContext.Provider>)
    const btn = screen.getByRole('button', { name: /Ask the analyst/ })
    expect(btn.getAttribute('title')).toMatch(/Nothing is sent until you press Send/)
    fireEvent.click(btn)
    expect(ask).toHaveBeenCalledExactlyOnceWith('Explain X')
  })
})
