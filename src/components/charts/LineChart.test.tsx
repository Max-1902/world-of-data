// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LineChart } from './LineChart'
import { XYChart } from './XYChart'

const pts = (ys: (number | null)[], x0 = 2000) => ys.flatMap((v, i) => (v === null ? [] : [{ t: x0 + i, v }]))

describe('LineChart', () => {
  it('draws one line per unbroken run and breaks at missing years instead of bridging them', () => {
    const { container } = render(<LineChart ariaLabel="x." xKind="year" fmtY={String} series={[{ key: 'a', label: 'A', color: 'red', points: pts([1, 2, 3, null, null, 4, 5]) }]} />)
    expect(container.querySelectorAll('polyline')).toHaveLength(2)
  })
  it('shows a legend only for two or more series, and reference lines with labels', () => {
    const one = render(<LineChart ariaLabel="x." xKind="year" fmtY={String} series={[{ key: 'a', label: 'Alpha', color: 'red', points: pts([1, 2]) }]} />)
    expect(one.container.querySelector('.viz-legend')).toBeNull()
    one.unmount()
    render(<LineChart ariaLabel="x." xKind="year" fmtY={String} refLines={[{ v: 2, label: 'ECB target 2%' }]}
      series={[{ key: 'a', label: 'Alpha', color: 'red', points: pts([1, 3]) }, { key: 'b', label: 'Beta', color: 'blue', points: pts([2, 2]) }]} />)
    expect(screen.getByText('Alpha')).toBeTruthy()
    expect(screen.getByText('ECB target 2%')).toBeTruthy()
  })
  it('distinguishes dashed series in the legend and marks the observed-to-forecast boundary', () => {
    const { container } = render(<LineChart ariaLabel="Forecast." xKind="year" fmtY={String} forecastBoundary={2000.5}
      series={[{ key: 'a', label: 'Observed series', color: 'red', points: pts([1, 2]) }, { key: 'b', label: 'Forecast series', color: 'blue', points: pts([2, 3]), dashed: true }]} />)
    expect(container.querySelector('.viz-legend .sw.line.dashed')).toBeTruthy()
    expect(screen.getByText('Observed')).toBeTruthy()
    expect(screen.getByText('Forecast')).toBeTruthy()
    expect(container.querySelector('line[stroke-width="1.5"]')).toBeTruthy()
  })
  it('names the history on the boundary with the panel\'s own word', () => {
    render(<LineChart ariaLabel="Forecast." xKind="year" fmtY={String} forecastBoundary={2000.5} observedLabel="Reported"
      series={[{ key: 'a', label: 'Reported', color: 'red', points: pts([1, 2]) }]} />)
    expect(screen.getByText('Reported')).toBeTruthy()
  })
  describe('pinning a readout', () => {
    const chart = () => {
      const r = render(<LineChart ariaLabel="Pin." xKind="year" fmtY={v => `${v}%`} series={[{ key: 'a', label: 'A', color: 'red', points: pts([1, 3, 5]) }]} />)
      const svg = screen.getByRole('img', { name: /Pin/ })
      const hit = r.container.querySelector('rect[style*="crosshair"]') as SVGRectElement
      hit.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) })
      return { svg, hit }
    }
    // jsdom has no pointer capture; the browser does
    ;(SVGElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {}
    it('a click pins the date so the pointer can move away, and a second click on it clears it', () => {
      const { hit } = chart()
      fireEvent.pointerMove(hit, { clientX: 0, pointerType: 'mouse' })
      fireEvent.pointerDown(hit, { clientX: 0, pointerType: 'mouse' })
      expect(screen.getByRole('status').textContent).toContain('Pinned')
      fireEvent.pointerMove(hit, { clientX: 200, pointerType: 'mouse' })
      expect(screen.getByRole('status').textContent).toContain('2000')
      fireEvent.pointerDown(hit, { clientX: 0, pointerType: 'mouse' })
      expect(screen.queryByRole('status')).toBeNull()
    })
    it('Escape and losing focus clear a pin', () => {
      const { svg, hit } = chart()
      fireEvent.pointerDown(hit, { clientX: 0, pointerType: 'mouse' })
      fireEvent.keyDown(svg, { key: 'Escape' })
      expect(screen.queryByRole('status')).toBeNull()
      fireEvent.pointerDown(hit, { clientX: 0, pointerType: 'mouse' })
      fireEvent.blur(svg)
      expect(screen.queryByRole('status')).toBeNull()
    })
    it('arrow keys browse without pinning, so hovering still works afterwards', () => {
      const { svg, hit } = chart()
      fireEvent.keyDown(svg, { key: 'ArrowRight' })
      expect(screen.getByRole('status').textContent).not.toContain('Pinned')
      fireEvent.pointerMove(hit, { clientX: 200, pointerType: 'mouse' })
      expect(screen.getByRole('status').textContent).toContain('2002')
    })
    it('a touch tap pins and a touch drag leaves the date it ended on pinned', () => {
      const { hit } = chart()
      fireEvent.pointerDown(hit, { clientX: 0, clientY: 50, pointerType: 'touch' })
      fireEvent.pointerUp(hit, { clientX: 0, clientY: 50, pointerType: 'touch' })
      expect(screen.getByRole('status').textContent).toContain('Pinned')
      fireEvent.pointerLeave(hit, { pointerType: 'touch' })
      expect(screen.getByRole('status').textContent).toContain('2000')
      fireEvent.pointerDown(hit, { clientX: 0, clientY: 50, pointerType: 'touch' })
      fireEvent.pointerUp(hit, { clientX: 0, clientY: 50, pointerType: 'touch' })
      expect(screen.queryByRole('status')).toBeNull()
      fireEvent.pointerDown(hit, { clientX: 0, clientY: 50, pointerType: 'touch' })
      fireEvent.pointerMove(hit, { clientX: 200, clientY: 50, pointerType: 'touch' })
      fireEvent.pointerUp(hit, { clientX: 200, clientY: 50, pointerType: 'touch' })
      expect(screen.getByRole('status').textContent).toContain('2002')
      expect(screen.getByRole('status').textContent).toContain('Pinned')
    })
    it('a vertical scroll (pointercancel) clears the preview instead of pinning', () => {
      const { hit } = chart()
      fireEvent.pointerDown(hit, { clientX: 0, clientY: 50, pointerType: 'touch' })
      fireEvent.pointerCancel(hit, { pointerType: 'touch' })
      expect(screen.queryByRole('status')).toBeNull()
    })
  })
  it('arrow keys read every series at a date, showing — where a series has no value', () => {
    render(<LineChart ariaLabel="Test chart." xKind="year" fmtY={v => `${v}%`}
      series={[{ key: 'a', label: 'Alpha', color: 'red', points: pts([1, 3, 5]) }, { key: 'b', label: 'Beta', color: 'blue', points: pts([2, null, 6]) }]} />)
    const svg = screen.getByRole('img', { name: /Test chart/ })
    fireEvent.keyDown(svg, { key: 'ArrowRight' })
    fireEvent.keyDown(svg, { key: 'ArrowRight' })
    const tip = screen.getByRole('status')
    expect(tip.textContent).toContain('2001')
    expect(tip.textContent).toContain('3%')
    expect(tip.textContent).toContain('—')
  })
  it('marks every observation when asked, and reads a shaded interval in the tooltip', () => {
    const { container } = render(<LineChart ariaLabel="Fc." xKind="year" fmtY={v => `${v}%`}
      areas={[{ key: 'ci', label: '95% interval', color: 'red', points: [{ t: 2002, lo: 3, hi: 3 }, { t: 2003, lo: 1, hi: 7 }] }]}
      series={[{ key: 'a', label: 'Actual', color: 'blue', points: pts([1, 2, 3]), markers: true }, { key: 'f', label: 'Forecast', color: 'red', points: [{ t: 2002, v: 3 }, { t: 2003, v: 4 }], dashed: true }]} />)
    expect(container.querySelectorAll('circle[r="4"]')).toHaveLength(3)
    expect(container.querySelectorAll('polygon')).toHaveLength(1)
    expect(screen.getByText('95% interval')).toBeTruthy()
    const svg = screen.getByRole('img', { name: /Fc/ })
    for (let i = 0; i < 4; i++) fireEvent.keyDown(svg, { key: 'ArrowRight' })
    const tip = screen.getByRole('status')
    expect(tip.textContent).toContain('2003')
    expect(tip.textContent).toContain('1% to 7%')
  })
  it('says so when there is nothing to draw', () => {
    render(<LineChart ariaLabel="x." xKind="year" fmtY={String} series={[{ key: 'a', label: 'A', color: 'red', points: [] }]} />)
    expect(screen.getByText('No data for this period.')).toBeTruthy()
  })
})

describe('XYChart', () => {
  it('plots one dot per year, labels the latest, and draws the fit line', () => {
    const { container } = render(<XYChart ariaLabel="Okun." xLabel="Growth" yLabel="ΔU" fmtX={String} fmtY={String} fit={{ slope: -0.4, intercept: 0.8 }}
      points={[{ key: '2001', x: 1, y: 0.4, label: '2001' }, { key: '2002', x: 3, y: -0.4, label: '2002' }, { key: '2003', x: 2, y: 0, label: '2003' }]} />)
    expect(container.querySelectorAll('circle')).toHaveLength(3)
    expect(screen.getByText('2003')).toBeTruthy()
    expect(screen.getByText('Growth')).toBeTruthy()
  })
})
