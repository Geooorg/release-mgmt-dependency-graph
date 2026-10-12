import { describe, expect, it } from 'vitest'
import { box, content, edge, group } from '../test/fixtures'
import { findCycles } from './cycles'

const sorted = (set: ReadonlySet<string>) => [...set].sort()

describe('findCycles', () => {
  it('finds nothing in an acyclic graph', () => {
    const result = findCycles(
      content([box('a', 0, 0), box('b', 1, 0), box('c', 2, 0)], [edge('ab', 'b', 'a'), edge('bc', 'c', 'b'), edge('ac', 'c', 'a')]),
    )
    expect(result.cycles).toEqual([])
    expect(result.nodeIds.size).toBe(0)
    expect(result.edgeIds.size).toBe(0)
  })

  it('finds a cycle of two', () => {
    const result = findCycles(content([box('a', 0, 0), box('b', 1, 0)], [edge('ab', 'b', 'a'), edge('ba', 'a', 'b')]))
    expect(result.cycles).toEqual([['a', 'b']])
    expect(sorted(result.nodeIds)).toEqual(['a', 'b'])
    expect(sorted(result.edgeIds)).toEqual(['ab', 'ba'])
  })

  it('finds a cycle of three, members in node order', () => {
    const result = findCycles(
      content([box('a', 0, 0), box('b', 1, 0), box('c', 2, 0)], [edge('ac', 'c', 'a'), edge('cb', 'b', 'c'), edge('ba', 'a', 'b')]),
    )
    expect(result.cycles).toEqual([['a', 'b', 'c']])
  })

  it('finds two separate cycles, ordered by first member', () => {
    const result = findCycles(
      content(
        [box('a', 0, 0), box('b', 1, 0), box('c', 2, 0), box('d', 3, 0), box('e', 4, 0)],
        [edge('de', 'e', 'd'), edge('ed', 'd', 'e'), edge('ab', 'b', 'a'), edge('ba', 'a', 'b'), edge('bc', 'c', 'b')],
      ),
    )
    expect(result.cycles).toEqual([
      ['a', 'b'],
      ['d', 'e'],
    ])
    expect(result.nodeIds.has('c')).toBe(false)
  })

  it('does not mark an edge that merely leads into or out of a cycle', () => {
    const result = findCycles(
      content(
        [box('in', 0, 0), box('a', 1, 0), box('b', 2, 0), box('out', 3, 0)],
        [edge('ina', 'a', 'in'), edge('ab', 'b', 'a'), edge('ba', 'a', 'b'), edge('bout', 'out', 'b')],
      ),
    )
    expect(sorted(result.edgeIds)).toEqual(['ab', 'ba'])
    expect(sorted(result.nodeIds)).toEqual(['a', 'b'])
  })

  it('does not treat a diamond as a cycle', () => {
    const result = findCycles(
      content(
        [box('a', 0, 0), box('b', 1, 0), box('c', 2, 0), box('d', 3, 0)],
        [edge('ab', 'b', 'a'), edge('ac', 'c', 'a'), edge('bd', 'd', 'b'), edge('cd', 'd', 'c')],
      ),
    )
    expect(result.cycles).toEqual([])
  })

  it('finds a cycle running through a group (X <- G, member M of G <- X)', () => {
    const result = findCycles(
      content(
        [box('x', 0, 0), group('g', 0, 0, 300, 200), box('m', 0, 0, 'g'), box('n', 1, 0, 'g')],
        [edge('xg', 'g', 'x'), edge('mx', 'x', 'm')],
      ),
    )
    expect(result.cycles).toEqual([['x', 'm']])
    expect(sorted(result.nodeIds)).toEqual(['m', 'x'])
    expect(sorted(result.edgeIds)).toEqual(['mx', 'xg'])
  })

  it('finds a cycle through a nested group', () => {
    const result = findCycles(
      content(
        [box('x', 0, 0), group('g', 0, 0, 300, 200), group('h', 0, 0, 100, 100, 'g'), box('m', 0, 0, 'h')],
        [edge('gx', 'x', 'g'), edge('xh', 'h', 'x')],
      ),
    )
    expect(result.cycles).toEqual([['x', 'm']])
    expect(sorted(result.edgeIds)).toEqual(['gx', 'xh'])
  })

  it('finds a cycle between two groups', () => {
    const result = findCycles(
      content(
        [group('g', 0, 0, 1, 1), box('a', 0, 0, 'g'), group('h', 0, 0, 1, 1), box('b', 0, 0, 'h')],
        [edge('gh', 'h', 'g'), edge('hg', 'g', 'h')],
      ),
    )
    expect(result.cycles).toEqual([['a', 'b']])
    expect(sorted(result.edgeIds)).toEqual(['gh', 'hg'])
  })

  it('includes an empty group that is part of a cycle', () => {
    const result = findCycles(
      content([box('x', 0, 0), group('g', 0, 0, 300, 200)], [edge('xg', 'g', 'x'), edge('gx', 'x', 'g')]),
    )
    expect(result.cycles).toEqual([['x', 'g']])
    expect(sorted(result.nodeIds)).toEqual(['g', 'x'])
  })

  it('ignores a group with members that is not itself a vertex', () => {
    const result = findCycles(
      content([group('g', 0, 0, 1, 1), box('m', 0, 0, 'g'), box('x', 1, 1)], [edge('xg', 'g', 'x'), edge('mx', 'x', 'm')]),
    )
    expect(result.nodeIds.has('g')).toBe(false)
  })

  it('handles a large linear graph without a stack overflow', () => {
    const size = 5000
    const nodes = Array.from({ length: size }, (_, i) => box(`n${i}`, i, 0))
    const edges = Array.from({ length: size - 1 }, (_, i) => edge(`e${i}`, `n${i + 1}`, `n${i}`))
    expect(findCycles(content(nodes, edges)).cycles).toEqual([])

    const closed = findCycles(content(nodes, [...edges, edge('back', 'n0', `n${size - 1}`)]))
    expect(closed.cycles).toHaveLength(1)
    expect(closed.cycles[0]).toHaveLength(size)
    expect(closed.edgeIds.size).toBe(size)
  })
})
