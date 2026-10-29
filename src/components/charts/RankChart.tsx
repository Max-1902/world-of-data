import { useState } from 'react'
import { useElementWidth } from './useElementWidth'
import { useHoverLeave } from './hoverLeave'
import { Tooltip } from './ChartFrame'
import { textWidth } from './format'
import { rightRounded } from './marks'

export interface RankItem { key: string; label: string; value: number; text: string; detail?: string }

const ROW_H = 21
const BAR_H = 12

/**
 * Horizontal ranked bars with the value at each tip. Bars start at a single baseline; clicking a row selects its key.
 * Charts stacked as one comparison pass the combined rows as `sizeWith`, so they share the label column, value room and
 * bar scale — otherwise each would start its bars at a different x and stretch its own longest bar to full width.
 */
export function RankChart({ items, ariaLabel, onSelect, sizeWith = items, color = 'var(--series-1)' }: {
  items: RankItem[]
  ariaLabel: string
  onSelect?: (key: string) => void
  sizeWith?: RankItem[]
  color?: string
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null)
  const onLeave = useHoverLeave(ref, () => setHover(null))
  const place = (i: number, e: React.PointerEvent) => { const b = ref.current!.getBoundingClientRect(); setHover({ i, x: e.clientX - b.left, y: e.clientY - b.top }) }
  const max = Math.max(...sizeWith.map(i => i.value), 1e-9)
  // Label column fits the longest name up to 40% of the width; value room is measured, so tips never clip.
  const LABEL_W = Math.round(Math.min(width * 0.4, Math.max(48, ...sizeWith.map(i => textWidth(i.label, 10))) + 10))
  const maxChars = Math.floor((LABEL_W - 10) / (10 * 0.56))
  const valueRoom = Math.max(...sizeWith.map(i => textWidth(i.text, 10)), 20) + 10
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
              onPointerMove={e => place(i, e)} onPointerDown={e => place(i, e)} onPointerLeave={onLeave}>
              <rect x={0} y={y - 1} width={width} height={ROW_H} fill="transparent" />
              <text x={LABEL_W - 8} y={y + ROW_H / 2 - 1} dominantBaseline="central" textAnchor="end" fontSize={10} fill="var(--text2)">{it.label.length > maxChars ? it.label.slice(0, maxChars - 1) + '…' : it.label}</text>
              <path d={rightRounded(LABEL_W, y + (ROW_H - BAR_H) / 2 - 1, w, BAR_H, 4)} fill={color} opacity={hover && hover.i !== i ? 0.55 : 1} />
              <text x={LABEL_W + w + 5} y={y + ROW_H / 2 - 1} dominantBaseline="central" fontSize={10} fontWeight={600} fill="var(--text1)" style={{ fontVariantNumeric: 'tabular-nums' }}>{it.text}</text>
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
