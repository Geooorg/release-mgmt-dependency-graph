import { describe, expect, it } from 'vitest'
import { DEFAULT_HIGHLIGHT, parseWorkMode } from './workMode'

describe('parseWorkMode', () => {
  it('accepts the two modes', () => {
    expect(parseWorkMode('build')).toBe('build')
    expect(parseWorkMode('analyze')).toBe('analyze')
  })

  it('falls back to build for anything else', () => {
    for (const value of [undefined, null, '', 'Analyze', 'edit', 1, {}, ['analyze']]) {
      expect(parseWorkMode(value)).toBe('build')
    }
  })
})

describe('DEFAULT_HIGHLIGHT', () => {
  it('is the critical path', () => {
    expect(DEFAULT_HIGHLIGHT).toBe('critical')
  })
})
