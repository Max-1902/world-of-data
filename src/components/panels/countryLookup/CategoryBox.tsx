import { useMemo, useState } from 'react'
import type { Category, CountryDataset } from '../../../services/countryLookup'
import { formatSlope, formatValue, pointsOf } from '../../../services/countryLookup'
import { trendTest, TREND_WINDOW, type TrendResult } from '../../../utils/econAnalysis'
import { ChartFrame } from '../../charts/ChartFrame'
import { LineChart } from '../../charts/LineChart'
import Sparkline from '../../Sparkline'
import { fmtP, inPeriod, toLine, type Period } from './shared'

function TrendBadge({ r, kind }: { r: TrendResult | null; kind: Parameters<typeof formatSlope>[0] }) {
  if (!r) return <span className="cl-trend none" title={`Fewer than 8 observations in the last ${TREND_WINDOW}: not tested`}>too short</span>
  const detail = `Mann–Kendall, autocorrelation-corrected, ${r.from}–${r.to}, n = ${r.n}. Sen's slope ${formatSlope(kind, r.slope)}, ${fmtP(r.p)}.`
  if (r.direction === 'flat') return <span className="cl-trend flat" title={detail}>no clear trend</span>
  return <span className={`cl-trend ${r.direction}`} title={detail}>{r.direction === 'up' ? '↑' : '↓'} {formatSlope(kind, r.slope)}</span>
}

/**
 * One World Bank category: a chart of the selected indicator (full history within the chosen period, with the Sen
 * trend over the test window dashed when significant) above every indicator in the category with its latest value,
 * year, sparkline and trend-test result. Indicators the World Bank has no data for are listed as such.
 */
export function CategoryBox({ category, data, period }: { category: Category; data: CountryDataset; period: Period }) {
  const rows = useMemo(() => category.series.map(meta => {
    const pts = pointsOf(data, meta.id)
    return { meta, pts, name: data.series[meta.id]?.name ?? meta.short, last: pts[pts.length - 1], trend: trendTest(pts) }
  }), [category, data])
  const withData = rows.filter(r => r.pts.length)
  const [sel, setSel] = useState<string | null>(null)
  const cur = rows.find(r => r.meta.id === sel && r.pts.length) ?? withData[0]

  const chartPts = cur ? inPeriod(cur.pts, period) : []
  const trendLine = cur?.trend && cur.trend.direction !== 'flat' ? (() => {
    const t = cur.trend, win = cur.pts.filter(p => p.x >= t.from && p.x <= t.to)
    const med = (v: number[]) => { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
    // Sen line passes through the medians of x and y (Conover)
    const b0 = med(win.map(p => p.y)) - t.slope * med(win.map(p => p.x))
    return [{ t: t.from, v: b0 + t.slope * t.from }, { t: t.to, v: b0 + t.slope * t.to }]
  })() : null

  return (
    <ChartFrame
      title={category.title}
      subtitle={`${category.blurb} · ${withData.length} of ${rows.length} indicators reported${category.profile ? ' · World Bank country profile' : ''}`}
      table={{
        columns: ['Year', cur ? cur.meta.short : 'Value'],
        rows: cur ? [...chartPts].reverse().map(p => [String(p.x), formatValue(cur.meta.kind, p.y)]) : [],
      }}
      footer={<>
          <ul className="cl-rows" aria-label={`${category.title} indicators`}>
            {rows.map(r => (
              <li key={r.meta.id}>
                <button className={`cl-row ${cur?.meta.id === r.meta.id ? 'on' : ''}`} disabled={!r.pts.length} onClick={() => setSel(r.meta.id)} aria-pressed={cur?.meta.id === r.meta.id} title={r.name}>
                  <span className="cl-row-l">{r.meta.short}</span>
                  {r.last ? (
                    <>
                      <span className="cl-row-v">{formatValue(r.meta.kind, r.last.y)}<i>{r.last.x}</i></span>
                      <Sparkline points={r.pts.slice(-TREND_WINDOW).map(p => ({ t: p.x, v: p.y }))} width={48} height={14} color="var(--text3)" label={`${r.meta.short}, last ${TREND_WINDOW} observations`} />
                      <TrendBadge r={r.trend} kind={r.meta.kind} />
                    </>
                  ) : <span className="cl-row-na">No data available</span>}
                </button>
              </li>
            ))}
          </ul>
          <p className="cl-cite">{cur ? <>Charted: <b>{cur.name}</b> ({cur.meta.id}). World Bank{cur.meta.source === 3 ? ', Worldwide Governance Indicators' : cur.meta.source === 63 ? ', Human Capital Index' : ', World Development Indicators'}. Click an indicator to chart it.</> : 'The World Bank has no data for this category for this country.'}</p>
        </>}
    >
      {cur && chartPts.length > 0 ? (
        <LineChart
          ariaLabel={`${cur.name}, ${category.title} category.`}
          xKind="year"
          fmtY={v => formatValue(cur.meta.kind, v)}
          series={[
            { key: 'v', label: cur.meta.short, color: 'var(--series-1)', points: toLine(chartPts) },
            ...(trendLine && trendLine[0].t >= (chartPts[0]?.x ?? 0) ? [{ key: 'trend', label: `Sen trend ${cur.trend!.from}–${cur.trend!.to}`, color: 'var(--series-2)', points: trendLine, dashed: true }] : []),
          ]}
        />
      ) : <div className="viz-note">{cur ? 'No observations in this period.' : 'No data available.'}</div>}
    </ChartFrame>
  )
}
