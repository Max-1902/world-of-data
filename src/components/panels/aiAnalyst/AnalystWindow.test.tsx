// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Suspense, useState } from 'react'
import type { PanelProps } from '../../../panels/types'

// A stand-in analyst with its own state: if a move remounted it, the count would reset.
vi.mock('../AIAnalystPanel', () => ({
  AIAnalystPanel: () => {
    const [n, setN] = useState(0)
    return <button onClick={() => setN(v => v + 1)}>asked {n}</button>
  },
}))

const { AnalystWindowProvider, AnalystSlot, useAnalystWindow } = await import('./AnalystWindow')

const props = { crises: [], flights: [] } as unknown as PanelProps

function Controls() {
  const w = useAnalystWindow()!
  return (
    <div data-testid="controls">
      <span>mode {w.mode}</span>
      <button onClick={w.popOut}>pop</button>
      <button onClick={w.openWindow}>win</button>
    </div>
  )
}

function App({ slot = true }: { slot?: boolean }) {
  return (
    <AnalystWindowProvider panelProps={props}>
      <Controls />
      {slot && <div data-testid="dock"><AnalystSlot {...props} /></div>}
    </AnalystWindowProvider>
  )
}

/** A pop-up window backed by a second jsdom document. */
function fakeWindow() {
  const doc = document.implementation.createHTMLDocument('')
  const listeners: Record<string, (() => void)[]> = {}
  const w = {
    document: doc, closed: false,
    focus: vi.fn(),
    close: vi.fn(() => { w.closed = true }),
    addEventListener: (t: string, f: () => void) => { (listeners[t] ??= []).push(f) },
    removeEventListener: (t: string, f: () => void) => { listeners[t] = (listeners[t] ?? []).filter(g => g !== f) },
    fire: (t: string) => (listeners[t] ?? []).forEach(f => f()),
  }
  return w
}

/** testing-library needs a document with a window; the pop-up's document has none, so click natively. */
function clickIn(doc: Document, match: RegExp) {
  const el = [...doc.querySelectorAll('button')].find(b => match.test(b.textContent ?? ''))
  if (!el) throw new Error(`no button ${match}`)
  act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
}

beforeEach(() => { localStorage.clear() })
afterEach(() => { vi.restoreAllMocks() })

describe('AnalystWindow', () => {
  it('moves the same analyst between the dock and the floating window without losing its state', async () => {
    render(<App />)
    const dock = screen.getByTestId('dock')
    fireEvent.click(await within(dock).findByText('asked 0'))
    expect(within(dock).getByText('asked 1')).toBeTruthy()

    fireEvent.click(screen.getByText('pop'))
    const float = screen.getByRole('dialog', { name: 'Analyst (pop-out)' })
    expect(within(float).getByText('asked 1')).toBeTruthy()          // same instance, state kept
    expect(within(dock).queryByText(/asked/)).toBeNull()
    expect(within(dock).getByText('The analyst is open in a pop-out window')).toBeTruthy()
    expect(float.querySelector('.ai-host')!.classList.contains('ai-large')).toBe(true)

    fireEvent.click(within(float).getByText('asked 1'))
    fireEvent.click(within(float).getByRole('button', { name: /Dock/ }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(dock).getByText('asked 2')).toBeTruthy()
    expect(dock.querySelector('.ai-host')!.classList.contains('ai-large')).toBe(false)
  })

  it('keeps the analyst alive while its dock slot is not shown', async () => {
    const { rerender } = render(<App />)
    fireEvent.click(await screen.findByText('asked 0'))
    rerender(<App slot={false} />)       // e.g. the user switched to another workspace
    rerender(<App />)
    expect(within(screen.getByTestId('dock')).getByText('asked 1')).toBeTruthy()
  })

  it('scales pop-out text in steps and remembers the choice', async () => {
    render(<App />)
    await screen.findByText('asked 0')
    fireEvent.click(screen.getByText('pop'))
    const host = document.querySelector<HTMLElement>('.ai-host')!
    expect(screen.getByText('100%')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Larger text' }))
    fireEvent.click(screen.getByRole('button', { name: 'Larger text' }))
    expect(screen.getByText('130%')).toBeTruthy()
    expect(host.style.getPropertyValue('--ai-text')).toBe('1.3')
    expect(localStorage.getItem('ai-text-scale')).toBe('1.3')
  })

  it('opens a separate window with the dashboard styles, and docks back when it is closed', async () => {
    const style = document.createElement('style')
    style.textContent = '.ai-host { color: red }'
    document.head.append(style)
    const w = fakeWindow()
    vi.spyOn(window, 'open').mockReturnValue(w as unknown as Window)

    render(<App />)
    fireEvent.click(await screen.findByText('asked 0'))
    fireEvent.click(screen.getByText('win'))

    expect(screen.getByText('mode window')).toBeTruthy()
    expect(w.document.head.querySelector('style')?.textContent).toContain('.ai-host')
    const inWindow = within(w.document.body)
    expect(inWindow.getByText('asked 1')).toBeTruthy()                // moved, not remounted
    clickIn(w.document, /asked 1/)                                    // React events work in the other document
    expect(inWindow.getByText('asked 2')).toBeTruthy()

    act(() => { w.closed = true; w.fire('pagehide') })               // user closes the window
    expect(screen.getByText('mode dock')).toBeTruthy()
    expect(within(screen.getByTestId('dock')).getByText('asked 2')).toBeTruthy()
    style.remove()
  })

  it('closes the separate window when the analyst is docked from it', async () => {
    const w = fakeWindow()
    vi.spyOn(window, 'open').mockReturnValue(w as unknown as Window)
    render(<App />)
    await screen.findByText('asked 0')
    fireEvent.click(screen.getByText('win'))
    clickIn(w.document, /^ ?Dock$/)
    expect(w.close).toHaveBeenCalled()
    expect(within(screen.getByTestId('dock')).getByText('asked 0')).toBeTruthy()
  })

  it('falls back to the floating window when the browser blocks pop-ups', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    render(<App />)
    await screen.findByText('asked 0')
    fireEvent.click(screen.getByText('win'))
    const float = screen.getByRole('dialog', { name: 'Analyst (pop-out)' })
    expect(within(float).getByText(/blocked the separate window/)).toBeTruthy()
  })

  it('renders the analyst directly when there is no provider', async () => {
    render(<Suspense fallback={null}><AnalystSlot {...props} /></Suspense>)   // the dock's PanelHost supplies Suspense
    expect(await screen.findByText('asked 0')).toBeTruthy()
  })
})
