// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { CrisisEvent } from '../../types'

const m = vi.hoisted(() => ({
  rents: vi.fn(), crisisWatch: vi.fn(), dataCenters: vi.fn(),
  alerts: [] as unknown[], outages: [] as unknown[], radar: [] as unknown[], headlines: [] as unknown[],
}))
vi.mock('../../services/resources', async orig => ({ ...await orig<typeof import('../../services/resources')>(), fetchResourceRents: m.rents }))
vi.mock('../../services/news', async orig => ({ ...await orig<typeof import('../../services/news')>(), fetchAllCrisisWatch: m.crisisWatch }))
vi.mock('../../services/datacenters', () => ({ fetchDataCenters: m.dataCenters }))
vi.mock('../../hooks/useDisasterAlerts', () => ({ useDisasterAlerts: () => ({ alerts: m.alerts, loading: false }) }))
vi.mock('../../hooks/useOutages', () => ({ useOutages: () => ({ outages: m.outages, radarOutages: m.radar, loading: false }) }))
vi.mock('../../hooks/useCountryBrief', () => ({ useCountryBrief: () => ({ headlines: m.headlines, loading: false }) }))

import { ActivityMore, InfraMore, NewsMore, RiskMore, TradeMore } from './moreData'

const crisis = (id: string, country: string, over: Partial<CrisisEvent> = {}): CrisisEvent => ({
  id, title: `Event ${id}`, type: 'conflict', severity: 'high', latitude: 1, longitude: 1, country, date: '2026-10-20', description: '', source: 'ACLED', ...over,
})

beforeEach(() => {
  m.rents.mockReset().mockResolvedValue([{ label: 'Oil rents (% of GDP)', value: 12.3, year: '2022' }])
  m.crisisWatch.mockReset().mockResolvedValue([])
  m.dataCenters.mockReset().mockResolvedValue([])
  m.alerts = []; m.outages = []; m.radar = []; m.headlines = []
})

describe('TradeMore', () => {
  it('shows the sourced minerals, oil and gas, rents and ports held for the country', async () => {
    render(<TradeMore country="United States" iso2="US" />)
    expect(screen.getByText(/Minerals/)).toBeTruthy()
    expect(screen.getByText(/USGS Mineral Commodity Summaries/)).toBeTruthy()
    expect(screen.getByText(/CIA World Factbook/)).toBeTruthy()
    expect(await screen.findByText('Oil rents')).toBeTruthy()
    expect(screen.getByText(/^Ports$/)).toBeTruthy()
  })

  it('says so when the datasets have nothing for the country, instead of leaving a gap', async () => {
    m.rents.mockResolvedValue([])
    render(<TradeMore country="Nauru" iso2="NR" />)
    expect(screen.getByText(/No mineral profile for Nauru/)).toBeTruthy()
    expect(screen.getByText(/No oil or gas figures for Nauru/)).toBeTruthy()
    expect(await screen.findByText(/reports no resource rents for Nauru/)).toBeTruthy()
    expect(screen.getByText(/No major port for Nauru/)).toBeTruthy()
  })
})

describe('RiskMore', () => {
  it('lists every conflict event for the country, not only the first few, and its CrisisWatch entry', async () => {
    const crises = [...Array.from({ length: 9 }, (_, i) => crisis(`s${i}`, 'Sudan')), crisis('x', 'Chad')]
    m.crisisWatch.mockResolvedValue([
      { id: 'a', title: 'Sudan: fighting around El Fasher', url: 'https://crisisgroup.org/a', source: 'ICG', publishedAt: new Date().toISOString(), description: '', trend: 'deteriorated', region: 'Africa' },
      { id: 'b', title: 'Chad: calm', url: 'https://crisisgroup.org/b', source: 'ICG', publishedAt: new Date().toISOString(), description: '', trend: 'unchanged', region: 'Africa' },
    ])
    render(<RiskMore country="Sudan" crises={crises} />)
    expect(screen.getAllByText(/^Event s\d$/)).toHaveLength(9)
    expect(screen.queryByText('Event x')).toBeNull()
    expect(await screen.findByText(/El Fasher/)).toBeTruthy()
    expect(screen.queryByText(/Chad: calm/)).toBeNull()
  })

  it("does not claim 'none' when only the baseline is loaded", () => {
    render(<RiskMore country="Sudan" crises={[crisis('baseline-1', 'Sudan', { source: 'Baseline' })]} />)
    expect(screen.getByText(/Not measured/)).toBeTruthy()
  })
})

describe('InfraMore', () => {
  it('lists data centers tagged with the country and states how many cannot be assigned', async () => {
    m.dataCenters.mockResolvedValue([
      { id: '1', name: 'DE-CIX Frankfurt', operator: 'DE-CIX', country: 'DE', lat: 50, lng: 8 },
      { id: '2', name: 'Somewhere', country: 'FR', lat: 48, lng: 2 },
      { id: '3', name: 'Untagged', lat: 0.5, lng: 0.5 },
    ])
    render(<InfraMore country="Germany" iso2="DE" />)
    expect(await screen.findByText('DE-CIX Frankfurt')).toBeTruthy()
    expect(screen.queryByText('Somewhere')).toBeNull()
    expect(screen.getByText(/1 of 3 worldwide have no country tag/)).toBeTruthy()
  })

  it('states an outage rather than showing nothing', async () => {
    m.dataCenters.mockRejectedValue(new Error('down'))
    render(<InfraMore country="Germany" iso2="DE" />)
    expect(await screen.findByText(/could not be reached/)).toBeTruthy()
  })
})

describe('ActivityMore', () => {
  it('shows disaster alerts and outages for this country only', () => {
    m.alerts = [
      { id: 'g1', type: 'FL', name: 'Floods in Pakistan', country: 'Pakistan', alert: 'Orange', severityText: 'Flood', reportUrl: 'https://gdacs.org/1' },
      { id: 'g2', type: 'EQ', name: 'Quake in Chile', country: 'Chile', alert: 'Red', severityText: 'M7', reportUrl: 'https://gdacs.org/2' },
    ]
    m.outages = [{ id: 'o1', entityName: 'Pakistan', org: '', countryCode: 'PK', status: 'ongoing', dropPct: 40 }, { id: 'o2', entityName: 'Chile', org: '', countryCode: 'CL', status: 'ongoing', dropPct: 10 }]
    render(<ActivityMore country="Pakistan" iso2="PK" />)
    expect(screen.getByText(/Floods in Pakistan/)).toBeTruthy()
    expect(screen.queryByText(/Chile/)).toBeNull()
    expect(screen.getByText(/ongoing, 40% below baseline/)).toBeTruthy()
  })

  it('says when nothing is reported', () => {
    render(<ActivityMore country="Pakistan" iso2="PK" />)
    expect(screen.getByText(/No Orange or Red GDACS alert in Pakistan/)).toBeTruthy()
    expect(screen.getByText(/No outage reported for Pakistan/)).toBeTruthy()
  })
})

describe('NewsMore', () => {
  it('shows the headlines beyond the top five', () => {
    m.headlines = Array.from({ length: 9 }, (_, i) => ({ id: `h${i}`, title: `Germany headline number ${i}`, description: '', url: `https://x/${i}`, source: 'Src', publishedAt: new Date().toISOString() }))
    render(<NewsMore country="Germany" articles={[]} />)
    expect(screen.getAllByText(/Germany headline number/)).toHaveLength(4)
  })
})
