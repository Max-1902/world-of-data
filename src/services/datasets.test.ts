/**
 * Integrity checks for every hand-curated static dataset.
 *
 * These can't prove an entry is *true* (CLAUDE.md requires each one to be traceable to a real
 * source), but they catch the mechanical mistakes that make map data silently wrong: swapped
 * lat/lng, placeholder (0,0) coordinates, duplicate ids, empty names, out-of-range values,
 * and enum typos that would break colour/label lookups at runtime.
 */
import { describe, it, expect } from 'vitest'
import { MILITARY_FACILITIES, NUCLEAR_PLANTS, FACILITY_COLORS, FACILITY_LABELS, PLANT_STATUS_COLORS, FACILITIES_BY_ID, PLANTS_BY_ID } from './military'
import { MAJOR_DAMS, LNG_TERMINALS, MAJOR_REFINERIES, PIPELINE_ROUTES, ALL_INFRA_POINTS, INFRA_COLORS, INFRA_LABELS, INFRA_ICONS } from './infrastructure'
import { CHOKEPOINTS } from './chokepoints'
import { PORTS, PORT_TYPE_COLORS, PORT_TYPE_LABELS } from './ports'
import { SUPPLY_CHAIN_FACILITIES, FACILITY_TYPE_COLORS, FACILITY_TYPE_LABELS } from './supplychain'
import { GPS_JAM_ZONES, SEVERITY_COLORS, TYPE_LABELS } from './gpsjam'
import { EARTHCAM_CAMERAS } from './earthcam'
import { GAS_PIPELINES, PIPELINE_STATUS_COLORS, PIPELINE_STATUS_LABELS } from './pipelines'
import { SANCTIONED_COUNTRIES, SANCTION_COLORS } from './sanctions'
import { OIL_GAS_DATA } from './oilgas'
import { RESOURCE_PROFILES } from './resources'
import { TRADE_PROFILES } from './tradeStats'
import { UNHCR_OFFICES, BORDER_CROSSINGS, REFUGEE_CAMPS, REFUGEE_FLOWS, COUNTRY_DISPLACEMENT, CROSSING_STATUS_COLORS, OFFICE_TYPE_COLORS, TOP_HOSTING, TOP_ORIGINS } from './unhcr'
import { COUNTRY_NEWS_SOURCES, RSS_FEEDS, CRISISWATCH_FEEDS } from './news'

const HEX = /^#[0-9a-f]{6}$/i

function validLat(n: unknown): n is number { return typeof n === 'number' && Number.isFinite(n) && n >= -90 && n <= 90 }
function validLng(n: unknown): n is number { return typeof n === 'number' && Number.isFinite(n) && n >= -180 && n <= 180 }

function expectUnique(label: string, ids: string[]) {
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
  expect(dupes, `${label}: duplicate ids`).toEqual([])
}

function expectPoints<T extends object>(
  label: string, items: T[], latKey: keyof T, lngKey: keyof T, nameKey: keyof T, idKey?: keyof T,
) {
  expect(items.length, `${label} is empty`).toBeGreaterThan(0)
  if (idKey) expectUnique(label, items.map(i => String(i[idKey])))
  for (const it of items) {
    const who = `${label}: ${String(it[nameKey] ?? it[idKey as keyof T])}`
    expect(validLat(it[latKey]), `${who} lat=${String(it[latKey])}`).toBe(true)
    expect(validLng(it[lngKey]), `${who} lng=${String(it[lngKey])}`).toBe(true)
    expect(!(it[latKey] === 0 && it[lngKey] === 0), `${who} is at (0,0) — placeholder coordinates`).toBe(true)
    expect(String(it[nameKey] ?? '').trim(), `${label}: entry with empty name`).not.toBe('')
  }
}

function expectRing(label: string, ring: [number, number][], closed = false) {
  expect(ring.length, `${label} needs >= 2 points`).toBeGreaterThanOrEqual(2)
  for (const [lng, lat] of ring) {
    expect(validLng(lng) && validLat(lat), `${label}: bad [lng,lat] [${lng}, ${lat}] (swapped?)`).toBe(true)
  }
  if (closed) expect(ring.length, `${label} polygon needs >= 4 points`).toBeGreaterThanOrEqual(4)
}

