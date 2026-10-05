import { describe, it, expect, vi } from 'vitest'
import { mockFetch, textResponse, jsonResponse } from '../test/helpers'

// powerGeneration.ts caches at module level — reload per test.
async function load() { vi.resetModules(); return import('./powerGeneration') }

const HEADER = 'entity,code,year,coal_generation__twh,gas_generation__twh,nuclear_generation__twh,hydro_generation__twh,solar_generation__twh,oil_generation__twh,wind_generation__twh,bioenergy_generation__twh,other_renewables_excluding_bioenergy_generation__twh'
const csv = (...rows: string[]) => [HEADER, ...rows].join('\n')

describe('parsePowerCsv', () => {
  it('ranks countries by total TWh using the latest year, and splits out low-carbon share', async () => {
    const { parsePowerCsv } = await load()
    const list = parsePowerCsv(csv(
      'France,FRA,2022,10,40,300,60,10,5,40,10,0',
      'France,FRA,2023,10,30,320,60,10,0,40,10,0',
      'Chad,TCD,2023,0,0,0,0,0,1,0,0,0',
      'Peru,PER,2023,0,20,0,30,2,1,3,0,0',
    ))
    expect(list.map(e => [e.rank, e.code, e.year])).toEqual([[1, 'FRA', 2023], [2, 'PER', 2023], [3, 'TCD', 2023]])
    expect(list[0].totalTwh).toBe(480)
    expect(list[0].bySource.nuclear).toBe(320)
    expect(list[0].lowCarbonPct).toBeCloseTo((1 - 40 / 480) * 100)
    expect(list[2].lowCarbonPct).toBe(0)
  })

  it('drops aggregates (no code, OWID_ codes) and rows without data', async () => {
    const { parsePowerCsv } = await load()
    const list = parsePowerCsv(csv(
      'World,OWID_WRL,2023,1,1,1,1,1,1,1,1,1', 'Asia (Ember),,2023,5,5,5,5,5,5,5,5,5',
      'Chad,TCD,2023,,,,,,,,,', 'Peru,PER,abc,1,1,1,1,1,1,1,1,1', 'Mali,MLI,2023,0,0,0,10,0,0,0,0,0',
    ))
    expect(list.map(e => e.code)).toEqual(['MLI'])
  })

  it('returns [] for empty input or when no known generation columns exist', async () => {
    const { parsePowerCsv } = await load()
    expect(parsePowerCsv('')).toEqual([])
    expect(parsePowerCsv('entity,code,year,foo\nChad,TCD,2023,5')).toEqual([])
  })
})

describe('fetchPowerGenerationRanking', () => {
  it('fetches once, shares in-flight requests and caches', async () => {
    const fetchMock = mockFetch(() => textResponse(csv('Peru,PER,2023,0,20,0,30,2,1,3,0,0')))
    const { fetchPowerGenerationRanking } = await load()
    const [a] = await Promise.all([fetchPowerGenerationRanking(), fetchPowerGenerationRanking()])
    await fetchPowerGenerationRanking()
    expect(a).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects on HTTP errors and recovers on the next call', async () => {
    const { fetchPowerGenerationRanking } = await load()
    mockFetch(() => jsonResponse({}, { status: 500 }))
    await expect(fetchPowerGenerationRanking()).rejects.toThrow('OWID API error 500')
    mockFetch(() => textResponse(csv('Peru,PER,2023,0,20,0,30,2,1,3,0,0')))
    expect(await fetchPowerGenerationRanking()).toHaveLength(1)
  })
})

describe('formatTwh', () => {
  it.each([[10583.4, '10,583 TWh'], [42.26, '42.3 TWh'], [0.01, '10 GWh']])('%s -> %s', async (n, out) => {
    expect((await load()).formatTwh(n)).toBe(out)
  })
})
