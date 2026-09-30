import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse, mockFetch } from '../test/helpers'
import snapshotRaw from '../../public/data/pipelines-trunk.geojson?raw'

type Mod = typeof import('./pipelines')
async function load(): Promise<Mod> {
  vi.resetModules()
  return import('./pipelines')
}

const way = (id: number, over: Record<string, unknown> = {}) => ({
  type: 'way', id,
  tags: { man_made: 'pipeline', substance: 'gas', 'name:en': 'Test Line', operator: 'Op', ...((over.tags as object) ?? {}) },
  geometry: [{ lat: 50, lon: 8 }, { lat: 50.1, lon: 8.1 }],
  ...over,
})

describe('committed world snapshot (public/data/pipelines-trunk.geojson)', () => {
  const fc = JSON.parse(snapshotRaw)

  it('is attributed to OpenStreetMap', () => {
    expect(fc.attribution).toMatch(/OpenStreetMap/)
  })

  it('has unique OSM ids, oil|gas substance and in-range coordinates', () => {
    const ids = fc.features.map((f: any) => f.properties.osm)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThan(100)
    for (const f of fc.features) {
      expect(f.properties.osm, 'osm ref').toMatch(/^relation\/\d+$/)
      expect(['oil', 'gas']).toContain(f.properties.substance)
      for (const line of f.geometry.coordinates) {
        expect(line.length).toBeGreaterThanOrEqual(2)
        for (const [lng, lat] of line) {
          expect(lng).toBeGreaterThanOrEqual(-180); expect(lng).toBeLessThanOrEqual(180)
          expect(lat).toBeGreaterThanOrEqual(-90);  expect(lat).toBeLessThanOrEqual(90)
          expect(lng === 0 && lat === 0, `${f.properties.osm} has a (0,0) point`).toBe(false)
        }
      }
    }
  })
})

describe('wayToFeature', () => {
  it('maps a tagged way to a coloured LineString', async () => {
    const { wayToFeature, PIPELINE_COLORS } = await load()
    const f = wayToFeature(way(7) as any)!
    expect(f.geometry).toEqual({ type: 'LineString', coordinates: [[8, 50], [8.1, 50.1]] })
    expect(f.properties).toMatchObject({ osm: 'way/7', name: 'Test Line', substance: 'gas', color: PIPELINE_COLORS.gas, operator: 'Op' })
  })

  it('rejects non-oil/gas, non-way, short and malformed geometry', async () => {
    const { wayToFeature } = await load()
    expect(wayToFeature(way(1, { tags: { substance: 'water' } }) as any)).toBeNull()
    expect(wayToFeature({ ...way(2), type: 'node' } as any)).toBeNull()
    expect(wayToFeature(way(3, { geometry: [{ lat: 1, lon: 1 }] }) as any)).toBeNull()
    expect(wayToFeature(way(4, { geometry: undefined }) as any)).toBeNull()
    expect(wayToFeature(way(5, { geometry: [{ lat: 'x', lon: 1 }, { lat: 2 }] }) as any)).toBeNull()
  })
})

describe('cellsForBounds', () => {
  it('covers the viewport with 0.5° cells, centre first, capped', async () => {
    const { cellsForBounds } = await load()
    const cells = cellsForBounds(8.1, 50.1, 9.4, 50.9)
    expect(cells.length).toBe(6)
    expect(new Set(cells.map(c => c.key)).size).toBe(cells.length)
    for (const c of cells) expect(c.north - c.south).toBeCloseTo(0.5)
    expect(cellsForBounds(-100, -60, 100, 60).length).toBeLessThanOrEqual(30)
  })

  it('stays inside valid lat/lng for a view past the poles or antimeridian', async () => {
    const { cellsForBounds } = await load()
    for (const c of cellsForBounds(170, 80, 190, 95)) {
      expect(c.north).toBeLessThanOrEqual(85.5)
      expect(c.east).toBeLessThanOrEqual(180.5)
    }
  })
})

describe('fetchPipelineCell', () => {
  beforeEach(() => vi.useRealTimers())
  const cell = { key: '1:1', south: 0.5, west: 0.5, north: 1, east: 1 }

  it('returns features, sends a bbox query, and caches by cell', async () => {
    const { fetchPipelineCell } = await load()
    const f = mockFetch(() => jsonResponse({ elements: [way(1), way(2, { tags: { substance: 'oil' } }), way(3, { tags: { substance: 'water' } })] }))
    const out = await fetchPipelineCell(cell)
    expect(out.map(x => x.properties.substance)).toEqual(['gas', 'oil'])
    expect(decodeURIComponent(String(f.mock.calls[0][1]?.body))).toContain('(0.5,0.5,1,1)')
    await fetchPipelineCell(cell)
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('dedupes concurrent requests for one cell', async () => {
    const { fetchPipelineCell } = await load()
    const f = mockFetch(() => jsonResponse({ elements: [way(1)] }))
    await Promise.all([fetchPipelineCell(cell), fetchPipelineCell(cell)])
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('falls back to the second endpoint on HTTP error', async () => {
    const { fetchPipelineCell } = await load()
    const f = mockFetch(url => url.includes('overpass-api.de') ? new Response('busy', { status: 504 }) : jsonResponse({ elements: [way(1)] }))
    expect(await fetchPipelineCell(cell)).toHaveLength(1)
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('returns [] on total failure and retries next time (not cached)', async () => {
    const { fetchPipelineCell } = await load()
    const f = mockFetch(() => { throw new Error('offline') })
    expect(await fetchPipelineCell(cell)).toEqual([])
    await fetchPipelineCell(cell)
    expect(f).toHaveBeenCalledTimes(4)
  })

  it('tolerates a payload with no elements', async () => {
    const { fetchPipelineCell } = await load()
    mockFetch(() => jsonResponse({ remark: 'runtime error' }))
    expect(await fetchPipelineCell(cell)).toEqual([])
  })
})

describe('fetchTrunkPipelines', () => {
  it('normalises features, drops non oil/gas, and caches', async () => {
    const { fetchTrunkPipelines, PIPELINE_COLORS } = await load()
    const line = { type: 'LineString', coordinates: [[1, 1], [2, 2]] }
    const f = mockFetch(() => jsonResponse({ type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: line, properties: { osm: 'relation/1', name: 'A', substance: 'oil' } },
      { type: 'Feature', geometry: line, properties: { substance: 'steam' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { substance: 'gas' } },
    ] }))
    const fc = await fetchTrunkPipelines()
    expect(fc.features).toHaveLength(1)
    expect((fc.features[0].properties as any).color).toBe(PIPELINE_COLORS.oil)
    await fetchTrunkPipelines()
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('returns an empty collection on HTTP error, malformed body or network failure, and retries', async () => {
    const { fetchTrunkPipelines } = await load()
    let n = 0
    const f = mockFetch(() => {
      n++
      if (n === 1) return new Response('nope', { status: 404 })
      if (n === 2) return jsonResponse({ nope: true })
      throw new Error('offline')
    })
    for (let i = 0; i < 3; i++) expect((await fetchTrunkPipelines()).features).toEqual([])
    expect(f).toHaveBeenCalledTimes(3)
  })
})
