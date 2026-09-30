import type { CrisisEvent, Flight } from '../types'

/** Composite 0–100 global threat index shown in the Threat Level panel (and recorded in history). */
export function computeThreatScore(crises: CrisisEvent[], flights: Flight[]): number {
  const base = crises.reduce((acc, c) => {
    const w: Record<string, number> = { critical: 8, high: 4, medium: 2, low: 1 }
    return acc + (w[c.severity] ?? 1)
  }, 0)
  return Math.min(100, Math.round(base / 8 + (flights.length > 5000 ? 5 : 0)))
}
