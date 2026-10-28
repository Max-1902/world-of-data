import { useMemo, type ReactNode } from 'react'
import { Map as MapIcon, RefreshCw } from 'lucide-react'
import { useOpenMap } from '../OpenMapContext'
import { useAnalyticsData } from '../../hooks/useAnalyticsData'
import type { HexSource, Slice } from '../../services/analyticsData'
import {
  HOUR_MS, DAY_MS, bucketCounts, depthBins, fireHourCounts, fireSummary, frpHistogram, gutenbergRichter, median,
  quakeRegion, quakeRegionMatrix, trailingMean,
} from '../../utils/dataAnalytics'
import { ChartFrame } from '../charts/ChartFrame'
import { TimeSeriesChart } from '../charts/TimeSeriesChart'
import { HeatmapChart } from '../charts/HeatmapChart'
import { BarsChart } from '../charts/BarsChart'
import { MagnitudeChart } from '../charts/MagnitudeChart'
import { fmtDay, fmtDayHour } from '../charts/format'
import type { PanelState } from '../../types'

const QUAKE_HOURS = 168

const pct = (v: number) => `${(v * 100).toFixed(0)}%`

function Kpi({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="viz-kpi">
      <div className="viz-kpi-l">{label}</div>
      <div className="viz-kpi-v">{value}</div>
      {detail && <div className="viz-kpi-d">{detail}</div>}
    </div>
  )
}

function Section({ title, source, children }: { title: string; source: string; children?: ReactNode }) {
  return (
    <>
      <div className="viz-section"><h2>{title}</h2><span>{source}</span></div>
      {children}
    </>
  )
}

/** What to show instead of charts while a feed has no data — always says what is (not) happening, never fills in. */
function Pending({ slice, empty, onRetry }: { slice: Slice<unknown>; empty: string; onRetry: () => void }) {
  const loading = slice.status === 'loading' || slice.status === 'idle'
  return (
    <div className="viz-note" role="status">
      {loading ? 'Loading…' : slice.status === 'error' ? `This feed could not be loaded${slice.error ? ` (${slice.error})` : ''}.` : empty}
      {!loading && <div style={{ marginTop: 6 }}><button className="cy-btn" onClick={onRetry}><RefreshCw size={11} /> Retry</button></div>}
    </div>
  )
}

