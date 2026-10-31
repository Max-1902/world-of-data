// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { AgentOptions, AgentRun } from '../../services/aiAgent'
import type { ToolResult } from '../../services/aiTools'

const runAgent = vi.fn<(o: AgentOptions) => Promise<AgentRun>>()
vi.mock('../../services/aiAgent', async orig => ({ ...(await orig<typeof import('../../services/aiAgent')>()), runAgent: (o: AgentOptions) => runAgent(o) }))
vi.mock('../../services/stocks', async orig => ({ ...(await orig<typeof import('../../services/stocks')>()), fetchMultipleQuotes: async () => [] }))
vi.mock('../../hooks/useCountryAnalytics', () => ({ useCountryAnalytics: () => ({ analysis: null }) }))
const catalogue = vi.fn<() => Promise<unknown[]>>(() => Promise.reject(new Error('offline')))
const modelPolicy = vi.fn<() => Promise<{ all: boolean; extra: string[] } | null>>(() => Promise.resolve(null))
vi.mock('../../services/openrouter', async orig => ({
  ...(await orig<typeof import('../../services/openrouter')>()),
  fetchAllModels: () => catalogue(),
  fetchModelPolicy: () => modelPolicy(),
}))

const { AIAnalystPanel } = await import('./AIAnalystPanel')
const { setAnalystDraft } = await import('../../utils/analystDraft')

const result: ToolResult = {
  id: 'R1', call: '[DATA:conflict]', tool: 'conflict', args: [], ok: true, at: Date.UTC(2026, 9, 16, 9),
  title: 'Conflict events by country', source: 'ACLED via the dashboard', text: 'Live events: 3 in 2 countries.',
  chart: { kind: 'rank', unit: 'events', items: [{ label: 'Sudan', value: 2, text: '2' }, { label: 'Chad', value: 1, text: '1' }] },
}

beforeEach(() => {
  runAgent.mockReset(); localStorage.clear()
  catalogue.mockImplementation(() => Promise.reject(new Error('offline')))
  modelPolicy.mockImplementation(() => Promise.resolve(null))
})

describe('AIAnalystPanel model picker', () => {
  const m = (id: string, free = false) => ({ id, label: id, ctx: '8k', priceIn: free ? 0 : 3, priceOut: free ? 0 : 15, free, created: 1 })
  const offered = () => screen.getAllByRole('option').map(o => (o as HTMLOptionElement).value)

  it('offers only the models this deployment will accept', async () => {
    catalogue.mockResolvedValue([m('anthropic/claude-x'), m('openai/gpt-y'), m('qwen/q:free', true)])
    modelPolicy.mockResolvedValue({ all: false, extra: ['openai/gpt-y'] })
    render(<AIAnalystPanel crises={[]} flights={[]} />)
    await vi.waitFor(() => expect(offered()).toContain('openai/gpt-y'))
    expect(offered()).toEqual(expect.arrayContaining(['openai/gpt-y', 'qwen/q:free']))
    expect(offered()).not.toContain('anthropic/claude-x')
  })

  it('offers everything when every model is allowed, or when the allowance cannot be read', async () => {
    catalogue.mockResolvedValue([m('anthropic/claude-x'), m('qwen/q:free', true)])
    modelPolicy.mockResolvedValue({ all: true, extra: [] })
    const first = render(<AIAnalystPanel crises={[]} flights={[]} />)
    await vi.waitFor(() => expect(offered()).toContain('anthropic/claude-x'))
    first.unmount()
    modelPolicy.mockResolvedValue(null)
    render(<AIAnalystPanel crises={[]} flights={[]} />)
    await vi.waitFor(() => expect(offered()).toContain('anthropic/claude-x'))
  })
})

