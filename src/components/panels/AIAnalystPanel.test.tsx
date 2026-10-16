// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { AgentOptions, AgentRun } from '../../services/aiAgent'
import type { ToolResult } from '../../services/aiTools'

const runAgent = vi.fn<(o: AgentOptions) => Promise<AgentRun>>()
const record = vi.fn()
vi.mock('../../services/aiAgent', async orig => ({ ...(await orig<typeof import('../../services/aiAgent')>()), runAgent: (o: AgentOptions) => runAgent(o) }))
vi.mock('../../services/aiRuns', () => ({ runLog: { record: (r: unknown) => record(r) }, downloadRuns: vi.fn() }))
vi.mock('../../services/stocks', async orig => ({ ...(await orig<typeof import('../../services/stocks')>()), fetchMultipleQuotes: async () => [] }))
vi.mock('../../hooks/useCountryAnalytics', () => ({ useCountryAnalytics: () => ({ analysis: null }) }))
vi.mock('../../services/openrouter', async orig => ({ ...(await orig<typeof import('../../services/openrouter')>()), fetchAllModels: () => Promise.reject(new Error('offline')) }))

const { AIAnalystPanel } = await import('./AIAnalystPanel')

const result: ToolResult = {
  id: 'R1', call: '[DATA:conflict]', tool: 'conflict', args: [], ok: true, at: Date.UTC(2026, 9, 16, 9),
  title: 'Conflict events by country', source: 'ACLED via the dashboard', text: 'Live events: 3 in 2 countries.',
  chart: { kind: 'rank', unit: 'events', items: [{ label: 'Sudan', value: 2, text: '2' }, { label: 'Chad', value: 1, text: '1' }] },
}

beforeEach(() => { runAgent.mockReset(); record.mockReset(); localStorage.clear() })

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

    await waitFor(() => expect(record).toHaveBeenCalled())
    expect(record.mock.calls[0][0]).toMatchObject({ outcome: 'ok', steps: 2, toolCalls: [{ id: 'R1', call: '[DATA:conflict]', ok: true }] })
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
})
