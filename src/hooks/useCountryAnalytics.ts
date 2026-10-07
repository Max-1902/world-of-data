import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { countryAnalytics, sliceOf } from '../services/countryAnalytics'
import { INDICATOR_BY_ID } from '../services/countryIndicators'
import { analyzePair, makeScale } from '../utils/countryStats'

/**
 * The shared country-comparison state plus the analysis for the current selection. `extra` lists further indicators to
 * load (e.g. for the correlation matrix); the two selected indicators are always loaded.
 */
export function useCountryAnalytics(enabled = true, extra: readonly string[] = []) {
  const state = useSyncExternalStore(countryAnalytics.subscribe, countryAnalytics.getState)
  const { x, y } = state.selection
  const extraKey = extra.join('|')
  useEffect(() => {
    if (!enabled) return
    void countryAnalytics.loadMany([x, y, ...extraKey.split('|').filter(Boolean)])
  }, [enabled, x, y, extraKey])

  const xMeta = INDICATOR_BY_ID.get(x)!
  const yMeta = INDICATOR_BY_ID.get(y)!
  const xs = useMemo(() => makeScale(xMeta.scale), [xMeta])
  const ys = useMemo(() => makeScale(yMeta.scale), [yMeta])
  const xSlice = sliceOf(state, x)
  const ySlice = sliceOf(state, y)
  const analysis = useMemo(
    () => xSlice.status === 'ready' && ySlice.status === 'ready' ? analyzePair(xSlice.rows, ySlice.rows, xs, ys) : null,
    [xSlice.status, xSlice.rows, ySlice.status, ySlice.rows, xs, ys],
  )

  return {
    state, xMeta, yMeta, xs, ys, xSlice, ySlice, analysis,
    setSelection: countryAnalytics.setSelection,
    setMapMode: countryAnalytics.setMapMode,
    reload: (id: string) => countryAnalytics.load(id, true),
  }
}