export function AnalyticsPanel({ panelState, onToggleLayer, onGeoSearch }: {
  panelState: PanelState
  onToggleLayer: (id: keyof PanelState) => void
  onGeoSearch?: (q: string) => void
}) {
  const openMap = useOpenMap()
  const d = useAnalyticsData({ quakes: true, fires: true })
  const { quakes, fires } = d
  const layerOn = panelState.analyticsHex

  const quakeView = useMemo(() => {
    if (quakes.fetchedAt === null || quakes.data.length === 0) return null
    const end = Math.ceil(quakes.fetchedAt / HOUR_MS) * HOUR_MS
    const start = end - QUAKE_HOURS * HOUR_MS
    const counts = bucketCounts(quakes.data.map(q => q.time), start, HOUR_MS, QUAKE_HOURS)
    const strongest = new Array<number>(QUAKE_HOURS).fill(0)
    for (const q of quakes.data) {
      const i = Math.floor((q.time - start) / HOUR_MS)
      if (i >= 0 && i < QUAKE_HOURS && q.magnitude > strongest[i]) strongest[i] = q.magnitude
    }
    const avg = trailingMean(counts, 24)
    const points = counts.map((value, i) => ({
      t: start + i * HOUR_MS, value, avg: avg[i],
      lines: strongest[i] > 0 ? [`Strongest: M${strongest[i].toFixed(1)}`] : [],
    }))
    const top = quakes.data.reduce((a, b) => (b.magnitude > a.magnitude ? b : a))
    return {
      end, points, top,
      gr: gutenbergRichter(quakes.data.map(q => q.magnitude)),
      matrix: quakeRegionMatrix(quakes.data, end, 7, DAY_MS, 10),
      depth: depthBins(quakes.data),
      medianDepth: median(quakes.data.map(q => q.depth).filter(Number.isFinite)),
      regions: new Set(quakes.data.map(q => quakeRegion(q.place))).size,
    }
  }, [quakes.data, quakes.fetchedAt])

  const fireView = useMemo(() => {
    if (fires.data.length === 0) return null
    const hours = fireHourCounts(fires.data)
    const total = hours.reduce((a, b) => a + b, 0)
    return {
      summary: fireSummary(fires.data),
      hours: hours.map((count, h) => ({ label: String(h).padStart(2, '0'), value: count, detail: total ? `${pct(count / total)} of detections` : undefined })),
      frp: frpHistogram(fires.data),
    }
  }, [fires.data])

  const setSource = (s: HexSource) => d.setHexSource(s)

  return (
    <div className="viz-root">
      <div className="viz-filters">
        <button className={`cy-btn ${layerOn ? 'active' : ''}`} aria-pressed={layerOn} onClick={() => { if (!layerOn) openMap(); onToggleLayer('analyticsHex') }}
          title="Draw this data on the map as 3D hexagons — tilt the map to see heights">
          <MapIcon size={11} /> {layerOn ? 'On the map' : 'Show on map'}
        </button>
        {(['fires', 'quakes'] as const).map(s => (
          <button key={s} className={`cy-btn ${d.hexSource === s ? 'active' : ''}`} aria-pressed={d.hexSource === s} onClick={() => setSource(s)}
            title={s === 'fires' ? 'Map layer: wildfire detections, last 24 hours' : 'Map layer: earthquakes M4.5+, last 7 days'}>
            {s === 'fires' ? 'Wildfires' : 'Earthquakes'}
          </button>
        ))}
        <button className="cy-btn" style={{ marginLeft: 'auto' }} title="Fetch both feeds again"
          disabled={quakes.status === 'loading' || fires.status === 'loading'}
          onClick={() => { void d.reload('quakes'); void d.reload('fires') }}>
          <RefreshCw size={11} />
        </button>
      </div>

      <Section title="Earthquakes" source="USGS · M4.5+ · last 7 days" />
      {quakeView ? (
        <>
          <div className="viz-kpis">
            <Kpi label="Earthquakes" value={quakes.data.length.toLocaleString()} detail={`${quakeView.regions} regions`} />
            <Kpi label="Strongest" value={`M${quakeView.top.magnitude.toFixed(1)}`} detail={quakeView.top.place} />
            <Kpi label="Median depth" value={quakeView.medianDepth === null ? '—' : `${Math.round(quakeView.medianDepth)} km`} />
            <Kpi label="Magnitude b-value" value={quakeView.gr.b === null ? '—' : quakeView.gr.b.toFixed(2)}
              detail={quakeView.gr.bErr === null ? undefined : `± ${quakeView.gr.bErr.toFixed(2)}`} />
          </div>

          <ChartFrame
            title="Earthquakes per hour"
            subtitle="Count of M4.5+ quakes in each UTC hour, with a trailing 24-hour average."
            table={{ columns: ['Hour (UTC)', 'Quakes', '24 h avg'], rows: quakeView.points.map(p => [fmtDayHour(p.t), p.value, p.avg === null ? '—' : p.avg.toFixed(2)]) }}
          >
            <TimeSeriesChart points={quakeView.points} valueLabel="Quakes per hour" avgLabel="24-hour average" fmtTick={fmtDayHour} fmtTitle={t => `${fmtDayHour(t)} UTC`}
              ariaLabel={`Earthquakes per hour over the last 7 days, ${quakes.data.length} in total.`} />
          </ChartFrame>

          <ChartFrame
            title="Magnitude–frequency (Gutenberg–Richter)"
            subtitle="How many quakes reach each magnitude or more, on a log scale. Roughly a straight line, as the law predicts."
            table={{ columns: ['Magnitude ≥', 'Quakes'], rows: quakeView.gr.points.map(p => [p.m.toFixed(1), p.cumulative]) }}
            footer={quakeView.gr.b === null ? undefined
              : `b = ${quakeView.gr.b.toFixed(2)}${quakeView.gr.bErr !== null ? ` ± ${quakeView.gr.bErr.toFixed(2)}` : ''} from ${quakeView.gr.n.toLocaleString()} quakes at M${quakeView.gr.mc} and above (maximum likelihood). Global catalogues usually give about 1; a single week is a small sample, so expect scatter.`}
          >
            <MagnitudeChart gr={quakeView.gr} />
          </ChartFrame>

          <ChartFrame
            title="Where quakes cluster"
            subtitle="Ten most active regions by daily count. Region is the text USGS gives after the last comma in the place name. Click a row to fly there."
            table={{ columns: ['Region', 'Total', ...quakeView.matrix.cols.map(fmtDay)], rows: quakeView.matrix.rows.map((r, i) => [r, quakeView.matrix.totals[i], ...quakeView.matrix.cells[i]]) }}
          >
            <HeatmapChart matrix={quakeView.matrix} unit="quakes" fmtCol={fmtDay} onRowClick={onGeoSearch}
              ariaLabel={`Heatmap of daily earthquake counts for the ${quakeView.matrix.rows.length} most active regions over 7 days`} />
          </ChartFrame>

          <ChartFrame
            title="How deep they are"
            subtitle="Number of quakes by focal depth in km. Most are shallow; deep ones sit in subduction zones."
            table={{ columns: ['Depth (km)', 'Quakes'], rows: quakeView.depth.map(b => [b.label, b.count]) }}
          >
            <BarsChart items={quakeView.depth.map(b => ({ label: b.label, value: b.count }))} unit="quakes" ariaLabel="Earthquake count by depth class" />
          </ChartFrame>
        </>
      ) : (
        <Pending slice={quakes} empty="The USGS feed returned no earthquakes, or could not be reached. Check the source-health indicator in the top bar." onRetry={() => void d.reload('quakes')} />
      )}

      <Section title="Wildfires" source="NASA FIRMS (VIIRS) · last 24 hours" />
      {fireView ? (
        <>
          <div className="viz-kpis">
            <Kpi label="Detections" value={fireView.summary.detections.toLocaleString()} />
            <Kpi label="Total fire power" value={fireView.summary.totalFrpMw >= 1000 ? `${Math.round(fireView.summary.totalFrpMw / 1000).toLocaleString()} GW` : `${Math.round(fireView.summary.totalFrpMw)} MW`}
              detail={`${fireView.summary.withFrp.toLocaleString()} with a power reading`} />
            <Kpi label="Detected at night" value={pct(fireView.summary.nightShare)} />
            <Kpi label="High confidence" value={pct(fireView.summary.highConfidenceShare)} />
          </div>

          <ChartFrame
            title="Detections by UTC hour"
            subtitle="When the satellite saw each fire. Peaks follow the orbit's overpass times over the fire-prone regions."
            table={{ columns: ['Hour (UTC)', 'Detections'], rows: fireView.hours.map(h => [`${h.label}:00`, h.value]) }}
          >
            <BarsChart items={fireView.hours} unit="detections" tickEvery={3} ariaLabel="Fire detections by UTC hour of acquisition" />
          </ChartFrame>

          <ChartFrame
            title="How intense the fires are"
            subtitle="Detections by fire radiative power in MW (log-spaced classes). Most are small; a few are very large."
            table={{ columns: ['Power (MW)', 'Detections'], rows: fireView.frp.map(b => [b.label, b.count]) }}
            footer="Detections that report no power are left out of this chart."
          >
            <BarsChart items={fireView.frp.map(b => ({ label: b.label, value: b.count }))} unit="detections" ariaLabel="Fire detections by radiative power class" />
          </ChartFrame>
        </>
      ) : (
        <Pending slice={fires} empty="The NASA FIRMS feed returned no detections, or could not be reached. Check the source-health indicator in the top bar." onRetry={() => void d.reload('fires')} />
      )}

      <div className="viz-note">
        Both feeds are the ones the Crises and Wildfires layers already use (USGS and NASA FIRMS, free, no key). Everything above is computed in the browser from those rows; nothing is estimated or filled in. Times are UTC.
      </div>
    </div>
  )
}
