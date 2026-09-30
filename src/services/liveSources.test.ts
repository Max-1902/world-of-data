/** Network-backed services: caching, parsing and failure fallbacks (fetch is always mocked). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockFetch, jsonResponse, textResponse, quietConsole } from '../test/helpers'

beforeEach(() => { vi.useFakeTimers(); quietConsole() })
afterEach(() => vi.useRealTimers())

// Every service below caches at module level — reload for isolation.
async function load<T>(loader: () => Promise<T>): Promise<T> { vi.resetModules(); return loader() }

describe('UNHCR live population', () => {
  const item = (coa: string, name: string, o: Record<string, number> = {}) => ({ coa, coa_name: name, ...o })
  const loadMod = () => load(() => import('./unhcr'))

  it('aggregates rows per country of asylum, totals all four categories, and sorts by total', async () => {
    mockFetch(() => jsonResponse({ items: [
      item('TUR', 'Türkiye', { refugees: 100, asylum_seekers: 10 }),
      item('TUR', 'Türkiye', { refugees: 50, idps: 5, stateless: 1 }),
      item('DEU', 'Germany', { refugees: 500 }),
    ] }))
    const { fetchUNHCRPopulation } = await loadMod()
    const stats = await fetchUNHCRPopulation()
    expect(stats.map(s => [s.iso3, s.total])).toEqual([['DEU', 500], ['TUR', 166]])
    expect(stats[1]).toMatchObject({ refugees: 150, asylum_seekers: 10, idps: 5, stateless: 1, role: 'hosting' })
  })

  it('keeps only the top 20 countries', async () => {
    mockFetch(() => jsonResponse({ items: Array.from({ length: 40 }, (_, i) => item(`C${i}`, `Country ${i}`, { refugees: i + 1 })) }))
    const { fetchUNHCRPopulation } = await loadMod()
    const stats = await fetchUNHCRPopulation()
    expect(stats).toHaveLength(20)
    expect(stats[0].total).toBe(40)
  })

  it('skips rows with no country of asylum', async () => {
    mockFetch(() => jsonResponse({ items: [item('', 'Nowhere', { refugees: 999 }), item('DEU', 'Germany', { refugees: 1 })] }))
    const { fetchUNHCRPopulation } = await loadMod()
    expect((await fetchUNHCRPopulation()).map(s => s.iso3)).toEqual(['DEU'])
  })

  it('falls back to the static TOP_HOSTING table on HTTP errors, empty results, and network failure', async () => {
    const { fetchUNHCRPopulation, TOP_HOSTING } = await loadMod()
    mockFetch(() => jsonResponse({}, { status: 500 }))
    expect(await fetchUNHCRPopulation()).toBe(TOP_HOSTING)
    mockFetch(() => jsonResponse({ items: [] }))
    expect(await fetchUNHCRPopulation()).toBe(TOP_HOSTING)
    mockFetch(() => { throw new Error('offline') })
    expect(await fetchUNHCRPopulation()).toBe(TOP_HOSTING)
  })
})

describe('data centers (OSM Overpass)', () => {
  const el = (id: number, o: Record<string, unknown> = {}) => ({ type: 'node', id, lat: 50, lon: 8, tags: { name: `DC ${id}` }, ...o })
  const loadMod = () => load(() => import('./datacenters'))

  it('maps nodes and ways (using the centre point) to named points', async () => {
    mockFetch(() => jsonResponse({ elements: [
      el(1, { tags: { name: 'Frankfurt One', operator: 'Op', 'addr:country': 'DE', description: 'desc' } }),
      { type: 'way', id: 2, center: { lat: 1.5, lon: 2.5 }, tags: { operator: 'OnlyOp' } },
      { type: 'node', id: 3, lat: 3, lon: 4 },
    ] }))
    const { fetchDataCenters } = await loadMod()
    const pts = await fetchDataCenters()
    expect(pts[0]).toEqual({ id: 'osm-node-1', name: 'Frankfurt One', operator: 'Op', country: 'DE', lat: 50, lng: 8, notes: 'desc' })
    expect(pts[1]).toMatchObject({ id: 'osm-way-2', name: 'OnlyOp', lat: 1.5, lng: 2.5 })
    expect(pts[2].name).toBe('Unnamed Data Center')
  })

  it('drops elements without coordinates', async () => {
    mockFetch(() => jsonResponse({ elements: [el(1), { type: 'relation', id: 9, tags: {} }] }))
    const pts = await (await loadMod()).fetchDataCenters()
    expect(pts.map(p => p.id)).toEqual(['osm-node-1'])
  })

  it('fails over to the second Overpass endpoint', async () => {
    const urls: string[] = []
    mockFetch(url => { urls.push(url); return urls.length === 1 ? jsonResponse({}, { status: 504 }) : jsonResponse({ elements: [el(1)] }) })
    const pts = await (await loadMod()).fetchDataCenters()
    expect(urls).toHaveLength(2)
    expect(new Set(urls).size).toBe(2)
    expect(pts).toHaveLength(1)
  })

  it('throws when every endpoint fails, and does not cache the failure', async () => {
    const { fetchDataCenters } = await loadMod()
    mockFetch(() => jsonResponse({}, { status: 500 }))
    await expect(fetchDataCenters()).rejects.toThrow('Overpass HTTP 500')
    mockFetch(() => jsonResponse({ elements: [el(1)] }))
    expect(await fetchDataCenters()).toHaveLength(1)
  })

  it('caches results and shares one in-flight request', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ elements: [el(1)] }))
    const { fetchDataCenters } = await loadMod()
    await Promise.all([fetchDataCenters(), fetchDataCenters()])
    await fetchDataCenters()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('fetchDataCentersForCountry matches tagged country exactly or the name loosely', async () => {
    mockFetch(() => jsonResponse({ elements: [
      el(1, { tags: { name: 'Alpha', 'addr:country': 'Germany' } }),
      el(2, { tags: { name: 'Berlin Hub' } }),
      el(3, { tags: { name: 'Other', 'addr:country': 'France' } }),
    ] }))
    const { fetchDataCentersForCountry } = await loadMod()
    expect((await fetchDataCentersForCountry('germany')).map(p => p.id)).toEqual(['osm-node-1'])
    expect((await fetchDataCentersForCountry('berlin')).map(p => p.id)).toEqual(['osm-node-2'])
  })
})

describe('civil facilities (OSM Overpass)', () => {
  const loadMod = () => load(() => import('./civilFacilities'))
  const node = (id: number, amenity: string, extra: Record<string, unknown> = {}) => ({ type: 'node', id, lat: 10 + id, lon: 20 + id, tags: { amenity, name: `${amenity} ${id}` }, ...extra })

  it('returns [] without a network call for unknown country codes', async () => {
    const fetchMock = mockFetch()
    expect(await (await loadMod()).fetchCivilFacilities('ZZ')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('splits hospital/police results by amenity tag, and telecom from the second query', async () => {
    mockFetch((_u, init) => String(init!.body).includes('data_center')
      ? jsonResponse({ elements: [{ type: 'node', id: 30, lat: 1, lon: 2, tags: {} }] })
      : jsonResponse({ elements: [node(1, 'hospital'), node(2, 'police'), node(3, 'fire_station')] }))
    const list = await (await loadMod()).fetchCivilFacilities('de')
    expect(list.map(f => [f.type, f.id])).toEqual([['hospital', 'osm-node-1'], ['police', 'osm-node-2'], ['telecom', 'osm-node-30']])
    expect(list[2].name).toBe('Telecom facility') // fallback name when untagged
  })

  it('caps each type at limitPerType and drops elements with bad coordinates', async () => {
    mockFetch((_u, init) => String(init!.body).includes('data_center')
      ? jsonResponse({ elements: [] })
      : jsonResponse({ elements: [node(1, 'hospital'), node(2, 'hospital'), node(3, 'hospital'), { type: 'node', id: 4, tags: { amenity: 'hospital' } }] }))
    const list = await (await loadMod()).fetchCivilFacilities('DE', 2)
    expect(list).toHaveLength(2)
  })

  it('degrades gracefully when one sub-query fails, and caches the partial result', async () => {
    const fetchMock = mockFetch((_u, init) => String(init!.body).includes('data_center')
      ? jsonResponse({}, { status: 429 })
      : jsonResponse({ elements: [node(1, 'hospital')] }))
    const { fetchCivilFacilities } = await loadMod()
    expect(await fetchCivilFacilities('DE')).toHaveLength(1)
    await fetchCivilFacilities('DE')
    expect(fetchMock).toHaveBeenCalledTimes(2) // 2 sub-queries once, second call served from cache
  })

  it('does not cache when both sub-queries fail', async () => {
    const { fetchCivilFacilities } = await loadMod()
    const failing = mockFetch(() => jsonResponse({}, { status: 500 }))
    expect(await fetchCivilFacilities('DE')).toEqual([])
    expect(failing).toHaveBeenCalledTimes(2)
    const ok = mockFetch(() => jsonResponse({ elements: [node(1, 'hospital')] }))
    expect((await fetchCivilFacilities('DE')).length).toBeGreaterThan(0)
    expect(ok).toHaveBeenCalled()
  })

  it('sends a User-Agent (Overpass rejects requests without one)', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ elements: [] }))
    await (await loadMod()).fetchCivilFacilities('DE')
    const headers = fetchMock.mock.calls[0][1]!.headers as Record<string, string>
    expect(headers['User-Agent']).toBeTruthy()
  })
})

describe('emailrep lookup', () => {
  it('lower-cases and encodes the address, and returns the parsed body', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ email: 'a@b.com', reputation: 'high', suspicious: false }))
    const { lookupEmail } = await load(() => import('./osint'))
    const r = await lookupEmail('A+Tag@B.com')
    expect(r).toMatchObject({ reputation: 'high' })
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/emailrep/a%2Btag%40b.com')
  })
  it('returns null on rate limiting and network errors', async () => {
    const { lookupEmail } = await load(() => import('./osint'))
    mockFetch(() => jsonResponse({}, { status: 429 }))
    expect(await lookupEmail('a@b.com')).toBeNull()
    mockFetch(() => { throw new Error('offline') })
    expect(await lookupEmail('a@b.com')).toBeNull()
  })
})

describe('sanctions news (GDELT)', () => {
  it('returns articles, scoping the query to a country when given', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ articles: [{ title: 'T', url: 'u', domain: 'd', seendate: 's' }] }))
    const { fetchSanctionsNews } = await load(() => import('./sanctions'))
    expect(await fetchSanctionsNews('Iran')).toHaveLength(1)
    expect(decodeURIComponent(String(fetchMock.mock.calls[0][0]))).toContain('sanctions "Iran"')
    await fetchSanctionsNews()
    expect(decodeURIComponent(String(fetchMock.mock.calls[1][0]))).toContain('economic sanctions OFAC')
  })
  it('returns [] on failure or missing articles', async () => {
    const { fetchSanctionsNews } = await load(() => import('./sanctions'))
    mockFetch(() => jsonResponse({}))
    expect(await fetchSanctionsNews()).toEqual([])
    mockFetch(() => jsonResponse({}, { status: 500 }))
    expect(await fetchSanctionsNews()).toEqual([])
    mockFetch(() => { throw new Error('offline') })
    expect(await fetchSanctionsNews()).toEqual([])
  })
})

describe('resource rents (World Bank)', () => {
  const wb = (value: number | null, date = '2022') => jsonResponse([{}, [{ value: null, date: '2023' }, { value, date }]])

  it('collects the latest non-null value per rent indicator, skipping missing ones', async () => {
    mockFetch(url => url.includes('PETR') ? wb(12.5, '2021') : url.includes('MINR') ? wb(null) : jsonResponse({}, { status: 500 }))
    const { fetchResourceRents } = await load(() => import('./resources'))
    expect(await fetchResourceRents('sa')).toEqual([{ label: 'Oil rents (% of GDP)', value: 12.5, year: '2021' }])
  })

  it('upper-cases the country code and caches per country', async () => {
    const fetchMock = mockFetch(() => wb(1))
    const { fetchResourceRents } = await load(() => import('./resources'))
    await fetchResourceRents('sa')
    const calls = fetchMock.mock.calls.length
    expect(String(fetchMock.mock.calls[0][0])).toContain('/country/SA/')
    await fetchResourceRents('SA')
    expect(fetchMock.mock.calls.length).toBe(calls)
  })
})

describe('power plants (WRI GPPD)', () => {
  const HEADER = 'country,country_long,name,capacity_mw,latitude,longitude,primary_fuel'
  const csv = (...rows: string[]) => [HEADER, ...rows].join('\n')
  const loadMod = () => load(() => import('./infrastructure'))

  it('picks the top N per fuel type by capacity, mapping to infra point types', async () => {
    mockFetch(() => textResponse(csv(
      'DEU,Germany,Small Coal,100,50,8,Coal',
      'DEU,Germany,Big Coal,900,51,9,Coal',
      'FRA,France,Wind Farm,50,48,2,Wind',
      'FRA,France,Nuke,5000,47,1,Nuclear',   // not a mapped fuel — excluded
    )))
    const { fetchTopPowerPlants } = await loadMod()
    const pts = await fetchTopPowerPlants(1)
    expect(pts.map(p => [p.type, p.name, p.capacity])).toEqual([['power_coal', 'Big Coal', '900 MW'], ['power_wind', 'Wind Farm', '50 MW']])
    expect(pts.every(p => p.notes?.includes('WRI'))).toBe(true)
  })

  it('parses quoted CSV fields containing commas and escaped quotes', async () => {
    mockFetch(() => textResponse(csv('DEU,Germany,"Plant, with ""quotes""",300,50,8,Solar')))
    const [p] = await (await loadMod()).fetchTopPowerPlants()
    expect(p.name).toBe('Plant, with "quotes"')
    expect(p.type).toBe('power_solar')
  })

  it('skips rows with non-numeric coordinates or capacity and blank lines', async () => {
    mockFetch(() => textResponse(csv('DEU,Germany,NoLat,100,,8,Coal', 'DEU,Germany,NoCap,,50,8,Coal', '', 'DEU,Germany,Good,100,50,8,Coal') + '\n'))
    const pts = await (await loadMod()).fetchTopPowerPlants()
    expect(pts.map(p => p.name)).toEqual(['Good'])
  })

  it('fetchPowerPlantsForCountry matches names loosely, ranks by capacity, caps at 30, and labels unmapped fuels as grid', async () => {
    const rows = Array.from({ length: 40 }, (_, i) => `DEU,Germany,P${i},${i + 1},50,8,Coal`)
    mockFetch(() => textResponse(csv(...rows, 'FRA,France,Nuke,5000,47,1,Nuclear')))
    const { fetchPowerPlantsForCountry } = await loadMod()
    const de = await fetchPowerPlantsForCountry('germany')
    expect(de).toHaveLength(30)
    expect(de[0].name).toBe('P39')
    const fr = await fetchPowerPlantsForCountry('France')
    expect(fr[0]).toMatchObject({ name: 'Nuke', type: 'grid' })
  })

  it('throws on HTTP errors', async () => {
    const { fetchTopPowerPlants } = await loadMod()
    mockFetch(() => textResponse('', { status: 500 }))
    await expect(fetchTopPowerPlants()).rejects.toThrow('GPPD HTTP 500')
  })

  // KNOWN BUG: fetchGppd() never clears `gppdPromise` when the download rejects (unlike
  // datacenters.ts / militaryPersonnel.ts, which reset their in-flight promise in `finally`),
  // so one transient failure makes every later call re-throw until the page is reloaded.
  // Remove `.fails` once the rejected promise is cleared.
  it.fails('recovers on a later call after a failed download', async () => {
    const { fetchTopPowerPlants } = await loadMod()
    mockFetch(() => textResponse('', { status: 500 }))
    await expect(fetchTopPowerPlants()).rejects.toThrow('GPPD HTTP 500')
    mockFetch(() => textResponse(csv('DEU,Germany,A,1,1,1,Coal')))
    expect(await fetchTopPowerPlants()).toHaveLength(1)
  })

  it('downloads the dataset only once across calls', async () => {
    const fetchMock = mockFetch(() => textResponse(csv('DEU,Germany,A,1,1,1,Coal')))
    const { fetchTopPowerPlants, fetchPowerPlantsForCountry } = await loadMod()
    await Promise.all([fetchTopPowerPlants(), fetchPowerPlantsForCountry('Germany')])
    await fetchTopPowerPlants()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
