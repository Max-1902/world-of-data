import { useState, useCallback } from 'react'
import { searchAllSources, fetchTopHeadlines } from '../services/news'
import type { NewsArticle } from '../types'

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

  return { articles, loading, query, error, search, loadHeadlines }
}
