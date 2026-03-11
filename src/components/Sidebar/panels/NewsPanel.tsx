import { useState, useEffect, useRef } from 'react'
import { Search, Newspaper, ExternalLink, Loader } from 'lucide-react'
import type { NewsArticle } from '../../../types'
import { formatDistanceToNow } from 'date-fns'

const SOURCE_COLORS: Record<string, string> = {
  'BBC News': '#BB1919',
  'Reuters': '#FF8000',
  'The Guardian': '#005689',
  'New York Times': '#000000',
  'Al Jazeera': '#FFFFFF',
  'DW News': '#0095B5',
  'France 24': '#003087',
}

interface Props {
  articles: NewsArticle[]
  loading: boolean
  query: string
  onSearch: (q: string) => void
  onLoad: () => void
  onSelect: (a: NewsArticle) => void
}

export default function NewsPanel({ articles, loading, query, onSearch, onLoad, onSelect }: Props) {
  const [input, setInput] = useState(query)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (articles.length === 0 && !loading) onLoad()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleInput(value: string) {
    setInput(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      onSearch(value)
    }, 500)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (timerRef.current) clearTimeout(timerRef.current)
    onSearch(input)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <form onSubmit={handleSubmit} className="px-3 py-2 border-b border-surface-600">
        <div className="flex items-center gap-2 bg-surface-800 border border-surface-600 rounded px-2 py-1 focus-within:border-accent-blue transition-colors">
          <Search size={12} className="text-gray-500 flex-shrink-0" />
          <input
            value={input}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search world news…"
            className="flex-1 bg-transparent text-xs text-gray-200 placeholder-gray-600 outline-none"
          />
          {loading && <Loader size={12} className="text-gray-500 animate-spin flex-shrink-0" />}
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {['War', 'Ukraine', 'Gaza', 'China', 'Elections', 'Economy', 'Climate'].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => { setInput(tag); onSearch(tag) }}
              className="text-xs px-1.5 py-0.5 rounded bg-surface-700 text-gray-500 hover:text-accent-blue hover:bg-surface-600 transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>
      </form>

      <div className="px-3 py-1 border-b border-surface-700 flex items-center justify-between">
        <span className="text-xs text-gray-600">
          {loading ? 'Searching…' : `${articles.length} articles from ${countSources(articles)} sources`}
        </span>
      </div>

      {/* Articles */}
      <div className="flex-1 overflow-y-auto">
        {articles.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-600 text-xs gap-2">
            <Newspaper size={24} />
            <span>Search for any topic above</span>
          </div>
        )}
        {articles.map((a) => (
          <div
            key={a.id}
            className="border-b border-surface-800 hover:bg-surface-700 transition-colors cursor-pointer group"
          >
            <button
              onClick={() => onSelect(a)}
              className="w-full text-left px-3 py-2"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span
                  className="text-xs font-semibold truncate"
                  style={{ color: SOURCE_COLORS[a.source] || '#7777ff', fontSize: '10px' }}
                >
                  {a.source}
                </span>
                <span className="text-xs text-gray-600 flex-shrink-0 ml-2" style={{ fontSize: '10px' }}>
                  {safeFormatDistance(a.publishedAt)}
                </span>
              </div>
              <div className="text-xs text-gray-200 group-hover:text-white leading-snug mb-0.5">
                {a.title}
              </div>
              {a.description && (
                <div className="text-xs text-gray-600 leading-snug line-clamp-2">
                  {a.description?.replace(/<[^>]*>/g, '')}
                </div>
              )}
            </button>
            <div className="px-3 pb-1.5">
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-accent-blue flex items-center gap-1 hover:underline w-fit"
                style={{ fontSize: '10px' }}
              >
                Read full article <ExternalLink size={9} />
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 border-t border-surface-600 text-xs text-gray-600">
        Sources: NewsAPI · Guardian · NYT · GDELT · BBC · Reuters · DW · AJ · France24
      </div>
    </div>
  )
}

function countSources(articles: NewsArticle[]) {
  return new Set(articles.map((a) => a.source)).size
}

function safeFormatDistance(dateStr: string) {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return ''
  }
}
