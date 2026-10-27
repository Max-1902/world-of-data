/** Shared building blocks for the country drawer and its section files. */
import { resolveISO2 } from '../../services/worldbank'
import { sameCountry } from '../../utils/countryBrief'

export const fmt = (n: number) => n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1_000 ? (n / 1_000).toFixed(0) + 'K' : n.toString()

// Soft translucent tint of a token color, for badge/chip backgrounds
export const soft = (color: string, pct = 14) => `color-mix(in srgb, ${color} ${pct}%, transparent)`

/**
 * Does a dataset's country label refer to this country? Compares ISO codes when both resolve, so
 * abbreviations work ("UK" ~ "United Kingdom") and prefixes don't ("UK" is not "Ukraine").
 * Shared labels ("Zambia/Zimbabwe") match either side; unresolvable ones fall back to whole-word names.
 */
export function matchCountry(name: string, lc: string): boolean {
  const target = resolveISO2(lc)
  return name.split('/').some(part => {
    const code = resolveISO2(part)
    return code && target ? code === target : sameCountry(part, lc)
  })
}

// Defined at module scope (not inside the drawer) so React keeps their subtrees mounted across renders.
// Section renderer helper
// The heading is the shared section style (DataLabels' SectionLabel); the section's colour survives only as a marker.
export const Section = ({ title, color, count, children }: { title: string; color: string; count?: number; children: React.ReactNode }) => (
  <section className="cd-section">
    <div className="dl-section cd-section-h"><i style={{ background: color }} aria-hidden />{title}{count !== undefined ? ` (${count})` : ''}</div>
    {children}
  </section>
)

export const Row = ({ children, onClick, style }: { children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties }) => (
  <div
    onClick={onClick}
    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px', borderRadius: 'var(--r-sm)', fontSize: 11, cursor: onClick ? 'pointer' : 'default', ...style }}
    onMouseEnter={onClick ? e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2)' } : undefined}
    onMouseLeave={onClick ? e => { (e.currentTarget as HTMLDivElement).style.background = '' } : undefined}
  >
    {children}
  </div>
)

export const Dot = ({ color }: { color: string }) => (
  <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
)

// Horizontal bar chart: one bar per category, length proportional to value.
// Direct labels (name + value) so identity never depends on color alone.
export const MiniBarChart = ({ data, unit }: { data: { label: string; value: number; color: string }[]; unit?: string }) => {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div role="img" aria-label={`Bar chart: ${data.map(d => `${d.label} ${d.value}${unit ?? ''}`).join(', ')}`}>
      {data.map(d => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
          <span style={{ width: 74, flexShrink: 0, fontSize: 10, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
          <div style={{ flex: 1, height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.max((d.value / max) * 100, 3)}%`, height: '100%',
              background: d.color, borderRadius: 4,
            }} />
          </div>
          <span style={{ width: 54, flexShrink: 0, textAlign: 'right', fontSize: 10, fontWeight: 700, color: d.color, fontVariantNumeric: 'tabular-nums' }}>
            {d.value.toLocaleString()}{unit ?? ''}
          </span>
        </div>
      ))}
    </div>
  )
}
