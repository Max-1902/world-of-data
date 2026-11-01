import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DisasterAlert } from './gdacs'
import type { PriceSeries } from './priceHistory'

const alert = (o: Partial<DisasterAlert>): DisasterAlert => ({
  id: 'EQ-1-1', eventKey: 'EQ-1', type: 'EQ', name: 'Earthquake in Japan', country: 'Japan', alert: 'Orange', score: 1,
  latitude: 38, longitude: 142, from: '2011-03-11T05:46:23', to: '2011-03-12T00:00:00', reportUrl: '', severityText: '',
  source: 'USGS', affectedCountries: [], isCurrent: false, ...o,
})

/** Daily closes for ~3 years from 2009-01-02, flat drift, so a seeded drop is the only abnormal move. */
function prices(symbol: string, drops: Record<string, number> = {}): PriceSeries {
  const points: [number, number][] = []
  let c = 100
  for (let i = 0; i < 1100; i++) {
    const t = Date.UTC(2009, 0, 2) / 1000 + 13.5 * 3600 + i * 86_400
    const day = new Date(t * 1000).toISOString().slice(0, 10)
    c *= 1 + Math.sin(i * 1.7) * 0.004 + (drops[day] ?? 0)
    points.push([t, c])
  }
  return { symbol, name: symbol, points }
}

const gdacs = { loadDisasterAlerts: vi.fn(), loadAlertHistory: vi.fn() }
const priceHistory = { fetchPriceHistory: vi.fn() }

beforeEach(() => {
  vi.resetModules()
  vi.doMock('./gdacs', async (orig) => ({ ...(await orig<typeof import('./gdacs')>()), ...gdacs }))
  vi.doMock('./priceHistory', () => priceHistory)
  priceHistory.fetchPriceHistory.mockImplementation(async (s: string) =>
    s === 'EWJ' ? prices('EWJ', { '2011-03-14': -0.08, '2011-03-15': -0.06 }) : s === 'ACWI' || s === 'EWT' ? prices(s) : null)
})

describe('eventSeconds', () => {
  it('reads GDACS\'s zone-less timestamps as UTC', async () => {
    const { eventSeconds } = await import('./disasterMarkets')
    expect(eventSeconds('2011-03-11T05:46:23')).toBe(Date.UTC(2011, 2, 11, 5, 46, 23) / 1000)
    expect(eventSeconds('2011-03-11T05:46:23Z')).toBe(Date.UTC(2011, 2, 11, 5, 46, 23) / 1000)
    expect(eventSeconds('junk')).toBeNaN()
  })
})

describe('pairEvents', () => {
  it('maps affected countries to funds, one pair per fund, and explains alerts with none', async () => {
    const { pairEvents } = await import('./disasterMarkets')
    const { pairs, unmatched } = pairEvents([
      alert({ eventKey: 'TC-1', affectedCountries: ['Taiwan', 'Japan', 'Japan', 'Guam'] }),
      alert({ eventKey: 'EQ-2', country: 'Nepal', from: '2011-05-01T00:00:00' }),
      alert({ eventKey: 'EQ-3', country: '', from: '2011-05-02T00:00:00' }),
    ], false)
    expect(pairs.map(p => [p.event.eventKey, p.fund.symbol])).toEqual([['TC-1', 'EWT'], ['TC-1', 'EWJ']])
    expect(unmatched.map(u => u.reason)).toEqual(['no US-listed single-country fund for the affected countries', 'GDACS lists no affected country'])
  })
  it('folds later alerts on the same fund within 30 days into the first, keeping the Red one on a tie', async () => {
    const { pairEvents } = await import('./disasterMarkets')
    const { pairs } = pairEvents([
      alert({ eventKey: 'FL-1', name: 'Flood in Japan', alert: 'Orange' }),
      alert({ eventKey: 'EQ-1', name: 'Earthquake in Japan', alert: 'Red' }),
      alert({ eventKey: 'EQ-9', name: 'Aftershock', from: '2011-04-07T00:00:00' }),
      alert({ eventKey: 'EQ-10', name: 'Later quake', from: '2011-06-01T00:00:00' }),
    ], true)
    expect(pairs.map(p => [p.event.name, p.merged])).toEqual([
      ['Earthquake in Japan', ['Flood in Japan', 'Aftershock']],
      ['Later quake', []],
    ])
  })
})

describe('loadHistoricalReactions', () => {
  it('measures each fund against the benchmark and counts what it had to leave out', async () => {
    gdacs.loadAlertHistory.mockResolvedValue([
      alert({}),
      alert({ eventKey: 'EQ-5', country: 'Nepal', from: '2011-04-25T00:00:00' }),
      alert({ eventKey: 'EQ-6', country: 'Chile', from: '2011-05-01T00:00:00' }), // ECH prices fail to load
    ])
    const { loadHistoricalReactions } = await import('./disasterMarkets')
    const h = await loadHistoricalReactions(new Date(Date.UTC(2012, 0, 1)))
    expect(h.reactions).toHaveLength(1)
    const w = h.reactions[0].study.windows[5]!
    expect(w.car).toBeLessThan(-0.1)
    expect(w.extremeShare).toBeLessThan(0.05)
    expect(h).toMatchObject({ noFund: 1, noHistory: 1, folded: 0, fromYear: 2009 })
  })
  it('throws when the benchmark cannot be loaded, rather than reporting nothing', async () => {
    gdacs.loadAlertHistory.mockResolvedValue([alert({})])
    priceHistory.fetchPriceHistory.mockResolvedValue(null)
    const { loadHistoricalReactions } = await import('./disasterMarkets')
    await expect(loadHistoricalReactions()).rejects.toThrow('ACWI')
  })
  it('passes a GDACS failure through', async () => {
    gdacs.loadAlertHistory.mockRejectedValue(new Error('GDACS 503'))
    const { loadHistoricalReactions } = await import('./disasterMarkets')
    await expect(loadHistoricalReactions()).rejects.toThrow('GDACS 503')
  })
})

describe('loadRecentReactions', () => {
  it('keeps sudden-onset alerts, one per event, newest first', async () => {
    gdacs.loadDisasterAlerts.mockResolvedValue([
      alert({ id: 'EQ-1-2', from: '2011-03-12T00:00:00' }),
      alert({ id: 'EQ-1-1' }),
      alert({ id: 'DR-4-1', eventKey: 'DR-4', type: 'DR', from: '2011-03-01T00:00:00' }),
    ])
    const { loadRecentReactions } = await import('./disasterMarkets')
    const r = await loadRecentReactions()
    expect(r.reactions.map(x => x.event.id)).toEqual(['EQ-1-1'])
    expect(r.unmatched).toEqual([])
  })
})

describe('baseRates', () => {
  it('groups reactions and summarises only completed windows', async () => {
    gdacs.loadAlertHistory.mockResolvedValue([alert({}), alert({ eventKey: 'EQ-7', country: 'Taiwan', from: '2011-06-01T00:00:00' })])
    const { loadHistoricalReactions, baseRates } = await import('./disasterMarkets')
    const h = await loadHistoricalReactions(new Date(Date.UTC(2012, 0, 1)))
    const [g] = baseRates(h.reactions, r => ({ key: r.event.type, label: 'Earthquake' }))
    expect(g.byHorizon[5]).toMatchObject({ n: 2, unusual: 1 })
  })
})
