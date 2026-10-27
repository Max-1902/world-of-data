import { Suspense, type ReactNode } from 'react'
import ErrorBoundary from './ErrorBoundary'
import PanelSources from './PanelSources'
import type { PanelSource } from '../panels/types'

/**
 * Wraps one panel: isolates render errors, shows a placeholder while its lazy chunk loads, and adds the standard
 * sources footer (the same place and style on every panel) from the registry's `sources`.
 */
export default function PanelHost({ label, sources = [], children }: { label: string; sources?: readonly PanelSource[]; children: ReactNode }) {
  return (
    <ErrorBoundary label={label}>
      <Suspense fallback={<div style={{ padding: '10px', fontSize: 11, color: 'var(--text3)' }}>Loading {label}…</div>}>
        {children}
      </Suspense>
      <PanelSources sources={sources} />
    </ErrorBoundary>
  )
}
