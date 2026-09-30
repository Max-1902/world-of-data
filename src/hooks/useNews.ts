import { useState, useCallback, useEffect } from 'react'
import { searchAllSources, fetchTopHeadlines } from '../services/news'
import type { NewsArticle } from '../types'

const HEADLINES_REFRESH_MS = 10 * 60 * 1000

export function useNews() {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (q: string) => {
    setQuery(q)
    setLoading(true)
    setError(null)
    try {
      const results = q.trim()
        ? await searchAllSources(q)
        : await fetchTopHeadlines()
      setArticles(results)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadHeadlines = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const results = await fetchTopHeadlines()
      setArticles(results)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  // Load headlines on mount and keep them fresh in the background, so features
  // like the Regional Outlook can cross-check crisis trends against hot news
  // without requiring the user to have opened the news tab first.
  useEffect(() => {
    if (query.trim()) return
    loadHeadlines()
    const timer = window.setInterval(loadHeadlines, HEADLINES_REFRESH_MS)
    return () => clearInterval(timer)
  }, [query]) // eslint-disable-line

  return { articles, loading, query, error, search, loadHeadlines }
}
