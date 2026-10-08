import type { PanelState } from '../../types'

/** Props for panels that can shade the globe through the Country Analytics layer. */
export interface MapLinkProps { panelState?: PanelState; onToggleLayer?: (id: keyof PanelState) => void }

export const infoStrip: React.CSSProperties = { fontSize: 9, color: 'var(--text2)', padding: '3px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }
