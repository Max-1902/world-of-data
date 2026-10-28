import { useEffect, useMemo, useState } from 'react'
import { fetchCountryList, fetchSeriesForCountries, type WbCountry } from '../services/countryLookup'
import { fetchWeo, type WeoPayload } from '../services/imfWeo'
import { focusCountry, onFocusCountry, storedFocus } from '../utils/focusCountry'
import { FLAGSHIP_SERIES, buildHomeForecast, type HomeForecastResult } from '../utils/homeForecast'
import type { Pt } from '../utils/econAnalysis'

const DEFAULT_ISO2 = 'DE'

type Load<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T }

/**
 * The home page's flagship forecast: real GDP growth for one country, from its own World Bank series, with the IMF's
 * figures beside it. The selected country is shared with the Predictions panel (utils/focusCountry.ts), so "open the
 * full forecast" lands on the same one.
 */
export function useHomeForecast() {
  const [iso2, setIso2] = useState(() => {
    const v = storedFocus('predictions')
    return v && /^[A-Z0-9]{2}$/.test(v) ? v : DEFAULT_ISO2
  })
  useEffect(() => onFocusCountry('predictions', setIso2), [])

  const [countries, setCountries] = useState<WbCountry[]>([])
  const [listFailed, setListFailed] = useState(false)
  useEffect(() => {
    let live = true
    fetchCountryList().then(c => { if (live) setCountries(c) }, () => { if (live) setListFailed(true) })
    return () => { live = false }
  }, [])

  const [series, setSeries] = useState<Load<{ iso2: string; points: Pt[] }>>({ status: 'loading' })
  useEffect(() => {
    let live = true
    setSeries({ status: 'loading' })
    fetchSeriesForCountries([iso2], FLAGSHIP_SERIES).then(
      r => { if (live) setSeries({ status: 'ready', data: { iso2, points: r[iso2]?.points ?? [] } }) },
      () => { if (live) setSeries({ status: 'error' }) },
    )
    return () => { live = false }
  }, [iso2])

  const [weo, setWeo] = useState<WeoPayload | null | 'loading'>('loading')
  useEffect(() => {
    let live = true
    void fetchWeo('NGDP_RPCH').then(d => { if (live) setWeo(d) })
    return () => { live = false }
  }, [])

  const country = countries.find(c => c.iso2 === iso2) ?? null
  const result: HomeForecastResult | null = useMemo(() => {
    // the IMF figures are matched by ISO3, so wait for the country list rather than record a forecast without them
    if (series.status !== 'ready' || series.data.iso2 !== iso2 || weo === 'loading' || !country) return null
    return buildHomeForecast(series.data.points, weo, country.iso3)
  }, [series, weo, iso2, country])

  return {
    iso2, country, countries, listFailed, weo,
    select: (code: string) => focusCountry('predictions', code),
    seriesStatus: series.status === 'ready' && series.data.iso2 !== iso2 ? 'loading' as const : series.status,
    points: series.status === 'ready' && series.data.iso2 === iso2 ? series.data.points : [],
    result,
  }
}
