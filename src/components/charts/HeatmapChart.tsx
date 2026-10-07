import { useState } from 'react'
import { format } from 'date-fns'
import type { CountryMatrix } from '../../utils/analytics'
import { sequentialColor, SEQUENTIAL } from '../../utils/vizPalette'
import { useElementWidth } from './useElementWidth'
import { Tooltip } from './ChartFrame'

const ROW_H = 17
const GAP = 1
const LABEL_W = 92
const TOP = 4
const dayLabel = (t: number) => format(new Date(t + new Date(t).getTimezoneOffset() * 60000), 'd MMM')

/**
 * Country × day heatmap. Colour is the square root of the day's score so one extreme day doesn't wash out the rest;
 * empty days stay as plain surface, distinct from the lowest colour step. Row labels are buttons (→ fly to country).
 */
export function HeatmapChart({ matrix, onCountryClick }: { matrix: CountryMatrix; onCountryClick?: (country: string) => void }) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<{ r: number; c: number; x: number; y: number } | null>(null)
  const cols = matrix.days.length
  const gridW = Math.max(40, width - LABEL_W - 4)
  const cw = gridW / Math.max(1, cols)
  const height = TOP + matrix.countries.length * ROW_H + 18
  const hv = hover ? { country: matrix.countries[hover.r], day: matrix.days[hover.c], score: matrix.cells[hover.r][hover.c] } : null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg width={width} height={height} role="img" aria-label={`Heatmap of weighted severity for the ${matrix.countries.length} most active countries over ${cols} days`}>
        {matrix.countries.map((country, r) => {
          const y = TOP + r * ROW_H
          return (
            <g key={country}>
              <text x={LABEL_W - 8} y={y + ROW_H / 2 + 3} textAnchor="end" fontSize={10} fill="var(--text2)"
                style={{ cursor: onCountryClick ? 'pointer' : 'default' }} onClick={() => onCountryClick?.(country)}>
                {country.length > 14 ? country.slice(0, 13) + '…' : country}
              </text>
              {matrix.cells[r].map((v, c) => (
                <rect key={c} x={LABEL_W + c * cw} y={y} width={Math.max(1, cw - GAP)} height={ROW_H - GAP * 2} rx={1.5}
                  fill={v > 0 ? sequentialColor(Math.sqrt(v / (matrix.max || 1))) : 'var(--surface2)'}
                  stroke={hover && hover.r === r && hover.c === c ? 'var(--text1)' : 'none'} strokeWidth={1.5}
                  onPointerMove={e => { const b = ref.current!.getBoundingClientRect(); setHover({ r, c, x: e.clientX - b.left, y: e.clientY - b.top }) }}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => onCountryClick?.(country)} style={{ cursor: onCountryClick ? 'pointer' : 'default' }} />
              ))}
            </g>
          )
        })}
        {[0, Math.floor((cols - 1) / 2), cols - 1].map(c => (
          <text key={c} x={LABEL_W + c * cw + (c === cols - 1 ? cw : c === 0 ? 0 : cw / 2)} y={height - 4} fontSize={9} fill="var(--text3)"
            textAnchor={c === 0 ? 'start' : c === cols - 1 ? 'end' : 'middle'}>{dayLabel(matrix.days[c])}</text>
        ))}
      </svg>
      <div className="viz-ramp" aria-hidden="true">
        <span>0</span>
        <i style={{ background: `linear-gradient(90deg, ${SEQUENTIAL.join(',')})` }} />
        <span>{matrix.max.toLocaleString()} / day</span>
      </div>
      {hv && hover && (
        <Tooltip x={hover.x} y={hover.y} width={width}>
          <div className="viz-tip-h">{hv.country}</div>
          <div className="viz-tip-r"><b>{hv.score.toLocaleString()}</b> score · {dayLabel(hv.day)}</div>
        </Tooltip>
      )}
    </div>
  )
}
