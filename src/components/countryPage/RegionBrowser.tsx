import { useEffect, useMemo, useState } from 'react'
import { fetchCountryList, type WbCountry } from '../../services/countryLookup'

/**
 * Browse every economy the World Bank reports on, grouped by its region. The grouping is the World Bank's own
 * classification (fetchCountryList), not ours; income group shows on hover.
 */
export default function RegionBrowser({ onPick }: { onPick: (country: string) => void }) {
  const [countries, setCountries] = useState<WbCountry[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    fetchCountryList().then(c => { if (live) setCountries(c) }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])

  const regions = useMemo(() => {
    const by = new Map<string, WbCountry[]>()
    for (const c of countries ?? []) by.set(c.region, [...(by.get(c.region) ?? []), c])
    return [...by.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [countries])

  if (failed) return <div className="viz-note" role="status">The country list could not be loaded, so regions are unavailable. Search still works if the World Bank is reachable.</div>
  if (!countries) return <div className="viz-note" role="status">Loading the country list…</div>
  return (
    <section aria-label="Browse by region" className="region-browser">
      <div className="viz-section"><h2>Browse by region</h2><span>{countries.length} economies</span></div>
      {regions.map(([region, list]) => (
        <details key={region}>
          <summary>{region} <span>{list.length}</span></summary>
          <div className="viz-chips">
            {list.map(c => <button key={c.iso3 || c.iso2} className="cy-btn" title={c.incomeLevel || undefined} onClick={() => onPick(c.name)}>{c.name}</button>)}
          </div>
        </details>
      ))}
      <div className="viz-foot">Regions and income groups: World Bank country classification.</div>
    </section>
  )
}
