/**
 * Panel implementations. Split out of the former PanelContent.tsx; wired up in src/panels/registry.tsx.
 */
import CloseButton from '../CloseButton'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink } from 'lucide-react'
import { WebcamSource, WebcamEntry, US_WEBCAMS } from '../../services/usWebcams'

const WEBCAM_STATES = ['All', ...Array.from(new Set(US_WEBCAMS.map(w => w.state))).sort()]

const SOURCE_META: Record<WebcamSource, { label: string; color: string }> = {
  skyline:  { label: 'SKYLINE',  color: 'var(--accent)' },
  earthcam: { label: 'EARTHCAM', color: 'var(--amber)' },
}

/** Small in-app box that shows a webcam feed at its exact geo location. Tries to embed
 * via iframe; since SkylineWebcams sends X-Frame-Options: SAMEORIGIN, embedding is blocked
 * server-side and cannot be bypassed client-side — falls back to a link-out state after a
 * short load timeout with no confirmed content. */
function WebcamBox({ cam, onClose }: { cam: WebcamEntry; onClose: () => void }) {
  const [status, setStatus] = useState<'loading' | 'embedded' | 'blocked'>('loading')
  const meta = SOURCE_META[cam.source]

  useEffect(() => {
    setStatus('loading')
    const t = setTimeout(() => setStatus(s => (s === 'loading' ? 'blocked' : s)), 3500)
    return () => clearTimeout(t)
  }, [cam.id])

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.35)',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 380, maxWidth: '90vw', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text1)', flex: 1 }}>{cam.label}</span>
          <span style={{ fontSize: '8.5px', fontWeight: 700, letterSpacing: '.06em', color: meta.color }}>{meta.label}</span>
          <CloseButton onClick={onClose} label={`Close ${cam.label} feed`} />
        </div>

        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', background: '#000' }}>
          {status !== 'blocked' && (
            <iframe
              key={cam.id}
              src={cam.url}
              title={cam.label}
              onLoad={() => setStatus('embedded')}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          )}
          {status === 'loading' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10.5px', color: 'var(--text3)', letterSpacing: '.08em' }}>
              CONNECTING…
            </div>
          )}
          {status === 'blocked' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, textAlign: 'center' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--text2)', letterSpacing: '.04em' }}>Feed blocked from embedding by source</span>
              <a href={cam.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '10.5px', fontWeight: 700, color: meta.color, textDecoration: 'none', border: `1px solid ${meta.color}55`, padding: '6px 12px', borderRadius: 'var(--r-sm)' }}>
                OPEN LIVE FEED <ExternalLink size={10} />
              </a>
            </div>
          )}
        </div>

        <div style={{ padding: '6px 10px', fontSize: '9.5px', color: 'var(--text3)', fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between' }}>
          <span>{cam.lat.toFixed(4)}, {cam.lng.toFixed(4)}</span>
          <span>{cam.state} · UNITED STATES</span>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function USWebcamsPanel() {
  const [state, setState]   = useState('All')
  const [source, setSource] = useState<WebcamSource | 'All'>('All')
  const [active, setActive] = useState<WebcamEntry | null>(null)

  const filtered = US_WEBCAMS.filter(w =>
    (state === 'All' || w.state === state) &&
    (source === 'All' || w.source === source)
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Source filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 6px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => setSource('All')} className={`news-tab ${source === 'All' ? 'active' : ''}`}>ALL</button>
        {(Object.keys(SOURCE_META) as WebcamSource[]).map(s => (
          <button key={s} onClick={() => setSource(s)}
            className={`news-tab ${source === s ? 'active' : ''}`}
            style={source === s ? { color: SOURCE_META[s].color, borderColor: SOURCE_META[s].color + '44' } : {}}
          >{SOURCE_META[s].label}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '9.5px', color: 'var(--text3)', letterSpacing: '.06em' }}>{filtered.length} CAMS</span>
      </div>

      {/* State filter */}
      <div style={{ display: 'flex', gap: 2, padding: '3px 6px', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {WEBCAM_STATES.map(s => (
          <button key={s} onClick={() => setState(s)}
            className={`news-tab ${state === s ? 'active' : ''}`}
            style={{ whiteSpace: 'nowrap' }}>{s}</button>
        ))}
      </div>

      {/* Grid */}
      <div style={{
        flex: 1, overflowY: 'auto', display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))', gap: 6, padding: 6,
      }}>
        {filtered.map(w => {
          const meta = SOURCE_META[w.source]
          return (
            <button key={w.id} onClick={() => setActive(w)}
              style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                aspectRatio: '4 / 3', padding: 7,
                border: '1px solid var(--border)', background: 'var(--surface2)',
                textAlign: 'left', cursor: 'pointer', transition: 'all .12s', position: 'relative',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = meta.color + '88'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-soft)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface2)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--red)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                <span style={{ fontSize: '8.5px', fontWeight: 700, letterSpacing: '.06em', color: meta.color }}>{meta.label}</span>
              </div>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text1)', lineHeight: 1.3 }}>{w.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                  <span style={{ fontSize: '9.5px', color: 'var(--text3)', letterSpacing: '.06em' }}>{w.state}</span>
                </div>
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.1em' }}>// NO CAMS FOR FILTER</div>
        )}
      </div>

      {active && <WebcamBox cam={active} onClose={() => setActive(null)} />}
    </div>
  )
}

