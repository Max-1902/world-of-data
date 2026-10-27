// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ipGrowth } from '../../utils/nowcast'

const m = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../../services/eurostatNowcast', async orig => ({ ...await orig<typeof import('../../services/eurostatNowcast')>(), fetchNowcastData: m.fetch }))
import NowcastPanel from './NowcastPanel'

// synthetic: GDP growth tracks IP growth closely, so the model qualifies; IP is out for Jul–Aug 2026
function data(signal = true) {
  const ip = new Map<string, number>()
  let level = 100, s = 7
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5 }
  for (let y = 1995; y <= 2026; y++) for (let mo = 1; mo <= 12; mo++) {
    const k = `${y}-${String(mo).padStart(2, '0')}`
    if (k > '2026-08') break
    level *= 1 + rnd() * 0.03
    ip.set(k, level)
  }
  const gdp = new Map<string, number>()
  let g = 0.5
  for (let y = 1995; y <= 2026; y++) for (let n = 1; n <= 4; n++) {
    const q = `${y}-Q${n}`
    if (q > '2026-Q2') break
    const x = ipGrowth(ip, q, 3)
    if (x === null) continue
    g = signal ? 0.2 + 0.3 * x + rnd() * 0.05 : 0.97 * g + 0.015 + rnd() * 0.1
    gdp.set(q, g)
  }
  return { gdp, ip, updated: { gdp: '2026-10-26T23:00:00+0100', ip: '2026-10-27T11:00:00+0100' } }
}

describe('NowcastPanel', () => {
  beforeEach(() => m.fetch.mockReset())

  it('shows the nowcast as a statistical estimate with its range and the months it used', async () => {
    m.fetch.mockResolvedValue(data(true))
    render(<NowcastPanel />)
    expect(await screen.findByText('2026-Q3 nowcast')).toBeTruthy()
    const t = document.body.textContent!
    expect(t).toContain('Statistical')
    expect(t).toContain('2 of 3 months of industrial production (Jul 2026, Aug 2026)')
    expect(t).toMatch(/80% range [−+]?\d/)
    expect(t).toContain('it beat "same as last quarter" in both test periods')
    expect(screen.getAllByRole('row').length).toBeGreaterThan(3)
  })

  it('falls back to "same as last quarter" and says so when the model fails the rule', async () => {
    m.fetch.mockResolvedValue(data(false))
    render(<NowcastPanel />)
    expect(await screen.findByText(/the bridge model did not beat it in both test periods/)).toBeTruthy()
  })

  it('loads the economy picked, and offers a retry when Eurostat fails', async () => {
    m.fetch.mockRejectedValue(new Error('Eurostat HTTP 503'))
    render(<NowcastPanel />)
    expect((await screen.findByRole('alert')).textContent).toContain('Eurostat HTTP 503')
    m.fetch.mockResolvedValue(data(true))
    fireEvent.change(screen.getByLabelText('Economy'), { target: { value: 'FR' } })
    expect(m.fetch).toHaveBeenLastCalledWith('FR')
    expect(await screen.findByText(/France: GDP growth this quarter/)).toBeTruthy()
  })
})
