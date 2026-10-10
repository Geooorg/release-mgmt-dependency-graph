import { describe, expect, it } from 'vitest'
import { box, group } from '../test/fixtures'
import { findByName, nextHit, normalizeQuery } from './search'
import type { ModelNode } from './types'

const named = (id: string, name: string, kind: 'node' | 'group' = 'node'): ModelNode => ({
  ...(kind === 'node' ? box(id, 0, 0) : group(id, 0, 0, 100, 100)),
  metadata: [{ key: 'name', value: name }],
})

describe('findByName', () => {
  const nodes = [
    named('a', 'Service A'),
    named('b', 'service Bravo'),
    named('g', 'Backend', 'group'),
    named('c', 'Mein Service'),
    named('d', ''),
  ]

  it('finds objects and groups whose name starts with the text, ignoring case, in model order', () => {
    expect(findByName(nodes, 'serv')).toEqual(['a', 'b'])
    expect(findByName(nodes, 'SERVICE')).toEqual(['a', 'b'])
    expect(findByName(nodes, 'b')).toEqual(['g'])
  })

  it('matches the start only, not any part of the name', () => {
    expect(findByName(nodes, 'service').includes('c')).toBe(false)
    expect(findByName(nodes, 'ervice')).toEqual([])
  })

  it('ignores spaces around the text but keeps the ones inside', () => {
    expect(findByName(nodes, '  service a ')).toEqual(['a'])
    expect(findByName(nodes, 'mein s')).toEqual(['c'])
  })

  it('finds nothing for an empty text, and never an unnamed element', () => {
    expect(findByName(nodes, '')).toEqual([])
    expect(findByName(nodes, '   ')).toEqual([])
    expect(findByName([named('d', '')], 'd')).toEqual([])
  })

  it('searches only the name, not other metadata', () => {
    const other: ModelNode = { ...named('x', 'Alpha'), metadata: [{ key: 'name', value: 'Alpha' }, { key: 'owner', value: 'Zeta' }] }

    expect(findByName([other], 'zeta')).toEqual([])
  })

  it('handles umlauts and capitals the way toLowerCase does', () => {
    expect(findByName([named('u', 'Übergabe')], 'üb')).toEqual(['u'])
    expect(findByName([named('u', 'übergabe')], 'ÜB')).toEqual(['u'])
  })
})

describe('normalizeQuery', () => {
  it('trims and lower-cases', () => {
    expect(normalizeQuery('  AbC ')).toBe('abc')
  })
})

describe('nextHit', () => {
  it('starts with the first hit', () => {
    expect(nextHit(['a', 'b', 'c'], null)).toBe('a')
  })

  it('goes on to the following hit and wraps around to the first one', () => {
    expect(nextHit(['a', 'b', 'c'], 'a')).toBe('b')
    expect(nextHit(['a', 'b', 'c'], 'c')).toBe('a')
  })

  it('stays on a single hit', () => {
    expect(nextHit(['a'], 'a')).toBe('a')
  })

  it('starts over when the current hit is no longer among them', () => {
    expect(nextHit(['a', 'b'], 'zzz')).toBe('a')
  })

  it('has nothing without hits', () => {
    expect(nextHit([], 'a')).toBeUndefined()
  })
})
