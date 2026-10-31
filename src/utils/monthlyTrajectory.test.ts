import { describe, it, expect } from 'vitest'
import { computeMonthlyTrajectories, conflictTrajectories, conflictWindow, monthlyBaseline, type UcdpSnapshot } from './monthlyTrajectory'
import { LIVE_WINDOW } from './trajectory'
import { resolveISO2 } from '../services/worldbank'
import committed from '../data/ucdp-candidate.json'
import type { CrisisEvent } from '../types'

const months = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']
const snap: UcdpSnapshot = {
  retrieved: '2026-10-30',
  months,
  countries: {
    Steady: { events: [40, 42, 38, 41, 39, 40, 41], clear: [40, 42, 38, 41, 39, 40, 41], deaths: [90, 90, 90, 90, 90, 90, 95] },
    Yemen: { events: [27, 32, 30, 25, 43, 30, 232], clear: [16, 16, 23, 17, 34, 20, 196], deaths: [50, 60, 55, 40, 80, 50, 610] },
    Quiet: { events: [0, 0, 0, 0, 0, 0, 0], clear: [0, 0, 0, 0, 0, 0, 0], deaths: [0, 0, 0, 0, 0, 0, 0] },
    'United States of America': { events: [1, 0, 2, 1, 0, 1, 1], clear: [1, 0, 2, 1, 0, 1, 1], deaths: [1, 0, 2, 1, 0, 1, 1] },
  },
}
const NOW = Date.parse('2026-10-30T12:00:00Z')

describe('computeMonthlyTrajectories', () => {
  it('ranks a surge against its own months first, flags it, and states month, deaths and review status', () => {
    const [top, ...rest] = computeMonthlyTrajectories(snap, { now: NOW })
    expect(top.country).toBe('Yemen')
    expect(top.trend).toBe('rising')
    expect(top.unusual).toBe('high')
    expect(top.window).toEqual({ source: 'UCDP Candidate Events', recent: 'September 2026', prior: 'the 6 months before' })
    expect(top.reason).toContain('232 events in September 2026 vs ~31 a month in the 6 months before')
    expect(top.reason).toContain('610 deaths (UCDP best estimate)')
    expect(top.reason).toContain('36 still under UCDP review')
    expect(top.baseline!.span).toBe('last 6 months')
    expect(rest.map(e => e.country)).not.toContain('Quiet')
  })

  it('reads an ordinary month of a steady conflict as flat and within its normal range', () => {
    const steady = computeMonthlyTrajectories(snap, { now: NOW, focusCountry: 'Steady' })[0]
    expect(steady.trend).toBe('flat')
    expect(steady.unusual).toBeNull()
    expect(steady.reason).toContain("within this country's normal range")
    expect(steady.reason).not.toContain('under UCDP review')
  })

  it('finds a focus country by its usual name, and says so plainly when UCDP recorded nothing', () => {
    expect(computeMonthlyTrajectories(snap, { now: NOW, focusCountry: 'United States' })[0].country).toBe('United States of America')
    const none = computeMonthlyTrajectories(snap, { now: NOW, focusCountry: 'Iceland' })[0]
    expect(none.reason).toBe('No lethal organised violence recorded by UCDP from March 2026 to September 2026')
    expect(none.recentCount).toBe(0)
  })

  it('needs two months to compare', () => {
    expect(computeMonthlyTrajectories({ ...snap, months: ['2026-09'] })).toEqual([])
  })

  it('treats a silent history as a low rate, not zero', () => {
    expect(monthlyBaseline([0, 0, 0], 1, 90).pHigh).toBeGreaterThan(0.01)
    expect(monthlyBaseline([0, 0, 0], 5, 90).pHigh).toBeLessThan(0.01)
  })
})

describe('conflictTrajectories', () => {
  const live: CrisisEvent = { id: 'a1', title: 'Clash', type: 'conflict', severity: 'high', latitude: 15, longitude: 32, country: 'Sudan', date: '2026-10-29', description: '', source: 'ACLED' }
  const marker: CrisisEvent = { ...live, id: 'baseline-sudan', source: 'Baseline' }

  it('uses the live 72h rule while ACLED returns current events', () => {
    const t = conflictTrajectories([live], { events: [live], capped: false }, { now: NOW, snapshot: snap })
    expect(t[0].country).toBe('Sudan')
    expect(t[0].window).toBeUndefined()
    expect(conflictWindow([live], { events: [live], capped: false }, snap)).toBe(LIVE_WINDOW)
  })

  it('falls back to UCDP when the feed is empty and only hand-entered markers remain', () => {
    const t = conflictTrajectories([marker], { events: [], capped: false }, { now: NOW, snapshot: snap })
    expect(t[0].window?.source).toBe('UCDP Candidate Events')
    expect(conflictWindow([marker], { events: [], capped: false }, snap).recent).toBe('September 2026')
  })
})

describe('committed UCDP snapshot', () => {
  it('has consecutive months, one value per month, cleared ≤ total, and names the app can match', () => {
    const s = committed as UcdpSnapshot
    expect(s.months.length).toBeGreaterThanOrEqual(2)
    s.months.slice(1).forEach((ym, i) => {
      const d = new Date(`${s.months[i]}-01T00:00:00Z`)
      d.setUTCMonth(d.getUTCMonth() + 1)
      expect(ym).toBe(d.toISOString().slice(0, 7))
    })
    for (const [name, c] of Object.entries(s.countries)) {
      expect([c.events.length, c.clear.length, c.deaths.length]).toEqual([s.months.length, s.months.length, s.months.length])
      c.events.forEach((n, i) => expect(c.clear[i]).toBeLessThanOrEqual(n))
      expect(resolveISO2(name), name).not.toBeNull()
    }
  })
})
