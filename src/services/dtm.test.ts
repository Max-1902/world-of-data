import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockFetch, jsonResponse, quietConsole } from '../test/helpers'
import { parseOperations, parseRegions } from './dtm'

const row = (o: Record<string, unknown>) => ({ admin0Name: 'Sudan', admin0Pcode: 'SDN', ...o })

describe('parseOperations', () => {
  it('keeps the latest round per operation with the previous one, summing split rows', () => {
    const ops = parseOperations([
      row({ operation: 'Sudan Mobility', reportingDate: '2026-08-01T00:00:00', roundNumber: 20, numPresentIdpInd: 6_000_000, displacementReason: 'Conflict' }),
      row({ operation: 'Sudan Mobility', reportingDate: '2026-08-01T00:00:00', roundNumber: 20, numPresentIdpInd: 500_000, displacementReason: 'Natural disaster' }),
      row({ operation: 'Sudan Mobility', reportingDate: '2026-05-01', roundNumber: 19, numPresentIdpInd: 7_000_000 }),
      row({ operation: 'Darfur Flash', reportingDate: '2026-09-15', numPresentIdpInd: '120000' }),
      row({ operation: '', reportingDate: '2026-09-15', numPresentIdpInd: 99 }),        // no operation
      row({ operation: 'Sudan Mobility', reportingDate: 'n/a', numPresentIdpInd: 99 }), // bad date
    ])
    expect(ops.map(o => o.operation)).toEqual(['Sudan Mobility', 'Darfur Flash'])
    expect(ops[0]).toMatchObject({ reportingDate: '2026-08-01', round: 20, idps: 6_500_000, prevDate: '2026-05-01', prevIdps: 7_000_000 })
    expect(ops[0].reasons).toEqual([{ reason: 'Conflict', idps: 6_000_000 }, { reason: 'Natural disaster', idps: 500_000 }])
    expect(ops[1]).toMatchObject({ idps: 120_000, prevIdps: null, round: null })
  })

  it('accepts PascalCase field names', () => {
    expect(parseOperations([{ Operation: 'X', ReportingDate: '2026-01-01', NumPresentIdpInd: 5 }])[0]).toMatchObject({ operation: 'X', idps: 5 })
  })
})

describe('parseRegions', () => {
  it('breaks down the given operation\'s latest round by admin1, largest first', () => {
    const out = parseRegions([
      row({ operation: 'Sudan Mobility', reportingDate: '2026-08-01', admin1Name: 'South Darfur', admin1Pcode: 'SD11', numPresentIdpInd: 900 }),
      row({ operation: 'Sudan Mobility', reportingDate: '2026-08-01', admin1Name: 'South Darfur', admin1Pcode: 'SD11', numPresentIdpInd: 100 }),
      row({ operation: 'Sudan Mobility', reportingDate: '2026-08-01', admin1Name: 'Kassala', admin1Pcode: 'SD05', numPresentIdpInd: 300 }),
      row({ operation: 'Sudan Mobility', reportingDate: '2026-05-01', admin1Name: 'Kassala', admin1Pcode: 'SD05', numPresentIdpInd: 99_999 }),
      row({ operation: 'Other', reportingDate: '2026-09-01', admin1Name: 'Kassala', numPresentIdpInd: 99_999 }),
    ], 'Sudan Mobility')
    expect(out).toEqual({ reportingDate: '2026-08-01', regions: [{ name: 'South Darfur', pcode: 'SD11', idps: 1000 }, { name: 'Kassala', pcode: 'SD05', idps: 300 }] })
  })
  it('returns null when the operation has no admin1 rows', () => {
    expect(parseRegions([], 'X')).toBeNull()
  })
})

describe('fetchDtm', () => {
  beforeEach(() => { quietConsole() })
  const load = async () => { vi.resetModules(); return import('./dtm') }
  const ok = (result: unknown) => jsonResponse({ isSuccess: true, result })

  it('asks the proxy for admin0 and admin1 by ISO3 and combines them', async () => {
    const fetchMock = mockFetch(url => url.includes('level=admin0')
      ? ok([row({ operation: 'M', reportingDate: '2026-08-01', numPresentIdpInd: 10 })])
      : ok([row({ operation: 'M', reportingDate: '2026-08-01', admin1Name: 'A', numPresentIdpInd: 10 })]))
    const { fetchDtm } = await load()
    const r = await fetchDtm('sdn')
    expect(fetchMock.mock.calls.map(c => String(c[0])).sort()).toEqual(['/api/dtm?level=admin0&iso3=SDN', '/api/dtm?level=admin1&iso3=SDN'])
    expect(r).toMatchObject({ status: 'ok', iso3: 'SDN', operations: [{ operation: 'M', idps: 10 }], regions: [{ name: 'A', idps: 10 }], regionsFrom: { operation: 'M' } })
  })

  it('reports a missing key as not_configured', async () => {
    mockFetch(() => jsonResponse({ error: { code: 'not_configured' } }, { status: 503 }))
    const { fetchDtm } = await load()
    expect(await fetchDtm('SDN')).toEqual({ status: 'not_configured' })
  })

  it('is ok with no operations for a country DTM does not cover', async () => {
    mockFetch(() => ok([]))
    const { fetchDtm } = await load()
    expect(await fetchDtm('DEU')).toMatchObject({ status: 'ok', operations: [], regions: [], regionsFrom: null })
  })

  it('turns HTTP errors, failure envelopes and network errors into an error result, uncached', async () => {
    const { fetchDtm } = await load()
    mockFetch(() => jsonResponse({ error: { message: 'quota' } }, { status: 429 }))
    expect(await fetchDtm('SDN')).toEqual({ status: 'error', message: 'IOM DTM returned HTTP 429: quota' })
    mockFetch(() => jsonResponse({ isSuccess: false, errorMessages: ['bad'] }))
    expect((await fetchDtm('SDN')).status).toBe('error')
    mockFetch(() => { throw new Error('offline') })
    expect(await fetchDtm('SDN')).toEqual({ status: 'error', message: 'offline' })
  })
})
