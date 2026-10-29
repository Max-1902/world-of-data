// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { CRISIS_COLORS, CRISIS_SHAPES, crisisMarkerEl } from './crisisShape'

describe('crisis marker shapes', () => {
  it('gives every crisis type its own shape, so type does not depend on colour', () => {
    const types = Object.keys(CRISIS_COLORS)
    expect(Object.keys(CRISIS_SHAPES).sort()).toEqual([...types].sort())
    expect(new Set(types.map(t => CRISIS_SHAPES[t].clip)).size).toBe(types.length)
  })

  it('labels the marker with type, shape, severity and title, and is a tab stop', () => {
    const el = crisisMarkerEl({ type: 'terrorism', severity: 'high', label: 'Bombing, Somalia' })
    expect(el.tabIndex).toBe(0)
    expect(el.getAttribute('role')).toBe('button')
    expect(el.getAttribute('aria-label')).toBe('Terrorism (triangle), high severity: Bombing, Somalia')
  })

  it('opens like a click on Enter and Space', () => {
    const el = crisisMarkerEl({ type: 'war', severity: 'low', label: 'x' })
    const onClick = vi.fn()
    el.addEventListener('click', onClick)
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('draws archived events hollow and says so, so they never read as live', () => {
    const live = crisisMarkerEl({ type: 'war', severity: 'high', label: 'x' })
    const old = crisisMarkerEl({ type: 'war', severity: 'high', archived: true, label: 'x' })
    expect(live.children).toHaveLength(1)
    expect(old.children).toHaveLength(2)
    expect(old.getAttribute('aria-label')).toContain('archived')
  })
})
