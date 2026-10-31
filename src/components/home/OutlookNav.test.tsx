// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import OutlookNav, { OUTLOOK_SECTIONS } from './OutlookNav'
import HomeTier from './HomeTier'

/** jsdom has no layout: section tops are set here, as the scroll position would move them */
const tops: Record<string, number> = {}

/** The nav sits inside a scroll container, like the Outlook page's. Only the listed sections exist on the page. */
function Page({ ids, onScrollTo }: { ids: string[]; onScrollTo: (id: string) => void }) {
  return (
    <div className="home-scroll">
      <div className="home-content">
        <OutlookNav />
        {ids.map(id => <section key={id} id={id} ref={el => { if (el) { el.scrollIntoView = () => onScrollTo(id); el.getBoundingClientRect = () => ({ top: tops[id] ?? 0 }) as DOMRect } }}>{id}</section>)}
      </div>
    </div>
  )
}

beforeEach(() => { vi.restoreAllMocks(); for (const k of Object.keys(tops)) delete tops[k] })

describe('OutlookNav', () => {
  it('links only to the sections that are on the page, in page order', async () => {
    render(<Page ids={['outlook-forecast', 'outlook-comovement', 'outlook-map']} onScrollTo={() => {}} />)
    const nav = screen.getByRole('navigation', { name: 'Sections of this page' })
    await waitFor(() => expect(Array.from(nav.querySelectorAll('button')).map(b => b.textContent)).toEqual(['Country forecast', 'Co-movement', 'Map']))
  })

  it('has a link for every section the page can show', () => {
    expect(OUTLOOK_SECTIONS.map(s => s.label)).toEqual(['World economy', 'World by group', 'Country forecast', 'Forecast detail', 'Co-movement', 'IMF compare', 'Map', 'World so far', 'Datasets'])
  })

  it('scrolls to the chosen section, and the forecast is always one click away', async () => {
    const onScrollTo = vi.fn()
    render(<Page ids={['outlook-forecast', 'outlook-map']} onScrollTo={onScrollTo} />)
    await screen.findByRole('button', { name: 'Map' })
    fireEvent.click(screen.getByRole('button', { name: 'Map' }))
    expect(onScrollTo).toHaveBeenLastCalledWith('outlook-map')
    fireEvent.click(screen.getByRole('button', { name: 'Country forecast' }))
    expect(onScrollTo).toHaveBeenLastCalledWith('outlook-forecast')
  })

  it('marks the forecast as the current section at the top of the page, and the map once it has scrolled up to the bar', async () => {
    tops['outlook-forecast'] = 0; tops['outlook-map'] = 900
    const { container } = render(<Page ids={['outlook-forecast', 'outlook-map']} onScrollTo={() => {}} />)
    const btn = await screen.findByRole('button', { name: 'Country forecast' })
    expect(btn.getAttribute('aria-current')).toBe('location')
    tops['outlook-forecast'] = -800; tops['outlook-map'] = 10
    fireEvent.scroll(container.querySelector('.home-scroll')!)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Map' }).getAttribute('aria-current')).toBe('location'))
    expect(screen.getByRole('button', { name: 'Country forecast' }).getAttribute('aria-current')).toBeNull()
  })
})

describe('HomeTier', () => {
  it('says how the sections below relate to the forecast', () => {
    render(<HomeTier label="Context" note="The wider picture. Not forecast evidence." />)
    expect(screen.getByRole('separator', { name: 'Context: The wider picture. Not forecast evidence.' })).toBeTruthy()
  })
})
