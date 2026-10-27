import { describe, it, expect } from 'vitest'
import { exportSensitivity, SENS_FROM, SENS_MIN_N } from './sensitivity'

const years = (n: number, x0 = 1995) => Array.from({ length: n }, (_, i) => x0 + i)

describe('exportSensitivity', () => {
  it('recovers a known slope with an interval that contains it', () => {
    const ex = years(25).map((x, i) => ({ x, y: Math.sin(i * 1.3) * 6 }))
    const gdp = ex.map((p, i) => ({ x: p.x, y: 1 + 0.4 * p.y + (i % 3 - 1) * 0.2 }))
    const s = exportSensitivity(gdp, ex)!
    expect(s.slope).toBeCloseTo(0.4, 1)
    expect(s.ci[0]).toBeLessThan(0.4)
    expect(s.ci[1]).toBeGreaterThan(0.4)
    expect([s.from, s.to, s.n]).toEqual([1995, 2019, 25])
  })
  it(`uses only years from ${SENS_FROM} on and needs ${SENS_MIN_N} joint years`, () => {
    const ex = years(20, 1980).map((x, i) => ({ x, y: i }))
    const gdp = ex.map(p => ({ x: p.x, y: p.y * 0.5 }))
    expect(exportSensitivity(gdp, ex)).toBeNull()                        // only 9 years from 1991
    expect(exportSensitivity(gdp.slice(0, 5), ex)).toBeNull()            // no overlap after 1991
  })
})
