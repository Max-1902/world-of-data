import { useState } from 'react'
import type { RateStat } from '../../utils/analytics'
import { MIN_BIN_SAMPLES } from '../../utils/analytics'
import { useElementWidth } from './useElementWidth'
import { Tooltip } from './ChartFrame'

export interface RateItem { label: string; stat: RateStat; emphasis?: boolean }

const H = 170
const M = { l: 34, r: 8, t: 14, b: 34 }
const pct = (v: number) => `${Math.round(v * 100)}%`

/**
 * Proportion bars with 95% intervals and an optional reference line. A bar with fewer than MIN_BIN_SAMPLES samples
 * is drawn as an empty outline and labelled "n too small" rather than as a rate it can't support.
 */
export function RateChart({ items, reference, referenceLabel, ariaLabel }: { items: RateItem[]; reference?: number; referenceLabel?: string; ariaLabel: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null)
  const innerW = Math.max(40, width - M.l - M.r)
  const innerH = H - M.t - M.b
  const band = innerW / Math.max(1, items.length)
  const barW = Math.min(24, band - 8)
  const x = (i: number) => M.l + band * i + band / 2
  const y = (v: number) => M.t + innerH - v * innerH
  const hi = hover ? items[hover.i] : null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg width={width} height={H} role="img" aria-label={ariaLabel}>
        {[0, 0.5, 1].map(t => (
          <g key={t}>
            <line x1={M.l} x2={width - M.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={M.l - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill="var(--text3)">{pct(t)}</text>
          </g>
        ))}
        {items.map((it, i) => {
          const thin = it.stat.n < MIN_BIN_SAMPLES
          const top = y(it.stat.rate)
          return (
            <g key={it.label} onPointerMove={e => { const b = ref.current!.getBoundingClientRect(); setHover({ i, x: e.clientX - b.left, y: e.clientY - b.top }) }} onPointerLeave={() => setHover(null)}>
              <rect x={x(i) - band / 2} y={M.t} width={band} height={innerH + M.b} fill="transparent" />
              {thin ? (
                <rect x={x(i) - barW / 2} y={y(0) - 2} width={barW} height={2} fill="var(--text3)" />
              ) : (
                <>
                  <rect x={x(i) - barW / 2} y={top} width={barW} height={Math.max(0, y(0) - top)} rx={4}
                    fill={it.emphasis ? 'var(--series-2)' : 'var(--series-1)'} opacity={hover && hover.i !== i ? 0.55 : 1} />
                  <line x1={x(i)} x2={x(i)} y1={y(it.stat.ci[1])} y2={y(it.stat.ci[0])} stroke="var(--text2)" strokeWidth={1.5} />
                  <line x1={x(i) - 4} x2={x(i) + 4} y1={y(it.stat.ci[1])} y2={y(it.stat.ci[1])} stroke="var(--text2)" strokeWidth={1.5} />
                  <line x1={x(i) - 4} x2={x(i) + 4} y1={y(it.stat.ci[0])} y2={y(it.stat.ci[0])} stroke="var(--text2)" strokeWidth={1.5} />
                  <text x={x(i)} y={Math.max(M.t - 2, y(it.stat.ci[1]) - 4)} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--text1)">{pct(it.stat.rate)}</text>
                </>
              )}
              <text x={x(i)} y={H - 18} textAnchor="middle" fontSize={9.5} fill="var(--text2)">{it.label}</text>
              <text x={x(i)} y={H - 6} textAnchor="middle" fontSize={9} fill="var(--text3)">{thin ? `n=${it.stat.n} · too few` : `n=${it.stat.n.toLocaleString()}`}</text>
            </g>
          )
        })}
        {reference !== undefined && (
          <g>
            <line x1={M.l} x2={width - M.r} y1={y(reference)} y2={y(reference)} stroke="var(--text2)" strokeWidth={1} />
            {referenceLabel && <text x={width - M.r} y={y(reference) - 4} textAnchor="end" fontSize={9} fill="var(--text2)">{referenceLabel} {pct(reference)}</text>}
          </g>
        )}
      </svg>
      {hi && hover && (
        <Tooltip x={hover.x} y={hover.y} width={width}>
          <div className="viz-tip-h">{hi.label}</div>
          {hi.stat.n < MIN_BIN_SAMPLES
            ? <div className="viz-tip-r">Only {hi.stat.n} samples — too few for a rate</div>
            : <>
                <div className="viz-tip-r"><b>{pct(hi.stat.rate)}</b> ({hi.stat.hits.toLocaleString()} of {hi.stat.n.toLocaleString()})</div>
                <div className="viz-tip-m">95% interval {pct(hi.stat.ci[0])}–{pct(hi.stat.ci[1])}</div>
              </>}
        </Tooltip>
      )}
    </div>
  )
}
