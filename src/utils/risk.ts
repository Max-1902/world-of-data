import type { CrisisEvent } from '../types'

export function computeCountryRisk(crises: CrisisEvent[]) {
  const m: Record<string, { events: number; score: number }> = {}
  for (const c of crises) {
    if (!c.country) continue
    if (!m[c.country]) m[c.country] = { events: 0, score: 0 }
    m[c.country].events++
    const sev: Record<string, number> = { critical: 10, high: 6, medium: 3, low: 1 }
    m[c.country].score += sev[c.severity] ?? 1
  }
  return Object.entries(m).map(([country, v]) => ({ country, ...v })).sort((a, b) => b.score - a.score).slice(0, 12)
}

export function riskColor(score: number) {
  if (score >= 40) return 'var(--red)'
  if (score >= 20) return 'var(--amber)'
  if (score >= 10) return 'var(--amber)'
  return 'var(--accent)'
}
