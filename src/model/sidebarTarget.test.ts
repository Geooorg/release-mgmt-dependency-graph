import { describe, expect, it } from 'vitest'
import { isSameTarget, sidebarTarget } from './sidebarTarget'

describe('sidebarTarget', () => {
  it('shows nothing for an empty selection', () => {
    expect(sidebarTarget([], [])).toEqual({ kind: 'none' })
  })

  it('shows the one selected object or group', () => {
    expect(sidebarTarget(['a'], [])).toEqual({ kind: 'node', id: 'a' })
  })

  it('shows the one selected edge', () => {
    expect(sidebarTarget([], ['e'])).toEqual({ kind: 'edge', id: 'e' })
  })

  it('reports the count when several elements are selected', () => {
    expect(sidebarTarget(['a', 'b'], [])).toEqual({ kind: 'multiple', count: 2 })
    expect(sidebarTarget([], ['e', 'f', 'g'])).toEqual({ kind: 'multiple', count: 3 })
  })

  it('counts nodes and edges together, so an object plus an edge is no single target', () => {
    expect(sidebarTarget(['a'], ['e'])).toEqual({ kind: 'multiple', count: 2 })
  })
})

describe('isSameTarget', () => {
  it('compares kind and id of single targets', () => {
    expect(isSameTarget({ kind: 'node', id: 'a' }, { kind: 'node', id: 'a' })).toBe(true)
    expect(isSameTarget({ kind: 'node', id: 'a' }, { kind: 'node', id: 'b' })).toBe(false)
    expect(isSameTarget({ kind: 'node', id: 'a' }, { kind: 'edge', id: 'a' })).toBe(false)
    expect(isSameTarget({ kind: 'edge', id: 'e' }, { kind: 'edge', id: 'e' })).toBe(true)
  })

  it('treats none and multiple by their count', () => {
    expect(isSameTarget({ kind: 'none' }, { kind: 'none' })).toBe(true)
    expect(isSameTarget({ kind: 'multiple', count: 2 }, { kind: 'multiple', count: 2 })).toBe(true)
    expect(isSameTarget({ kind: 'multiple', count: 2 }, { kind: 'multiple', count: 3 })).toBe(false)
    expect(isSameTarget({ kind: 'none' }, { kind: 'multiple', count: 2 })).toBe(false)
  })
})
