import { useState } from 'react'
import type { CorrMatrix } from '../../utils/countryStats'
import { BELOW, ABOVE, NEUTRAL, divergingColor } from '../../utils/vizPalette'
import { useElementWidth } from './useElementWidth'
import { Tooltip } from './ChartFrame'

const LABEL_W = 64
const TOP = 54

/**
 * Spearman correlation matrix. Colour is diverging around zero (blue negative, red positive) and every cell also prints
 * its value, so colour never carries the number alone. Click a cell to plot that pair.
 */
export function CorrMatrixChart({ matrix, labels, names, onPick }: {
  matrix: CorrMatrix
  labels: string[]
  names: string[]
  onPick?: (i: number, j: number) => void
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<{ i: number; j: number; x: number; y: number } | null>(null)
  const k = matrix.ids.length
  const cell = Math.max(18, Math.min(36, (width - LABEL_W - 36) / k))   // right margin leaves room for the rotated column labels
  const height = TOP + k * cell + 4
  const hv = hover ? { a: names[hover.i], b: names[hover.j], r: matrix.rho[hover.i][hover.j], n: matrix.n[hover.i][hover.j] } : null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg width={width} height={height} role="img" aria-label={`Spearman correlation matrix of ${k} country indicators`}>
        {labels.map((l, j) => (
          <text key={`c${j}`} transform={`translate(${LABEL_W + j * cell + cell / 2},${TOP - 6}) rotate(-45)`} fontSize={9} fill="var(--text2)">{l}</text>
        ))}
        {labels.map((l, i) => (
          <text key={`r${i}`} x={LABEL_W - 6} y={TOP + i * cell + cell / 2 + 3} textAnchor="end" fontSize={9} fill="var(--text2)">{l}</text>
        ))}
        {matrix.rho.map((row, i) => row.map((r, j) => {
          const diag = i === j
          return (
            <g key={`${i}-${j}`} style={{ cursor: !diag && r !== null && onPick ? 'pointer' : 'default' }}
              onPointerMove={e => { const b = ref.current!.getBoundingClientRect(); setHover({ i, j, x: e.clientX - b.left, y: e.clientY - b.top }) }}
              onPointerLeave={() => setHover(null)} onClick={() => { if (!diag && r !== null) onPick?.(i, j) }}>
              <rect x={LABEL_W + j * cell} y={TOP + i * cell} width={cell - 1} height={cell - 1} rx={2}
                fill={r === null ? 'var(--surface2)' : diag ? 'var(--border-strong)' : divergingColor(r)}
                stroke={hover && hover.i === i && hover.j === j ? 'var(--text1)' : 'none'} strokeWidth={1.5} />
              <text x={LABEL_W + j * cell + cell / 2} y={TOP + i * cell + cell / 2 + 3} textAnchor="middle" fontSize={cell > 28 ? 9 : 8}
                fill={r !== null && !diag && Math.abs(r) > 0.45 ? '#ffffff' : 'var(--text2)'}>
                {r === null ? '–' : diag ? '' : r.toFixed(2).replace('0.', '.').replace('-', '−')}
              </text>
            </g>
          )
        }))}
      </svg>
      <div className="viz-ramp" aria-hidden="true">
        <span>−1</span>
        <i style={{ background: `linear-gradient(90deg, ${BELOW}, ${NEUTRAL}, ${ABOVE})` }} />
        <span>+1</span>
      </div>
      {hv && hover && (
        <Tooltip x={hover.x} y={hover.y} width={width}>
          <div className="viz-tip-h">{hv.a} × {hv.b}</div>
          <div className="viz-tip-r">{hv.r === null ? 'Too few countries in common' : <><b>ρ = {hv.r.toFixed(2)}</b> · {hv.n} countries</>}</div>
          {hover.i !== hover.j && hv.r !== null && onPick && <div className="viz-tip-m">Click to plot this pair</div>}
        </Tooltip>
      )}
    </div>
  )
}
