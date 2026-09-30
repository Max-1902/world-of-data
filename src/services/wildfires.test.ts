import { describe, it, expect } from 'vitest'
import { fetchWildfires } from './wildfires'
import { mockFetch, textResponse, quietConsole } from '../test/helpers'

const HEADER = 'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight'
const row = (o: { lat?: string; lng?: string; conf?: string; frp?: string; dn?: string } = {}) =>
  `${o.lat ?? '10.5'},${o.lng ?? '20.5'},330.1,0.4,0.4,2025-01-02,0130,N21,${o.conf ?? 'n'},2.0NRT,290.0,${o.frp ?? '5.5'},${o.dn ?? 'N'}`

describe('fetchWildfires', () => {
  it('parses CSV rows into fire points', async () => {
    quietConsole()
    mockFetch(() => textResponse([HEADER, row()].join('\n')))
    const [p] = await fetchWildfires()
    expect(p).toEqual({
      id: 'fire-1', latitude: 10.5, longitude: 20.5, brightness: 330.1, frp: 5.5,
      date: '2025-01-02', time: '0130', satellite: 'N21', confidence: 'nominal', daynight: 'N',
    })
  })

  it('normalises confidence values: high, low, and anything else is nominal', async () => {
    quietConsole()
    mockFetch(() => textResponse([HEADER, row({ conf: 'high' }), row({ conf: 'LOW' }), row({ conf: 'n' }), row({ conf: 'x' })].join('\n')))
    const pts = await fetchWildfires()
    expect(pts.map(p => p.confidence)).toEqual(['high', 'low', 'nominal', 'nominal'])
  })

  it('skips malformed rows (short rows, non-numeric coordinates) and treats bad FRP as 0', async () => {
    quietConsole()
    mockFetch(() => textResponse([
      HEADER,
      'only,three,cols',
      row().split(',').slice(0, 12).join(','), // 12 of 13 columns: must be skipped, not crash on the missing daynight field
      row({ lat: 'abc' }),
      row({ lng: '' }),
      row({ frp: 'oops' }),
    ].join('\n')))
    const pts = await fetchWildfires()
    expect(pts).toHaveLength(1)
    expect(pts[0].frp).toBe(0)
  })

  it('returns [] for a header-only or empty body', async () => {
    quietConsole()
    mockFetch(() => textResponse(HEADER))
    expect(await fetchWildfires()).toEqual([])
    mockFetch(() => textResponse(''))
    expect(await fetchWildfires()).toEqual([])
  })

  it('throws on a non-OK response so callers can surface the failure', async () => {
    mockFetch(() => textResponse('nope', { status: 500 }))
    await expect(fetchWildfires()).rejects.toThrow('FIRMS HTTP 500')
  })
})
