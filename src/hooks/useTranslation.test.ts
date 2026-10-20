// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { NewsArticle } from '../types'

const translateToEnglish = vi.hoisted(() => vi.fn())
vi.mock('../services/translate', async orig => ({ ...await orig<typeof import('../services/translate')>(), translateToEnglish }))

const { useAutoTranslate, useTranslatedArticle, setAutoTranslate } = await import('./useTranslation')

const art = (o: Partial<NewsArticle> = {}): NewsArticle => ({ id: '1', title: 'Wahl in Berlin', description: 'Lange Nacht', url: 'u', source: 's', publishedAt: '', lang: 'de', ...o })

beforeEach(() => {
  translateToEnglish.mockReset()
  translateToEnglish.mockImplementation(async (t: string) => ({ text: `EN:${t}`, from: 'de' }))
  act(() => setAutoTranslate(true))
})

describe('useAutoTranslate', () => {
  it('shares one switch across components and remembers it', () => {
    const a = renderHook(() => useAutoTranslate())
    const b = renderHook(() => useAutoTranslate())
    act(() => a.result.current[1](false))
    expect(b.result.current[0]).toBe(false)
    expect(localStorage.getItem('ws-auto-translate')).toBe('0')
  })
})

describe('useTranslatedArticle', () => {
  it('translates the headline straight away and the summary only once wanted', async () => {
    const { result, rerender } = renderHook(({ want }) => useTranslatedArticle(art(), want), { initialProps: { want: false } })
    await waitFor(() => expect(result.current.title).toBe('EN:Wahl in Berlin'))
    expect(result.current).toMatchObject({ description: 'Lange Nacht', from: 'de' })
    expect(translateToEnglish).toHaveBeenCalledTimes(1)
    rerender({ want: true })
    await waitFor(() => expect(result.current.description).toBe('EN:Lange Nacht'))
  })

  it('shows English articles and the switched-off state as published, without calling the service', async () => {
    const en = renderHook(() => useTranslatedArticle(art({ title: 'Vote', lang: 'en' }), true))
    act(() => setAutoTranslate(false))
    const off = renderHook(() => useTranslatedArticle(art(), true))
    expect(en.result.current.title).toBe('Vote')
    expect(off.result.current).toEqual({ title: 'Wahl in Berlin', description: 'Lange Nacht', from: undefined })
    expect(translateToEnglish).not.toHaveBeenCalled()
  })

  it('keeps the original when the service fails', async () => {
    translateToEnglish.mockResolvedValue(null)
    const { result } = renderHook(() => useTranslatedArticle(art(), true))
    await act(async () => { await Promise.resolve() })
    expect(result.current.title).toBe('Wahl in Berlin')
  })
})
