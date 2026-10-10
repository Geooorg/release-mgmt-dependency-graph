import { describe, expect, it } from 'vitest'
import { box, content, edge, group } from '../test/fixtures'
import { buildEffectiveGraph } from './effectiveGraph'

describe('buildEffectiveGraph', () => {
  it('uses plain objects as vertices in input order, edges map 1:1', () => {
    const graph = buildEffectiveGraph(
      content([box('a', 0, 0), box('b', 1, 0), box('c', 2, 0)], [edge('ab', 'a', 'b'), edge('bc', 'b', 'c')]),
    )
    expect(graph.vertices).toEqual(['a', 'b', 'c'])
    expect(graph.successors.get('a')).toEqual(['b'])
    expect(graph.successors.get('b')).toEqual(['c'])
    expect(graph.successors.get('c')).toEqual([])
    expect(graph.edgeIdsOf('a', 'b')).toEqual(['ab'])
    expect(graph.edgeIdsOf('b', 'a')).toEqual([])
  })

  it('resolves an edge into a group to all its members (any depth)', () => {
    const graph = buildEffectiveGraph(
      content(
        [
          box('x', 0, 0),
          group('g', 0, 0, 300, 200),
          box('m1', 0, 0, 'g'),
          group('h', 0, 0, 100, 100, 'g'),
          box('m2', 0, 0, 'h'),
        ],
        [edge('xg', 'x', 'g')],
      ),
    )
    expect(graph.vertices).toEqual(['x', 'm1', 'm2'])
    expect(graph.successors.get('x')).toEqual(['m1', 'm2'])
    expect(graph.edgeIdsOf('x', 'm2')).toEqual(['xg'])
  })

  it('resolves an edge out of a group to all its members', () => {
    const graph = buildEffectiveGraph(
      content([group('g', 0, 0, 300, 200), box('m1', 0, 0, 'g'), box('m2', 0, 0, 'g'), box('y', 9, 9)], [
        edge('gy', 'g', 'y'),
      ]),
    )
    expect(graph.successors.get('m1')).toEqual(['y'])
    expect(graph.successors.get('m2')).toEqual(['y'])
  })

  it('lets a group without objects stand for itself', () => {
    const graph = buildEffectiveGraph(
      content([box('x', 0, 0), group('g', 0, 0, 300, 200)], [edge('xg', 'x', 'g')]),
    )
    expect(graph.vertices).toEqual(['x', 'g'])
    expect(graph.successors.get('x')).toEqual(['g'])
  })

  it('combines group to group edges to all pairs and remembers every edge per pair', () => {
    const graph = buildEffectiveGraph(
      content(
        [
          group('g', 0, 0, 100, 100),
          box('a1', 0, 0, 'g'),
          box('a2', 0, 0, 'g'),
          group('h', 0, 0, 100, 100),
          box('b', 0, 0, 'h'),
        ],
        [edge('gh', 'g', 'h'), edge('a1b', 'a1', 'b')],
      ),
    )
    expect(graph.successors.get('a1')).toEqual(['b'])
    expect(graph.edgeIdsOf('a1', 'b')).toEqual(['gh', 'a1b'])
    expect(graph.edgeIdsOf('a2', 'b')).toEqual(['gh'])
  })

  it('drops pairs that would be self loops', () => {
    // g -> m where m is in g is forbidden by the model, but must not blow up the analysis.
    const graph = buildEffectiveGraph(
      content([group('g', 0, 0, 100, 100), box('m', 0, 0, 'g')], [edge('gm', 'g', 'm')]),
    )
    expect(graph.successors.get('m')).toEqual([])
  })

  it('ignores edges to unknown ids', () => {
    const graph = buildEffectiveGraph(content([box('a', 0, 0)], [edge('e', 'a', 'ghost')]))
    expect(graph.successors.get('a')).toEqual([])
  })

  it('survives a corrupt parent loop', () => {
    const graph = buildEffectiveGraph(
      content([{ ...group('g', 0, 0, 1, 1), parentId: 'h' }, { ...group('h', 0, 0, 1, 1), parentId: 'g' }]),
    )
    expect(graph.vertices).toEqual(['g', 'h'])
  })

  it('exposes the vertices an element stands for', () => {
    const graph = buildEffectiveGraph(
      content([
        box('x', 0, 0),
        group('g', 0, 0, 300, 200),
        box('m1', 0, 0, 'g'),
        group('h', 0, 0, 100, 100, 'g'),
        box('m2', 0, 0, 'h'),
        group('empty', 0, 0, 100, 100),
      ]),
    )
    expect(graph.leavesOf('x')).toEqual(['x'])
    expect(graph.leavesOf('g')).toEqual(['m1', 'm2'])
    expect(graph.leavesOf('empty')).toEqual(['empty'])
    expect(graph.leavesOf('ghost')).toEqual([])
  })
})
