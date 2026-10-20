// @vitest-environment jsdom
/**
 * Panels that poll a live feed through usePolling: what they show, and that a slow answer for a previous
 * tab, country or query never replaces the current one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { NewsArticle, Stock } from '../../types'

const m = vi.hoisted(() => ({
  searchGDELTNews: vi.fn(), fetchSanctionsNews: vi.fn(), fetchCountryNews: vi.fn(), fetchAllCrisisWatch: vi.fn(), fetchMultipleQuotes: vi.fn(),
}))
vi.mock('../../services/news', async orig => ({ ...await orig<typeof import('../../services/news')>(), ...{
  searchGDELTNews: m.searchGDELTNews, fetchSanctionsNews: m.fetchSanctionsNews, fetchCountryNews: m.fetchCountryNews, fetchAllCrisisWatch: m.fetchAllCrisisWatch,
} }))
vi.mock('../../services/stocks', async orig => ({ ...await orig<typeof import('../../services/stocks')>(), fetchMultipleQuotes: m.fetchMultipleQuotes }))

const { DrugTrafficPanel, SanctionsPanel } = await import('./SecurityPanels')
const { NewsPanel, CrisisWatchPanel } = await import('./NewsPanels')
const { MarketsPanel } = await import('./MarketPanels')

function deferred<T>() {
  let resolve!: (v: T) => void
  return { promise: new Promise<T>(r => { resolve = r }), resolve }
}
const article = (title: string): NewsArticle => ({ id: title, title, description: '', url: `https://x/${encodeURIComponent(title)}`, source: 'Wire', publishedAt: '2026-10-16T08:00:00Z', lang: 'en' })
const quote = (symbol: string): Stock => ({ symbol, name: symbol, price: 101.5, change: 1, changePercent: 1, high: 0, low: 0, open: 0, previousClose: 0, currency: 'USD', exchange: 'NYSE', lastUpdated: '' })

beforeEach(() => { for (const f of Object.values(m)) f.mockReset() })
afterEach(() => { vi.useRealTimers() })

describe('DrugTrafficPanel', () => {
  it('regression: a slow answer for the previous tab never shows under the new one', async () => {
    const globalTab = deferred<NewsArticle[]>()
    m.searchGDELTNews.mockReturnValueOnce(globalTab.promise).mockResolvedValue([article('Cartel bust in Sinaloa')])
    render(<DrugTrafficPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'AMERICAS' }))
    await screen.findByText('Cartel bust in Sinaloa')
    await act(async () => { globalTab.resolve([article('Global seizure report')]); await globalTab.promise })
    expect(screen.queryByText('Global seizure report')).toBeNull()
    expect(m.searchGDELTNews).toHaveBeenLastCalledWith(expect.stringContaining('Mexico'))
  })

  it('shows the error the feed reported', async () => {
    m.searchGDELTNews.mockRejectedValue(new Error('rate limited'))
    render(<DrugTrafficPanel />)
    expect(await screen.findByText('// RATE LIMITED')).toBeTruthy()
  })
})

describe('SanctionsPanel news', () => {
  it('waits for typing to stop before searching GDELT, then searches once', async () => {
    vi.useFakeTimers()
    m.fetchSanctionsNews.mockResolvedValue([])
    render(<SanctionsPanel />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(m.fetchSanctionsNews).toHaveBeenCalledWith(undefined)
    const box = screen.getByPlaceholderText('Search country, regime…')
    for (const v of ['i', 'ir', 'ira', 'iran']) {
      fireEvent.change(box, { target: { value: v } })
      await act(async () => { await vi.advanceTimersByTimeAsync(200) })
    }
    expect(m.fetchSanctionsNews).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(600) })
    expect(m.fetchSanctionsNews.mock.calls).toEqual([[undefined], ['iran']])
  })
})

describe('NewsPanel', () => {
  it("regression: switching country never shows the previous country's articles", async () => {
    const us = deferred<NewsArticle[]>()
    m.fetchCountryNews.mockImplementation((code: string) => code === 'US' ? us.promise : Promise.resolve([article(`Story from ${code}`)]))
    const { container } = render(<NewsPanel />)
    const select = container.querySelector('select')!
    const other = [...select.options].find(o => o.value !== 'US')!.value
    fireEvent.change(select, { target: { value: other } })
    await screen.findByText(`Story from ${other}`)
    await act(async () => { us.resolve([article('Story from US')]); await us.promise })
    expect(screen.queryByText('Story from US')).toBeNull()
  })
})

describe('CrisisWatchPanel', () => {
  it('lists entries and counts them', async () => {
    m.fetchAllCrisisWatch.mockResolvedValue([{ ...article('Sudan: clashes escalated'), trend: 'deteriorated', region: 'Africa' }])
    render(<CrisisWatchPanel />)
    expect(await screen.findByText('Sudan: clashes escalated')).toBeTruthy()
  })

  it('a failed fetch shows the empty state', async () => {
    m.fetchAllCrisisWatch.mockRejectedValue(new Error('ICG down'))
    render(<CrisisWatchPanel />)
    expect(await screen.findByText('// NO ENTRIES MATCHED')).toBeTruthy()
  })
})

describe('MarketsPanel', () => {
  it('shows quotes for the selected sector', async () => {
    m.fetchMultipleQuotes.mockImplementation(async (syms: string[]) => syms.slice(0, 2).map(quote))
    render(<MarketsPanel />)
    expect(await screen.findByText('SPY')).toBeTruthy()
    expect(screen.getAllByText('$101.50')).toHaveLength(2)
  })

  it('offers a retry when the feed returns nothing, and the retry refetches', async () => {
    m.fetchMultipleQuotes.mockResolvedValueOnce([]).mockResolvedValue([quote('SPY')])
    render(<MarketsPanel />)
    fireEvent.click(await screen.findByText('↻ RETRY'))
    await waitFor(() => expect(screen.getByText('SPY')).toBeTruthy())
    expect(m.fetchMultipleQuotes).toHaveBeenCalledTimes(2)
  })
})
