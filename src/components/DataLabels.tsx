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
