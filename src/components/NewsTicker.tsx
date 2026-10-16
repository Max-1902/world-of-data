import { useEffect, useState, useRef } from 'react'
import { fetchTopHeadlines } from '../services/news'
import type { NewsArticle } from '../types'
import CloseButton from './CloseButton'
import { StateMediaBadge } from './StateMediaBadge'
import { isDemoMode } from '../utils/urlState'

const REFRESH_MS = 3 * 60 * 1000 // refresh headlines every 3 min

export default function NewsTicker({ onClose, demo = isDemoMode() }: { onClose: () => void; demo?: boolean }) {
  const [headlines, setHeadlines] = useState<NewsArticle[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (demo) return
    let mounted = true
    async function load() {
      try {
        const arts = await fetchTopHeadlines()
        if (mounted) setHeadlines(arts.slice(0, 40))
      } catch { /* silent */ }
    }
    load()
    const iv = setInterval(load, REFRESH_MS)
    return () => { mounted = false; clearInterval(iv) }
  }, [demo])

  if (demo) {
    return (
      <div className="news-ticker" role="status" style={{ height: 28, background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 10px', gap: 8, flexShrink: 0, fontSize: 11, color: 'var(--text3)' }}>
        Live headlines hidden (screenshot / demo mode). Remove <code>?demo=1</code> from the address to show them.
        <span style={{ marginLeft: 'auto' }}><CloseButton onClick={onClose} label="Close news ticker" /></span>
      </div>
    )
  }

  if (headlines.length === 0) return null

  // Duplicate items so the scroll loops seamlessly
  const items = [...headlines, ...headlines]

  return (
    <div className="news-ticker" style={{
      height: 28,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      overflow: 'hidden',
      position: 'relative',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
    }}>
      {/* LIVE label */}
      <div className="live-badge" style={{ margin: '0 10px', flexShrink: 0 }}>
        LIVE
      </div>

      {/* Scrolling ticker */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          position: 'relative',
        }}
      >
        <div
          className="ticker-track"
          style={{
            gap: 0,
            animationDuration: `${Math.max(items.length * 4, 60)}s`,
            willChange: 'transform',
          }}
        >
          {items.map((a, i) => (
            <a
              key={`${a.id}-${i}`}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '0 16px',
                textDecoration: 'none',
                color: 'var(--text2)',
                fontSize: 11,
                fontFamily: 'Inter, -apple-system, sans-serif',
                whiteSpace: 'nowrap',
                lineHeight: '28px',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text1)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text2)'
              }}
            >
              <span style={{ color: 'var(--border-strong)' }}>●</span>
              <span style={{ color: 'var(--text3)', fontSize: 9, fontWeight: 700, flexShrink: 0, letterSpacing: '.04em' }}>
                {a.source?.toUpperCase() || 'NEWS'}
              </span>
              <StateMediaBadge source={a.source} />
              <span>{a.title}</span>
            </a>
          ))}
        </div>
      </div>

      <CloseButton onClick={onClose} label="Hide news ticker" size={12} style={{ margin: '0 8px', flexShrink: 0 }} />
    </div>
  )
}