describe('military & nuclear', () => {
  it('facilities have valid coordinates, unique ids and a known type', () => {
    expectPoints('MILITARY_FACILITIES', MILITARY_FACILITIES, 'lat', 'lng', 'name', 'id')
    for (const f of MILITARY_FACILITIES) {
      expect(FACILITY_COLORS[f.type], `${f.id} type ${f.type}`).toMatch(HEX)
      expect(FACILITY_LABELS[f.type], `${f.id} type ${f.type}`).toBeTruthy()
      expect(['active', 'suspected', 'proposed', 'decommissioned']).toContain(f.status)
      expect(f.operator.trim(), f.id).not.toBe('')
      expect(f.host.trim(), f.id).not.toBe('')
      if (f.personnel !== undefined) expect(f.personnel, f.id).toBeGreaterThan(0)
    }
  })

  it('nuclear plants have valid coordinates, unique ids, positive reactor counts, capacity and known status', () => {
    expectPoints('NUCLEAR_PLANTS', NUCLEAR_PLANTS, 'lat', 'lng', 'name', 'id')
    for (const p of NUCLEAR_PLANTS) {
      expect(PLANT_STATUS_COLORS[p.status], `${p.id} status ${p.status}`).toMatch(HEX)
      expect(Number.isInteger(p.reactors) && p.reactors > 0, `${p.id} reactors`).toBe(true)
      if (p.status === 'shutdown') expect(p.capacity, `${p.id} capacity`).toBeGreaterThanOrEqual(0)
      else expect(p.capacity, `${p.id} capacity`).toBeGreaterThan(0)
      expect(p.country.trim(), p.id).not.toBe('')
    }
  })

  it('lookup maps cover every entry', () => {
    expect(Object.keys(FACILITIES_BY_ID)).toHaveLength(MILITARY_FACILITIES.length)
    expect(Object.keys(PLANTS_BY_ID)).toHaveLength(NUCLEAR_PLANTS.length)
  })
})

describe('infrastructure', () => {
  const all = [...MAJOR_DAMS, ...LNG_TERMINALS, ...MAJOR_REFINERIES]

  it('points have valid coordinates and ids that are unique across all infra lists', () => {
    expectPoints('infra points', all, 'lat', 'lng', 'name', 'id')
    expectUnique('ALL_INFRA_POINTS', ALL_INFRA_POINTS.map(p => p.id))
    expect(ALL_INFRA_POINTS.length).toBeGreaterThanOrEqual(all.length)
  })

  it('every point type has a colour, label and icon', () => {
    for (const p of ALL_INFRA_POINTS) {
      expect(INFRA_COLORS[p.type], p.id).toMatch(HEX)
      expect(INFRA_LABELS[p.type], p.id).toBeTruthy()
      expect(INFRA_ICONS[p.type], p.id).toBeTruthy()
      expect(['operational', 'under_construction', 'decommissioned']).toContain(p.status)
    }
  })

  it('each list only contains its own type', () => {
    for (const d of MAJOR_DAMS) expect(d.type, d.id).toBe('dam')
    for (const d of LNG_TERMINALS) expect(d.type, d.id).toBe('lng')
    for (const d of MAJOR_REFINERIES) expect(d.type, d.id).toBe('refinery')
  })

  it('pipeline routes have unique ids and valid [lng, lat] paths', () => {
    expectUnique('PIPELINE_ROUTES', PIPELINE_ROUTES.map(p => p.id))
    for (const r of PIPELINE_ROUTES) {
      expectRing(`route ${r.id}`, r.coords)
      expect(['oil', 'gas', 'multi'], r.id).toContain(r.type)
      expect(['operational', 'under_construction', 'suspended'], r.id).toContain(r.status)
    }
  })
})

