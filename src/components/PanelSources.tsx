import { useSyncExternalStore } from 'react'
import { SOURCE_RULES, healthTracker, type SourceHealth } from '../services/sourceHealth'
import type { PanelSource } from '../panels/types'
import { StatusLabel } from './DataLabels'

const RULE = new Map(SOURCE_RULES.map(r => [r.id, r]))

/** "Economy (World Bank)" → "World Bank": the provider, which is what a source line names. */
export function providerName(label: string): string {
  const m = label.match(/\(([^)]+)\)\s*$/)
  return m ? m[1] : label
}

const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** One source as the footer states it: name plus when it last answered (live) or what date it is as of (static). */
export function describeSource(src: PanelSource, health: ReadonlyMap<string, SourceHealth>): { name: string; when: string; problem: SourceHealth | null } {
  if (typeof src !== 'string') return { name: src.name, when: src.asOf ?? 'date not recorded', problem: null }
  const rule = RULE.get(src)
  const h = health.get(src)
  const name = providerName(h?.label ?? rule?.label ?? src)
  if (!h) return { name, when: 'not requested yet', problem: null }
  return { name, when: h.lastOk ? `updated ${clock(h.lastOk)}` : 'no successful response yet', problem: h.status === 'ok' ? null : h }
}

/**
 * The footer every panel gets from its frame (PanelHost): where its figures come from and how current they are, in one
 * place and one style, with a status line for any live source that is failing.
 */
export default function PanelSources({ sources }: { sources: readonly PanelSource[] }) {
  const all = useSyncExternalStore(healthTracker.subscribe, healthTracker.getAll)
  if (sources.length === 0) return null
  const health = new Map(all.map(h => [h.id, h]))
  const rows = sources.map(s => describeSource(s, health))
  return (
    <footer className="panel-sources" aria-label="Data sources">
      <div className="dl-src">
        <span>{rows.length > 1 ? 'Sources' : 'Source'}: </span>
        {rows.map((r, i) => <span key={r.name}>{i > 0 && ' · '}{r.name} <span className="panel-sources-when">({r.when})</span></span>)}
      </div>
      {rows.filter(r => r.problem).map(r => (
        <StatusLabel key={r.name} status={r.problem!.status === 'down' ? 'error' : 'stale'}>
          {r.name} {r.problem!.status === 'down' ? 'is not responding' : 'is responding intermittently'}{r.problem!.lastError ? ` (${r.problem!.lastError})` : ''}: figures here may be missing or out of date.
        </StatusLabel>
      ))}
    </footer>
  )
}
