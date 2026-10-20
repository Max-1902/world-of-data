import { useState, useCallback, useEffect, useRef } from 'react'
import { searchAllSources, fetchTopHeadlines } from '../services/news'
import type { NewsArticle } from '../types'

const HEADLINES_REFRESH_MS = 10 * 60 * 1000

export function useNews() {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  // only the newest request may write, so a slow headlines poll can't overwrite search results
  const reqRef = useRef(0)

  const run = useCallback(async (q: string) => {
    const id = ++reqRef.current
    setLoading(true)
    setError(null)
    try {
      const results = q.trim() ? await searchAllSources(q) : await fetchTopHeadlines()
      if (id === reqRef.current) setArticles(results)
    } catch (e) {
      if (id === reqRef.current) setError(String(e))
    } finally {
      if (id === reqRef.current) setLoading(false)
    }
  }, [])

  const search = useCallback((q: string) => { setQuery(q); return run(q) }, [run])
  const loadHeadlines = useCallback(() => run(''), [run])

  // Headlines load on mount and stay fresh so the Regional Outlook can cross-check them without the news tab open.
  useEffect(() => {
    if (query.trim()) return
    void loadHeadlines()
    const timer = window.setInterval(loadHeadlines, HEADLINES_REFRESH_MS)
    return () => clearInterval(timer)
  }, [query, loadHeadlines])

  return { articles, loading, query, error, search, loadHeadlines }
}
