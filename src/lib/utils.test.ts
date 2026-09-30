import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('joins class names and drops falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })
  it('supports conditional object syntax', () => {
    expect(cn('a', { b: true, c: false })).toBe('a b')
  })
  it('lets later Tailwind utilities override conflicting earlier ones', () => {
    expect(cn('p-2 text-red-500', 'p-4')).toBe('text-red-500 p-4')
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
  it('keeps non-conflicting utilities', () => {
    expect(cn('p-2', 'm-2')).toBe('p-2 m-2')
  })
})
