import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  /** Shown in the fallback so the user knows which panel failed. */
  label: string
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Isolates a render error to one panel instead of blanking the whole app.
 * Clicking Retry re-mounts the children (e.g. after a bad payload has been replaced by a poll).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[panel:${this.props.label}] render failed:`, error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--red)' }}>{this.props.label} failed to render</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{this.state.error.message}</span>
        <button
          onClick={() => this.setState({ error: null })}
          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-strong)', background: 'var(--surface2)', color: 'var(--text1)', cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    )
  }
}
