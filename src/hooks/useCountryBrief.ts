import { useEffect, useState } from 'react'
import { fetchCountryHeadlines } from '../services/news'
import { fetchCountryEcon, fetchCountryProfile, type CountryEconData, type CountryProfile } from '../services/worldbank'
import type { NewsArticle } from '../types'

export interface CountryBriefData {
  headlines: NewsArticle[]
  profile: CountryProfile | null
  econ: CountryEconData | null
  /** true until all three lookups have settled (each one fails soft to []/null) */
  loading: boolean
}

const EMPTY: CountryBriefData = { headlines: [], profile: null, econ: null, loading: false }

/** Live news + World Bank facts for one country. Results arrive independently; stale ones are dropped on switch. */
export function useCountryBrief(country: string | null | undefined): CountryBriefData {
  const [data, setData] = useState<CountryBriefData>(EMPTY)

  useEffect(() => {
    if (!country) { setData(EMPTY); return }
    let cancelled = false
    let pending = 3
    setData({ ...EMPTY, loading: true })
    const settle = () => { if (--pending === 0 && !cancelled) setData(d => ({ ...d, loading: false })) }
    const apply = <K extends 'headlines' | 'profile' | 'econ'>(key: K) => (value: CountryBriefData[K]) => {
      if (!cancelled) setData(d => ({ ...d, [key]: value }))
    }

    fetchCountryHeadlines(country).then(apply('headlines')).catch(() => {}).finally(settle)
    fetchCountryProfile(country).then(apply('profile')).catch(() => {}).finally(settle)
    fetchCountryEcon(country).then(apply('econ')).catch(() => {}).finally(settle)
    return () => { cancelled = true }
  }, [country])

  return data
}
