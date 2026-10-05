import { describe, it, expect } from 'vitest'
import { classifyKeyEvent, summarizeKeyEvents } from './keyEvents'
import type { NewsArticle } from '../types'

const NOW = Date.parse('2026-10-04T12:00:00Z')
const art = (title: string, publishedAt = '2026-10-04T08:00:00Z'): NewsArticle =>
  ({ id: title, title, description: '', url: 'u', source: 's', publishedAt })

describe('classifyKeyEvent', () => {
  it.each([
    ['UN warns of famine as 2 million displaced', 'humanitarian'],
    ['Central bank raises interest rates again', 'economic'],
    ['Prime minister resigns after coup attempt', 'political'],
    ['Missile strike hits city overnight', 'other'],
  ])('%s -> %s', (title, expected) => expect(classifyKeyEvent(title)).toBe(expected))

  it('returns null for headlines with no high-impact signal', () => {
    expect(classifyKeyEvent('Ten recipes for a quiet weekend')).toBeNull()
  })
})

describe('summarizeKeyEvents', () => {
  it('counts per category, de-duplicates across outlets and ignores stale or undated items', () => {
    const s = summarizeKeyEvents([
      art('Central bank raises interest rates'),
      art('Central Bank raises interest rates!'),
      art('Prime minister resigns'),
      art('Old election result', '2026-09-20T00:00:00Z'),
      art('Famine declared', 'not a date'),
      art('Weekend recipes'),
    ], NOW)
    expect(s.total).toBe(2)
    expect(s.byCategory).toEqual({ political: 1, economic: 1, humanitarian: 0, other: 0 })
  })
})
