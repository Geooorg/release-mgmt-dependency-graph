import { describe, expect, it } from 'vitest'
import { box, edge, group } from '../test/fixtures'
import { toFlowEdges, toFlowNodes } from './mapping'

const nodes = [box('a', 0, 0), box('b', 400, 0), box('c', 0, 400)]
const none = new Set<string>()

describe('toFlowEdges', () => {
  it('uses the stored connectors', () => {
    const [flow] = toFlowEdges(
      [{ ...edge('e', 'a', 'b'), sourceHandle: 'bottom', targetHandle: 'top' }],
      none,
      none,
      nodes,
    )
    expect(flow).toMatchObject({ sourceHandle: 'bottom', targetHandle: 'top' })
  })

  it('falls back to facing sides for edges without connectors (older files)', () => {
    const flows = toFlowEdges([edge('e1', 'a', 'b'), edge('e2', 'a', 'c')], none, none, nodes)
    expect(flows[0]).toMatchObject({ sourceHandle: 'right', targetHandle: 'left' })
    expect(flows[1]).toMatchObject({ sourceHandle: 'bottom', targetHandle: 'top' })
  })

  it('fills only the missing side', () => {
    const [flow] = toFlowEdges([{ ...edge('e', 'a', 'b'), sourceHandle: 'top' }], none, none, nodes)
    expect(flow).toMatchObject({ sourceHandle: 'top', targetHandle: 'left' })
  })

  it('draws dependency edges thick, red and on top; selected ones darker blue', () => {
    const flows = toFlowEdges(
      [edge('dep', 'a', 'b'), edge('sel', 'a', 'c'), edge('plain', 'b', 'c')],
      new Set(['sel', 'dep']),
      new Set(['dep']),
      nodes,
    )
    const [dep, sel, plain] = flows
    expect(dep.style).toMatchObject({ stroke: '#dc2626', strokeWidth: 6 })
    expect(dep.zIndex).toBe(1000)
    expect(sel.style).toMatchObject({ stroke: '#1e3a8a', strokeWidth: 3 })
    expect(plain.style).toMatchObject({ stroke: '#2563eb', strokeWidth: 2 })
  })
})

describe('toFlowNodes', () => {
  const ui = {
    selectedIds: none,
    connectSourceId: null,
    dropTargetId: null,
    dependencyNodeIds: new Set(['b']),
    dependencyEdgeIds: none,
  }

  it('passes colour, contrast text and dependency flag to the node data', () => {
    const coloured = {
      ...box('a', 0, 0),
      metadata: [
        { key: 'name', value: 'A' },
        { key: 'color', value: '#FACC15' },
      ],
    }
    const [a, b] = toFlowNodes([coloured, box('b', 1, 1)], ui)
    expect(a.data).toMatchObject({ color: '#facc15', textColor: '#111827', isDependency: false })
    expect(b.data).toMatchObject({ color: undefined, isDependency: true })
  })

  it('maps kinds to node types and orders parents first', () => {
    const flows = toFlowNodes([box('in', 1, 1, 'g'), group('g', 0, 0, 300, 200)], ui)
    expect(flows.map((n) => [n.id, n.type])).toEqual([
      ['g', 'group'],
      ['in', 'box'],
    ])
  })
})
