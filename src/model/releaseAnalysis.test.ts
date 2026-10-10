import { describe, expect, it } from 'vitest'
import { box, content, edge, group, withStatus } from '../test/fixtures'
import {
  analyzeProject,
  analyzeSelection,
  formatAnalysisMarkdown,
} from './releaseAnalysis'

const done = (id: string, x = 0) => withStatus(box(id, x, 0), 'fertig')
const wip = (id: string, x = 0) => withStatus(box(id, x, 0), 'in Arbeit')
const open = (id: string, x = 0) => box(id, x, 0)
const sorted = (set: ReadonlySet<string>) => [...set].sort()

describe('analyzeProject', () => {
  it('blocks nothing when everything is done', () => {
    const result = analyzeProject(
      content([done('a'), done('b', 1), done('c', 2)], [edge('ab', 'a', 'b'), edge('bc', 'b', 'c')]),
    )
    expect(result.blockedIds.size).toBe(0)
    expect(result.readyIds.size).toBe(0)
    expect(result.counts).toEqual({ total: 3, done: 3, inProgress: 0, open: 0, blocked: 0, inconsistent: 0, unknownStatus: 0, ready: 0 })
  })

  it('reads the status of every object (default offen)', () => {
    const result = analyzeProject(content([done('a'), wip('b', 1), open('c', 2), withStatus(box('d', 3, 0), 'bald')]))
    expect([...result.statusById]).toEqual([
      ['a', 'fertig'],
      ['b', 'in Arbeit'],
      ['c', 'offen'],
      ['d', 'offen'],
    ])
  })

  it('blocks a chain down to its first open prerequisite', () => {
    // a depends on b depends on c; c is open
    const result = analyzeProject(
      content([wip('a'), wip('b', 1), open('c', 2)], [edge('ab', 'a', 'b'), edge('bc', 'b', 'c')]),
    )
    expect(sorted(result.blockedIds)).toEqual(['a', 'b'])
    expect(sorted(result.readyIds)).toEqual(['c'])
    expect(result.blockingDirect.get('a')).toEqual(['b'])
    expect(result.blockingDirect.get('b')).toEqual(['c'])
    expect(result.blockingDirect.has('c')).toBe(false)
    expect(result.counts).toEqual({ total: 3, done: 0, inProgress: 2, open: 1, blocked: 2, inconsistent: 0, unknownStatus: 0, ready: 1 })
  })

  it('reports a finished object with an open prerequisite as inconsistent, not as blocked', () => {
    // a (done) depends on b (done) depends on c (open): b is inconsistent through c, a only via b
    const result = analyzeProject(
      content([done('a'), done('b', 1), open('c', 2)], [edge('ab', 'a', 'b'), edge('bc', 'b', 'c')]),
    )
    expect(result.blockedIds.size).toBe(0)
    expect(sorted(result.inconsistentIds)).toEqual(['a', 'b'])
    expect(result.blockingDirect.get('a')).toEqual(['b'])
    expect(result.blockingDirect.get('b')).toEqual(['c'])
    expect(sorted(result.readyIds)).toEqual(['c'])
    expect(result.counts).toMatchObject({ done: 2, blocked: 0, inconsistent: 2, ready: 1 })
  })

  it('explains the A -> B, A -> C, C -> D example: A is blocked, C is inconsistent', () => {
    // a (offen) depends on b (no status) and c (fertig); c depends on d (no status)
    const result = analyzeProject(
      content(
        [open('a'), open('b', 1), done('c', 2), open('d', 3)],
        [edge('ab', 'a', 'b'), edge('ac', 'a', 'c'), edge('cd', 'c', 'd')],
      ),
    )
    expect(sorted(result.blockedIds)).toEqual(['a'])
    expect(sorted(result.inconsistentIds)).toEqual(['c'])
    // c counts as a way through which a is blocked, although it is marked done
    expect(result.blockingDirect.get('a')).toEqual(['b', 'c'])
    expect(result.blockingDirect.get('c')).toEqual(['d'])
    expect(sorted(result.readyIds)).toEqual(['b', 'd'])
  })

  it('keeps open + inProgress equal to ready + blocked, also with cycles and inconsistencies', () => {
    const models = [
      content([open('p'), wip('q', 1), open('r', 2)], [edge('pq', 'p', 'q'), edge('qp', 'q', 'p'), edge('pr', 'p', 'r')]),
      content([done('a'), open('b', 1), wip('c', 2), done('d', 3)], [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('cd', 'c', 'd')]),
      content([done('p'), open('q', 1)], [edge('pq', 'p', 'q'), edge('qp', 'q', 'p')]),
    ]
    for (const model of models) {
      const { counts } = analyzeProject(model)
      expect(counts.open + counts.inProgress).toBe(counts.ready + counts.blocked)
    }
  })

  it('reports a finished object in a cycle with an unfinished one as inconsistent', () => {
    const result = analyzeProject(
      content([done('p'), open('q', 1)], [edge('pq', 'p', 'q'), edge('qp', 'q', 'p')]),
    )
    expect(sorted(result.inconsistentIds)).toEqual(['p'])
    expect(sorted(result.blockedIds)).toEqual(['q'])
    expect(result.readyIds.size).toBe(0)
  })

  it('lists the inconsistent members of a group, and a group is blocked only by blocked members', () => {
    const result = analyzeProject(
      content(
        [group('g', 0, 0, 300, 200), done('m1', 0), open('m2', 1), open('y', 5), group('h', 0, 0, 300, 200)].map((n) =>
          n.id === 'm1' || n.id === 'm2' ? { ...n, parentId: 'g' } : n,
        ),
        [edge('m1y', 'm1', 'y')],
      ),
    )
    expect(result.inconsistentMembers.get('g')).toEqual(['m1'])
    expect(result.inconsistentMembers.has('h')).toBe(false)
    expect(result.blockedIds.has('g')).toBe(false)
    expect(result.blockedMembers.has('g')).toBe(false)
  })

  it('collects objects with an unknown status value (counted as offen)', () => {
    const result = analyzeProject(
      content([withStatus(box('a', 0, 0), ' erledigt '), open('b', 1), withStatus(box('c', 2, 0), ''), done('d', 3)]),
    )
    expect([...result.unknownStatusIds]).toEqual([['a', 'erledigt']])
    expect(result.counts).toMatchObject({ open: 3, unknownStatus: 1 })
    expect(result.statusInfoById.get('a')).toEqual({ status: 'offen', raw: 'erledigt', known: false })
    expect(result.statusInfoById.get('b')).toEqual({ status: 'offen', raw: undefined, known: true })
  })

  it('reads a Status key in any case', () => {
    const upper = { ...box('a', 0, 0), metadata: [{ key: 'name', value: 'a' }, { key: 'Status', value: 'fertig' }] }
    expect(analyzeProject(content([upper])).statusById.get('a')).toBe('fertig')
  })

  it('does not block an object whose prerequisites are all done', () => {
    const result = analyzeProject(content([open('a'), done('b', 1)], [edge('ab', 'a', 'b')]))
    expect(result.blockedIds.size).toBe(0)
    expect(sorted(result.readyIds)).toEqual(['a'])
  })

  it('lists every blocking direct prerequisite in node order', () => {
    const result = analyzeProject(
      content(
        [open('a'), open('b', 1), done('c', 2), open('d', 3)],
        [edge('ad', 'a', 'd'), edge('ab', 'a', 'b'), edge('ac', 'a', 'c')],
      ),
    )
    expect(result.blockingDirect.get('a')).toEqual(['b', 'd'])
  })

  it('applies an edge to a group to all its members', () => {
    // x depends on group g; one member is still open
    const result = analyzeProject(
      content(
        [wip('x'), group('g', 0, 0, 300, 200), done('m1', 0), open('m2', 1)].map((n, i) =>
          i >= 2 ? { ...n, parentId: 'g' } : n,
        ),
        [edge('xg', 'x', 'g')],
      ),
    )
    expect(sorted(result.blockedIds)).toEqual(['x'])
    expect(result.blockingDirect.get('x')).toEqual(['m2'])
  })

  it('flags a group that contains a blocked member', () => {
    const result = analyzeProject(
      content(
        [group('g', 0, 0, 300, 200), open('m1', 0), open('m2', 1), open('y', 5)].map((n, i) =>
          i === 1 || i === 2 ? { ...n, parentId: 'g' } : n,
        ),
        [edge('m2y', 'm2', 'y')],
      ),
    )
    expect(sorted(result.blockedIds)).toEqual(['g', 'm2'])
    expect(result.blockedMembers.get('g')).toEqual(['m2'])
    expect(sorted(result.readyIds)).toEqual(['m1', 'y'])
    // counts only objects
    expect(result.counts.blocked).toBe(1)
  })

  it('counts the finished members of every group, nested ones for the outer group too', () => {
    const result = analyzeProject(
      content([
        group('g', 0, 0, 300, 200),
        { ...done('m1'), parentId: 'g' },
        group('h', 0, 0, 100, 100, 'g'),
        { ...open('m2'), parentId: 'h' },
        { ...open('m3', 1), parentId: 'h' },
        group('empty', 0, 0, 10, 10),
      ]),
    )
    expect(result.groupProgress.get('g')).toEqual({ done: 1, total: 3 })
    expect(result.groupProgress.get('h')).toEqual({ done: 0, total: 2 })
    expect(result.groupProgress.get('empty')).toEqual({ done: 0, total: 0 })
  })

  it('treats a group without objects as transparent (it has no work of its own)', () => {
    // a depends on the empty group, which depends on c (open)
    const result = analyzeProject(
      content([open('a'), group('e', 0, 0, 10, 10), open('c', 2)], [edge('ae', 'a', 'e'), edge('ec', 'e', 'c')]),
    )
    expect(sorted(result.blockedIds)).toEqual(['a'])
    expect(result.blockingDirect.get('a')).toEqual(['e'])
    expect(result.counts.total).toBe(2)
  })

  it('blocks open objects in a cycle: they can never become ready', () => {
    const result = analyzeProject(
      content([open('p'), open('q', 1), open('r', 2)], [edge('pq', 'p', 'q'), edge('qp', 'q', 'p'), edge('pr', 'p', 'r')]),
    )
    expect(sorted(result.blockedIds)).toEqual(['p', 'q'])
    expect(sorted(result.readyIds)).toEqual(['r'])
  })

  it('handles a 5000 object chain without overflowing the stack', () => {
    const size = 5000
    const nodes = Array.from({ length: size }, (_, i) => (i === size - 1 ? open(`n${i}`, i) : done(`n${i}`, i)))
    const edges = Array.from({ length: size - 1 }, (_, i) => edge(`e${i}`, `n${i}`, `n${i + 1}`))
    const result = analyzeProject(content(nodes, edges))
    expect(result.blockedIds.size).toBe(0)
    expect(result.inconsistentIds.size).toBe(size - 1)
    expect([...result.readyIds]).toEqual([`n${size - 1}`])
  })
})

