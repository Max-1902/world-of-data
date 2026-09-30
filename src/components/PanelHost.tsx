import { Suspense, type ReactNode } from 'react'
import ErrorBoundary from './ErrorBoundary'

/** Wraps one panel: isolates render errors and shows a placeholder while its lazy chunk loads. */
export default function PanelHost({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ErrorBoundary label={label}>
      <Suspense fallback={<div style={{ padding: '10px', fontSize: 11, color: 'var(--text3)' }}>Loading {label}…</div>}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}
