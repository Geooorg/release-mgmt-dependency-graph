import { describe, expect, it } from 'vitest'
import { box, content, edge, group } from '../test/fixtures'
import { findDependencies } from './dependency'

// a depends on b depends on c, a depends on d, x depends on b; y isolated (arrows point to the dependent)
const chain = content(
  [box('a', 0, 0), box('b', 1, 0), box('c', 2, 0), box('d', 3, 0), box('x', 4, 0), box('y', 5, 0)],
  [edge('ab', 'b', 'a'), edge('bc', 'c', 'b'), edge('ad', 'd', 'a'), edge('xb', 'b', 'x')],
)

const sorted = (set: ReadonlySet<string>) => [...set].sort()

describe('findDependencies', () => {
  it('follows the prerequisites transitively, against the arrows', () => {
    const result = findDependencies(chain, ['a'], 'prerequisites')
    expect(sorted(result.edgeIds)).toEqual(['ab', 'ad', 'bc'])
    expect(sorted(result.nodeIds)).toEqual(['b', 'c', 'd'])
  })

  it('starts mid-chain', () => {
    const result = findDependencies(chain, ['b'], 'prerequisites')
    expect(sorted(result.edgeIds)).toEqual(['bc'])
    expect(sorted(result.nodeIds)).toEqual(['c'])
  })

  it('follows the dependents, along the arrows', () => {
    const result = findDependencies(chain, ['c'], 'dependents')
    expect(sorted(result.edgeIds)).toEqual(['ab', 'bc', 'xb'])
    expect(sorted(result.nodeIds)).toEqual(['a', 'b', 'x'])
  })

  it('the transitive closure joins all prerequisites and all dependents, but no siblings', () => {
    // d is another prerequisite of a: neither a prerequisite nor a dependent of b
    const result = findDependencies(chain, ['b'], 'closure')
    expect(sorted(result.edgeIds)).toEqual(['ab', 'bc', 'xb'])
    expect(sorted(result.nodeIds)).toEqual(['a', 'c', 'x'])
    expect(result.prerequisiteIds).toEqual(['c'])
    expect(result.dependentIds).toEqual(['a', 'x'])
  })

  it('lists the reached objects per side, nearest first, then in node order', () => {
    expect(findDependencies(chain, ['c'], 'dependents').dependentIds).toEqual(['b', 'a', 'x'])
    expect(findDependencies(chain, ['c'], 'dependents').prerequisiteIds).toEqual([])
    expect(findDependencies(chain, ['a'], 'prerequisites').prerequisiteIds).toEqual(['b', 'd', 'c'])
    expect(findDependencies(chain, ['a'], 'prerequisites').dependentIds).toEqual([])
  })

  it('lists an object on both sides when a cycle runs through the start', () => {
    const cyclic = content([box('p', 0, 0), box('q', 1, 0)], [edge('pq', 'p', 'q'), edge('qp', 'q', 'p')])
    const result = findDependencies(cyclic, ['p'], 'closure')
    expect(result.prerequisiteIds).toEqual(['q'])
    expect(result.dependentIds).toEqual(['q'])
  })

  it('lists objects only, not the groups the traversal passes', () => {
    // x depends on group g (members m1, m2)
    const grouped = content(
      [box('x', 0, 0), group('g', 0, 0, 300, 200), box('m1', 0, 0, 'g'), box('m2', 0, 0, 'g'), group('e', 0, 0, 10, 10)],
      [edge('xg', 'g', 'x'), edge('ex', 'e', 'x')],
    )
    const result = findDependencies(grouped, ['x'], 'closure')
    expect(sorted(result.nodeIds)).toEqual(['e', 'g', 'm1', 'm2'])
    expect(result.prerequisiteIds).toEqual(['m1', 'm2'])
  })

  it('merges several start elements', () => {
    const result = findDependencies(chain, ['b', 'x'], 'prerequisites')
    expect(sorted(result.edgeIds)).toEqual(['bc', 'xb'])
  })

  it('terminates on cycles', () => {
    const cyclic = content([box('p', 0, 0), box('q', 1, 0)], [edge('pq', 'q', 'p'), edge('qp', 'p', 'q')])
    const result = findDependencies(cyclic, ['p'], 'prerequisites')
    expect(sorted(result.edgeIds)).toEqual(['pq', 'qp'])
  })

  it('returns nothing for isolated, unknown or no start elements', () => {
    for (const start of [['y'], ['nope'], []]) {
      const result = findDependencies(chain, start, 'closure')
      expect(result.edgeIds.size).toBe(0)
      expect(result.nodeIds.size).toBe(0)
    }
  })

  it('starting at a group also starts at its members', () => {
    const grouped = content(
      [group('g', 0, 0, 300, 200), box('in', 10, 10, 'g'), box('out', 500, 0)],
      [edge('e', 'out', 'in')],
    )
    const result = findDependencies(grouped, ['g'], 'prerequisites')
    expect(sorted(result.edgeIds)).toEqual(['e'])
    expect(sorted(result.nodeIds)).toEqual(['out'])
  })

  it('does not mutate its input', () => {
    const before = JSON.stringify(chain)
    findDependencies(chain, ['a'], 'closure')
    expect(JSON.stringify(chain)).toBe(before)
  })

  it('treats an edge to a group as an edge to all its members', () => {
    // x depends on group g (members m1, m2); m2 depends on z
    const grouped = content(
      [box('x', 0, 0), group('g', 0, 0, 300, 200), box('m1', 0, 0, 'g'), box('m2', 0, 0, 'g'), box('z', 9, 9)],
      [edge('xg', 'g', 'x'), edge('m2z', 'z', 'm2')],
    )
    const result = findDependencies(grouped, ['x'], 'prerequisites')
    expect(sorted(result.edgeIds)).toEqual(['m2z', 'xg'])
    expect(sorted(result.nodeIds)).toEqual(['g', 'm1', 'm2', 'z'])
  })

  it('follows an edge out of a group for every member (dependents)', () => {
    const grouped = content(
      [box('y', 9, 9), group('g', 0, 0, 300, 200), box('m1', 0, 0, 'g'), box('m2', 0, 0, 'g')],
      [edge('gy', 'y', 'g')],
    )
    const result = findDependencies(grouped, ['y'], 'dependents')
    expect(sorted(result.edgeIds)).toEqual(['gy'])
    expect(sorted(result.nodeIds)).toEqual(['g', 'm1', 'm2'])
  })

  it('does not report the group around the selected member', () => {
    const grouped = content(
      [group('g', 0, 0, 300, 200), box('m', 0, 0, 'g'), box('y', 9, 9)],
      [edge('gy', 'y', 'g')],
    )
    const result = findDependencies(grouped, ['m'], 'prerequisites')
    expect(sorted(result.edgeIds)).toEqual(['gy'])
    expect(sorted(result.nodeIds)).toEqual(['y'])
  })

  it('follows paths through a group between a member and an outside object', () => {
    // a depends on group g; member m of g depends on d
    const grouped = content(
      [box('a', 0, 0), group('g', 0, 0, 300, 200), box('m', 0, 0, 'g'), box('d', 9, 9)],
      [edge('ag', 'g', 'a'), edge('md', 'd', 'm')],
    )
    expect(sorted(findDependencies(grouped, ['a'], 'prerequisites').nodeIds)).toEqual(['d', 'g', 'm'])
    expect(sorted(findDependencies(grouped, ['d'], 'dependents').nodeIds)).toEqual(['a', 'g', 'm'])
  })

  it('reports an empty group as an element', () => {
    const model = content([box('x', 0, 0), group('e', 0, 0, 10, 10)], [edge('xe', 'e', 'x')])
    const result = findDependencies(model, ['x'], 'prerequisites')
    expect(sorted(result.nodeIds)).toEqual(['e'])
  })
})
