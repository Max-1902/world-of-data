import type { ReactNode } from 'react'
import { EVIDENCE, type EvidenceKind } from '../utils/evidence'

/**
 * Shared labels for every number the dashboard shows: what kind of claim it is, where it comes from and how current it
 * is, and the state of the feed behind it. One look and one placement everywhere, so countries and topics can be
 * compared without relearning each panel. Styles: `.dl-*` in index.css.
 */

export function EvidenceTag({ kind }: { kind: EvidenceKind }) {
  const e = EVIDENCE[kind]
  return <span className={`dl-ev dl-ev-${kind}`} title={e.desc}>{e.label}</span>
}

/** "Source: … · as of …", always last in its block. */
export function SourceLine({ source, asOf, children }: { source: string; asOf?: string; children?: ReactNode }) {
  return (
    <div className="dl-src">
      <span>Source: {source}</span>
      {asOf && <span> · {asOf}</span>}
      {children && <span> · {children}</span>}
    </div>
  )
}

export type DataStatus = 'loading' | 'error' | 'empty' | 'stale'

const STATUS_TEXT: Record<DataStatus, string> = { loading: 'Loading', error: 'Unavailable', empty: 'No data', stale: 'Dated' }

/** State of the data behind a view, with an optional explanation. */
export function StatusLabel({ status, children }: { status: DataStatus; children?: ReactNode }) {
  return (
    <div className={`dl-status dl-status-${status}`} role={status === 'error' ? 'alert' : 'status'}>
      <b>{STATUS_TEXT[status]}</b>{children && <span> {children}</span>}
    </div>
  )
}

export type Tone = 'neutral' | 'accent' | 'up' | 'down' | 'warn'

/**
 * A headline figure: label (with its evidence kind), value and unit, the uncertainty range when there is one, and what
 * it is as of. Every panel's key numbers use this, so a forecast, a reported figure and an estimate read the same way.
 */
export function Metric({ label, value, unit, range, asOf, evidence, detail, tone = 'neutral' }: {
  label: string
  value: string
  unit?: string
  /** e.g. "80% range −0.2 to 0.6%" — stated in words, never implied by precision */
  range?: string
  asOf?: string
  evidence?: EvidenceKind
  detail?: ReactNode
  tone?: Tone
}) {
  return (
    <div className="viz-kpi dl-metric">
      <div className="dl-metric-head"><span className="viz-kpi-l">{label}</span>{evidence && <EvidenceTag kind={evidence} />}</div>
      <div className={`viz-kpi-v dl-tone-${tone}`}>{value}{unit && <small className="dl-unit"> {unit}</small>}</div>
      {range && <div className="dl-range">{range}</div>}
      {detail && <div className="viz-kpi-d">{detail}</div>}
      {asOf && <div className="dl-asof">{asOf}</div>}
    </div>
  )
}

/** One "label … value unit · year" line; a dated year is flagged the same way everywhere (utils/freshness.ts). */
export function MetricRow({ label, value, unit, year, stale, staleLabel, tone = 'neutral', onClick, title }: {
  label: ReactNode
  value: string
  unit?: string
  year?: string | number
  stale?: boolean
  staleLabel?: string
  tone?: Tone
  /** makes the row a button (e.g. fly the map to it) */
  onClick?: () => void
  title?: string
}) {
  const body = (
    <>
      <span className="dl-row-l">{label}</span>
      <span className={`dl-row-v dl-tone-${tone}`}>{value}{unit && <small className="dl-unit"> {unit}</small>}</span>
      {year !== undefined && <span className={`dl-row-y${stale ? ' stale' : ''}`} title={staleLabel ?? `reported for ${year}`}>{year}{stale ? ' ⚠' : ''}</span>}
    </>
  )
  return onClick ? <button className="dl-row dl-row-btn" onClick={onClick} title={title}>{body}</button> : <div className="dl-row" title={title}>{body}</div>
}

/** A ranked country line: rank, code, name, share-of-max bar, value and year. Clickable when `onClick` is given. */
export function RankRow({ rank, code, name, share, value, year, stale, staleLabel, tone = 'accent', onClick }: {
  rank: number
  code?: string
  name: string
  /** 0–1, the bar's length relative to the largest value */
  share?: number
  value: string
  year?: string | number
  stale?: boolean
  staleLabel?: string
  tone?: Tone
  onClick?: () => void
}) {
  const body = (
    <>
      <span className="dl-rank-n">#{rank}</span>
      {code && <span className={`dl-rank-code dl-tone-${tone}`}>{code}</span>}
      <span className="dl-rank-name">{name}</span>
      {share !== undefined && <span className="dl-rank-bar"><span className={`dl-bg-${tone}`} style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%` }} /></span>}
      <span className="dl-rank-v">{value}</span>
      {year !== undefined && <span className={`dl-row-y${stale ? ' stale' : ''}`} title={staleLabel ?? `reported for ${year}`}>{year}{stale ? '⚠' : ''}</span>}
    </>
  )
  return onClick ? <button className="dl-rank" onClick={onClick}>{body}</button> : <div className="dl-rank">{body}</div>
}

/** Small-caps heading inside a panel section ("TOP EXPORTS"). */
export function SectionLabel({ children, tone }: { children: ReactNode; tone?: Tone }) {
  return <div className={`dl-section${tone ? ` dl-tone-${tone}` : ''}`}>{children}</div>
}
