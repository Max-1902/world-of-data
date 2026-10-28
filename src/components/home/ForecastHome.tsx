import { useEffect, useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useHomeForecast } from '../../hooks/useHomeForecast'
import { FLAGSHIP_SERIES, g20Projections, type HomeForecast } from '../../utils/homeForecast'
import { FORECAST_HORIZON, coverageLabel } from '../../utils/forecastPolicy'
import { makeRecord, type ForecastRecord } from '../../utils/forecastRecord'
import { remember } from '../../services/forecastLog'
import { EvidenceTag, Metric, SourceLine, StatusLabel } from '../DataLabels'
import { SinceBlock } from '../forecast/SinceBlock'
import { LineChart } from '../charts/LineChart'
import { CorrMatrixCard } from '../charts/CorrMatrixCard'

/** An interval band wider than this many times the charted history's own range is stated in words, not drawn. */
const MAX_BAND_RATIO = 4
const HISTORY_YEARS = 25

const f1 = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`
const today = () => new Date().toISOString().slice(0, 10)

interface Props { onOpenPanel: (id: string) => void }

/**
 * The home page's forecast: what we expect (real GDP growth, three years, with its range), what changed since it was
 * last shown, what it rests on, what it cannot see, and how the G20 compare on the IMF's own projections. It reads
 * the same functions as the Predictions panel, so the number here is the number there.
 */
export function ForecastHome({ onOpenPanel }: Props) {
  const h = useHomeForecast()
  const name = h.country?.name ?? h.iso2
  const ok = h.result?.kind === 'ok' ? h.result : null
  const weoReady = h.weo !== 'loading' && h.weo !== null ? h.weo : null

  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return h.countries.filter(c => c.name.toLowerCase().includes(q) || c.iso2.toLowerCase() === q || c.iso3.toLowerCase() === q).slice(0, 8)
  }, [query, h.countries])
  const pick = (iso2: string) => { h.select(iso2); setQuery('') }

  // remember what the card showed (same record the Predictions panel writes), so "what changed" works from either place
  const [memory, setMemory] = useState<{ previous: ForecastRecord | null; since: string; now: ForecastRecord } | null>(null)
  useEffect(() => {
    if (!ok || !h.country) { setMemory(null); return }
    const rec = makeRecord({
      key: `${h.country.iso2}|${FLAGSHIP_SERIES}`, issued: today(), model: ok.headline, series: h.points, points: ok.forecast.points,
      imf: weoReady ? { vintage: weoReady.vintage, points: ok.imf } : null,
    })
    setMemory({ ...remember(rec), now: rec })
  }, [ok, h.country, h.points, weoReady])

  const compare = useMemo(() => weoReady ? g20Projections(weoReady) : null, [weoReady])
  const byIso3 = useMemo(() => new Map(h.countries.map(c => [c.iso3, c])), [h.countries])

  return (
    <>
      <section className="home-hero fh-hero" aria-label="Forecast">
        <div className="hero-copy">
          <div className="home-eyebrow"><span className="new-live-dot" /> FORECAST · REAL GDP GROWTH</div>
          <h1>Where is <em>{name}</em>’s economy heading?</h1>
          <p>{ok ? headlineSentence(ok) : 'A statistical projection from the country’s own history, with its range, its track record and the IMF’s figure beside it.'}</p>
          <div className="fh-pick cl-search">
            <label className="viz-field">
              <span>Country</span>
              <input className="viz-select" type="search" placeholder={h.countries.length ? `Search ${h.countries.length} economies…` : 'Loading country list…'}
                value={query} onChange={e => setQuery(e.target.value)} aria-label="Choose a country to forecast"
                onKeyDown={e => { if (e.key === 'Enter' && matches[0]) pick(matches[0].iso2) }} />
            </label>
            {matches.length > 0 && (
              <ul className="cl-matches" role="listbox" aria-label="Matching countries">
                {matches.map(m => <li key={m.iso2}><button role="option" aria-selected={m.iso2 === h.iso2} onClick={() => pick(m.iso2)}>{m.name}<span>{m.region}</span></button></li>)}
              </ul>
            )}
          </div>
          <button className="home-primary-cta" onClick={() => onOpenPanel('predictions')}>Full forecast, backtest and IMF comparison <ArrowRight size={16} /></button>
        </div>

        <aside className="fh-glance" aria-label={`${name} forecast at a glance`}>
          {ok ? <Glance f={ok} weoVintage={ok.imfVintage} /> : <GlanceStatus h={h} />}
        </aside>
      </section>

      {ok && (
        <section className="home-section fh-section" aria-label="Forecast detail">
          <div className="fh-card">
            <div className="fh-chart-h">
              <strong>{name}: real GDP growth, next {FORECAST_HORIZON} years</strong>
              <span>{ok.headline === 'ar' ? 'AR(2) forecast' : '“No change” forecast'}{ok.imf.length ? ' · IMF projection' : ''}</span>
            </div>
            <ForecastChart f={ok} history={h.points} name={name} vintage={ok.imfVintage} />
            <p className="viz-verdict">{limits(ok, h.weo === null)}</p>
          </div>

          <div className="fh-cols">
            <div className="fh-card">{memory ? <SinceBlock memory={memory} unit="%" /> : null}</div>
            <div className="fh-card">
              <div className="pred-block-h">What it rests on</div>
              <ul className="ex-path">{ok.basis.map((b, i) => <li key={i}><EvidenceTag kind={b.kind} /><div>{b.text}</div></li>)}</ul>
              <p className="viz-verdict">These are the model’s inputs, not causes: it sees only this country’s own growth history.</p>
            </div>
            <div className="fh-card">
              <div className="pred-block-h">What could change it</div>
              <p className="viz-verdict">The forecast cannot see trade, prices, policy or shocks. Shock exposure traces which economies a shock reaches, step by step, from reported trade links, with the evidence behind each step labelled. It is separate from the forecast above and does not change the number: the forecast has no scenario analysis of its own yet.</p>
              <div className="fh-links">
                <button className="text-link" onClick={() => onOpenPanel('exposure')}>Trace a shock <ArrowRight size={13} /></button>
                <button className="text-link" onClick={() => onOpenPanel('nowcast')}>GDP nowcast, EU economies <ArrowRight size={13} /></button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="home-section fh-section" aria-label="What moves together">
        <div className="fh-card"><CorrMatrixCard onPick={() => onOpenPanel('countryAnalytics')} /></div>
      </section>

      {compare && (
        <section className="home-section fh-section" aria-label="Compare economies">
          <div className="home-section-heading">
            <div><span className="section-kicker">COMPARE ECONOMIES</span><h2>The G20 on the IMF’s projections</h2><p>The IMF’s own figures, not this app’s forecast. Select an economy to see its forecast above.</p></div>
          </div>
          <div className="fh-card">
            <div className="viz-table-wrap fh-compare"><table className="viz-table">
              <thead><tr><th scope="col">Economy</th><th scope="col">{compare.years[0]}</th><th scope="col">{compare.years[1]}</th></tr></thead>
              <tbody>{compare.rows.map(r => {
                const c = byIso3.get(r.iso3)
                return (
                  <tr key={r.iso3} className={c?.iso2 === h.iso2 ? 'fh-selected' : undefined}>
                    <th scope="row">{c ? <button className="fh-row-btn" onClick={() => pick(c.iso2)}>{c.name}</button> : r.iso3}</th>
                    <td>{r.thisYear == null ? '—' : `${f1(r.thisYear)}%`}</td>
                    <td>{r.nextYear == null ? '—' : `${f1(r.nextYear)}%`}</td>
                  </tr>
                )
              })}</tbody>
            </table></div>
            <div className="cc-ev"><EvidenceTag kind="statistical" /><span>Real GDP growth, projected by the IMF. A forecast made with far more information than this app’s model, not a measurement.</span></div>
            <SourceLine source={`IMF, ${weoReady!.vintage}`} asOf={weoReady!.lastModified ? `updated ${weoReady!.lastModified.slice(0, 10)}` : undefined} />
          </div>
        </section>
      )}
    </>
  )
}

function headlineSentence(f: HomeForecast): string {
  const a = f.forecast.points[0], z = f.forecast.points[f.forecast.points.length - 1]
  const lead = f.headline === 'ar' ? 'Projected real GDP growth' : 'Real GDP growth held at the last reported value'
  return `${lead}: ${f1(a.value)}% in ${a.year} (range ${f1(a.lo)} to ${f1(a.hi)}%), ${f1(z.value)}% in ${z.year} (range ${f1(z.lo)} to ${f1(z.hi)}%). ${f.last.x}: ${f1(f.last.y)}% reported.`
}

function limits(f: HomeForecast, imfFailed: boolean): string {
  const base = 'A statistical projection of this country’s own World Bank history, not a claim about what will happen. The backtests use today’s revised figures, so a real-time test would look worse.'
  const imf = imfFailed ? ' The IMF’s figures could not be loaded right now, so there is no outside benchmark.'
    : f.imf.length ? ' The IMF’s projection is shown beside it and beat this model in most economies in backtests.'
    : ' The IMF publishes no figure for this economy in the current edition, so there is no outside benchmark.'
  return base + imf
}

function Glance({ f, weoVintage }: { f: HomeForecast; weoVintage: string | null }) {
  const a = f.forecast.points[0]
  const imfFirst = f.imf.find(p => p.year === a.year)
  const label = coverageLabel(f.fallbackHorizons.includes(1) ? null : f.policy, 1)
  return (
    <div className="fh-glance-body">
      <Metric label={`${f.last.x} reported`} value={f1(f.last.y)} unit="%" evidence="observed" asOf="World Bank" />
      <Metric label={`${a.year} forecast`} value={f1(a.value)} unit="%" evidence="statistical" range={`${label}: ${f1(a.lo)} to ${f1(a.hi)}%`} />
      <Metric label={`${a.year} IMF projection`} value={imfFirst ? f1(imfFirst.value) : '—'} unit={imfFirst ? '%' : undefined} evidence={imfFirst ? 'statistical' : undefined}
        asOf={imfFirst && weoVintage ? weoVintage : 'no IMF figure for this year'} />
    </div>
  )
}

function GlanceStatus({ h }: { h: ReturnType<typeof useHomeForecast> }) {
  if (h.listFailed) return <StatusLabel status="error">The country list could not be loaded.</StatusLabel>
  if (h.seriesStatus === 'error') return <StatusLabel status="error">The World Bank’s figures could not be loaded right now.</StatusLabel>
  if (h.result?.kind === 'short') return <StatusLabel status="empty">{h.country?.name ?? h.iso2} has {h.result.n} years of reported growth; a forecast needs at least 15.</StatusLabel>
  return <StatusLabel status="loading">Real GDP growth, World Bank and IMF…</StatusLabel>
}

function ForecastChart({ f, history, name, vintage }: { f: HomeForecast; history: { x: number; y: number }[]; name: string; vintage: string | null }) {
  const { forecast: fc, last } = f
  const shown = history.filter(p => p.x >= last.x - HISTORY_YEARS + 1)
  const ys = shown.map(p => p.y)
  const range = Math.max(Math.max(...ys, last.y) - Math.min(...ys, last.y), 1)
  const drawBand = fc.points.every(p => Number.isFinite(p.lo) && p.hi - p.lo <= MAX_BAND_RATIO * range)
  const end = fc.points[fc.points.length - 1]
  const line = (pick: 'value' | 'lo' | 'hi') => [{ t: last.x, v: last.y }, ...fc.points.map(p => ({ t: p.year, v: p[pick] }))]
  const label = coverageLabel(f.fallbackHorizons.includes(FORECAST_HORIZON) ? null : f.policy, FORECAST_HORIZON)
  return (
    <LineChart
      ariaLabel={`${name} real GDP growth, ${shown[0]?.x ?? last.x} to ${last.x}, with a ${FORECAST_HORIZON}-year forecast reaching ${f1(end.value)}%.`}
      xKind="year" height={230} fmtY={v => `${f1(v)}%`} refLines={[{ v: 0, label: '0' }]}
      bands={[{ from: fc.points[0].year, to: end.year, label: 'Forecast period' }]}
      areas={drawBand ? [{ key: 'ci', label, color: 'var(--series-2)', points: [{ t: last.x, lo: last.y, hi: last.y }, ...fc.points.map(p => ({ t: p.year, lo: p.lo, hi: p.hi }))] }] : []}
      series={[
        { key: 'hist', label: 'Reported', color: 'var(--series-1)', points: shown.map(p => ({ t: p.x, v: p.y })), markers: true },
        { key: 'fc', label: f.headline === 'ar' ? 'AR(2) forecast' : 'No-change forecast', color: 'var(--series-2)', points: line('value'), dashed: true, markers: true },
        ...(f.imf.length ? [{ key: 'imf', label: vintage ? `IMF (${vintage.replace('World Economic Outlook', 'WEO')})` : 'IMF', color: 'var(--series-5)', points: f.imf.map(p => ({ t: p.year, v: p.value })), dashed: true, markers: true }] : []),
      ]} />
  )
}
