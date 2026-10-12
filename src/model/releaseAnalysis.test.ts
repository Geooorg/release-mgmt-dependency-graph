import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/translate'
import { findDependencies } from './dependency'
import { box, content, edge, group, softEdge, withStatus } from '../test/fixtures'
import {
  analyzeProject,
  analyzeSelection,
  formatAnalysisMarkdown,
} from './releaseAnalysis'

const done = (id: string, x = 0) => withStatus(box(id, x, 0), 'fertig')
const wip = (id: string, x = 0) => withStatus(box(id, x, 0), 'in Arbeit')
const open = (id: string, x = 0) => box(id, x, 0)
const stuck = (id: string, x = 0, reason?: string) => {
  const node = withStatus(box(id, x, 0), 'blockiert')
  return reason === undefined ? node : { ...node, metadata: [...node.metadata, { key: 'blockiert_grund', value: reason }] }
}
const sorted = (set: ReadonlySet<string>) => [...set].sort()

describe('analyzeProject', () => {
  it('waits for nothing when everything is done', () => {
    const result = analyzeProject(
      content([done('a'), done('b', 1), done('c', 2)], [edge('ab', 'b', 'a'), edge('bc', 'c', 'b')]),
    )
    expect(result.waitingIds.size).toBe(0)
    expect(result.readyIds.size).toBe(0)
    expect(result.counts).toEqual({ total: 3, done: 3, inProgress: 0, open: 0, blocked: 0, waiting: 0, unknownStatus: 0, ready: 0 })
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
      content([wip('a'), wip('b', 1), open('c', 2)], [edge('ab', 'b', 'a'), edge('bc', 'c', 'b')]),
    )
    expect(sorted(result.waitingIds)).toEqual(['a', 'b'])
    expect(sorted(result.readyIds)).toEqual(['c'])
    expect(result.waitingFor.get('a')).toEqual(['b'])
    expect(result.waitingFor.get('b')).toEqual(['c'])
    expect(result.waitingFor.has('c')).toBe(false)
    expect(result.counts).toEqual({ total: 3, done: 0, inProgress: 2, open: 1, blocked: 0, waiting: 2, unknownStatus: 0, ready: 1 })
  })

  it('waits transitively along a chain of unfinished objects', () => {
    const result = analyzeProject(
      content([open('a'), open('b', 1), open('c', 2)], [edge('ab', 'b', 'a'), edge('bc', 'c', 'b')]),
    )
    expect(sorted(result.waitingIds)).toEqual(['a', 'b'])
    expect(result.waitingFor.get('a')).toEqual(['b'])
    expect(result.waitingFor.get('b')).toEqual(['c'])
    expect(sorted(result.readyIds)).toEqual(['c'])
  })

  it('does not look through a finished object: App <- Lib (fertig) <- Core', () => {
    const result = analyzeProject(
      content([open('app'), done('lib', 1), open('core', 2)], [edge('al', 'lib', 'app'), edge('lc', 'core', 'lib')]),
    )
    expect(result.waitingIds.size).toBe(0)
    expect(result.waitingFor.size).toBe(0)
    expect(sorted(result.readyIds)).toEqual(['app', 'core'])
    expect(result.blockedIds.size).toBe(0)
    expect(result.counts).toMatchObject({ done: 1, waiting: 0, ready: 2 })
  })

  it('gives a finished object neither flag nor hourglass, whatever it depends on', () => {
    const result = analyzeProject(
      content([done('a'), done('b', 1), stuck('c', 2), open('d', 3)], [edge('ab', 'b', 'a'), edge('ac', 'c', 'a'), edge('bd', 'd', 'b')]),
    )
    expect(result.waitingIds.size).toBe(0)
    expect(sorted(result.blockedIds)).toEqual(['c'])
    expect(result.waitingFor.size).toBe(0)
    expect(sorted(result.readyIds)).toEqual(['d'])
  })

  it('explains the A <- B, A <- C, C <- D example: A waits for B only', () => {
    // a (offen) depends on b (no status) and c (fertig); c depends on d (no status)
    const result = analyzeProject(
      content(
        [open('a'), open('b', 1), done('c', 2), open('d', 3)],
        [edge('ab', 'b', 'a'), edge('ac', 'c', 'a'), edge('cd', 'd', 'c')],
      ),
    )
    expect(sorted(result.waitingIds)).toEqual(['a'])
    expect(result.waitingFor.get('a')).toEqual(['b'])
    expect(result.waitingFor.has('c')).toBe(false)
    expect(sorted(result.readyIds)).toEqual(['b', 'd'])
  })

  it('keeps the unfinished objects equal to blocked + waiting + ready, also with cycles, finished objects and empty groups', () => {
    const models = [
      content([open('p'), wip('q', 1), open('r', 2)], [edge('pq', 'q', 'p'), edge('qp', 'p', 'q'), edge('pr', 'r', 'p')]),
      content([done('a'), open('b', 1), wip('c', 2), done('d', 3)], [edge('ab', 'b', 'a'), edge('bc', 'c', 'b'), edge('cd', 'd', 'c')]),
      content([done('p'), open('q', 1)], [edge('pq', 'q', 'p'), edge('qp', 'p', 'q')]),
      content([open('x'), group('g', 0, 0, 10, 10), open('y', 2), done('z', 3), open('w', 4)], [edge('xg', 'g', 'x'), edge('gy', 'y', 'g'), edge('yz', 'z', 'y'), edge('zw', 'w', 'z')]),
      content(
        [stuck('p'), wip('q', 1), open('r', 2), done('s', 3), stuck('t', 4)],
        [edge('pq', 'q', 'p'), edge('qp', 'p', 'q'), edge('pr', 'r', 'p'), edge('st', 't', 's'), edge('tr', 'r', 't')],
      ),
    ]
    for (const model of models) {
      const { counts } = analyzeProject(model)
      expect(counts.open + counts.inProgress + counts.blocked).toBe(counts.blocked + counts.waiting + counts.ready)
      expect(counts.total - counts.done).toBe(counts.blocked + counts.waiting + counts.ready)
    }
  })

  it('does not let a finished object in a cycle make anything wait', () => {
    const result = analyzeProject(
      content([done('p'), open('q', 1)], [edge('pq', 'q', 'p'), edge('qp', 'p', 'q')]),
    )
    expect(result.waitingIds.size).toBe(0)
    expect(sorted(result.readyIds)).toEqual(['q'])
  })

  it('flags a group by its waiting members only, never for finished members', () => {
    const result = analyzeProject(
      content(
        [group('g', 0, 0, 300, 200), done('m1', 0), open('m2', 1), open('y', 5), group('h', 0, 0, 300, 200)].map((n) =>
          n.id === 'm1' || n.id === 'm2' ? { ...n, parentId: 'g' } : n,
        ),
        [edge('m1y', 'y', 'm1')],
      ),
    )
    expect(result.waitingIds.size).toBe(0)
    expect(result.waitingMembers.size).toBe(0)
    expect(result.blockedMembers.size).toBe(0)
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
    const result = analyzeProject(content([open('a'), done('b', 1)], [edge('ab', 'b', 'a')]))
    expect(result.waitingIds.size).toBe(0)
    expect(sorted(result.readyIds)).toEqual(['a'])
  })

  it('lists every blocking direct prerequisite in node order', () => {
    const result = analyzeProject(
      content(
        [open('a'), open('b', 1), done('c', 2), open('d', 3)],
        [edge('ad', 'd', 'a'), edge('ab', 'b', 'a'), edge('ac', 'c', 'a')],
      ),
    )
    expect(result.waitingFor.get('a')).toEqual(['b', 'd'])
  })

  it('applies an edge to a group to all its members', () => {
    // x depends on group g; one member is still open
    const result = analyzeProject(
      content(
        [wip('x'), group('g', 0, 0, 300, 200), done('m1', 0), open('m2', 1)].map((n, i) =>
          i >= 2 ? { ...n, parentId: 'g' } : n,
        ),
        [edge('xg', 'g', 'x')],
      ),
    )
    expect(sorted(result.waitingIds)).toEqual(['x'])
    expect(result.waitingFor.get('x')).toEqual(['m2'])
  })

  it('flags a group that contains a waiting member', () => {
    const result = analyzeProject(
      content(
        [group('g', 0, 0, 300, 200), open('m1', 0), open('m2', 1), open('y', 5)].map((n, i) =>
          i === 1 || i === 2 ? { ...n, parentId: 'g' } : n,
        ),
        [edge('m2y', 'y', 'm2')],
      ),
    )
    expect(sorted(result.waitingIds)).toEqual(['g', 'm2'])
    expect(result.waitingMembers.get('g')).toEqual(['m2'])
    expect(sorted(result.readyIds)).toEqual(['m1', 'y'])
    // counts only objects
    expect(result.counts.waiting).toBe(1)
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
      content([open('a'), group('e', 0, 0, 10, 10), open('c', 2)], [edge('ae', 'e', 'a'), edge('ec', 'c', 'e')]),
    )
    expect(sorted(result.waitingIds)).toEqual(['a'])
    // names the unfinished object behind the empty group, not the group
    expect(result.waitingFor.get('a')).toEqual(['c'])
    expect(result.counts.total).toBe(2)
  })

  it('looks through an empty group, but stops at a finished object behind it', () => {
    const through = analyzeProject(
      content([open('x'), group('g', 0, 0, 10, 10), open('y', 2)], [edge('xg', 'g', 'x'), edge('gy', 'y', 'g')]),
    )
    expect(through.waitingFor.get('x')).toEqual(['y'])
    expect(sorted(through.readyIds)).toEqual(['y'])
    const stopped = analyzeProject(
      content(
        [open('x'), group('g', 0, 0, 10, 10), done('f', 2), open('y', 3)],
        [edge('xg', 'g', 'x'), edge('gf', 'f', 'g'), edge('fy', 'y', 'f')],
      ),
    )
    expect(stopped.waitingIds.size).toBe(0)
    expect(sorted(stopped.readyIds)).toEqual(['x', 'y'])
  })

  it('blocks open objects in a cycle: they can never become ready', () => {
    const result = analyzeProject(
      content([open('p'), open('q', 1), open('r', 2)], [edge('pq', 'q', 'p'), edge('qp', 'p', 'q'), edge('pr', 'r', 'p')]),
    )
    expect(sorted(result.waitingIds)).toEqual(['p', 'q'])
    expect(sorted(result.readyIds)).toEqual(['r'])
  })

  it('handles a 5000 object chain without overflowing the stack', () => {
    const size = 5000
    const nodes = Array.from({ length: size }, (_, i) => (i === size - 1 ? open(`n${i}`, i) : done(`n${i}`, i)))
    const edges = Array.from({ length: size - 1 }, (_, i) => edge(`e${i}`, `n${i + 1}`, `n${i}`))
    const result = analyzeProject(content(nodes, edges))
    expect(result.waitingIds.size).toBe(0)
    expect(result.counts).toMatchObject({ done: size - 1, waiting: 0, ready: 1 })
    expect([...result.readyIds]).toEqual([`n${size - 1}`])
  })

  it('handles a 5000 object chain of unfinished objects without overflowing the stack', () => {
    const size = 5000
    const nodes = Array.from({ length: size }, (_, i) => open(`n${i}`, i))
    const edges = Array.from({ length: size - 1 }, (_, i) => edge(`e${i}`, `n${i + 1}`, `n${i}`))
    const result = analyzeProject(content(nodes, edges))
    expect(result.counts).toMatchObject({ waiting: size - 1, ready: 1 })
    expect(result.waitingFor.get('n0')).toEqual(['n1'])
  })
})

