import { describe, it, expect } from 'vitest'
import { extractPlaceCandidates, stripPublisher } from './placeExtract'

const names = (t: string) => extractPlaceCandidates(t).map(c => c.name)

describe('extractPlaceCandidates', () => {
  it('puts places introduced by a preposition first', () => {
    const c = extractPlaceCandidates('Explosion heard in Kharkiv as Russia warns Kyiv')
    expect(c[0]).toEqual({ name: 'Kharkiv', kind: 'prep' })
    expect(names('Explosion heard in Kharkiv as Russia warns Kyiv')).toEqual(expect.arrayContaining(['Russia', 'Kyiv']))
  })
  it('tries the whole run, then its words', () => {
    expect(names('Strike near Gaza City').slice(0, 2)).toEqual(['Gaza City', 'Gaza'])
  })
  it('skips sentence-start words, days, months and titles', () => {
    const n = names('Breaking: President Monday in March')
    expect(n).not.toContain('Breaking')
    expect(n).not.toContain('President')
    expect(n).not.toContain('Monday')
    expect(n).not.toContain('March')
  })
  it('expands country abbreviations', () => {
    expect(names('Tariffs hit US exports')).toContain('United States')
  })
  it('returns nothing for lowercase text and caps the list', () => {
    expect(names('nothing capitalised here')).toEqual([])
    expect(extractPlaceCandidates('Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa').length).toBeLessThanOrEqual(6)
  })
})

describe('publisher is not location', () => {
  it('ignores outlet names that contain a city', () => {
    expect(names('Washington Post reports strike on Odesa')).toEqual(expect.arrayContaining(['Odesa']))
    expect(names('Washington Post reports strike on Odesa')).not.toContain('Washington')
    expect(names('Kyiv Independent: blast in Kharkiv')).not.toContain('Kyiv')
    expect(names('Moscow Times says flood hit Sochi')).not.toContain('Moscow')
    expect(names('Report in The Jerusalem Post on Beirut')).not.toContain('Jerusalem')
  })
  it('ignores a wire dateline but keeps the place the story is about', () => {
    expect(names('LONDON (Reuters) - Earthquake strikes near Izmir')).not.toContain('London')
    expect(names('LONDON (Reuters) - Earthquake strikes near Izmir')).toContain('Izmir')
    expect(names('Tehran strike (AFP)')).toContain('Tehran')
    expect(names('Kyiv (Reuters) - Blast in Lviv')).not.toContain('Kyiv')
    expect(stripPublisher('WASHINGTON, D.C. (AP) — Flooding in Lagos')).not.toMatch(/Washington/i)
  })
  it('keeps a place name that merely starts like an outlet', () => {
    expect(names('Blast in New York Times Square')).toContain('York')
    expect(names('Protests across Daily Star Avenue in Dhaka')).toContain('Dhaka')
  })
  it('does not remove a real place that is not an outlet', () => {
    expect(names('Floods hit Washington state')).toContain('Washington')
  })
})
