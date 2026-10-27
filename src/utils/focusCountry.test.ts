// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { installLocalStorage } from '../test/helpers'
import { focusCountry, onFocusCountry, storedFocus } from './focusCountry'

describe('focusCountry', () => {
  it('stores the country for a panel that mounts later and tells one that is open', () => {
    installLocalStorage()
    const seen = vi.fn(), other = vi.fn()
    const off = onFocusCountry('predictions', seen)
    const off2 = onFocusCountry('nowcast', other)
    focusCountry('predictions', 'DE')
    expect(storedFocus('predictions')).toBe('DE')
    expect(seen).toHaveBeenCalledWith('DE')
    expect(other).not.toHaveBeenCalled()
    off(); off2()
    focusCountry('predictions', 'FR')
    expect(seen).toHaveBeenCalledTimes(1)
  })
})
