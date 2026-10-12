import { describe, expect, it } from 'vitest'
import { box, content, edge, group, note } from '../test/fixtures'
import { buildEffectiveGraph } from './effectiveGraph'

describe('buildEffectiveGraph', () => {
  it('uses plain objects as vertices in input order, an arrow points from prerequisite to dependent', () => {
    const graph = buildEffectiveGraph(
      content([box('a', 0, 0), box('b', 1, 0), box('c', 2, 0)], [edge('ab', 'a', 'b'), edge('bc', 'b', 'c')]),
    )
    expect(graph.vertices).toEqual(['a', 'b', 'c'])
    expect(graph.prerequisites.get('a')).toEqual([])
    expect(graph.prerequisites.get('b')).toEqual(['a'])
    expect(graph.prerequisites.get('c')).toEqual(['b'])
    expect(graph.edgeIdsOf('b', 'a')).toEqual(['ab'])
    expect(graph.edgeIdsOf('a', 'b')).toEqual([])
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
    expect(graph.prerequisites.get('m1')).toEqual(['x'])
    expect(graph.prerequisites.get('m2')).toEqual(['x'])
    expect(graph.edgeIdsOf('m2', 'x')).toEqual(['xg'])
  })

  it('resolves an edge out of a group to all its members', () => {
    const graph = buildEffectiveGraph(
      content([group('g', 0, 0, 300, 200), box('m1', 0, 0, 'g'), box('m2', 0, 0, 'g'), box('y', 9, 9)], [
        edge('gy', 'g', 'y'),
      ]),
    )
    expect(graph.prerequisites.get('y')).toEqual(['m1', 'm2'])
    expect(graph.edgeIdsOf('y', 'm1')).toEqual(['gy'])
  })

  it('lets a group without objects stand for itself', () => {
    const graph = buildEffectiveGraph(
      content([box('x', 0, 0), group('g', 0, 0, 300, 200)], [edge('xg', 'x', 'g')]),
    )
    expect(graph.vertices).toEqual(['x', 'g'])
    expect(graph.prerequisites.get('g')).toEqual(['x'])
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
    expect(graph.prerequisites.get('b')).toEqual(['a1', 'a2'])
    expect(graph.edgeIdsOf('b', 'a1')).toEqual(['gh', 'a1b'])
    expect(graph.edgeIdsOf('b', 'a2')).toEqual(['gh'])
  })

  it('drops pairs that would be self loops', () => {
    // g -> m where m is in g is forbidden by the model, but must not blow up the analysis.
    const graph = buildEffectiveGraph(
      content([group('g', 0, 0, 100, 100), box('m', 0, 0, 'g')], [edge('gm', 'g', 'm')]),
    )
    expect(graph.prerequisites.get('m')).toEqual([])
  })

  it('ignores edges to unknown ids', () => {
    const graph = buildEffectiveGraph(content([box('a', 0, 0)], [edge('e', 'ghost', 'a'), edge('f', 'a', 'ghost')]))
    expect(graph.prerequisites.get('a')).toEqual([])
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

describe('buildEffectiveGraph and notes', () => {
  it('leaves notes out: they are no vertices, not even inside a group', () => {
    const graph = buildEffectiveGraph(
      content([group('g', 0, 0, 400, 300), note('n', 10, 10, 'x', 'g'), note('free', 500, 0, 'y'), box('a', 20, 60, 'g'), box('b', 500, 200)], [edge('e', 'a', 'b')]),
    )

    expect(graph.vertices).toEqual(['a', 'b'])
    expect(graph.leavesOf('g')).toEqual(['a'])
    expect(graph.leavesOf('n')).toEqual([])
  })

  it('lets a group that holds only notes stand for itself', () => {
    const graph = buildEffectiveGraph(content([group('g', 0, 0, 400, 300), note('n', 10, 40, 'x', 'g')]))

    expect(graph.vertices).toEqual(['g'])
  })
})
