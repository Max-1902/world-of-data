// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DriversPanel from './DriversPanel'
import { BACKTEST_ROWS } from '../../data/predictorBacktest'

describe('DriversPanel', () => {
  it('reports the backtest verdict and its scope, one row per candidate', () => {
    render(<DriversPanel />)
    expect(screen.getByText(/0 of 6/)).toBeTruthy()
    for (const r of BACKTEST_ROWS) expect(screen.getByText(new RegExp(r.label))).toBeTruthy()
    expect(screen.getByText(/does not show that growth is unrelated/i)).toBeTruthy()
  })
  it('states the full pass rule, including the 1990–2009 period, and shows both periods per row', () => {
    render(<DriversPanel />)
    expect(screen.getByText(/To pass, all of these had to hold/)).toBeTruthy()
    expect(screen.getByText(/origin periods, 1990–2009 and 2010–2024/)).toBeTruthy()
    expect(screen.getByText('Error ratio 1990–2009, own / pooled')).toBeTruthy()
    // unemployment has no pre-2010 data, so it is shown as such rather than as a number
    expect(screen.getAllByText('no data').length).toBeGreaterThanOrEqual(2)
  })
  it('never marks an exploratory candidate as scored', () => {
    expect(BACKTEST_ROWS.filter(r => r.exploratory).every(r => !r.passed)).toBe(true)
  })
})