describe('analyzeSelection', () => {
  // a -> b -> c -> d  (a depends on b, ...), a -> x -> d
  const graph = content(
    [open('a'), wip('b', 1), open('c', 2), open('d', 3), done('x', 4)],
    [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('cd', 'c', 'd'), edge('ax', 'a', 'x'), edge('xd', 'x', 'd')],
  )

  it('lists open transitive prerequisites, ready ones first, then in release order', () => {
    const result = analyzeSelection(graph, ['a'])
    expect(result.scope).toBe('selection')
    expect(result.blockers).toEqual([
      { id: 'd', status: 'offen', ready: true, distance: 2 },
      { id: 'c', status: 'offen', ready: false, distance: 2 },
      { id: 'b', status: 'in Arbeit', ready: false, distance: 1 },
    ])
  })

  it('computes the shortest distance', () => {
    const result = analyzeSelection(graph, ['a'])
    expect(result.blockers.find((b) => b.id === 'd')?.distance).toBe(2)
  })

  it('excludes the selection itself and finished prerequisites', () => {
    const result = analyzeSelection(graph, ['b', 'c'])
    expect(result.blockers.map((b) => b.id)).toEqual(['d'])
  })

  it('has no blockers when all prerequisites are done', () => {
    const result = analyzeSelection(content([open('a'), done('b', 1)], [edge('ab', 'a', 'b')]), ['a'])
    expect(result.blockers).toEqual([])
    expect(result.criticalPath).toEqual({ nodeIds: ['a'], edgeIds: [], length: 1 })
  })

  it('starts at all members of a selected group', () => {
    const grouped = content(
      [group('g', 0, 0, 300, 200), { ...open('m1'), parentId: 'g' }, { ...open('m2', 1), parentId: 'g' }, open('y', 5), open('z', 6)],
      [edge('m1y', 'm1', 'y'), edge('m2z', 'm2', 'z')],
    )
    const result = analyzeSelection(grouped, ['g'])
    expect(result.selectedIds).toEqual(['g'])
    expect(result.blockers.map((b) => b.id)).toEqual(['y', 'z'])
  })

  it('picks the longer of two chains as critical path, in release order', () => {
    // a -> b -> c (2 open below) vs a -> x -> d -> e? build: long chain a-b-c-d, short a-x
    const result = analyzeSelection(graph, ['a'])
    expect(result.criticalPath).toEqual({
      nodeIds: ['d', 'c', 'b', 'a'],
      edgeIds: ['cd', 'bc', 'ab'],
      length: 4,
    })
  })

  it('weights finished objects with 0', () => {
    // a -> x(done) -> d(open) is shorter than a -> b -> c -> d, but with x done and the long chain done too:
    const model = content(
      [open('a'), done('b', 1), done('c', 2), open('d', 3), open('x', 4), done('y', 5)],
      [
        edge('ab', 'a', 'b'),
        edge('bc', 'b', 'c'),
        edge('cd', 'c', 'd'),
        edge('ax', 'a', 'x'),
        edge('xy', 'x', 'y'),
      ],
    )
    const result = analyzeSelection(model, ['a'])
    // via b, c: a(1) + b(0) + c(0) + d(1) = 2; via x: a(1) + x(1) = 2 -> tie -> node order (b before x)
    expect(result.criticalPath?.length).toBe(2)
    expect(result.criticalPath?.nodeIds).toEqual(['d', 'c', 'b', 'a'])
  })

  it('breaks ties by node order', () => {
    const model = content(
      [open('a'), open('p', 1), open('q', 2)],
      [edge('aq', 'a', 'q'), edge('ap', 'a', 'p')],
    )
    expect(analyzeSelection(model, ['a']).criticalPath?.nodeIds).toEqual(['p', 'a'])
    // deterministic: same result a second time
    expect(analyzeSelection(model, ['a']).criticalPath?.nodeIds).toEqual(['p', 'a'])
  })

  it('reports an empty critical path when nothing is open on the way', () => {
    const model = content([done('a'), done('b', 1)], [edge('ab', 'a', 'b')])
    expect(analyzeSelection(model, ['a']).criticalPath).toEqual({ nodeIds: [], edgeIds: [], length: 0 })
  })

  it('has an empty critical path for an empty project (no phantom step)', () => {
    const result = analyzeSelection(content([]), [])
    expect(result.criticalPath).toEqual({ nodeIds: [], edgeIds: [], length: 0 })
    expect(result.blockers).toEqual([])
  })

  it('includes a finished selected object that waits for an open prerequisite', () => {
    const model = content([done('a'), open('b', 1)], [edge('ab', 'a', 'b')])
    expect(analyzeSelection(model, ['a']).criticalPath).toEqual({ nodeIds: ['b', 'a'], edgeIds: ['ab'], length: 1 })
  })

  it('credits group edges to the explicit edge that produced the step', () => {
    const model = content(
      [open('x'), group('g', 0, 0, 300, 200), { ...open('m'), parentId: 'g' }],
      [edge('xg', 'x', 'g')],
    )
    expect(analyzeSelection(model, ['x']).criticalPath).toEqual({ nodeIds: ['m', 'x'], edgeIds: ['xg'], length: 2 })
  })

  it('cannot compute a critical path when the relevant part contains a cycle, but still lists blockers', () => {
    const model = content(
      [open('a'), open('p', 1), open('q', 2)],
      [edge('ap', 'a', 'p'), edge('pq', 'p', 'q'), edge('qp', 'q', 'p')],
    )
    const result = analyzeSelection(model, ['a'])
    expect(result.criticalPath).toBeNull()
    expect(result.cycleIds).toEqual(['p', 'q'])
    expect(result.blockers.map((b) => b.id)).toEqual(['p', 'q'])
  })

  it('ignores a cycle that is not reachable from the selection', () => {
    const model = content(
      [open('a'), open('b', 1), open('p', 2), open('q', 3)],
      [edge('ab', 'a', 'b'), edge('pq', 'p', 'q'), edge('qp', 'q', 'p')],
    )
    const result = analyzeSelection(model, ['a'])
    expect(result.cycleIds).toEqual([])
    expect(result.criticalPath).toEqual({ nodeIds: ['b', 'a'], edgeIds: ['ab'], length: 2 })
  })

  it('covers the whole project without a selection', () => {
    // two roots: r1 -> m1 -> m2 (3 open), r2 -> m2 (2 open)
    const model = content(
      [open('r1'), open('r2', 1), open('m1', 2), open('m2', 3), done('z', 4)],
      [edge('r1m1', 'r1', 'm1'), edge('m1m2', 'm1', 'm2'), edge('r2m2', 'r2', 'm2')],
    )
    const result = analyzeSelection(model, [])
    expect(result.scope).toBe('project')
    expect(result.selectedIds).toEqual([])
    expect(result.criticalPath).toEqual({ nodeIds: ['m2', 'm1', 'r1'], edgeIds: ['m1m2', 'r1m1'], length: 3 })
    // project scope: every open object is listed, ready ones first
    expect(result.blockers.map((b) => [b.id, b.ready])).toEqual([
      ['m2', true],
      ['r2', false],
      ['m1', false],
      ['r1', false],
    ])
  })

  it('treats unknown ids as no selection', () => {
    expect(analyzeSelection(graph, ['ghost']).scope).toBe('project')
  })

  it('computes a 5000 object chain without overflowing the stack', () => {
    const size = 5000
    const nodes = Array.from({ length: size }, (_, i) => open(`n${i}`, i))
    const edges = Array.from({ length: size - 1 }, (_, i) => edge(`e${i}`, `n${i}`, `n${i + 1}`))
    const result = analyzeSelection(content(nodes, edges), ['n0'])
    expect(result.criticalPath?.length).toBe(size)
    expect(result.criticalPath?.nodeIds[0]).toBe(`n${size - 1}`)
    expect(result.blockers).toHaveLength(size - 1)
  })

  describe('to clarify', () => {
    // a -> b(done) -> c(open); a -> x(done) -> y(done); z(done) -> c; u(unknown status) alone
    const model = content(
      [open('a'), done('b', 1), open('c', 2), done('x', 3), done('y', 4), done('z', 5), withStatus(box('u', 6, 0), 'bald')],
      [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('ax', 'a', 'x'), edge('xy', 'x', 'y'), edge('zc', 'z', 'c')],
    )

    it('lists every inconsistent object of the project, with what it waits for', () => {
      const result = analyzeSelection(model, [])
      expect(result.inconsistent).toEqual([
        { id: 'b', waitingFor: ['c'] },
        { id: 'z', waitingFor: ['c'] },
      ])
      expect(result.unknownStatus).toEqual([{ id: 'u', raw: 'bald' }])
    })

    it('limits the list to the selection and its transitive prerequisites', () => {
      expect(analyzeSelection(model, ['a']).inconsistent).toEqual([{ id: 'b', waitingFor: ['c'] }])
      expect(analyzeSelection(model, ['a']).unknownStatus).toEqual([])
      expect(analyzeSelection(model, ['z']).inconsistent).toEqual([{ id: 'z', waitingFor: ['c'] }])
      expect(analyzeSelection(model, ['b']).inconsistent).toEqual([{ id: 'b', waitingFor: ['c'] }])
      expect(analyzeSelection(model, ['x']).inconsistent).toEqual([])
      expect(analyzeSelection(model, ['u']).unknownStatus).toEqual([{ id: 'u', raw: 'bald' }])
    })

    it('names the direct prerequisites in node order, including a finished one that is itself inconsistent', () => {
      const chain = content(
        [done('p'), done('q', 1), open('r', 2), open('s', 3)],
        [edge('ps', 'p', 's'), edge('pq', 'p', 'q'), edge('qr', 'q', 'r')],
      )
      expect(analyzeSelection(chain, []).inconsistent).toEqual([
        { id: 'p', waitingFor: ['q', 's'] },
        { id: 'q', waitingFor: ['r'] },
      ])
    })
  })

  it('does not mutate its input', () => {
    const before = JSON.stringify(graph)
    analyzeSelection(graph, ['a'])
    analyzeProject(graph)
    expect(JSON.stringify(graph)).toBe(before)
  })
})

