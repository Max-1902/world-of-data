import { useEffect, useMemo, useState } from 'react'
import { fetchCountryList, type WbCountry } from '../../services/countryLookup'

/**
 * Browse every economy the World Bank reports on, grouped by its region, and narrow the list by name, region or
 * income group. Both groupings are the World Bank's own classification (fetchCountryList), not ours.
 */
const INCOME_ORDER = ['Low income', 'Lower middle income', 'Upper middle income', 'High income']
export default function RegionBrowser({ onPick }: { onPick: (country: string) => void }) {
  const [countries, setCountries] = useState<WbCountry[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    fetchCountryList().then(c => { if (live) setCountries(c) }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])

  const [text, setText] = useState('')
  const [region, setRegion] = useState('')
  const [income, setIncome] = useState('')
  const filtering = Boolean(text.trim() || region || income)

  const regionNames = useMemo(() => [...new Set((countries ?? []).map(c => c.region))].sort((a, b) => a.localeCompare(b)), [countries])
  const incomeNames = useMemo(() => {
    const found = new Set((countries ?? []).map(c => c.incomeLevel).filter(Boolean))
    return [...INCOME_ORDER.filter(i => found.has(i)), ...[...found].filter(i => !INCOME_ORDER.includes(i)).sort()]
  }, [countries])
  const shown = useMemo(() => {
    const q = text.trim().toLowerCase()
    return (countries ?? []).filter(c => (!q || c.name.toLowerCase().includes(q)) && (!region || c.region === region) && (!income || c.incomeLevel === income))
  }, [countries, text, region, income])
  const regions = useMemo(() => {
    const by = new Map<string, WbCountry[]>()
    for (const c of shown) by.set(c.region, [...(by.get(c.region) ?? []), c])
    return [...by.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [shown])

  if (failed) return <div className="viz-note" role="status">The country list could not be loaded, so regions are unavailable. Search still works if the World Bank is reachable.</div>
  if (!countries) return <div className="viz-note" role="status">Loading the country list…</div>
  return (
    <section aria-label="Browse by region" className="region-browser">
      <div className="viz-section"><h2>Browse by region</h2><span>{filtering ? `${shown.length} of ${countries.length}` : countries.length} economies</span></div>
      <div className="region-filters">
        <label>Name<input type="search" value={text} onChange={e => setText(e.target.value)} placeholder="Filter by name" /></label>
        <label>Region
          <select value={region} onChange={e => setRegion(e.target.value)}>
            <option value="">All regions</option>
            {regionNames.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label>Income group
          <select value={income} onChange={e => setIncome(e.target.value)}>
            <option value="">All income groups</option>
            {incomeNames.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </label>
        {filtering && <button className="cy-btn" onClick={() => { setText(''); setRegion(''); setIncome('') }}>Clear filters</button>}
      </div>
      <div className="sr-only" role="status">{filtering ? `${shown.length} economies match` : ''}</div>
      {filtering && !shown.length && <div className="viz-note">No economy matches these filters.</div>}
      {regions.map(([name, list]) => (
        <details key={name} open={filtering || undefined}>
          <summary>{name} <span>{list.length}</span></summary>
          <div className="viz-chips">
            {list.map(c => <button key={c.iso3 || c.iso2} className="cy-btn" title={c.incomeLevel || undefined} onClick={() => onPick(c.name)}>{c.name}</button>)}
          </div>
        </details>
      ))}
      <div className="viz-foot">Regions and income groups: World Bank country classification.</div>
    </section>
  )
}
