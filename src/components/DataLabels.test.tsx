// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Metric, MetricRow, RankRow, StatusLabel } from './DataLabels'

describe('shared figures', () => {
  it('Metric shows label, evidence kind, value with unit, range and as-of in one block', () => {
    render(<Metric label="2026-Q3 nowcast" value="0.3" unit="%" range="80% range −0.1 to 0.7%" asOf="2 of 3 months known" evidence="statistical" />)
    const t = document.body.textContent!
    for (const part of ['2026-Q3 nowcast', 'Statistical', '0.3 %', '80% range −0.1 to 0.7%', '2 of 3 months known']) expect(t).toContain(part)
  })
  it('MetricRow flags a dated year the same way everywhere, and becomes a button only when clickable', () => {
    const onClick = vi.fn()
    const { rerender } = render(<MetricRow label="China" value="17.2%" year={2018} stale staleLabel="7 years old" />)
    expect(screen.getByTitle('7 years old').textContent).toBe('2018 ⚠')
    expect(screen.queryByRole('button')).toBeNull()
    rerender(<MetricRow label="China" value="17.2%" year={2025} onClick={onClick} title="Fly to China" />)
    fireEvent.click(screen.getByRole('button', { name: /China/ }))
    expect(onClick).toHaveBeenCalledOnce()
  })
  it('RankRow clamps its bar to 0–100% and shows rank, code, value and year', () => {
    const { container } = render(<RankRow rank={3} code="DE" name="Germany" share={1.7} value="180K" year={2020} />)
    expect(container.textContent).toBe('#3DEGermany180K2020')
    expect((container.querySelector('.dl-rank-bar > span') as HTMLElement).style.width).toBe('100%')
  })
  it('StatusLabel announces errors as alerts and the rest as status', () => {
    const { rerender } = render(<StatusLabel status="error">down</StatusLabel>)
    expect(screen.getByRole('alert').textContent).toBe('Unavailable down')
    rerender(<StatusLabel status="loading">World Bank…</StatusLabel>)
    expect(screen.getByRole('status').textContent).toBe('Loading World Bank…')
  })
})