describe('formatAnalysisMarkdown', () => {
  const model = {
    ...content(
      [open('a'), wip('b', 1), open('c', 2), done('x', 3)],
      [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('ax', 'a', 'x')],
    ),
    projectName: 'Release-1',
  }
  const named = {
    ...model,
    nodes: model.nodes.map((n) => ({ ...n, metadata: [{ key: 'name', value: `Dienst ${n.id.toUpperCase()}` }, ...n.metadata.slice(1)] })),
  }

  it('describes a selection', () => {
    const text = formatAnalysisMarkdown(named, analyzeProject(named), analyzeSelection(named, ['a']))
    expect(text).toBe(
      [
        '# Release-Analyse: Release-1 – Dienst A',
        '',
        '- fertig: 1',
        '- in Arbeit: 1',
        '- offen: 2',
        '- blockiert: 2',
        '- jetzt umsetzbar: 1',
        '',
        '## Kritischer Pfad (3 Schritte)',
        '',
        '1. Dienst C – offen',
        '2. Dienst B – in Arbeit',
        '3. Dienst A – offen',
        '',
        '## Blockierende Objekte',
        '',
        '- Dienst C – offen, jetzt umsetzbar',
        '- Dienst B – in Arbeit',
        '',
      ].join('\n'),
    )
  })

  it('describes the whole project and uses the short id for unnamed objects', () => {
    const unnamed = { ...model, nodes: model.nodes.map((n) => ({ ...n, metadata: [{ key: 'name', value: '' }, ...n.metadata.slice(1)] })) }
    const text = formatAnalysisMarkdown(unnamed, analyzeProject(unnamed), analyzeSelection(unnamed, []))
    expect(text).toContain('# Release-Analyse: Release-1 – Gesamtes Projekt')
    expect(text).toContain('## Jetzt umsetzbar\n\n- c – offen')
    expect(text).toContain('## Blockiert\n\n- b – in Arbeit\n- a – offen')
  })

  it('adds a section "Zu klären" for inconsistent objects and unknown status values', () => {
    const unclear = content(
      [open('a'), done('b', 1), open('c', 2), withStatus(box('u', 3, 0), 'erledigt')],
      [edge('ab', 'a', 'b'), edge('bc', 'b', 'c')],
    )
    const text = formatAnalysisMarkdown(unclear, analyzeProject(unclear), analyzeSelection(unclear, []))
    expect(text).toContain('- zu klären: 2\n')
    expect(text).toContain(
      [
        '## Zu klären',
        '',
        '### Fertig trotz offener Voraussetzung (1)',
        '',
        '- b – wartet auf c (offen)',
        '',
        '### Unbekannter Status (1)',
        '',
        '- u – „erledigt“ (zählt als offen)',
        '',
        '## Kritischer Pfad',
      ].join('\n'),
    )
  })

  it('omits the section and the counter when there is nothing to clarify', () => {
    const text = formatAnalysisMarkdown(named, analyzeProject(named), analyzeSelection(named, ['a']))
    expect(text).not.toContain('Zu klären')
    expect(text).not.toContain('zu klären')
  })

  it('explains a missing critical path on a cycle', () => {
    const cyclic = content([open('p'), open('q', 1)], [edge('pq', 'p', 'q'), edge('qp', 'q', 'p')])
    const text = formatAnalysisMarkdown(cyclic, analyzeProject(cyclic), analyzeSelection(cyclic, ['p']))
    expect(text).toContain('Kritischer Pfad nicht berechenbar – Zyklus zwischen p, q.')
    expect(text).toContain('# Release-Analyse: Release-Management – p')
  })

  it('says so when nothing is open', () => {
    const finished = content([done('a'), done('b', 1)], [edge('ab', 'a', 'b')])
    const text = formatAnalysisMarkdown(finished, analyzeProject(finished), analyzeSelection(finished, ['a']))
    expect(text).toContain('Keine offenen Voraussetzungen – kann released werden.')
  })
})
