import { useState, type ReactNode } from 'react'

export interface TableData { columns: string[]; rows: (string | number)[][] }

/**
 * Card around a chart: title, one-line "what am I looking at", and a Chart / Table switch.
 * The table view carries every value the chart encodes, so nothing depends on colour or hover.
 */
export function ChartFrame({ title, subtitle, table, children, footer }: {
  title: string
  subtitle?: string
  table: TableData
  children: ReactNode
  footer?: ReactNode
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  return (
    <section className="viz-card" aria-label={title}>
      <header className="viz-head">
        <div style={{ minWidth: 0 }}>
          <h3 className="viz-title">{title}</h3>
          {subtitle && <p className="viz-sub">{subtitle}</p>}
        </div>
        <div className="viz-toggle" role="group" aria-label={`${title} view`}>
          {(['chart', 'table'] as const).map(v => (
            <button key={v} className={view === v ? 'on' : ''} aria-pressed={view === v} onClick={() => setView(v)}>{v === 'chart' ? 'Chart' : 'Table'}</button>
          ))}
        </div>
      </header>
      {view === 'chart' ? children : (
        <div className="viz-table-wrap">
          <table className="viz-table">
            <thead><tr>{table.columns.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((cell, j) => j === 0 ? <th key={j} scope="row">{cell}</th> : <td key={j}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      {footer && <div className="viz-foot">{footer}</div>}
    </section>
  )
}

export function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  // Flip to the left of the pointer near the right edge so the readout never clips.
  const flip = x > width * 0.55
  return (
    <div className="viz-tip" role="status" style={{ left: flip ? undefined : x + 12, right: flip ? width - x + 12 : undefined, top: Math.max(0, y - 8) }}>
      {children}
    </div>
  )
}
