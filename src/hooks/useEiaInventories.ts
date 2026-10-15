import { useEffect, useState } from 'react'
import { EIA_SERIES, fetchEiaSeries, type EiaResult } from '../services/eia'

/** All EIA inventory series, fetched in parallel; `null` per series while it loads. */
export function useEiaInventories(): { results: Record<string, EiaResult | null>; retry: () => void } {
  const [attempt, setAttempt] = useState(0)
  const [results, setResults] = useState<Record<string, EiaResult | null>>(() => Object.fromEntries(EIA_SERIES.map(s => [s.id, null])))
  useEffect(() => {
    let alive = true
    for (const s of EIA_SERIES) {
      fetchEiaSeries(s.id).then(r => { if (alive) setResults(prev => ({ ...prev, [s.id]: r })) })
    }
    return () => { alive = false }
  }, [attempt])
  return { results, retry: () => setAttempt(a => a + 1) }
}
