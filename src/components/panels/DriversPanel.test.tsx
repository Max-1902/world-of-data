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
  it('never marks an exploratory candidate as scored', () => {
    expect(BACKTEST_ROWS.filter(r => r.exploratory).every(r => !r.passed)).toBe(true)
  })
})
