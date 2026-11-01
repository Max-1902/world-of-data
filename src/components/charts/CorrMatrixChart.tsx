import { useState } from 'react'
import type { CorrMatrix } from '../../utils/countryStats'
import { BELOW, ABOVE, NEUTRAL, NEUTRAL_LIGHT, divergingColor, inkOn } from '../../utils/vizPalette'
import { useActiveTheme } from '../../hooks/useTheme'
import { useElementWidth } from './useElementWidth'
import { Tooltip } from './ChartFrame'

const LABEL_W = 92
const TOP = 76      // room for the longest rotated column label ("Resource rents")
const RIGHT = 60    // the last rotated column label runs past the grid

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
  const neutral = useActiveTheme() === 'light' ? NEUTRAL_LIGHT : NEUTRAL
  const k = matrix.ids.length
  const cell = Math.max(18, Math.min(56, (width - LABEL_W - RIGHT) / k))
  const height = TOP + k * cell + 4
  const hv = hover ? { a: names[hover.i], b: names[hover.j], r: matrix.rho[hover.i][hover.j], n: matrix.n[hover.i][hover.j] } : null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg width={width} height={height} role="img" aria-label={`Spearman correlation matrix of ${k} country indicators`}>
        {labels.map((l, j) => (
          <text key={`c${j}`} transform={`translate(${LABEL_W + j * cell + cell / 2},${TOP - 6}) rotate(-45)`} fontSize={cell > 40 ? 11 : 10} fill="var(--text2)">{l}</text>
        ))}
        {labels.map((l, i) => (
          <text key={`r${i}`} x={LABEL_W - 6} y={TOP + i * cell + cell / 2 - 1} dominantBaseline="central" textAnchor="end" fontSize={cell > 40 ? 11 : 10} fill="var(--text2)">{l}</text>
        ))}
        {matrix.rho.map((row, i) => row.map((r, j) => {
          const diag = i === j
          const fill = r === null || diag ? null : divergingColor(r, neutral)
          return (
            <g key={`${i}-${j}`} style={{ cursor: !diag && r !== null && onPick ? 'pointer' : 'default' }}
              onPointerMove={e => { const b = ref.current!.getBoundingClientRect(); setHover({ i, j, x: e.clientX - b.left, y: e.clientY - b.top }) }}
              onPointerLeave={() => setHover(null)} onClick={() => { if (!diag && r !== null) onPick?.(i, j) }}>
              {/* the diagonal (ρ = 1 by definition) is an outlined cell with a muted 1, so it reads neither as a near-zero grey nor as missing data */}
              <rect x={LABEL_W + j * cell + (diag ? 0.5 : 0)} y={TOP + i * cell + (diag ? 0.5 : 0)} width={cell - 2 - (diag ? 1 : 0)} height={cell - 2 - (diag ? 1 : 0)} rx={3}
                fill={fill ?? (diag ? 'none' : 'var(--surface2)')}
                stroke={hover && hover.i === i && hover.j === j ? 'var(--text1)' : diag ? 'var(--border)' : 'none'} strokeWidth={hover && hover.i === i && hover.j === j ? 1.5 : 1} />
              <text x={LABEL_W + j * cell + cell / 2 - 1} y={TOP + i * cell + cell / 2 - 1} dominantBaseline="central" textAnchor="middle" fontSize={cell > 40 ? 11.5 : cell > 28 ? 10 : 8.5}
                fill={diag ? 'var(--text3)' : fill && Math.abs(r!) >= 0.3 ? inkOn(fill) : 'var(--text2)'} style={{ fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>
                {diag ? '1' : r === null ? '–' : r.toFixed(2).replace('0.', '.').replace('-', '−')}
              </text>
            </g>
          )
        }))}
      </svg>
      <div className="viz-ramp" aria-hidden="true">
        <span>−1</span>
        <i style={{ background: `linear-gradient(90deg, ${BELOW}, ${neutral}, ${ABOVE})` }} />
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