describe('analyzeSelection', () => {
  // a <- b <- c <- d  (a depends on b, ...), a <- x <- d
  const graph = content(
    [open('a'), wip('b', 1), open('c', 2), open('d', 3), done('x', 4)],
    [edge('ab', 'b', 'a'), edge('bc', 'c', 'b'), edge('cd', 'd', 'c'), edge('ax', 'x', 'a'), edge('xd', 'd', 'x')],
  )

  it('lists open transitive prerequisites, ready ones first, then in release order', () => {
    const result = analyzeSelection(graph, ['a'])
    expect(result.scope).toBe('selection')
    expect(result.unfinished).toEqual([
      { id: 'd', status: 'offen', state: 'ready', distance: 3 },
      { id: 'c', status: 'offen', state: 'waiting', distance: 2 },
      { id: 'b', status: 'in Arbeit', state: 'waiting', distance: 1 },
    ])
  })

  it('computes the shortest distance over unfinished objects only', () => {
    // d is two steps away via the finished x, but x is not looked through: three via b and c
    const result = analyzeSelection(graph, ['a'])
    expect(result.unfinished.find((u) => u.id === 'd')?.distance).toBe(3)
    const shortcut = content([open('a'), open('b', 1), open('c', 2), open('d', 3)], [edge('ab', 'b', 'a'), edge('bc', 'c', 'b'), edge('cd', 'd', 'c'), edge('ad', 'd', 'a')])
    expect(analyzeSelection(shortcut, ['a']).unfinished.find((u) => u.id === 'd')?.distance).toBe(1)
  })

  it('excludes the selection itself and finished prerequisites', () => {
    const result = analyzeSelection(graph, ['b', 'c'])
    expect(result.unfinished.map((u) => u.id)).toEqual(['d'])
  })

  it('has no blockers when all prerequisites are done', () => {
    const result = analyzeSelection(content([open('a'), done('b', 1)], [edge('ab', 'b', 'a')]), ['a'])
    expect(result.unfinished).toEqual([])
    expect(result.criticalPath).toEqual({ nodeIds: ['a'], edgeIds: [], length: 1 })
  })

  it('starts at all members of a selected group', () => {
    const grouped = content(
      [group('g', 0, 0, 300, 200), { ...open('m1'), parentId: 'g' }, { ...open('m2', 1), parentId: 'g' }, open('y', 5), open('z', 6)],
      [edge('m1y', 'y', 'm1'), edge('m2z', 'z', 'm2')],
    )
    const result = analyzeSelection(grouped, ['g'])
    expect(result.selectedIds).toEqual(['g'])
    expect(result.unfinished.map((u) => u.id)).toEqual(['y', 'z'])
  })

  it('picks the longer of two chains as critical path, in release order', () => {
    // a <- b <- c (2 open below) vs a <- x <- d <- e? build: long chain a-b-c-d, short a-x
    const result = analyzeSelection(graph, ['a'])
    expect(result.criticalPath).toEqual({
      nodeIds: ['d', 'c', 'b', 'a'],
      edgeIds: ['cd', 'bc', 'ab'],
      length: 4,
    })
  })

  it('ends a chain at a finished object', () => {
    // a <- b(done) <- c <- d is cut at b: the chain through x (a, x) is the longest
    const model = content(
      [open('a'), done('b', 1), open('c', 2), open('d', 3), open('x', 4)],
      [edge('ab', 'b', 'a'), edge('bc', 'c', 'b'), edge('cd', 'd', 'c'), edge('ax', 'x', 'a')],
    )
    const result = analyzeSelection(model, ['a'])
    expect(result.criticalPath).toEqual({ nodeIds: ['x', 'a'], edgeIds: ['ax'], length: 2 })
    expect(result.unfinished.map((u) => u.id)).toEqual(['x'])
  })

  it('does not look through a finished object: App <- Lib (fertig) <- Core', () => {
    const model = content(
      [open('app'), done('lib', 1), open('core', 2)],
      [edge('al', 'lib', 'app'), edge('lc', 'core', 'lib')],
    )
    const result = analyzeSelection(model, ['app'])
    expect(result.unfinished).toEqual([])
    expect(result.criticalPath).toEqual({ nodeIds: ['app'], edgeIds: [], length: 1 })
    expect(result.selectionFinished).toBe(false)
    const whole = analyzeSelection(model, [])
    expect(whole.unfinished.map((u) => [u.id, u.state])).toEqual([
      ['app', 'ready'],
      ['core', 'ready'],
    ])
    expect(whole.criticalPath?.length).toBe(1)
  })

  it('explains the A <- B, A <- C, C <- D example for the whole project', () => {
    const model = content(
      [open('a'), open('b', 1), done('c', 2), open('d', 3)],
      [edge('ab', 'b', 'a'), edge('ac', 'c', 'a'), edge('cd', 'd', 'c')],
    )
    const project = analyzeSelection(model, [])
    expect(project.criticalPath).toEqual({ nodeIds: ['b', 'a'], edgeIds: ['ab'], length: 2 })
    expect(project.unfinished.map((u) => [u.id, u.state])).toEqual([
      ['b', 'ready'],
      ['d', 'ready'],
      ['a', 'waiting'],
    ])
    expect(analyzeSelection(model, ['a']).unfinished.map((u) => u.id)).toEqual(['b'])
  })

  it('follows the unfinished objects through an empty group', () => {
    const model = content(
      [open('x'), group('g', 0, 0, 10, 10), open('y', 2)],
      [edge('xg', 'g', 'x'), edge('gy', 'y', 'g')],
    )
    const result = analyzeSelection(model, ['x'])
    expect(result.criticalPath?.length).toBe(2)
    expect(result.criticalPath?.nodeIds).toEqual(['y', 'g', 'x'])
    expect(result.unfinished.map((u) => u.id)).toEqual(['y'])
  })

  it('breaks ties by node order', () => {
    const model = content(
      [open('a'), open('p', 1), open('q', 2)],
      [edge('aq', 'q', 'a'), edge('ap', 'p', 'a')],
    )
    expect(analyzeSelection(model, ['a']).criticalPath?.nodeIds).toEqual(['p', 'a'])
    // deterministic: same result a second time
    expect(analyzeSelection(model, ['a']).criticalPath?.nodeIds).toEqual(['p', 'a'])
  })

  it('reports an empty critical path when nothing is open on the way', () => {
    const model = content([done('a'), done('b', 1)], [edge('ab', 'b', 'a')])
    expect(analyzeSelection(model, ['a']).criticalPath).toEqual({ nodeIds: [], edgeIds: [], length: 0 })
  })

  it('has an empty path and no prerequisites for a finished selection, whatever it depends on', () => {
    const model = content([done('a'), open('b', 1), done('c', 2)], [edge('ab', 'b', 'a')])
    const result = analyzeSelection(model, ['a'])
    expect(result.criticalPath).toEqual({ nodeIds: [], edgeIds: [], length: 0 })
    expect(result.unfinished).toEqual([])
    expect(result.selectionFinished).toBe(true)
    expect(analyzeSelection(model, ['a', 'c']).selectionFinished).toBe(true)
    expect(analyzeSelection(model, ['a', 'b']).selectionFinished).toBe(false)
    expect(analyzeSelection(model, []).selectionFinished).toBe(false)
  })

  it('treats a selected group of finished objects as finished', () => {
    const model = content(
      [group('g', 0, 0, 300, 200), { ...done('m1'), parentId: 'g' }, { ...done('m2', 1), parentId: 'g' }, open('y', 5)],
      [edge('m1y', 'y', 'm1')],
    )
    const result = analyzeSelection(model, ['g'])
    expect(result.selectionFinished).toBe(true)
    expect(result.unfinished).toEqual([])
  })

  it('has an empty critical path for an empty project (no phantom step)', () => {
    const result = analyzeSelection(content([]), [])
    expect(result.criticalPath).toEqual({ nodeIds: [], edgeIds: [], length: 0 })
    expect(result.unfinished).toEqual([])
  })

  it('credits group edges to the explicit edge that produced the step', () => {
    const model = content(
      [open('x'), group('g', 0, 0, 300, 200), { ...open('m'), parentId: 'g' }],
      [edge('xg', 'g', 'x')],
    )
    expect(analyzeSelection(model, ['x']).criticalPath).toEqual({ nodeIds: ['m', 'x'], edgeIds: ['xg'], length: 2 })
  })

  it('cannot compute a critical path when the relevant part contains a cycle, but still lists blockers', () => {
    const model = content(
      [open('a'), open('p', 1), open('q', 2)],
      [edge('ap', 'p', 'a'), edge('pq', 'q', 'p'), edge('qp', 'p', 'q')],
    )
    const result = analyzeSelection(model, ['a'])
    expect(result.criticalPath).toBeNull()
    expect(result.cycleIds).toEqual(['p', 'q'])
    expect(result.unfinished.map((u) => u.id)).toEqual(['p', 'q'])
  })

  it('breaks a cycle at a finished object: the critical path is defined', () => {
    // p <- q <- p, but q is finished
    const model = content(
      [open('p'), done('q', 1), open('r', 2)],
      [edge('pq', 'q', 'p'), edge('qp', 'p', 'q'), edge('pr', 'r', 'p')],
    )
    const result = analyzeSelection(model, ['p'])
    expect(result.cycleIds).toEqual([])
    expect(result.criticalPath).toEqual({ nodeIds: ['r', 'p'], edgeIds: ['pr'], length: 2 })
    expect(analyzeSelection(model, []).criticalPath?.length).toBe(2)
  })

  it('still cannot compute the path of a cycle of unfinished objects, in the project scope too', () => {
    const model = content(
      [open('p'), wip('q', 1), done('f', 2), open('r', 3)],
      [edge('pq', 'q', 'p'), edge('qp', 'p', 'q'), edge('qf', 'f', 'q'), edge('fr', 'r', 'f')],
    )
    const result = analyzeSelection(model, [])
    expect(result.criticalPath).toBeNull()
    expect(result.cycleIds).toEqual(['p', 'q'])
    expect(analyzeSelection(model, ['f']).criticalPath).toEqual({ nodeIds: [], edgeIds: [], length: 0 })
  })

  it('cannot compute the path of a cycle that consists of empty groups and unfinished objects', () => {
    const model = content(
      [open('p'), group('g', 0, 0, 10, 10)],
      [edge('pg', 'g', 'p'), edge('gp', 'p', 'g')],
    )
    expect(analyzeSelection(model, ['p']).criticalPath).toBeNull()
  })

  it('ignores a cycle behind a finished selection and one that is not reachable', () => {
    const model = content(
      [done('a'), open('p', 1), open('q', 2)],
      [edge('ap', 'p', 'a'), edge('pq', 'q', 'p'), edge('qp', 'p', 'q')],
    )
    const result = analyzeSelection(model, ['a'])
    expect(result.cycleIds).toEqual([])
    expect(result.criticalPath).toEqual({ nodeIds: [], edgeIds: [], length: 0 })
  })

  it('ignores a cycle that is not reachable from the selection', () => {
    const model = content(
      [open('a'), open('b', 1), open('p', 2), open('q', 3)],
      [edge('ab', 'b', 'a'), edge('pq', 'q', 'p'), edge('qp', 'p', 'q')],
    )
    const result = analyzeSelection(model, ['a'])
    expect(result.cycleIds).toEqual([])
    expect(result.criticalPath).toEqual({ nodeIds: ['b', 'a'], edgeIds: ['ab'], length: 2 })
  })

  it('covers the whole project without a selection', () => {
    // two roots: r1 <- m1 <- m2 (3 open), r2 <- m2 (2 open)
    const model = content(
      [open('r1'), open('r2', 1), open('m1', 2), open('m2', 3), done('z', 4)],
      [edge('r1m1', 'm1', 'r1'), edge('m1m2', 'm2', 'm1'), edge('r2m2', 'm2', 'r2')],
    )
    const result = analyzeSelection(model, [])
    expect(result.scope).toBe('project')
    expect(result.selectedIds).toEqual([])
    expect(result.criticalPath).toEqual({ nodeIds: ['m2', 'm1', 'r1'], edgeIds: ['m1m2', 'r1m1'], length: 3 })
    // project scope: every open object is listed, ready ones first
    expect(result.unfinished.map((u) => [u.id, u.state])).toEqual([
      ['m2', 'ready'],
      ['r2', 'waiting'],
      ['m1', 'waiting'],
      ['r1', 'waiting'],
    ])
  })

  describe('soft dependencies', () => {
    // a <-soft- b <- c, all open
    const chain = content([open('a'), open('b', 1), open('c', 2)], [softEdge('ab', 'b', 'a'), edge('bc', 'c', 'b')])

    it('leaves soft edges out of the critical path of the project', () => {
      expect(analyzeSelection(chain, []).criticalPath).toEqual({ nodeIds: ['c', 'b'], edgeIds: ['bc'], length: 2 })
    })

    it('ends the critical path of a selection at a soft edge, but still lists what is behind it', () => {
      const result = analyzeSelection(chain, ['a'])
      expect(result.criticalPath).toEqual({ nodeIds: ['a'], edgeIds: [], length: 1 })
      expect(result.unfinished.map((u) => u.id)).toEqual(['c', 'b'])
    })

    it('still counts soft edges for waiting', () => {
      const project = analyzeProject(chain)
      expect(sorted(project.waitingIds)).toEqual(['a', 'b'])
      expect(project.waitingFor.get('a')).toEqual(['b'])
    })

    it('does not see a cycle that is closed by a soft edge only', () => {
      const model = content([open('p'), open('q', 1)], [edge('pq', 'q', 'p'), softEdge('qp', 'p', 'q')])
      const result = analyzeSelection(model, [])
      expect(result.cycleIds).toEqual([])
      expect(result.criticalPath).toEqual({ nodeIds: ['q', 'p'], edgeIds: ['pq'], length: 2 })
      expect(sorted(analyzeProject(model).waitingIds)).toEqual(['p', 'q'])
    })

    it('ignores a cycle that is only reached over a soft edge', () => {
      const model = content(
        [open('a'), open('p', 1), open('q', 2)],
        [softEdge('ap', 'p', 'a'), edge('pq', 'q', 'p'), edge('qp', 'p', 'q')],
      )
      const result = analyzeSelection(model, ['a'])
      expect(result.cycleIds).toEqual([])
      expect(result.criticalPath).toEqual({ nodeIds: ['a'], edgeIds: [], length: 1 })
      expect(analyzeSelection(model, []).criticalPath).toBeNull()
    })

    it('marks only the hard edge when a soft group edge produces the same step', () => {
      // x <- b directly, and x <-soft- g, which contains b
      const model = content(
        [group('g', 0, 0, 300, 200), open('x', 400), box('b', 10, 40, 'g')],
        [softEdge('xg', 'g', 'x'), edge('xb', 'b', 'x')],
      )
      expect(analyzeSelection(model, ['x']).criticalPath).toEqual({ nodeIds: ['b', 'x'], edgeIds: ['xb'], length: 2 })
    })
  })

  it('treats unknown ids as no selection', () => {
    expect(analyzeSelection(graph, ['ghost']).scope).toBe('project')
  })

  it('computes a 5000 object chain without overflowing the stack', () => {
    const size = 5000
    const nodes = Array.from({ length: size }, (_, i) => open(`n${i}`, i))
    const edges = Array.from({ length: size - 1 }, (_, i) => edge(`e${i}`, `n${i + 1}`, `n${i}`))
    const result = analyzeSelection(content(nodes, edges), ['n0'])
    expect(result.criticalPath?.length).toBe(size)
    expect(result.criticalPath?.nodeIds[0]).toBe(`n${size - 1}`)
    expect(result.unfinished).toHaveLength(size - 1)
  })

  describe('to clarify', () => {
    // a <- b(done) <- c(open); u (unknown status) alone, v (unknown status) below a
    const model = content(
      [open('a'), done('b', 1), open('c', 2), withStatus(box('u', 3, 0), 'bald'), withStatus(box('v', 4, 0), 'x')],
      [edge('ab', 'b', 'a'), edge('bc', 'c', 'b'), edge('av', 'v', 'a')],
    )

    it('lists every object with an unknown status of the project', () => {
      expect(analyzeSelection(model, []).unknownStatus).toEqual([
        { id: 'u', raw: 'bald' },
        { id: 'v', raw: 'x' },
      ])
    })

    it('limits the list to the selection and its unfinished prerequisites', () => {
      expect(analyzeSelection(model, ['a']).unknownStatus).toEqual([{ id: 'v', raw: 'x' }])
      expect(analyzeSelection(model, ['u']).unknownStatus).toEqual([{ id: 'u', raw: 'bald' }])
      expect(analyzeSelection(model, ['b']).unknownStatus).toEqual([])
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
      [edge('ab', 'b', 'a'), edge('bc', 'c', 'b'), edge('ax', 'x', 'a')],
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
        '- blockiert: 0',
        '- wartet: 2',
        '- jetzt umsetzbar: 1',
        '',
        '## Kritischer Pfad (3 Schritte)',
        '',
        '1. Dienst C – offen',
        '2. Dienst B – in Arbeit',
        '3. Dienst A – offen',
        '',
        '## Offene Voraussetzungen',
        '',
        '- Dienst C – offen, jetzt umsetzbar',
        '- Dienst B – in Arbeit, wartet auf Dienst C',
        '',
      ].join('\n'),
    )
  })

  it('adds the objects of a dependency highlight before the critical path', () => {
    const closure = { direction: 'closure' as const, ...findDependencies(named, ['b'], 'closure') }
    const text = formatAnalysisMarkdown(named, analyzeProject(named), analyzeSelection(named, ['b']), createTranslate('de'), closure)
    expect(text).toContain(
      [
        '## Transitive Hülle (2)',
        '',
        '### Voraussetzungen (1)',
        '',
        '- Dienst C – offen',
        '',
        '### Betroffene (1)',
        '',
        '- Dienst A – offen',
        '',
        '## Kritischer Pfad (2 Schritte)',
      ].join('\n'),
    )

    const one = { direction: 'dependents' as const, ...findDependencies(named, ['a'], 'dependents') }
    expect(formatAnalysisMarkdown(named, analyzeProject(named), analyzeSelection(named, ['a']), createTranslate('en'), one)).toContain(
      '## All affected (0)\n\nNothing.\n',
    )
  })

  it('describes the whole project and uses the short id for unnamed objects', () => {
    const unnamed = { ...model, nodes: model.nodes.map((n) => ({ ...n, metadata: [{ key: 'name', value: '' }, ...n.metadata.slice(1)] })) }
    const text = formatAnalysisMarkdown(unnamed, analyzeProject(unnamed), analyzeSelection(unnamed, []))
    expect(text).toContain('# Release-Analyse: Release-1 – Gesamtes Projekt')
    expect(text).toContain('## Jetzt umsetzbar\n\n- c – offen')
    expect(text).toContain('## Wartet\n\n- b – in Arbeit, wartet auf c\n- a – offen, wartet auf b')
    expect(text).toContain('## Blockiert\n\nNichts.')
  })

  it('adds a section "Zu klären" for unknown status values', () => {
    const unclear = content(
      [open('a'), done('b', 1), open('c', 2), withStatus(box('u', 3, 0), 'erledigt')],
      [edge('ab', 'b', 'a'), edge('bc', 'c', 'b')],
    )
    const text = formatAnalysisMarkdown(unclear, analyzeProject(unclear), analyzeSelection(unclear, []))
    expect(text).toContain('- zu klären: 1\n')
    expect(text).toContain(
      ['## Zu klären', '', '### Unbekannter Status (1)', '', '- u – „erledigt“ (zählt als offen)', '', '## Blockiert'].join('\n'),
    )
    expect(text).not.toContain('Fertig trotz')
  })

  it('omits the section and the counter when there is nothing to clarify', () => {
    const text = formatAnalysisMarkdown(named, analyzeProject(named), analyzeSelection(named, ['a']))
    expect(text).not.toContain('Zu klären')
    expect(text).not.toContain('zu klären')
  })

  it('explains a missing critical path on a cycle', () => {
    const cyclic = content([open('p'), open('q', 1)], [edge('pq', 'q', 'p'), edge('qp', 'p', 'q')])
    const text = formatAnalysisMarkdown(cyclic, analyzeProject(cyclic), analyzeSelection(cyclic, ['p']))
    expect(text).toContain('Kritischer Pfad nicht berechenbar – Zyklus zwischen p, q.')
    expect(text).toContain('# Release-Analyse: Release-Management – p')
  })

  it('says so when nothing is open', () => {
    const finished = content([done('a'), done('b', 1)], [edge('ab', 'b', 'a')])
    const text = formatAnalysisMarkdown(finished, analyzeProject(finished), analyzeSelection(finished, ['a']))
    expect(text).toContain('Fertig – Voraussetzungen werden nicht mehr betrachtet.')
    expect(text).not.toContain('kann released werden')
  })

  it('says a selection without unfinished prerequisites can be released', () => {
    const ready = content([open('a'), done('b', 1)], [edge('ab', 'b', 'a')])
    const text = formatAnalysisMarkdown(ready, analyzeProject(ready), analyzeSelection(ready, ['a']))
    expect(text).toContain('Keine offenen Voraussetzungen – kann released werden.')
  })

  describe('blocked by hand', () => {
    it('counts a manually blocked object as blocked, never as waiting or ready, with its reason', () => {
      const result = analyzeProject(content([stuck('a', 0, ' Freigabe fehlt '), stuck('b', 1), open('c', 2)]))
      expect(sorted(result.blockedIds)).toEqual(['a', 'b'])
      expect(result.blockReasons).toEqual(new Map([['a', 'Freigabe fehlt']]))
      expect(result.waitingIds.size).toBe(0)
      expect(sorted(result.readyIds)).toEqual(['c'])
      expect(result.counts).toMatchObject({ total: 3, open: 1, blocked: 2, waiting: 0, ready: 1 })
    })

    it('makes everything that depends on it wait, with the blocked object named as the cause', () => {
      // a <- b <- c; c is blocked by hand
      const result = analyzeProject(content([open('a'), wip('b', 1), stuck('c', 2)], [edge('ab', 'b', 'a'), edge('bc', 'c', 'b')]))
      expect(sorted(result.waitingIds)).toEqual(['a', 'b'])
      expect(result.waitingFor.get('b')).toEqual(['c'])
      expect(result.waitingFor.get('a')).toEqual(['b'])
      expect(result.readyIds.size).toBe(0)
      expect(result.counts).toMatchObject({ blocked: 1, waiting: 2, ready: 0 })
    })

    it('shows a blocked object that also waits as blocked only, but remembers what it waits for', () => {
      const result = analyzeProject(content([stuck('a'), open('b', 1)], [edge('ab', 'b', 'a')]))
      expect(sorted(result.blockedIds)).toEqual(['a'])
      expect(result.waitingIds.size).toBe(0)
      expect(result.waitingFor.get('a')).toEqual(['b'])
      expect(result.counts).toMatchObject({ blocked: 1, waiting: 0, ready: 1 })
    })

    it('does not wait for a finished prerequisite, and a finished object over a blocked one carries nothing', () => {
      const ok = analyzeProject(content([stuck('a'), done('b', 1)], [edge('ab', 'b', 'a')]))
      expect(ok.waitingFor.has('a')).toBe(false)
      const over = analyzeProject(content([done('a'), stuck('b', 1)], [edge('ab', 'b', 'a')]))
      expect(sorted(over.blockedIds)).toEqual(['b'])
      expect(over.waitingIds.size).toBe(0)
      expect(over.waitingFor.has('a')).toBe(false)
    })

    it('does not look through a finished object behind a blocked one', () => {
      // a <- lib(done) <- k(blocked): a is ready
      const result = analyzeProject(content([open('a'), done('lib', 1), stuck('k', 2)], [edge('al', 'lib', 'a'), edge('lk', 'k', 'lib')]))
      expect(result.waitingIds.size).toBe(0)
      expect(sorted(result.readyIds)).toEqual(['a'])
    })

    it('ignores the reason of an object that is not blocked, and a blank reason', () => {
      const stray = { ...open('a'), metadata: [...open('a').metadata, { key: 'blockiert_grund', value: 'alt' }] }
      const result = analyzeProject(content([stray, stuck('b', 1, '   ')]))
      expect(result.blockReasons.size).toBe(0)
      expect(sorted(result.blockedIds)).toEqual(['b'])
    })

    it('flags groups by their blocked and by their waiting members separately', () => {
      const result = analyzeProject(
        content(
          [group('g', 0, 0, 300, 200), { ...stuck('m1'), parentId: 'g' }, { ...open('m2', 1), parentId: 'g' }, open('y', 5)],
          [edge('m2m1', 'm1', 'm2')],
        ),
      )
      expect(sorted(result.blockedIds)).toEqual(['g', 'm1'])
      expect(result.blockedMembers.get('g')).toEqual(['m1'])
      expect(sorted(result.waitingIds)).toEqual(['g', 'm2'])
      expect(result.waitingMembers.get('g')).toEqual(['m2'])
      expect(result.groupProgress.get('g')).toEqual({ done: 0, total: 2 })
    })

    it('keeps unfinished = blocked + waiting + ready with cycles through blocked objects', () => {
      const cyclic = content(
        [stuck('p'), open('q', 1), wip('r', 2), done('s', 3)],
        [edge('pq', 'q', 'p'), edge('qp', 'p', 'q'), edge('rs', 's', 'r'), edge('qr', 'r', 'q')],
      )
      const { counts } = analyzeProject(cyclic)
      expect(counts.total - counts.done).toBe(counts.blocked + counts.waiting + counts.ready)
      expect(counts).toMatchObject({ blocked: 1, waiting: 1, ready: 1 })
    })

    it('lists blocked prerequisites first, then ready, then waiting ones', () => {
      // a depends on w (waits for z), r (ready), k (blocked); z is ready
      const model = content(
        [open('a'), wip('w', 1), open('r', 2), stuck('k', 3), open('z', 4)],
        [edge('aw', 'w', 'a'), edge('ar', 'r', 'a'), edge('ak', 'k', 'a'), edge('wz', 'z', 'w')],
      )
      const result = analyzeSelection(model, ['a'])
      expect(result.unfinished.map((u) => [u.id, u.state])).toEqual([
        ['k', 'blocked'],
        ['r', 'ready'],
        ['z', 'ready'],
        ['w', 'waiting'],
      ])
      expect(result.selectedBlocked).toEqual([])
    })

    it('reports a selected object that is blocked itself', () => {
      const model = content([stuck('a'), open('b', 1), stuck('c', 2)], [edge('ab', 'b', 'a')])
      expect(analyzeSelection(model, ['a']).selectedBlocked).toEqual(['a'])
      expect(analyzeSelection(model, ['a', 'b', 'c']).selectedBlocked).toEqual(['a', 'c'])
      expect(analyzeSelection(model, ['b']).selectedBlocked).toEqual([])
      expect(analyzeSelection(model, []).selectedBlocked).toEqual([])
    })

    it('counts a blocked object as unfinished work on the critical path', () => {
      const model = content([open('a'), stuck('b', 1)], [edge('ab', 'b', 'a')])
      expect(analyzeSelection(model, ['a']).criticalPath).toEqual({ nodeIds: ['b', 'a'], edgeIds: ['ab'], length: 2 })
    })
  })
})

