import { useEffect, useState } from 'react'
import { onFocusCountry } from '../utils/focusCountry'
import { fetchCountryDataset, fetchCountryList, type CountryDataset, type WbCountry } from '../services/countryLookup'
import { fetchEuropeData, isEurope, type EuropeData } from '../services/europeMacro'

const LS_KEY = 'country-lookup-iso2'
const DEFAULT_ISO2 = 'DE'

export type LoadStatus = 'loading' | 'ready' | 'error'

function loadIso(): string {
  try {
    const v = localStorage.getItem(LS_KEY)
    if (v && /^[A-Z0-9]{2}$/.test(v)) return v
  } catch { /* storage unavailable */ }
  return DEFAULT_ISO2
}

/**
 * Everything the Country Lookup workspace shows for one country: the World Bank economy list, the full World Bank
 * dataset for the selection, and — for European countries — the ECB / Eurostat / BIS bundle. A newer selection
 * discards a slower earlier response.
 */
export function useCountryLookup(forcedIso2?: string) {
  const [chosenIso2, setIso2State] = useState(loadIso)
  // a view that already knows its country (the country page) passes it in and leaves the stored choice alone
  const iso2 = forcedIso2 ?? chosenIso2
  // another view (the country page) can point this panel at a country while it is open
  useEffect(() => onFocusCountry('predictions', setIso2State), [])
  const [countries, setCountries] = useState<WbCountry[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [data, setData] = useState<CountryDataset | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [europe, setEurope] = useState<EuropeData | null>(null)
  const [europeStatus, setEuropeStatus] = useState<LoadStatus | 'none'>('none')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    fetchCountryList().then(c => { if (live) { setCountries(c); setListError(null) } }, e => { if (live) setListError(e instanceof Error ? e.message : String(e)) })
    return () => { live = false }
  }, [attempt])

  useEffect(() => {
    let live = true
    setStatus('loading'); setError(null)
    fetchCountryDataset(iso2).then(
      d => { if (live) { setData(d); setStatus('ready') } },
      e => { if (live) { setData(null); setStatus('error'); setError(e instanceof Error ? e.message : String(e)) } },
    )
    if (isEurope(iso2)) {
      setEuropeStatus('loading')
      fetchEuropeData(iso2).then(d => { if (live) { setEurope(d); setEuropeStatus('ready') } }, () => { if (live) { setEurope(null); setEuropeStatus('error') } })
    } else { setEurope(null); setEuropeStatus('none') }
    return () => { live = false }
  }, [iso2, attempt])

  const setIso2 = (v: string) => {
    if (forcedIso2) return
    setIso2State(v)
    try { localStorage.setItem(LS_KEY, v) } catch { /* storage unavailable */ }
  }

  return {
    iso2, setIso2, countries, listError,
    data: data?.iso2 === iso2 ? data : null, status, error,
    europe: europe?.iso2 === iso2 ? europe : null, europeStatus,
    retry: () => setAttempt(a => a + 1),
  }
}
