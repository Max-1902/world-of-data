import CountrySearchBox from '../CountrySearchBox'
import RegionBrowser from './RegionBrowser'
import { useWatchlist } from '../../hooks/useWatchlist'

/** The Countries destination before a country is picked: choose one, and its full record opens as a page. */
export default function CountriesLanding({ onPick }: { onPick: (country: string) => void }) {
  const { countries: followed } = useWatchlist()
  return (
    <div className="countries-landing">
      <h2>Countries</h2>
      <p className="viz-sub">Pick an economy to open its full record: GDP and the forecast beside the IMF's, trade, risk, infrastructure and news.</p>
      <CountrySearchBox onPick={onPick} />
      {followed.length > 0 && (
        <section aria-label="Countries you follow">
          <div className="viz-section"><h2>Countries you follow</h2><span /></div>
          <div className="viz-chips">
            {followed.map(c => <button key={c} className="cy-btn" onClick={() => onPick(c)}>{c}</button>)}
          </div>
        </section>
      )}
      <RegionBrowser onPick={onPick} />
    </div>
  )
}