describe('formatAnalysisMarkdown with blocked objects', () => {
  const model = content(
    [open('a'), stuck('lib', 1, 'Freigabe fehlt'), stuck('x', 2), wip('w', 3), open('z', 4)],
    [edge('a-lib', 'lib', 'a'), edge('w-z', 'z', 'w'), edge('a-w', 'w', 'a')],
  )
  const named = {
    ...model,
    nodes: model.nodes.map((n) => ({ ...n, metadata: n.metadata.map((m) => (m.key === 'name' ? { ...m, value: m.value === 'lib' ? 'Lib' : m.value } : m)) })),
  }

  it('lists blocked, ready and waiting objects of the whole project with reasons', () => {
    const text = formatAnalysisMarkdown(named, analyzeProject(named), analyzeSelection(named, []))
    expect(text).toContain('- blockiert: 2\n- wartet: 2\n- jetzt umsetzbar: 1\n')
    expect(text).toContain('## Blockiert\n\n- Lib – Freigabe fehlt\n- x – kein Grund angegeben\n')
    expect(text).toContain('## Jetzt umsetzbar\n\n- z – offen\n')
    expect(text).toContain('## Wartet\n\n- w – in Arbeit, wartet auf z\n- a – offen, wartet auf Lib, w\n')
    expect(text.indexOf('## Blockiert')).toBeLessThan(text.indexOf('## Jetzt umsetzbar'))
    expect(text.indexOf('## Wartet')).toBeLessThan(text.indexOf('## Kritischer Pfad'))
  })

  it('puts blocked prerequisites of a selection first and says when the selection is blocked itself', () => {
    const text = formatAnalysisMarkdown(named, analyzeProject(named), analyzeSelection(named, ['a']))
    expect(text).toContain('## Offene Voraussetzungen\n\n- Lib – blockiert: Freigabe fehlt\n- z – offen, jetzt umsetzbar\n- w – in Arbeit, wartet auf z\n')
    expect(text).not.toContain('Auswahl ist blockiert')
    const self = formatAnalysisMarkdown(named, analyzeProject(named), analyzeSelection(named, ['lib']))
    expect(self).toContain('## Auswahl ist blockiert\n\n- Lib – Freigabe fehlt\n')
  })

  it('shortens long lists of what an object waits for', () => {
    const many = content(
      [open('a'), ...['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((id, i) => open(id, i + 1))],
      ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((id) => edge(`a-${id}`, id, 'a')),
    )
    const text = formatAnalysisMarkdown(many, analyzeProject(many), analyzeSelection(many, []))
    expect(text).toContain('- a – offen, wartet auf p1, p2, p3, p4, p5, …')
  })
})

describe('formatAnalysisMarkdown in other languages', () => {
  const model = {
    ...content(
      [open('a'), stuck('b', 1, 'Freigabe fehlt'), open('c', 2), withStatus(box('u', 3, 0), 'erledigt'), done('d', 4)],
      [edge('ab', 'b', 'a'), edge('ac', 'c', 'a')],
    ),
    projectName: 'Release-1',
  }
  const GERMAN_MARKERS = ['Zu klären', 'Kritischer Pfad', 'wartet', 'Wartet', 'Jetzt umsetzbar', 'jetzt umsetzbar', 'Nichts.', 'Blockiert', 'Voraussetzungen', 'Schritt', 'zählt als', 'Unbekannter Status', 'kein Grund']
  const render = (locale: 'de' | 'en' | 'fr', ids: string[]) =>
    formatAnalysisMarkdown(model, analyzeProject(model), analyzeSelection(model, ids), createTranslate(locale))

  it('writes the English report without German words', () => {
    const project = render('en', [])
    expect(project).toContain('# Release analysis: Release-1 – Whole project')
    expect(project).toContain('- done: 1\n- in progress: 0\n- open: 3\n- blocked: 1\n- waiting: 1\n- ready now: 2\n- to clarify: 1\n')
    expect(project).toContain('## To clarify\n\n### Unknown status (1)\n\n- u – “erledigt” (counts as open)')
    expect(project).toContain('## Blocked\n\n- b – Freigabe fehlt\n')
    expect(project).toContain('## Ready now\n\n- c – open\n- u – open\n')
    expect(project).toContain('## Waiting\n\n- a – open, waits for b, c\n')
    expect(project).toContain('## Critical path (2 steps)')

    const selection = render('en', ['a'])
    expect(selection).toContain('## Open prerequisites\n\n- b – blocked: Freigabe fehlt\n- c – open, ready now\n')
    expect(render('en', ['d'])).toContain('Done – prerequisites are no longer considered.')
    for (const text of [project, selection]) {
      for (const marker of GERMAN_MARKERS) expect(text, marker).not.toContain(marker)
    }
  })

  it('writes the French report without German words', () => {
    const project = render('fr', [])
    expect(project).toContain('# Analyse de release : Release-1 – Projet entier')
    expect(project).toContain('- terminé : 1\n- en cours : 0\n- ouvert : 3\n- bloqué : 1\n- en attente : 1\n- réalisable maintenant : 2\n- à clarifier : 1\n')
    expect(project).toContain('## Chemin critique (2 étapes)')
    expect(project).toContain('## Bloqués\n\n- b – Freigabe fehlt\n')
    expect(project).toContain('- a – ouvert, attend b, c')
    expect(render('fr', ['a'])).toContain('- b – bloqué : Freigabe fehlt')
    for (const marker of GERMAN_MARKERS) expect(project, marker).not.toContain(marker)
  })

  it('names the cycle and the missing reason in English', () => {
    const cyclic = content([stuck('p'), open('q', 1)], [edge('pq', 'q', 'p'), edge('qp', 'p', 'q')])
    const text = formatAnalysisMarkdown(cyclic, analyzeProject(cyclic), analyzeSelection(cyclic, ['p']), createTranslate('en'))
    expect(text).toContain('Critical path cannot be computed – cycle between p, q.')
    expect(text).toContain('- p – no reason given')
  })

  it('keeps the German output when no translator is passed', () => {
    expect(formatAnalysisMarkdown(model, analyzeProject(model), analyzeSelection(model, ['a']))).toBe(render('de', ['a']))
  })
})
