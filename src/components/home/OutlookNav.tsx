import { useEffect, useRef, useState } from 'react'

/** The Outlook page's sections, in page order. A section that is not on the page right now (still loading, no data) gets no link. */
export const OUTLOOK_SECTIONS = [
  { id: 'outlook-world-economy', label: 'World economy' },
  { id: 'outlook-world-detail', label: 'World by group' },
  { id: 'outlook-forecast', label: 'Country forecast' },
  { id: 'outlook-detail', label: 'Forecast detail' },
  { id: 'outlook-comovement', label: 'Co-movement' },
  { id: 'outlook-imf', label: 'IMF compare' },
  { id: 'outlook-map', label: 'Map' },
  { id: 'outlook-world', label: 'World so far' },
  { id: 'outlook-browse', label: 'Datasets' },
] as const

/**
 * A bar that stays at the top of the Outlook page: jump to a section, and always get back to the top. It marks
 * the section being read. It only moves the scroll position; it changes no data and hides nothing.
 */
export default function OutlookNav() {
  const ref = useRef<HTMLElement>(null)
  const [present, setPresent] = useState<string[]>([OUTLOOK_SECTIONS[0].id])
  const [active, setActive] = useState<string>(OUTLOOK_SECTIONS[0].id)

  useEffect(() => {
    const nav = ref.current
    const scroller = nav?.closest<HTMLElement>('.home-scroll')
    const content = nav?.parentElement
    if (!nav || !scroller || !content) return
    let frame = 0
    const measure = () => {
      frame = 0
      const ids = OUTLOOK_SECTIONS.map(s => s.id).filter(id => document.getElementById(id))
      setPresent(prev => prev.length === ids.length && prev.every((v, i) => v === ids[i]) ? prev : ids)
      // the section being read: the last one whose top has reached the bar
      const line = scroller.getBoundingClientRect().top + nav.offsetHeight + 24
      let current: string = ids[0] ?? OUTLOOK_SECTIONS[0].id
      for (const id of ids) if (document.getElementById(id)!.getBoundingClientRect().top <= line) current = id
      setActive(current)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure) }
    measure()
    scroller.addEventListener('scroll', schedule, { passive: true })
    const mo = new MutationObserver(schedule)
    mo.observe(content, { childList: true, subtree: true })
    return () => { scroller.removeEventListener('scroll', schedule); mo.disconnect(); if (frame) cancelAnimationFrame(frame) }
  }, [])

  // on a phone the bar scrolls sideways: keep the current section's button in view (the bar only, never the page)
  useEffect(() => {
    const nav = ref.current
    const btn = nav?.querySelector<HTMLElement>('[aria-current]')
    if (!nav || !btn) return
    if (btn.offsetLeft < nav.scrollLeft || btn.offsetLeft + btn.offsetWidth > nav.scrollLeft + nav.clientWidth) {
      nav.scrollLeft = btn.offsetLeft - (nav.clientWidth - btn.offsetWidth) / 2
    }
  }, [active, present])

  const go = (id: string) => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    document.getElementById(id)?.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <nav ref={ref} className="outlook-nav" aria-label="Sections of this page">
      {OUTLOOK_SECTIONS.filter(s => present.includes(s.id)).map(s => (
        <button key={s.id} onClick={() => go(s.id)} aria-current={active === s.id ? 'location' : undefined}>{s.label}</button>
      ))}
    </nav>
  )
}
