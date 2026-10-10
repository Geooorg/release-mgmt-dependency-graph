import { describe, expect, it } from 'vitest'
import { analyzeProject } from '../model/releaseAnalysis'
import { box, content, edge, group, withStatus } from '../test/fixtures'
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

describe('toFlowEdges cycles', () => {
  const cycleIds = new Set(['cyc', 'both', 'cycsel'])

  it('draws cycle edges purple, dashed and 3 wide, with a matching arrow', () => {
    const [cyc, plain] = toFlowEdges([edge('cyc', 'a', 'b'), edge('plain', 'b', 'c')], none, none, nodes, cycleIds)
    expect(cyc.style).toMatchObject({ stroke: '#9333ea', strokeWidth: 3, strokeDasharray: '6 4' })
    expect(cyc.markerEnd).toMatchObject({ color: '#9333ea' })
    expect(plain.style?.strokeDasharray).toBeUndefined()
  })

  it('lets the dependency highlight win over the cycle colour but keeps the dashes', () => {
    const [both] = toFlowEdges([edge('both', 'a', 'b')], none, new Set(['both']), nodes, cycleIds)
    expect(both.style).toMatchObject({ stroke: '#dc2626', strokeWidth: 6, strokeDasharray: '6 4' })
  })

  it('shows a selected cycle edge in a darker purple', () => {
    const [flow] = toFlowEdges([edge('cycsel', 'a', 'b')], new Set(['cycsel']), none, nodes, cycleIds)
    expect(flow.style).toMatchObject({ stroke: '#6b21a8', strokeDasharray: '6 4' })
  })
})

