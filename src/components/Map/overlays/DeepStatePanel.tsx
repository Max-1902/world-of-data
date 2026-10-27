import { ExternalLink } from 'lucide-react'
import CloseButton from '../../CloseButton'

const URL = 'https://deepstatemap.live/en#6/49.4383200/32.0526800'

/** The right-hand half of the split view: DeepState's Ukraine battlefield map in an iframe. */
export default function DeepStatePanel({ onClose }: { onClose?: () => void }) {
  return (
  <div className="ds-panel">
    <div className="ds-head">
      <span className="ds-title">DeepState · Ukraine frontline</span>
      <a className="ds-link" href={URL} target="_blank" rel="noopener noreferrer">
        Open full map <ExternalLink size={11} />
      </a>
      {onClose && <CloseButton onClick={onClose} label="Close DeepState panel" />}
    </div>

    {/* Embedded DeepState map — may be blocked by CSP on some browsers */}
    <iframe key="deepstate-iframe" src={URL} title="DeepState Ukraine Battlefield Map" allow="fullscreen" className="ds-frame" />

    {/* Shown underneath the iframe until it paints, or if the browser blocks it */}
    <div className="ds-fallback">
      <div>Loading the DeepState map…</div>
      <small>If your browser blocks it, use “Open full map” above.</small>
    </div>
  </div>
  )
}
