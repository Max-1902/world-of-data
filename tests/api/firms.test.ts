import { describe, it, expect } from 'vitest'
import handler, { ALLOWED_PATHS } from '../../api/firms/[...path]'
import { mockReq, mockRes, mockUpstream } from './helpers'

const FILE = [...ALLOWED_PATHS][0]

describe('FIRMS proxy (regression: existed only in the dev server, so production had no wildfire data)', () => {
  it('forwards the fixed FIRMS file and returns the CSV', async () => {
    const up = mockUpstream('latitude,longitude\n1,2\n', { headers: { 'Content-Type': 'text/csv' } })
    const r = mockRes()
    await handler(mockReq({ query: { path: FILE.split('/') } }), r.res)
    expect(up).toHaveBeenCalledWith(`https://firms.modaps.eosdis.nasa.gov/${FILE}`, expect.anything())
    expect(r.statusCode()).toBe(200)
    expect(r.body()).toBe('latitude,longitude\n1,2\n')
    expect(r.headers()['content-type']).toMatch(/text\/csv/)
  })

  it('accepts the "...path" key used by `vercel dev`', async () => {
    mockUpstream('x')
    const r = mockRes()
    await handler(mockReq({ query: { '...path': FILE } }), r.res)
    expect(r.statusCode()).toBe(200)
  })

  it('is not an open proxy: any other path is refused without an upstream call', async () => {
    const up = mockUpstream('x')
    for (const path of ['api/area/csv/KEY/VIIRS/world/1', '../etc/passwd', '', 'data/active_fire/other.csv']) {
      const r = mockRes()
      await handler(mockReq({ query: { path } }), r.res)
      expect(r.statusCode()).toBe(404)
    }
    expect(up).not.toHaveBeenCalled()
  })

  it('reports upstream failure as 502, not as an empty CSV', async () => {
    mockUpstream('down', { status: 503 })
    const r = mockRes()
    await handler(mockReq({ query: { path: FILE } }), r.res)
    expect(r.statusCode()).toBe(502)
  })

  it('GET only', async () => {
    const r = mockRes()
    await handler(mockReq({ method: 'POST', query: { path: FILE } }), r.res)
    expect(r.statusCode()).toBe(405)
  })
})
