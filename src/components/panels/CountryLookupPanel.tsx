import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useCountryLookup } from '../../hooks/useCountryLookup'
import { CATEGORIES } from '../../services/countryLookup'
import { isEurope } from '../../services/europeMacro'
import { CategoryBox } from './countryLookup/CategoryBox'
import { EuropeSection } from './countryLookup/EuropeSection'
import { AnalysisSection } from './countryLookup/AnalysisSection'
import { PERIODS, type Period } from './countryLookup/shared'

/**
 * Country Lookup: one country's full World Bank record, one box and chart per category; ECB / Eurostat / BIS data for
 * European countries; and below it all, an analysis of that economy's own history. A research tool, separate from the
 * cross-country Country Analytics panel.
 */
export function CountryLookupPanel() {
  const c = useCountryLookup()
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState<Period>('all')
  const current = c.countries.find(x => x.iso2 === c.iso2)
  const name = current?.name ?? c.data?.name ?? c.iso2
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return c.countries.filter(x => x.name.toLowerCase().includes(q) || x.iso2.toLowerCase() === q || x.iso3.toLowerCase() === q).slice(0, 8)
  }, [query, c.countries])

  return (
    <div className="viz-root cl-root">
      <div className="cl-search">
        <label className="viz-field" style={{ flex: 1 }}>
          <span>Country</span>
          <input className="viz-select" type="search" placeholder={c.countries.length ? `Search ${c.countries.length} economies…` : 'Loading country list…'} value={query}
            onChange={e => setQuery(e.target.value)} aria-label="Search for a country"
            onKeyDown={e => { if (e.key === 'Enter' && matches[0]) { c.setIso2(matches[0].iso2); setQuery('') } }} />
        </label>
        {matches.length > 0 && (
          <ul className="cl-matches" role="listbox" aria-label="Matching countries">
            {matches.map(m => (
              <li key={m.iso2}><button role="option" aria-selected={m.iso2 === c.iso2} onClick={() => { c.setIso2(m.iso2); setQuery('') }}>{m.name}<span>{m.region}</span></button></li>
            ))}
          </ul>
        )}
      </div>
      {c.listError && <div className="viz-note" role="status">Could not load the World Bank country list ({c.listError}). <button className="cy-btn" onClick={c.retry}><RefreshCw size={11} /> Retry</button></div>}

      <header className="cl-head">
        <div>
          <h2 className="cl-name">{name}</h2>
          {current && <p className="viz-sub">{[current.region, current.incomeLevel, current.capital && `capital ${current.capital}`].filter(Boolean).join(' · ')}</p>}
        </div>
        <div className="viz-toggle" role="group" aria-label="Period shown in charts">
          {PERIODS.map(p => <button key={p.id} className={period === p.id ? 'on' : ''} aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</button>)}
        </div>
      </header>

      {c.status === 'loading' && <div className="viz-note" role="status">Loading {name}'s World Bank record since 1960…</div>}
      {c.status === 'error' && (
        <div className="viz-note" role="status">Could not reach the World Bank ({c.error}). <button className="cy-btn" onClick={c.retry}><RefreshCw size={11} /> Retry</button></div>
      )}
      {c.data && c.data.failedBatches > 0 && (
        <div className="viz-note" role="status">{c.data.failedBatches} of {c.data.totalBatches} World Bank requests failed; some boxes are incomplete. <button className="cy-btn" onClick={c.retry}><RefreshCw size={11} /> Retry</button></div>
      )}

      {c.data && (
        <>
          <div className="viz-section"><h2>World Bank · country profile</h2><span>World Development Indicators</span></div>
          {CATEGORIES.filter(k => k.profile).map(k => <CategoryBox key={`${c.iso2}-${k.id}`} category={k} data={c.data!} period={period} />)}
          <div className="viz-section"><h2>World Bank · full record</h2><span>WDI, governance, human capital</span></div>
          {CATEGORIES.filter(k => !k.profile).map(k => <CategoryBox key={`${c.iso2}-${k.id}`} category={k} data={c.data!} period={period} />)}
        </>
      )}

      {isEurope(c.iso2) && c.europeStatus === 'loading' && <div className="viz-note" role="status">Loading ECB, Eurostat and BIS series…</div>}
      {c.europeStatus === 'error' && <div className="viz-note" role="status">Could not load the European series. <button className="cy-btn" onClick={c.retry}><RefreshCw size={11} /> Retry</button></div>}
      {c.europe && <EuropeSection eu={c.europe} period={period} countryName={name} />}

      {c.data && <AnalysisSection data={c.data} eu={c.europe} name={name} />}

      <p className="viz-foot">
        Sources: World Bank Open Data{c.europe ? ', ECB Data Portal, Eurostat, BIS' : ''}; all free and keyless. Values are as published; nothing is
        estimated or filled in. A missing indicator means the source has no data for {name}.
      </p>
    </div>
  )
}
