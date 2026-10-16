import { Fragment, type ReactNode } from 'react'
import type { ToolResult } from '../../../services/aiTools'
import { CHART_LINE } from '../../../services/aiTools'
import { AIChart } from './AIChart'

const INLINE = /(\*\*[^*]+\*\*|\[(?:dashboard|background|inference)\]|\((?:R\d+)(?:\s*,\s*R\d+)*\)|`[^`]+`)/g

function inline(text: string, onRef?: (id: string) => void): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    const tag = part.match(/^\[(dashboard|background|inference)\]$/)
    if (tag) return <span key={i} className={`ai-src-tag ${tag[1]}`} title={TAG_HELP[tag[1]]}>{tag[1]}</span>
    if (/^\(R\d+/.test(part)) {
      const ids = part.slice(1, -1).split(',').map(s => s.trim())
      return <span key={i} className="ai-ref-group">{ids.map(id => (
        <button key={id} className="ai-ref" onClick={() => onRef?.(id)} title={`Show result ${id}`}>{id}</button>
      ))}</span>
    }
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="ai-code">{part.slice(1, -1)}</code>
    return <Fragment key={i}>{part}</Fragment>
  })
}

const TAG_HELP: Record<string, string> = {
  dashboard: 'Rests on data the dashboard fetched or computed',
  background: "The model's general knowledge — may be out of date",
  inference: "The model's own reasoning",
}

const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())

/**
 * The analyst's answer as a document: headings, bullet and numbered lists, markdown tables, inline source tags and
 * result references, and charts at their [CHART:Rn] lines. Deliberately a small subset of markdown — no HTML, no
 * links — so model output can never inject markup.
 */
export function AIMarkdown({ text, results, onRef, streaming = false }: {
  text: string
  results: ToolResult[]
  onRef?: (id: string) => void
  streaming?: boolean
}) {
  const lines = text.split('\n')
  const out: ReactNode[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const t = line.trim()
    const chart = t.match(CHART_LINE)
    if (chart) {
      const r = results.find(x => x.id.toUpperCase() === chart[1].toUpperCase())
      if (r?.chart) out.push(<div key={i} className="ai-chart"><AIChart result={r} /></div>)
      continue
    }
    if (t.startsWith('|') && t.endsWith('|') && t.length > 2) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const r = lines[i].trim()
        if (!/^\|[\s:|-]+\|$/.test(r)) rows.push(cells(r))
        i++
      }
      i--
      const [head, ...body] = rows
      // a table still streaming in has only its header: render it as text until a body row arrives
      if (!head) continue
      out.push(
        <div key={i} className="ai-table-wrap">
          <table className="ai-table">
            <thead><tr>{head.map((c, k) => <th key={k}>{inline(c, onRef)}</th>)}</tr></thead>
            <tbody>{body.map((r, k) => <tr key={k}>{head.map((_, j) => <td key={j}>{inline(r[j] ?? '', onRef)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
      continue
    }
    const h = t.match(/^(#{1,4})\s+(.*)$/)
    if (h) { out.push(<div key={i} className={`ai-md-h h${h[1].length}`}>{inline(h[2].replace(/\*\*/g, ''), onRef)}</div>); continue }
    const b = t.match(/^[-•*]\s+(.*)$/)
    if (b) { out.push(<div key={i} className="ai-response-line bullet"><span className="ai-bullet-mark" /><span>{inline(b[1], onRef)}</span></div>); continue }
    const n = t.match(/^(\d+)[.)]\s+(.*)$/)
    if (n) { out.push(<div key={i} className="ai-response-line numbered"><span className="ai-num-mark">{n[1]}</span><span>{inline(n[2], onRef)}</span></div>); continue }
    if (!t) { out.push(<div key={i} className="ai-md-gap" />); continue }
    out.push(<div key={i} className="ai-response-line">{inline(line, onRef)}</div>)
  }
  return <div className="ai-md">{out}{streaming && <span className="ai-cursor" />}</div>
}
