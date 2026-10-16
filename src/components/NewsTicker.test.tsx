// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const { fetchTopHeadlines } = vi.hoisted(() => ({
  fetchTopHeadlines: vi.fn(async () => [{ id: '1', title: 'Unmoderated live headline', url: 'https://example.org/a', source: 'X', publishedAt: '2026-10-15T00:00:00Z', description: '' }]),
}))
vi.mock('../services/news', () => ({ fetchTopHeadlines }))

import NewsTicker from './NewsTicker'

describe('NewsTicker demo / screenshot mode', () => {
  it('shows no live headline and does not even fetch them', () => {
    render(<NewsTicker onClose={() => {}} demo />)
    expect(screen.getByRole('status').textContent).toMatch(/Live headlines hidden/)
    expect(screen.queryByText('Unmoderated live headline')).toBeNull()
    expect(fetchTopHeadlines).not.toHaveBeenCalled()
  })

  it('shows live headlines outside demo mode', async () => {
    render(<NewsTicker onClose={() => {}} demo={false} />)
    expect((await screen.findAllByText('Unmoderated live headline')).length).toBeGreaterThan(0)
  })
})
