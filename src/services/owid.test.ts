import { describe, it, expect, vi } from 'vitest'
import { OWID_CHARTS, TOPIC_LABELS, formatOwidValue } from './owid'
import { mockFetch, textResponse } from '../test/helpers'

// owid.ts caches responses and in-flight requests at module level — reload per test.
async function load() { vi.resetModules(); return import('./owid') }

const slug = OWID_CHARTS[0].slug
const csv = (...rows: string[]) => ['Entity,Code,Year,value', ...rows].join('\n')

describe('fetchOwidChart', () => {
  it('keeps the most recent year per country and sorts by value, descending', async () => {
    mockFetch(() => textResponse(csv('France,FRA,2019,10', 'France,FRA,2021,30', 'France,FRA,2020,99', 'Chad,TCD,2021,50', 'Peru,PER,2018,5')))
    const { fetchOwidChart } = await load()
    const chart = await fetchOwidChart(slug)
    expect(chart!.values).toEqual([
      { entity: 'Chad', code: 'TCD', year: 2021, value: 50 },
      { entity: 'France', code: 'FRA', year: 2021, value: 30 },
      { entity: 'Peru', code: 'PER', year: 2018, value: 5 },
    ])
  })

  it('excludes aggregate entities like "World" and rows without a country code', async () => {
    mockFetch(() => textResponse(csv('World,OWID_WRL,2021,1000', 'Asia,,2021,500', 'Europe,OWID_EUR,2021,400', 'Chad,TCD,2021,50')))
    const chart = await (await load()).fetchOwidChart(slug)
    expect(chart!.values.map(v => v.entity)).toEqual(['Chad'])
  })

  it('sums multiple numeric columns (e.g. one per energy source) and ignores non-numeric ones', async () => {
    mockFetch(() => textResponse(['Entity,Code,Year,coal,gas,region', 'Chad,TCD,2021,1,2.5,Africa', 'Peru,PER,2021,,4,Americas'].join('\n')))
    const chart = await (await load()).fetchOwidChart(slug)
    expect(chart!.values.find(v => v.entity === 'Chad')!.value).toBe(3.5)
    expect(chart!.values.find(v => v.entity === 'Peru')!.value).toBe(4)
  })

  it('skips rows with no numeric value or a non-numeric year', async () => {
    mockFetch(() => textResponse(csv('Chad,TCD,2021,', 'Peru,PER,abc,5', 'Mali,MLI,2020,7')))
    const chart = await (await load()).fetchOwidChart(slug)
    expect(chart!.values.map(v => v.entity)).toEqual(['Mali'])
  })

  it('returns an empty list for a header-only body', async () => {
    mockFetch(() => textResponse('Entity,Code,Year,value'))
    expect((await (await load()).fetchOwidChart(slug))!.values).toEqual([])
  })

  it('carries chart metadata from the catalogue', async () => {
    mockFetch(() => textResponse(csv('Chad,TCD,2021,1')))
    const chart = await (await load()).fetchOwidChart(slug)
    expect(chart).toMatchObject({ slug, label: OWID_CHARTS[0].label, topic: OWID_CHARTS[0].topic, unit: OWID_CHARTS[0].unit })
  })

  it('returns null for slugs not in the catalogue, without a network call', async () => {
    const fetchMock = mockFetch()
    expect(await (await load()).fetchOwidChart('not-a-chart')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null on HTTP errors and network failures', async () => {
    mockFetch(() => textResponse('x', { status: 500 }))
    expect(await (await load()).fetchOwidChart(slug)).toBeNull()
    mockFetch(() => { throw new Error('offline') })
    expect(await (await load()).fetchOwidChart(slug)).toBeNull()
  })

  it('serves repeat and concurrent requests from one network call', async () => {
    const fetchMock = mockFetch(() => textResponse(csv('Chad,TCD,2021,1')))
    const { fetchOwidChart } = await load()
    await Promise.all([fetchOwidChart(slug), fetchOwidChart(slug)])
    await fetchOwidChart(slug)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not cache failures', async () => {
    let fail = true
    const fetchMock = mockFetch(() => fail ? textResponse('x', { status: 500 }) : textResponse(csv('Chad,TCD,2021,1')))
    const { fetchOwidChart } = await load()
    expect(await fetchOwidChart(slug)).toBeNull()
    fail = false
    expect(await fetchOwidChart(slug)).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('fetchOwidTopic', () => {
  it('fetches every chart for the topic and drops failed ones', async () => {
    const topic = 'violence' as const
    const slugs = OWID_CHARTS.filter(c => c.topic === topic).map(c => c.slug)
    expect(slugs.length).toBeGreaterThan(1)
    mockFetch(url => url.includes(slugs[0]) ? textResponse('x', { status: 500 }) : textResponse(csv('Chad,TCD,2021,1')))
    const charts = await (await load()).fetchOwidTopic(topic)
    expect(charts.map(c => c.slug)).toEqual(slugs.slice(1))
  })
})

describe('OWID catalogue', () => {
  it('has unique slugs and a label for every topic in use', () => {
    expect(new Set(OWID_CHARTS.map(c => c.slug)).size).toBe(OWID_CHARTS.length)
    for (const c of OWID_CHARTS) expect(TOPIC_LABELS[c.topic], c.slug).toBeTruthy()
  })
})

describe('formatOwidValue', () => {
  it.each([
    ['%', 12.345, '12.3%'],
    ['TWh', 2_500_000_000, '2.50B'],
    ['deaths', 3_400_000, '3.4M'],
    ['deaths', 12_500, '12.5K'],
    ['index', 5.678, '5.68'],
    ['index', 42.4, '42'],
    ['index', 0, '0.00'],
  ])('%s %s -> %s', (unit, v, out) => {
    expect(formatOwidValue(unit, v)).toBe(out)
  })
})
