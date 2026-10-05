import { useEffect, useState, useSyncExternalStore } from 'react'
import type { NewsArticle } from '../types'
import { mayNeedTranslation, translateToEnglish, type Translation } from '../services/translate'

// ── Global "auto-translate" switch ───────────────────────────────────────────
// One setting for every news list, kept in localStorage and shared across components via a tiny store.
const LS_KEY = 'ws-auto-translate'
const listeners = new Set<() => void>()

function read(): boolean {
  try { return localStorage.getItem(LS_KEY) !== '0' } catch { return true }
}
let enabled = read()

export function setAutoTranslate(on: boolean) {
  enabled = on
  try { localStorage.setItem(LS_KEY, on ? '1' : '0') } catch { /* private mode */ }
  listeners.forEach(l => l())
}

export function useAutoTranslate(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => enabled,
  )
  return [on, setAutoTranslate]
}

// ── Per-article translation ──────────────────────────────────────────────────
export interface TranslatedArticle {
  title: string
  description: string
  /** Source language when the title or description was actually translated; undefined when shown as published. */
  from?: string
}

function useTranslatedText(text: string, lang: string | undefined, active: boolean): Translation | null {
  const [result, setResult] = useState<Translation | null>(null)
  useEffect(() => {
    setResult(null)
    if (!active || !mayNeedTranslation(text, lang)) return
    let cancelled = false
    void translateToEnglish(text).then(t => { if (!cancelled) setResult(t) })
    return () => { cancelled = true }
  }, [text, lang, active])
  return result
}

/**
 * The English version of an article's text. The headline is translated straight away; the summary only once
 * `wantDescription` is set (the row was opened), which keeps requests down. Falls back to the original text
 * while a translation is pending or if it fails.
 */
export function useTranslatedArticle(a: NewsArticle, wantDescription: boolean): TranslatedArticle {
  const [on] = useAutoTranslate()
  const title = useTranslatedText(a.title ?? '', a.lang, on)
  const desc = useTranslatedText(a.description ?? '', a.lang, on && wantDescription)
  const t = title && title.from !== 'en' ? title : null
  const d = desc && desc.from !== 'en' ? desc : null
  return {
    title: t ? t.text : a.title,
    description: d ? d.text : a.description,
    from: t?.from ?? d?.from,
  }
}
