import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { fetchCountryList, type WbCountry } from '../services/countryLookup'

interface Props {
  onPick: (countryName: string) => void
  placeholder?: string
}

/** Name search over the World Bank economy list, for jumping straight to a country's dashboard. */
export default function CountrySearchBox({ onPick, placeholder }: Props) {
  const [countries, setCountries] = useState<WbCountry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let live = true
    fetchCountryList().then(c => { if (live) { setCountries(c); setError(null) } }, e => { if (live) setError(e instanceof Error ? e.message : String(e)) })
    return () => { live = false }
  }, [])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return countries.filter(c => c.name.toLowerCase().includes(q) || c.iso2.toLowerCase() === q || c.iso3.toLowerCase() === q).slice(0, 8)
  }, [query, countries])

  function pick(name: string) {
    onPick(name)
    setQuery('')
  }

  return (
    <div className="cl-search country-search-box">
      <label className="viz-field" style={{ flex: 1 }}>
        <span><Search size={10} style={{ verticalAlign: '-1px' }} /> Look up a country</span>
        <input
          className="viz-select"
          type="search"
          placeholder={placeholder ?? (countries.length ? `Search ${countries.length} economies…` : 'Loading country list…')}
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search for a country"
          onKeyDown={e => { if (e.key === 'Enter' && matches[0]) pick(matches[0].name) }}
        />
      </label>
      {matches.length > 0 && (
        <ul className="cl-matches" role="listbox" aria-label="Matching countries">
          {matches.map(m => (
            <li key={m.iso2}><button role="option" onClick={() => pick(m.name)}>{m.name}<span>{m.region}</span></button></li>
          ))}
        </ul>
      )}
      {error && <div className="viz-note" role="status">Could not load the country list ({error}).</div>}
    </div>
  )
}
