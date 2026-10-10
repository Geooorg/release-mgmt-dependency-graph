import { describe, expect, it } from 'vitest'
import { box, content, edge, group } from '../test/fixtures'
import { findDependencies } from './dependency'

// a -> b -> c, a -> d, x -> b (x feeds into b), y isolated
const chain = content(
  [box('a', 0, 0), box('b', 1, 0), box('c', 2, 0), box('d', 3, 0), box('x', 4, 0), box('y', 5, 0)],
  [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('ad', 'a', 'd'), edge('xb', 'x', 'b')],
)

const sorted = (set: ReadonlySet<string>) => [...set].sort()

describe('findDependencies', () => {
  it('follows edges in their direction transitively (outgoing)', () => {
    const result = findDependencies(chain, ['a'], 'outgoing')
    expect(sorted(result.edgeIds)).toEqual(['ab', 'ad', 'bc'])
    expect(sorted(result.nodeIds)).toEqual(['b', 'c', 'd'])
  })

  it('starts mid-chain', () => {
    const result = findDependencies(chain, ['b'], 'outgoing')
    expect(sorted(result.edgeIds)).toEqual(['bc'])
    expect(sorted(result.nodeIds)).toEqual(['c'])
  })

  it('follows edges backwards (incoming)', () => {
    const result = findDependencies(chain, ['c'], 'incoming')
    expect(sorted(result.edgeIds)).toEqual(['ab', 'bc', 'xb'])
    expect(sorted(result.nodeIds)).toEqual(['a', 'b', 'x'])
  })

  it('both directions yields the whole connected component', () => {
    const result = findDependencies(chain, ['b'], 'both')
    expect(sorted(result.edgeIds)).toEqual(['ab', 'ad', 'bc', 'xb'])
    expect(sorted(result.nodeIds)).toEqual(['a', 'c', 'd', 'x'])
  })

  it('merges several start elements', () => {
    const result = findDependencies(chain, ['b', 'x'], 'outgoing')
    expect(sorted(result.edgeIds)).toEqual(['bc', 'xb'])
  })

  it('terminates on cycles', () => {
    const cyclic = content([box('p', 0, 0), box('q', 1, 0)], [edge('pq', 'p', 'q'), edge('qp', 'q', 'p')])
    const result = findDependencies(cyclic, ['p'], 'outgoing')
    expect(sorted(result.edgeIds)).toEqual(['pq', 'qp'])
  })

  it('returns nothing for isolated, unknown or no start elements', () => {
    for (const start of [['y'], ['nope'], []]) {
      const result = findDependencies(chain, start, 'both')
      expect(result.edgeIds.size).toBe(0)
      expect(result.nodeIds.size).toBe(0)
    }
  })

  it('starting at a group also starts at its members', () => {
    const grouped = content(
      [group('g', 0, 0, 300, 200), box('in', 10, 10, 'g'), box('out', 500, 0)],
      [edge('e', 'in', 'out')],
    )
    const result = findDependencies(grouped, ['g'], 'outgoing')
    expect(sorted(result.edgeIds)).toEqual(['e'])
    expect(sorted(result.nodeIds)).toEqual(['out'])
  })

  it('does not mutate its input', () => {
    const before = JSON.stringify(chain)
    findDependencies(chain, ['a'], 'both')
    expect(JSON.stringify(chain)).toBe(before)
  })
})
