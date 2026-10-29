import { useSyncExternalStore } from 'react'
import { SOURCE_RULES, healthTracker, type DataNote, type SourceHealth } from '../services/sourceHealth'
import type { PanelSource } from '../panels/types'
import { StatusLabel } from './DataLabels'

const RULE = new Map(SOURCE_RULES.map(r => [r.id, r]))

/** "Economy (World Bank)" → "World Bank": the provider, which is what a source line names. */
export function providerName(label: string): string {
  const m = label.match(/\(([^)]+)\)\s*$/)
  return m ? m[1] : label
}

const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** The parts of a live source's data note the footer prints after "updated …". */
const noteParts = (n: DataNote | undefined) => [n?.asOf, n?.coverage].filter((x): x is string => !!x)

/**
 * One source as the footer states it: name plus when it last answered (live, with what that response held when the
 * service reported it) or what date it is as of (static).
 */
export function describeSource(
  src: PanelSource, health: ReadonlyMap<string, SourceHealth>, notes: ReadonlyMap<string, DataNote> = new Map(),
): { name: string; when: string; problem: SourceHealth | null; warn: string | null } {
  if (typeof src !== 'string') return { name: src.name, when: src.asOf ?? 'date not recorded', problem: null, warn: null }
  const rule = RULE.get(src)
  const h = health.get(src)
  const note = notes.get(src)
  const name = providerName(h?.label ?? rule?.label ?? src)
  if (!h) return { name, when: 'not requested yet', problem: null, warn: null }
  const updated = h.lastOk ? `updated ${clock(h.lastOk)}` : 'no successful response yet'
  return { name, when: [updated, ...noteParts(note)].join(' · '), problem: h.status === 'ok' ? null : h, warn: note?.warn ?? null }
}

/**
 * The footer every panel gets from its frame (PanelHost): where its figures come from and how current they are, in one
 * place and one style, with a status line for any live source that is failing.
 */
export default function PanelSources({ sources }: { sources: readonly PanelSource[] }) {
  const all = useSyncExternalStore(healthTracker.subscribe, healthTracker.getAll)
  const notes = useSyncExternalStore(healthTracker.subscribe, healthTracker.getNotes)
  if (sources.length === 0) return null
  const health = new Map(all.map(h => [h.id, h]))
  const rows = sources.map(s => describeSource(s, health, notes))
  return (
    <footer className="panel-sources" aria-label="Data sources">
      <div className="dl-src">
        <span>{rows.length > 1 ? 'Sources' : 'Source'}: </span>
        {rows.map((r, i) => <span key={r.name}>{i > 0 && ' · '}{r.name} <span className="panel-sources-when">({r.when})</span></span>)}
      </div>
      {rows.filter(r => r.warn).map(r => (
        <StatusLabel key={`${r.name}-warn`} status="stale">{r.name}: {r.warn}</StatusLabel>
      ))}
      {rows.filter(r => r.problem).map(r => (
        <StatusLabel key={r.name} status={r.problem!.status === 'down' ? 'error' : 'stale'}>
          {r.name} {r.problem!.status === 'down' ? 'is not responding' : 'is responding intermittently'}{r.problem!.lastError ? ` (${r.problem!.lastError})` : ''}: figures here may be missing or out of date.
        </StatusLabel>
      ))}
    </footer>
  )
}
