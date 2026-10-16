import { useState } from 'react'
import { ChevronRight, Database, AlertTriangle, Loader2 } from 'lucide-react'
import type { ToolCall, ToolResult } from '../../../services/aiTools'
import { AIChart } from './AIChart'

/**
 * What the analyst looked at before answering: every data request, its status, its source, and — expanded — the
 * exact text the model was given, plus its chart. This is the evidence; the answer above it is the interpretation.
 */
export function InvestigationTrail({ turnId, results, pending = [], notes = [], open, onToggle }: {
  turnId: string
  results: ToolResult[]
  pending?: ToolCall[]
  notes?: string[]
  /** result id expanded from outside (clicking a reference in the answer) */
  open?: string | null
  onToggle?: (id: string | null) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [local, setLocal] = useState<string | null>(null)
  const expanded = open !== undefined ? open : local
  const toggle = (id: string) => { const next = expanded === id ? null : id; if (onToggle) onToggle(next); else setLocal(next) }
  if (!results.length && !pending.length) return null
  const failed = results.filter(r => !r.ok).length

  return (
    <div className="ai-trail">
      <button className="ai-trail-head" onClick={() => setCollapsed(c => !c)} aria-expanded={!collapsed}>
        <ChevronRight size={12} className={collapsed ? '' : 'open'} />
        <Database size={12} />
        <span>
          {pending.length ? `Fetching ${pending.length} dataset${pending.length === 1 ? '' : 's'}…` : `Investigated ${results.length} dataset${results.length === 1 ? '' : 's'}`}
          {failed > 0 && <em> · {failed} unavailable</em>}
        </span>
      </button>
      {!collapsed && (
        <div className="ai-trail-body">
          {notes.map((n, i) => <div key={`n${i}`} className="ai-trail-note">{n}</div>)}
          {results.map(r => (
            <div key={r.id} id={`ai-res-${turnId}-${r.id}`} className={`ai-trail-row${r.ok ? '' : ' failed'}${expanded === r.id ? ' expanded' : ''}`}>
              <button className="ai-trail-item" onClick={() => toggle(r.id)} aria-expanded={expanded === r.id}>
                <span className="ai-trail-id">{r.id}</span>
                {!r.ok && <AlertTriangle size={11} color="var(--amber)" />}
                <span className="ai-trail-title">{r.title}</span>
                {r.ok && <span className="ai-trail-src">{r.source.split(/[;(,]/)[0]}</span>}
              </button>
              {expanded === r.id && (
                <div className="ai-trail-detail">
                  {r.chart && r.ok && <AIChart result={r} />}
                  <pre className="ai-trail-text">{r.text}</pre>
                  <div className="ai-trail-meta">{r.call} · fetched {new Date(r.at).toISOString().slice(11, 16)} UTC</div>
                </div>
              )}
            </div>
          ))}
          {pending.map(c => (
            <div key={c.raw} className="ai-trail-row pending">
              <span className="ai-trail-item"><Loader2 size={11} className="ai-spin" /><span className="ai-trail-title">{c.tool}{c.args.length ? ` · ${c.args.join(' · ')}` : ''}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