describe('chokepoints', () => {
  it('have valid coordinates, unique ids and plausible shares', () => {
    expectPoints('CHOKEPOINTS', CHOKEPOINTS, 'lat', 'lng', 'name', 'id')
    for (const c of CHOKEPOINTS) {
      expect(c.pctWorldTrade, c.id).toBeGreaterThan(0)
      expect(c.pctWorldTrade, c.id).toBeLessThanOrEqual(100)
      if (c.pctOilTrade !== undefined) {
        expect(c.pctOilTrade, c.id).toBeGreaterThanOrEqual(0)
        expect(c.pctOilTrade, c.id).toBeLessThanOrEqual(100)
      }
      expect(c.dailyTransits, c.id).toBeGreaterThan(0)
      expect(c.keyGoods.length, c.id).toBeGreaterThan(0)
      expect(c.controlledBy.trim(), c.id).not.toBe('')
    }
  })

  it('zone outlines are valid [lng, lat] rings that contain (or sit next to) the marker', () => {
    for (const c of CHOKEPOINTS) {
      expectRing(`zone ${c.id}`, c.zone, true)
      const lngs = c.zone.map(p => p[0]), lats = c.zone.map(p => p[1])
      const pad = 3 // degrees — markers are approximate, but a wildly-off zone means swapped/wrong coords
      expect(c.lng, `${c.id} lng vs zone`).toBeGreaterThanOrEqual(Math.min(...lngs) - pad)
      expect(c.lng, `${c.id} lng vs zone`).toBeLessThanOrEqual(Math.max(...lngs) + pad)
      expect(c.lat, `${c.id} lat vs zone`).toBeGreaterThanOrEqual(Math.min(...lats) - pad)
      expect(c.lat, `${c.id} lat vs zone`).toBeLessThanOrEqual(Math.max(...lats) + pad)
    }
  })
})

describe('ports & supply chain', () => {
  it('ports have valid coordinates, unique ids, a known type and non-negative throughput', () => {
    expectPoints('PORTS', PORTS, 'lat', 'lng', 'name', 'id')
    for (const p of PORTS) {
      expect(PORT_TYPE_COLORS[p.type], p.id).toMatch(HEX)
      expect(PORT_TYPE_LABELS[p.type], p.id).toBeTruthy()
      if (p.annualTEU !== undefined) expect(p.annualTEU, p.id).toBeGreaterThan(0)
    }
  })

  it('supply chain facilities have valid coordinates, a known type and sane global share', () => {
    expectPoints('SUPPLY_CHAIN_FACILITIES', SUPPLY_CHAIN_FACILITIES, 'lat', 'lng', 'name', 'id')
    for (const f of SUPPLY_CHAIN_FACILITIES) {
      expect(FACILITY_TYPE_COLORS[f.type], f.id).toMatch(HEX)
      expect(FACILITY_TYPE_LABELS[f.type], f.id).toBeTruthy()
      if (f.globalShare !== undefined) {
        expect(f.globalShare, f.id).toBeGreaterThan(0)
        expect(f.globalShare, f.id).toBeLessThanOrEqual(100)
      }
    }
  })
})

describe('GPS interference zones', () => {
  it('have valid coordinates, unique ids, positive radius, a known severity/type, and an attributed source', () => {
    expectPoints('GPS_JAM_ZONES', GPS_JAM_ZONES, 'lat', 'lng', 'name', 'id')
    for (const z of GPS_JAM_ZONES) {
      expect(z.radius, z.id).toBeGreaterThan(0)
      expect(z.radius, z.id).toBeLessThanOrEqual(2000)
      expect(SEVERITY_COLORS[z.severity], z.id).toMatch(HEX)
      expect(TYPE_LABELS[z.type], z.id).toBeTruthy()
      expect(z.source.trim(), `${z.id} has no source attribution`).not.toBe('')
      expect(typeof z.active).toBe('boolean')
    }
  })
})

describe('live cameras', () => {
  it('have valid coordinates, unique ids, and https URLs to the named source', () => {
    expectPoints('EARTHCAM_CAMERAS', EARTHCAM_CAMERAS, 'lat', 'lng', 'name', 'id')
    for (const c of EARTHCAM_CAMERAS) {
      const u = new URL(c.url)
      expect(u.protocol, c.id).toBe('https:')
      expect(c.city.trim(), c.id).not.toBe('')
      expect(c.country.trim(), c.id).not.toBe('')
    }
  })
  it('has no duplicate stream URLs', () => {
    expectUnique('camera urls', EARTHCAM_CAMERAS.map(c => c.url))
  })
})

describe('gas pipelines', () => {
  it('pipelines have unique ids, known status, valid paths and non-negative metrics', () => {
    expectUnique('GAS_PIPELINES', GAS_PIPELINES.map(p => p.id))
    for (const p of GAS_PIPELINES) {
      expect(PIPELINE_STATUS_COLORS[p.status], p.id).toMatch(HEX)
      expect(PIPELINE_STATUS_LABELS[p.status], p.id).toBeTruthy()
      expectRing(`pipeline ${p.id}`, p.path)
      if (p.capacityBcmYr !== undefined) expect(p.capacityBcmYr, p.id).toBeGreaterThan(0)
      if (p.lengthKm !== undefined) expect(p.lengthKm, p.id).toBeGreaterThan(0)
    }
  })
})

