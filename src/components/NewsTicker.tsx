import { useEffect, useState, useRef } from 'react'
import { fetchTopHeadlines } from '../services/news'
import type { NewsArticle } from '../types'

const REFRESH_MS = 3 * 60 * 1000 // refresh headlines every 3 min

export default function NewsTicker() {
  const [headlines, setHeadlines] = useState<NewsArticle[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
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
  }, [])

  if (headlines.length === 0) return null

  // Duplicate items so the scroll loops seamlessly
  const items = [...headlines, ...headlines]

  return (
    <div style={{
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
              <span>{a.title}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