// ── Live TV Feed ───────────────────────────────────────────────────────────────
// Each entry is a channel's official YouTube live stream (embedded via YouTube's
// standard embed URL — free, keyless, no API involved).
interface LiveChannel {
  id: string
  label: string
  videoId: string
}

const LIVE_CHANNELS: LiveChannel[] = [
  { id: 'cnn', label: 'CNN', videoId: 'GotlA1KKWoo' },
  { id: 'fox', label: 'FOX', videoId: 'C96oohpWBGw' },
  { id: 'nbc', label: 'NBC', videoId: 'ScfK6qmxoqE' },
  { id: 'cbs', label: 'CBS', videoId: 'bftI1brf9Mw' },
  { id: 'euronews', label: 'EURONEWS', videoId: 'pykpO5kQJ98' },
  { id: 'dw', label: 'DW', videoId: 'LuKwFajn37U' },
  { id: 'sky', label: 'SKY NEWS', videoId: 'xDWQ3LkccY8' },
  { id: 'france24', label: 'FRANCE 24', videoId: 'HvZt-nh9sGg' },
]

export function LiveFeedPanel() {
  const [active, setActive] = useState<LiveChannel>(LIVE_CHANNELS[0])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 6px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {LIVE_CHANNELS.map(ch => (
          <button key={ch.id} onClick={() => setActive(ch)}
            className={`news-tab ${active.id === ch.id ? 'active' : ''}`}
          >{ch.label}</button>
        ))}
      </div>
      <div style={{ position: 'relative', flex: 1, background: '#000', minHeight: 0 }}>
        <iframe
          key={active.id}
          src={`https://www.youtube.com/embed/${active.videoId}?autoplay=1&mute=1`}
          title={`${active.label} live feed`}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        <div style={{ position: 'absolute', top: 6, left: 6, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,0.55)', padding: '2px 8px', borderRadius: 'var(--r-pill)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '.06em', color: '#fff' }}>LIVE</span>
        </div>
      </div>
      <div style={{ padding: '3px 8px', borderTop: '1px solid var(--border)', fontSize: 9, color: 'var(--text3)', letterSpacing: '.08em', flexShrink: 0, display: 'flex', justifyContent: 'space-between' }}>
        <span>SOURCE: YOUTUBE — {active.label} OFFICIAL</span>
        <a href={`https://www.youtube.com/watch?v=${active.videoId}`} target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text3)', textDecoration: 'none' }}
        >OPEN <ExternalLink size={9} /></a>
      </div>
    </div>
  )
}
