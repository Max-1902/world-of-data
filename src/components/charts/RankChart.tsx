import { useState } from 'react'
import { useElementWidth } from './useElementWidth'
import { Tooltip } from './ChartFrame'

export interface RankItem { key: string; label: string; value: number; text: string; detail?: string }

const ROW_H = 21
const LABEL_W = 112

/** Horizontal ranked bars with the value at each tip. Bars start at a single baseline; clicking a row selects its key. */
export function RankChart({ items, ariaLabel, onSelect }: { items: RankItem[]; ariaLabel: string; onSelect?: (key: string) => void }) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null)
  const max = Math.max(...items.map(i => i.value), 1e-9)
  const valueRoom = 58
  const plotW = Math.max(30, width - LABEL_W - valueRoom)
  const height = items.length * ROW_H + 4
  const hi = hover ? items[hover.i] : null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {items.map((it, i) => {
          const y = 2 + i * ROW_H
          const w = Math.max(2, (it.value / max) * plotW)
          return (
            <g key={it.key} style={{ cursor: onSelect ? 'pointer' : 'default' }} onClick={() => onSelect?.(it.key)}
              onPointerMove={e => { const b = ref.current!.getBoundingClientRect(); setHover({ i, x: e.clientX - b.left, y: e.clientY - b.top }) }} onPointerLeave={() => setHover(null)}>
              <rect x={0} y={y - 1} width={width} height={ROW_H} fill="transparent" />
              <text x={LABEL_W - 8} y={y + ROW_H / 2 + 1} textAnchor="end" fontSize={10} fill="var(--text2)">{it.label.length > 17 ? it.label.slice(0, 16) + '…' : it.label}</text>
              <rect x={LABEL_W} y={y + 3} width={w} height={ROW_H - 8} rx={3} fill="var(--series-1)" opacity={hover && hover.i !== i ? 0.55 : 1} />
              <text x={LABEL_W + w + 5} y={y + ROW_H / 2 + 1} fontSize={9.5} fontWeight={600} fill="var(--text1)">{it.text}</text>
            </g>
          )
        })}
      </svg>
      {hi && hover && (
        <Tooltip x={hover.x} y={hover.y} width={width}>
          <div className="viz-tip-h">{hi.label}</div>
          <div className="viz-tip-r"><b>{hi.text}</b></div>
          {hi.detail && <div className="viz-tip-m">{hi.detail}</div>}
        </Tooltip>
      )}
    </div>
  )
}
