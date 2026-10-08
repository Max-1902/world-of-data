/**
 * Integrity checks for every hand-curated static dataset.
 *
 * These can't prove an entry is *true* (CLAUDE.md requires each one to be traceable to a real
 * source), but they catch the mechanical mistakes that make map data silently wrong: swapped
 * lat/lng, placeholder (0,0) coordinates, duplicate ids, empty names, out-of-range values,
 * and enum typos that would break colour/label lookups at runtime.
 */
import { describe, it, expect } from 'vitest'
import { MILITARY_FACILITIES, NUCLEAR_PLANTS, FACILITY_COLORS, FACILITY_LABELS, PLANT_STATUS_COLORS } from './military'
import { MAJOR_DAMS, LNG_TERMINALS, MAJOR_REFINERIES, ALL_INFRA_POINTS, INFRA_COLORS, INFRA_LABELS, INFRA_ICONS } from './infrastructure'
import { CHOKEPOINTS, oilSharePct } from './chokepoints'
import portwatch from '../data/chokepoints-portwatch.json'
import { PORTS, PORT_TYPE_COLORS, PORT_TYPE_LABELS } from './ports'
import { SUPPLY_CHAIN_FACILITIES, FACILITY_TYPE_COLORS, FACILITY_TYPE_LABELS } from './supplychain'
import { EARTHCAM_CAMERAS } from './earthcam'
import { US_WEBCAMS, registerUSWebcams } from './usWebcams'
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
})

describe('chokepoints', () => {
  it('have valid coordinates, unique ids, and a cited figure for every chokepoint', () => {
    expectPoints('CHOKEPOINTS', CHOKEPOINTS, 'lat', 'lng', 'name', 'id')
    for (const c of CHOKEPOINTS) {
      expect(c.transits ?? c.oilFlowMbd, `${c.id} has no cited figure`).toBeDefined()
      if (c.oilFlowMbd !== undefined) {
        expect(c.oilFlowMbd, c.id).toBeGreaterThan(0)
        expect(oilSharePct(c)!, c.id).toBeLessThanOrEqual(100)
      }
      if (c.transits) {
        expect(c.transits.avgDaily, c.id).toBeGreaterThan(0)
        expect(c.transits.year, c.id).toBeGreaterThanOrEqual(2024)
      }
      expect(c.controlledBy.trim(), c.id).not.toBe('')
    }
  })

  it('each marker sits near the PortWatch measurement point it takes transits from', () => {
    const rows = Object.values(portwatch.chokepoints)
    for (const c of CHOKEPOINTS) {
      if (!c.transits) continue
      const nearest = Math.min(...rows.map(r => Math.hypot(r.lat - c.lat, r.lng - c.lng)))
      expect(nearest, `${c.id} is ${nearest.toFixed(1)}° from any PortWatch chokepoint`).toBeLessThan(3)
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
      expect(f.source.trim().length, `${f.id} has no source`).toBeGreaterThan(10)
      expect(f.asOf, `${f.id} asOf`).toMatch(/^\d{4}-\d{2}$/)
      expect(FACILITY_TYPE_COLORS[f.type], f.id).toMatch(HEX)
      expect(FACILITY_TYPE_LABELS[f.type], f.id).toBeTruthy()
      if (f.globalShare !== undefined) {
        expect(f.globalShare, f.id).toBeGreaterThan(0)
        expect(f.globalShare, f.id).toBeLessThanOrEqual(100)
      }
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
  it('US webcam directory has valid coordinates, unique ids/urls, https URLs on the named source', () => {
    expectPoints('US_WEBCAMS', US_WEBCAMS, 'lat', 'lng', 'label', 'id')
    expectUnique('US webcam urls', US_WEBCAMS.map(w => w.url))
    for (const w of US_WEBCAMS) {
      const host = new URL(w.url)
      expect(host.protocol, w.id).toBe('https:')
      expect(host.hostname, w.id).toContain(w.source === 'skyline' ? 'skylinewebcams.com' : 'earthcam.com')
    }
    expect(registerUSWebcams()).toHaveLength(US_WEBCAMS.length)
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
        // every shown figure carries the Factbook reference year; a missing one is 0, not a guess
        if (c[k] > 0) expect(c.years[k], `${c.name}.${k} has no year`).toBeGreaterThanOrEqual(2015)
        else expect(c.years[k], `${c.name}.${k}`).toBeUndefined()
      }
      // unit slips (e.g. million vs billion) would blow far past the world's largest holders
      expect(c.oilReserves, c.name).toBeLessThan(400)
      expect(c.gasReserves, c.name).toBeLessThan(60)
      expect(c.oilProduction, c.name).toBeLessThan(30)
      expect(c.gasProduction, c.name).toBeLessThan(1500)
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
      for (const s of c.sources) if (s.lang) expect(s.lang, `${c.code} ${s.name}`).toMatch(/^[a-z]{2}$/)
      expectUnique(`${c.code} source urls`, c.sources.map(s => s.url))
    }
  })

  it('covers the countries requested for local-press news (Poland first among them)', () => {
    const codes = COUNTRY_NEWS_SOURCES.map(c => c.code)
    for (const code of ['PL', 'IT', 'ES', 'NL', 'SE', 'TR', 'MX', 'KR', 'NG']) expect(codes).toContain(code)
    const pl = COUNTRY_NEWS_SOURCES.find(c => c.code === 'PL')!
    expect(pl.sources.some(s => s.lang === 'pl')).toBe(true)
  })
})
