import { describe, it, expect } from 'vitest'
import { stateMediaInfo, stateMediaTitle } from './stateMedia'
import { COUNTRY_NEWS_SOURCES, RSS_FEEDS } from './news'

describe('stateMediaInfo', () => {
  it('labels the state-owned outlets in the curated feed lists', () => {
    for (const name of ['RT', 'CGTN', 'Global Times', 'Xinhua', 'Tehran Times']) {
      expect(stateMediaInfo(name), name).not.toBeNull()
    }
  })

  it('matches edition suffixes and case-insensitively', () => {
    expect(stateMediaInfo('Al Jazeera English')?.country).toBe('Qatar')
    expect(stateMediaInfo('rt')?.country).toBe('Russia')
    expect(stateMediaInfo('Xinhua (EN)')?.country).toBe('China')
  })

  it('does not label public-service broadcasters or private outlets', () => {
    for (const name of ['BBC News', 'DW News', 'France 24', 'NHK World', 'CBC News', 'Daily Sabah', 'The Moscow Times', 'Reuters']) {
      expect(stateMediaInfo(name), name).toBeNull()
    }
  })

  it('returns null for missing names', () => {
    expect(stateMediaInfo(undefined)).toBeNull()
    expect(stateMediaInfo('')).toBeNull()
  })

  it('names the owning body in the tooltip', () => {
    expect(stateMediaTitle(stateMediaInfo('RT')!)).toMatch(/TV-Novosti/)
  })

  it('every curated feed from a labelled outlet is recognised', () => {
    const names = [...RSS_FEEDS.map(f => f.name), ...COUNTRY_NEWS_SOURCES.flatMap(c => c.sources.map(s => s.name))]
    const labelled = names.filter(n => stateMediaInfo(n))
    expect(labelled).toEqual(expect.arrayContaining(['RT', 'CGTN', 'Global Times', 'Xinhua', 'Tehran Times', 'Al Jazeera']))
  })
})