describe('AIAnalystPanel', () => {
  it('investigates with tools, shows the trail, and renders the answer with the chart it placed', async () => {
    runAgent.mockImplementation(async o => {
      o.onEvent?.({ type: 'step', step: 0 })
      o.onEvent?.({ type: 'tools', step: 0, calls: [{ tool: 'conflict', args: [], raw: '[DATA:conflict]' }] })
      o.onEvent?.({ type: 'result', step: 0, result })
      const answer = '## Bottom line\nSudan leads with 2 events [dashboard] (R1).\n[CHART:R1]\n| Country | Events |\n|---|---|\n| Sudan | 2 |'
      return { answer, answeredBy: o.model, transcript: o.messages, results: [result], steps: 2 }
    })
    render(<AIAnalystPanel crises={[]} flights={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Daily brief' }))

    await screen.findByText('Bottom line')
    const sent = runAgent.mock.calls[0][0]
    expect(sent.messages[0].content).toContain('INVESTIGATING WITH DATA TOOLS')
    expect(sent.messages[0].content).toContain('[DATA:series|')
    expect(screen.getByText('Investigated 1 dataset')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Conflict events by country' })).toBeTruthy() // the placed chart
    expect(screen.getByText('dashboard').className).toContain('ai-src-tag')
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.queryByText('Data behind this answer')).toBeNull() // the model placed a chart, so none is added

    // a reference opens the evidence: the exact text the model was given
    fireEvent.click(screen.getByRole('button', { name: 'R1' }))
    expect(screen.getByText('Live events: 3 in 2 countries.')).toBeTruthy()

  })

  it('adds the charts of the data used when the answer placed none', async () => {
    runAgent.mockResolvedValue({ answer: 'Sudan leads.', answeredBy: 'm', transcript: [], results: [result], steps: 2 })
    render(<AIAnalystPanel crises={[]} flights={[]} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Where is conflict worst?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByText('Data behind this answer')
    expect(screen.getByRole('heading', { name: 'Conflict events by country' })).toBeTruthy()
  })

  it('keeps the data gathered before a failure and shows the error', async () => {
    runAgent.mockImplementation(async o => {
      o.onEvent?.({ type: 'result', step: 0, result })
      throw new Error('Provider returned error')
    })
    render(<AIAnalystPanel crises={[]} flights={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Daily brief' }))
    await screen.findByText(/The model returned an error: Provider returned error/)
    expect(screen.getByText('Investigated 1 dataset')).toBeTruthy()
  })

  it('a question stopped by "New conversation" writes nothing into the new one', async () => {
    let fail!: (e: Error) => void
    runAgent.mockImplementation(o => new Promise((_, reject) => {
      o.onEvent?.({ type: 'result', step: 0, result })
      fail = reject
    }))
    render(<AIAnalystPanel crises={[]} flights={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Daily brief' }))
    await screen.findByText('Investigated 1 dataset')
    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }))
    await act(async () => fail(new DOMException('Aborted', 'AbortError')))
    expect(screen.queryByText('Investigated 1 dataset')).toBeNull()
    expect(screen.queryByText(/Stopped before the answer/)).toBeNull()
    expect(screen.getByText('What would you like to understand?')).toBeTruthy()
  })

  it('Enter while an answer is running keeps the typed question instead of clearing it unsent', async () => {
    runAgent.mockImplementation(() => new Promise(() => {}))
    render(<AIAnalystPanel crises={[]} flights={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Daily brief' }))
    await screen.findByRole('button', { name: 'Stop' })
    const box = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'And Chad?' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(box.value).toBe('And Chad?')
    expect(runAgent).toHaveBeenCalledTimes(1)
  })

  it('shows a question handed over by "Ask the analyst" in the input, unsent — whether it arrived before or after mounting', () => {
    setAnalystDraft('Explain the Brazil forecast')
    render(<AIAnalystPanel crises={[]} flights={[]} />)
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Explain the Brazil forecast')
    act(() => setAnalystDraft('Briefing on Chile'))
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Briefing on Chile')
    expect(runAgent).not.toHaveBeenCalled()
  })
})
