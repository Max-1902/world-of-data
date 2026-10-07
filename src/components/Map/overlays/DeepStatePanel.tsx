import CloseButton from '../../CloseButton'

/** The right-hand half of the split view: DeepState's Ukraine battlefield map in an iframe. */
export default function DeepStatePanel({ onClose }: { onClose?: () => void }) {
  return (
  <div style={{
    flex: '0 0 50%', height: '100%', position: 'relative',
    background: '#03060e',
    borderLeft: '2px solid #ff1a3e33',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  }}>
    {/* Header bar */}
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 12px',
      background: 'rgba(8,14,10,0.96)',
      borderBottom: '1px solid #ff1a3e33',
      flexShrink: 0, zIndex: 2,
    }}>
      <div style={{ width: 6, height: 6, background: '#ff1a3e', borderRadius: '50%', animation: 'blink 1s step-end infinite' }} />
      <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#ff1a3e', fontWeight: 700, letterSpacing: '.15em' }}>
        ◆ DEEPSTATE · UKRAINE BATTLEFIELD MONITOR
      </span>
      <a
        href="https://deepstatemap.live/en#7/48.8/32.4"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          marginLeft: 'auto', fontFamily: 'monospace', fontSize: 7.5,
          color: '#2a3e2e', letterSpacing: '.1em', fontWeight: 700,
          border: '1px solid #141e16', padding: '2px 8px', textDecoration: 'none',
          transition: 'all .15s',
        }}
        onMouseEnter={e => { const a = e.currentTarget as HTMLAnchorElement; a.style.color = '#ff1a3e'; a.style.borderColor = '#ff1a3e55' }}
        onMouseLeave={e => { const a = e.currentTarget as HTMLAnchorElement; a.style.color = '#2a3e2e'; a.style.borderColor = '#141e16' }}
      >
        ↗ OPEN FULL MAP
      </a>
      {onClose && (
        <CloseButton onClick={onClose} label="Close DeepState panel" style={{ color: '#9fb0b8' }} />
      )}
    </div>

    {/* Embedded DeepState map — may be blocked by CSP on some browsers */}
    <iframe
      key="deepstate-iframe"
      src="https://deepstatemap.live/en#7/48.8/32.4"
      title="DeepState Ukraine Battlefield Map"
      allow="fullscreen"
      style={{ flex: 1, border: 'none', width: '100%', display: 'block' }}
    />

    {/* Fallback overlay shown on top — dim unless iframe loads */}
    <div style={{
      position: 'absolute', inset: 0, top: 34, /* below header */
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 0,
    }}>
      <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#1a2e1e', letterSpacing: '.12em', textAlign: 'center', lineHeight: 2 }}>
        <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.15 }}>◍</div>
        <div>DEEPSTATE MAP LOADING…</div>
        <div style={{ fontSize: 7, marginTop: 4, color: '#141e16' }}>
          If blocked by browser, use ↗ OPEN FULL MAP above
        </div>
      </div>
    </div>
  </div>
  )
}
