import { describe, it, expect } from 'vitest'
import { gfwFeatures, gfwPopupHtml, GFW_COLORS } from './darkVessels'
import type { GfwEvent } from '../../../services/gfw'

const ev = (o: Partial<GfwEvent> = {}): GfwEvent => ({
  id: '1', kind: 'gaps', start: Date.UTC(2026, 9, 10), end: Date.UTC(2026, 9, 11), lat: -10.1, lon: -80, durationHours: 30,
  vessel: { name: 'SEA <b>STAR</b>', flag: 'CHN', type: 'fishing', ssvid: '412' }, other: null, gapDistanceKm: 312.5, onPosition: null,
  encounterType: '', potentialRisk: false, highSeas: true, distanceFromShoreKm: 420, ...o,
})

describe('dark vessel layer', () => {
  it('builds one point per event, coloured by kind and risk, with ids unique across datasets', () => {
    const f = gfwFeatures([ev(), ev({ kind: 'encounters' }), ev({ id: '2', kind: 'encounters', potentialRisk: true })])
    expect(f.map(x => (x.geometry as GeoJSON.Point).coordinates)).toEqual([[-80, -10.1], [-80, -10.1], [-80, -10.1]])
    expect(f.map(x => x.properties!.color)).toEqual([GFW_COLORS.gap, GFW_COLORS.encounter, GFW_COLORS.risk])
    expect(new Set(f.map(x => x.properties!.id)).size).toBe(3)
  })

  it('AIS-off popup escapes feed text, gives the measurements, the caveat and the attribution', () => {
    const html = gfwPopupHtml(ev())
    expect(html).toContain('SEA &lt;b&gt;STAR&lt;/b&gt;')
    expect(html).not.toContain('<b>STAR</b>')
    expect(html).toContain('2026-10-10 00:00 UTC, for 30 h')
    expect(html).toContain('313 km (straight line)')
    expect(html).toContain('High seas, 420 km from shore')
    expect(html).toContain('not proof')
    expect(html).toContain('Powered by Global Fishing Watch')
  })

  it('encounter popup names both vessels and states what the risk flag does and does not cover', () => {
    const other = { name: 'REEFER', flag: 'PAN', type: 'carrier', ssvid: '' }
    expect(gfwPopupHtml(ev({ kind: 'encounters', other, encounterType: 'fishing-carrier', potentialRisk: true }))).toContain('potential risk')
    const unflagged = gfwPopupHtml(ev({ kind: 'encounters', other, highSeas: false }))
    expect(unflagged).toContain('REEFER · flag PAN · carrier')
    expect(unflagged).toContain('Inside a national EEZ')
    expect(unflagged).toContain('not checked')
  })
})
