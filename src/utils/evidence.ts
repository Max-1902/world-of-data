/**
 * The three kinds of claim the dashboard makes, labelled the same way everywhere (panels, legends, map popups), so a
 * reader can always tell a reported figure from an estimate from something a scenario simply assumes.
 */
export type EvidenceKind = 'observed' | 'statistical' | 'assumption'

export const EVIDENCE: Record<EvidenceKind, { label: string; desc: string }> = {
  observed: { label: 'Observed', desc: 'Figures as reported by the named source. Not modelled.' },
  statistical: { label: 'Statistical', desc: 'Estimated from the data by the stated method. Describes an association, not a cause, and carries uncertainty.' },
  assumption: { label: 'Assumption', desc: 'Set by you or by the scenario. Not measured.' },
}
