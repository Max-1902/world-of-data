import { useState } from 'react'
import type { Matrix } from '../../utils/dataAnalytics'
import { sequentialColor, SEQUENTIAL } from '../../utils/vizPalette'
import { useElementWidth } from './useElementWidth'
import { Tooltip } from './ChartFrame'
import { textWidth, TICK } from './format'

const ROW_H = 17
const GAP = 2   // surface gap between cells
const MAX_LABEL_W = 128
const TOP = 4

/**
 * Row × time heatmap of counts. Colour is the square root of the cell value so one extreme cell doesn't wash out the
 * rest; empty cells stay plain surface, distinct from the lowest colour step. Row labels are clickable when `onRowClick` is set.
 */
export function HeatmapChart({ matrix, unit, fmtCol, onRowClick, ariaLabel }: {
  matrix: Matrix
  unit: string
  fmtCol: (t: number) => string
  onRowClick?: (row: string) => void
  ariaLabel: string
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<{ r: number; c: number; x: number; y: number } | null>(null)
  const cols = matrix.cols.length
  const LABEL_W = Math.min(MAX_LABEL_W, Math.max(56, ...matrix.rows.map(r => textWidth(r, 10))) + 10)
  const maxChars = Math.floor((LABEL_W - 10) / (10 * 0.56))
  const gridW = Math.max(40, width - LABEL_W - 4)
  const cw = gridW / Math.max(1, cols)
  const height = TOP + matrix.rows.length * ROW_H + 18
  const hv = hover ? { row: matrix.rows[hover.r], t: matrix.cols[hover.c], v: matrix.cells[hover.r][hover.c] } : null
  const pointer = onRowClick ? 'pointer' : 'default'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {matrix.rows.map((row, r) => {
          const y = TOP + r * ROW_H
          return (
            <g key={row}>
              <text x={LABEL_W - 8} y={y + ROW_H / 2 + 3} textAnchor="end" fontSize={10} fill="var(--text2)" style={{ cursor: pointer }} onClick={() => onRowClick?.(row)}>
                {row.length > maxChars ? row.slice(0, maxChars - 1) + '…' : row}
              </text>
              {matrix.cells[r].map((v, c) => (
                <rect key={c} x={LABEL_W + c * cw} y={y} width={Math.max(1, cw - GAP)} height={ROW_H - GAP} rx={2}
                  fill={v > 0 ? sequentialColor(Math.sqrt(v / (matrix.max || 1))) : 'var(--surface2)'}
                  stroke={hover && hover.r === r && hover.c === c ? 'var(--text1)' : 'none'} strokeWidth={1.5}
                  onPointerMove={e => { const b = ref.current!.getBoundingClientRect(); setHover({ r, c, x: e.clientX - b.left, y: e.clientY - b.top }) }}
                  onPointerLeave={() => setHover(null)} onClick={() => onRowClick?.(row)} style={{ cursor: pointer }} />
              ))}
            </g>
          )
        })}
        {[0, Math.floor((cols - 1) / 2), cols - 1].filter((c, i, a) => a.indexOf(c) === i).map(c => (
          <text key={c} x={LABEL_W + c * cw + (c === cols - 1 ? cw : c === 0 ? 0 : cw / 2)} y={height - 4} {...TICK}
            textAnchor={c === 0 ? 'start' : c === cols - 1 ? 'end' : 'middle'}>{fmtCol(matrix.cols[c])}</text>
        ))}
      </svg>
      <div className="viz-ramp" aria-hidden="true">
        <span>0</span>
        <i style={{ background: `linear-gradient(90deg, ${SEQUENTIAL.join(',')})` }} />
        <span>{matrix.max.toLocaleString()} {unit}</span>
      </div>
      {hv && hover && (
        <Tooltip x={hover.x} y={hover.y} width={width}>
          <div className="viz-tip-h">{hv.row}</div>
          <div className="viz-tip-r"><b>{hv.v.toLocaleString()}</b> {unit} · {fmtCol(hv.t)}</div>
        </Tooltip>
      )}
    </div>
  )
}