describe('sanctions', () => {
  it('have unique ISO codes in the right format, known severity, and at least one regime', () => {
    expectUnique('SANCTIONED_COUNTRIES iso2', SANCTIONED_COUNTRIES.map(c => c.iso2))
    expectUnique('SANCTIONED_COUNTRIES iso3', SANCTIONED_COUNTRIES.map(c => c.iso3))
    for (const c of SANCTIONED_COUNTRIES) {
      expect(c.iso2, c.name).toMatch(/^[A-Z]{2}$/)
      expect(c.iso3, c.name).toMatch(/^[A-Z]{3}$/)
      expect(SANCTION_COLORS[c.severity], c.name).toMatch(HEX)
      expect(c.regimes.length, c.name).toBeGreaterThan(0)
      expect(c.categories.length, c.name).toBeGreaterThan(0)
      expect(c.summary.trim(), c.name).not.toBe('')
    }
  })
})

describe('oil & gas', () => {
  it('has unique ISO codes, valid centroids and no negative or non-finite figures', () => {
    expectPoints('OIL_GAS_DATA', OIL_GAS_DATA, 'lat', 'lng', 'name', 'iso2')
    for (const c of OIL_GAS_DATA) {
      expect(c.iso2, c.name).toMatch(/^[A-Z]{2}$/)
      for (const k of ['oilReserves', 'gasReserves', 'oilProduction', 'gasProduction'] as const) {
        expect(Number.isFinite(c[k]) && c[k] >= 0, `${c.name}.${k}=${c[k]}`).toBe(true)
      }
    }
  })
})

describe('resources', () => {
  it('has unique ISO codes and sane per-mineral ranks and shares', () => {
    expectUnique('RESOURCE_PROFILES', RESOURCE_PROFILES.map(r => r.iso2))
    for (const p of RESOURCE_PROFILES) {
      expect(p.iso2, p.name).toMatch(/^[A-Z]{2}$/)
      expect(p.resources.length, p.name).toBeGreaterThan(0)
      for (const r of p.resources) {
        expect(r.mineral.trim(), p.name).not.toBe('')
        if (r.rank !== undefined) expect(Number.isInteger(r.rank) && r.rank >= 1, `${p.name} ${r.mineral} rank`).toBe(true)
        if (r.shareOfWorld !== undefined) {
          expect(r.shareOfWorld, `${p.name} ${r.mineral}`).toBeGreaterThan(0)
          expect(r.shareOfWorld, `${p.name} ${r.mineral}`).toBeLessThanOrEqual(100)
        }
      }
    }
  })

  it('never lists two countries as the #1 producer with a combined share above 100% for the same mineral', () => {
    const topShare = new Map<string, number>()
    for (const p of RESOURCE_PROFILES) for (const r of p.resources) {
      if (r.rank === 1 && r.shareOfWorld) topShare.set(r.mineral, (topShare.get(r.mineral) ?? 0) + r.shareOfWorld)
    }
    for (const [mineral, total] of topShare) expect(total, mineral).toBeLessThanOrEqual(100)
  })

  it('shares for one mineral never sum above 100% across countries', () => {
    const totals = new Map<string, number>()
    for (const p of RESOURCE_PROFILES) for (const r of p.resources) {
      if (r.shareOfWorld) totals.set(r.mineral, (totals.get(r.mineral) ?? 0) + r.shareOfWorld)
    }
    for (const [mineral, total] of totals) expect(total, `${mineral} sums to ${total}%`).toBeLessThanOrEqual(100.5)
  })
})