describe('toFlowNodes', () => {
  const ui = {
    selectedIds: none,
    connectSourceId: null,
    dropTargetId: null,
    dependencyNodeIds: new Set(['b']),
    dependencyEdgeIds: none,
    cycleNodeIds: new Set(['a']),
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

  it('passes the cycle flag to the node data', () => {
    const [a, b] = toFlowNodes([box('a', 0, 0), box('b', 1, 1)], ui)
    expect(a.data.isInCycle).toBe(true)
    expect(b.data.isInCycle).toBe(false)
  })

  it('maps kinds to node types and orders parents first', () => {
    const flows = toFlowNodes([box('in', 1, 1, 'g'), group('g', 0, 0, 300, 200)], ui)
    expect(flows.map((n) => [n.id, n.type])).toEqual([
      ['g', 'group'],
      ['in', 'box'],
    ])
  })
})

describe('toFlowEdges labels', () => {
  it('passes the label to the edge, in the edge colour', () => {
    const [plain, labelled] = toFlowEdges(
      [edge('p', 'a', 'b'), { ...edge('l', 'a', 'c'), label: 'braucht' }],
      none,
      new Set(['l']),
      nodes,
    )
    expect(plain.label).toBeUndefined()
    expect(labelled.label).toBe('braucht')
    expect(labelled.labelStyle).toMatchObject({ fill: '#dc2626' })
  })
})

describe('toFlowEdges labels', () => {
  it('passes the label to the edge, in the edge colour', () => {
    const [plain, labelled] = toFlowEdges(
      [edge('p', 'a', 'b'), { ...edge('l', 'a', 'c'), label: 'braucht' }],
      none,
      new Set(['l']),
      nodes,
    )
    expect(plain.label).toBeUndefined()
    expect(labelled.label).toBe('braucht')
    expect(labelled.labelStyle).toMatchObject({ fill: '#dc2626' })
  })
})

describe('toFlowNodes status and blockers', () => {
  const ui = (analysis: ReturnType<typeof analyzeProject>, revealedId: string | null = null) => ({
    selectedIds: new Set<string>(),
    connectSourceId: null,
    dropTargetId: null,
    dependencyNodeIds: new Set<string>(),
    dependencyEdgeIds: new Set<string>(),
    cycleNodeIds: new Set<string>(),
    analysis,
    revealedId,
  })

  it('carries the status and the blockers of an object', () => {
    const model = content(
      [withStatus(box('a', 0, 0), 'fertig'), box('b', 1, 0), withStatus(box('c', 2, 0), 'in Arbeit')],
      [edge('ab', 'a', 'b'), edge('bc', 'b', 'c')],
    )
    const [a, b, c] = toFlowNodes(model.nodes, ui(analyzeProject(model)))
    expect([a.data.status, b.data.status, c.data.status]).toEqual(['fertig', 'offen', 'in Arbeit'])
    // a is finished but waits for b: a contradiction, not a blockade
    expect(a.data.blockedTitle).toBeUndefined()
    expect(a.data.inconsistentTitle).toBe('Fertig, aber Voraussetzung nicht fertig: b')
    expect(b.data.blockedTitle).toBe('Blockiert durch: c')
    expect(b.data.inconsistentTitle).toBeUndefined()
    expect(c.data.blockedTitle).toBeUndefined()
    expect(c.data.inconsistentTitle).toBeUndefined()
  })

  it('tells an unset, an unknown and a real status apart', () => {
    const model = content([
      box('unset', 0, 0),
      withStatus(box('real', 1, 0), ' Offen '),
      withStatus(box('odd', 2, 0), 'erledigt'),
      withStatus(box('done', 3, 0), 'fertig'),
    ])
    const [unset, real, odd, done] = toFlowNodes(model.nodes, ui(analyzeProject(model)))
    expect([unset.data.status, unset.data.statusRaw, unset.data.statusKnown]).toEqual(['offen', undefined, true])
    expect([real.data.status, real.data.statusRaw, real.data.statusKnown]).toEqual(['offen', 'Offen', true])
    expect([odd.data.status, odd.data.statusRaw, odd.data.statusKnown]).toEqual(['offen', 'erledigt', false])
    expect([done.data.status, done.data.statusRaw, done.data.statusKnown]).toEqual(['fertig', 'fertig', true])
  })

  it('lists at most five names in the inconsistency title', () => {
    const blockers = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((id, i) => box(id, i + 1, 0))
    const model = content(
      [withStatus(box('a', 0, 0), 'fertig'), ...blockers],
      blockers.map((b) => edge(`e-${b.id}`, 'a', b.id)),
    )
    const [a] = toFlowNodes(model.nodes, ui(analyzeProject(model)))
    expect(a.data.inconsistentTitle).toBe('Fertig, aber Voraussetzung nicht fertig: p1, p2, p3, p4, p5, …')
  })

  it('marks a group that contains an inconsistent object, besides the blocked flag if there is one', () => {
    const model = content(
      [
        group('g', 0, 0, 300, 200),
        withStatus(box('m', 1, 1, 'g'), 'fertig'),
        box('n', 2, 2, 'g'),
        box('y', 5, 5),
        group('h', 0, 400, 300, 200),
        withStatus(box('o', 1, 401, 'h'), 'fertig'),
      ],
      [edge('my', 'm', 'y'), edge('ny', 'n', 'y'), edge('oy', 'o', 'y')],
    )
    const flows = toFlowNodes(model.nodes, ui(analyzeProject(model)))
    const g = flows.find((n) => n.id === 'g')!
    const h = flows.find((n) => n.id === 'h')!
    expect(g.data.inconsistentTitle).toBe('Enthält fertige Objekte mit nicht fertiger Voraussetzung: m')
    expect(g.data.blockedTitle).toBe('Enthält blockierte Objekte: n')
    expect(h.data.inconsistentTitle).toBe('Enthält fertige Objekte mit nicht fertiger Voraussetzung: o')
    expect(h.data.blockedTitle).toBeUndefined()
  })

  it('lists at most five blockers, then an ellipsis', () => {
    const blockers = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((id, i) => box(id, i + 1, 0))
    const model = content(
      [box('a', 0, 0), ...blockers],
      blockers.map((b) => edge(`e-${b.id}`, 'a', b.id)),
    )
    const [a] = toFlowNodes(model.nodes, ui(analyzeProject(model)))
    expect(a.data.blockedTitle).toBe('Blockiert durch: p1, p2, p3, p4, p5, …')
  })

  it('names the blocked members on a group and gives it no status', () => {
    const model = content(
      [group('g', 0, 0, 300, 200), box('m', 1, 1, 'g'), box('y', 5, 5)],
      [edge('my', 'm', 'y')],
    )
    const flows = toFlowNodes(model.nodes, ui(analyzeProject(model)))
    const g = flows.find((n) => n.id === 'g')!
    expect(g.data.blockedTitle).toBe('Enthält blockierte Objekte: m')
    expect(g.data.status).toBeUndefined()
  })

  it('flags the revealed element and works without analysis', () => {
    const nodes = [box('a', 0, 0), box('b', 1, 0)]
    const withReveal = toFlowNodes(nodes, ui(analyzeProject(content(nodes)), 'b'))
    expect(withReveal.map((n) => n.data.isRevealed)).toEqual([false, true])

    const [plain] = toFlowNodes(nodes, { ...ui(analyzeProject(content(nodes))), analysis: undefined })
    expect(plain.data.status).toBeUndefined()
    expect(plain.data.blockedTitle).toBeUndefined()
  })
})