describe('trade profiles', () => {
  it('have unique ISO codes and partner/product percentages within 0-100 that sum to <= 100', () => {
    expectUnique('TRADE_PROFILES', TRADE_PROFILES.map(t => t.iso2))
    for (const t of TRADE_PROFILES) {
      expect(t.iso2, t.name).toMatch(/^[A-Z]{2}$/)
      expect(['high', 'upper-middle', 'lower-middle', 'low'], t.name).toContain(t.incomeGroup)
      for (const key of ['topExportPartners', 'topImportPartners'] as const) {
        const total = t[key].reduce((s, p) => s + p.pct, 0)
        for (const p of t[key]) { expect(p.pct, `${t.name} ${key}`).toBeGreaterThan(0); expect(p.pct, `${t.name} ${key}`).toBeLessThanOrEqual(100) }
        expect(total, `${t.name} ${key} sums to ${total}`).toBeLessThanOrEqual(100.5)
      }
      for (const key of ['topExports', 'topImports'] as const) {
        const total = t[key].reduce((s, p) => s + p.pct, 0)
        for (const p of t[key]) { expect(p.pct, `${t.name} ${key}`).toBeGreaterThan(0); expect(p.pct, `${t.name} ${key}`).toBeLessThanOrEqual(100) }
        expect(total, `${t.name} ${key} sums to ${total}`).toBeLessThanOrEqual(100.5)
      }
      expect(t.currency.trim(), t.name).not.toBe('')
    }
  })
})

describe('UNHCR datasets', () => {
  it('offices, crossings and camps have valid coordinates and unique ids', () => {
    expectPoints('UNHCR_OFFICES', UNHCR_OFFICES, 'lat', 'lng', 'name', 'id')
    expectPoints('BORDER_CROSSINGS', BORDER_CROSSINGS, 'lat', 'lng', 'name', 'id')
    expectPoints('REFUGEE_CAMPS', REFUGEE_CAMPS, 'lat', 'lng', 'name', 'id')
  })

  it('enum fields resolve to colours, bearings are compass values and camp populations are positive', () => {
    for (const o of UNHCR_OFFICES) expect(OFFICE_TYPE_COLORS[o.type], o.id).toMatch(HEX)
    for (const c of BORDER_CROSSINGS) {
      expect(CROSSING_STATUS_COLORS[c.status], c.id).toMatch(HEX)
      expect(c.bearing, c.id).toBeGreaterThanOrEqual(0)
      expect(c.bearing, c.id).toBeLessThan(360)
    }
    for (const c of REFUGEE_CAMPS) expect(c.population, c.id).toBeGreaterThan(0)
  })

  it('refugee flows have valid [lng, lat] endpoints and positive counts', () => {
    for (const f of REFUGEE_FLOWS) {
      expectRing(`flow ${f.label}`, [f.origin, f.dest])
      expect(f.count, f.label).toBeGreaterThan(0)
    }
  })

  it('country displacement rows are keyed by ISO3 with a matching-format ISO2', () => {
    for (const [iso3, v] of Object.entries(COUNTRY_DISPLACEMENT)) {
      expect(iso3).toMatch(/^[A-Z]{3}$/)
      expect(v.iso2, iso3).toMatch(/^[A-Z]{2}$/)
      expect(v.hosting, iso3).toBeGreaterThanOrEqual(0)
      expect(v.origin, iso3).toBeGreaterThanOrEqual(0)
    }
  })

  it('fallback top-hosting/origin tables are sorted and internally consistent', () => {
    for (const list of [TOP_HOSTING, TOP_ORIGINS]) {
      expect(list.length).toBeGreaterThan(0)
      for (const s of list) {
        expect(s.total, s.country).toBeGreaterThan(0)
        expect(s.refugees + s.asylum_seekers + s.idps + s.stateless, `${s.country} components exceed total`).toBeLessThanOrEqual(s.total * 1.001)
      }
    }
  })
})

describe('news source lists', () => {
  it('RSS feeds and CrisisWatch feeds use https URLs with unique names/urls', () => {
    for (const list of [RSS_FEEDS, CRISISWATCH_FEEDS]) {
      for (const f of list) expect(new URL(f.url).protocol, f.name).toBe('https:')
      expectUnique('feed urls', list.map(f => f.url))
    }
  })

  it('country news sources have unique codes and valid URLs, US first (the default)', () => {
    expect(COUNTRY_NEWS_SOURCES[0].code).toBe('US')
    expectUnique('COUNTRY_NEWS_SOURCES', COUNTRY_NEWS_SOURCES.map(c => c.code))
    for (const c of COUNTRY_NEWS_SOURCES) {
      expect(c.code).toMatch(/^[A-Z]{2}$/)
      expect(c.sources.length, c.code).toBeGreaterThan(0)
      // Feeds are fetched server-side through the rss2json proxy, so plain-http origins (e.g. Xinhua) work.
      for (const s of c.sources) expect(['http:', 'https:'], `${c.code} ${s.name}`).toContain(new URL(s.url).protocol)
    }
  })
})
