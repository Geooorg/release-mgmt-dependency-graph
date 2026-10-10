import { describe, expect, it } from 'vitest'
import {
  addEdge,
  canGroup,
  checkConnection,
  createNode,
  defaultIdGenerator,
  deleteElements,
  findDropTargetGroup,
  findGroupAtPoint,
  setBlockReason,
  setStatus,
  getAbsolutePosition,
  getAncestorIds,
  getSize,
  groupElements,
  moveNode,
  pickSides,
  reparent,
  resizeNode,
  sortParentsFirst,
  ungroup,
  renameEdge,
  reconnectEdge,
  checkReconnection,
  renameElement,
  setColor,
  updateMetadata,
  wouldBreakHierarchy,
} from './graph'
import {
  GROUP_DEFAULT_SIZE,
  GROUP_HEADER_HEIGHT,
  GROUP_MIN_SIZE,
  GROUP_PADDING,
  NODE_SIZE,
} from './types'
import type { GraphContent, IdGenerator, ModelEdge, ModelNode } from './types'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function counter(prefix = 'id'): IdGenerator {
  let n = 0
  return () => `${prefix}-${++n}`
}

function node(id: string, x: number, y: number, extra: Partial<ModelNode> = {}): ModelNode {
  return { id, kind: 'node', position: { x, y }, metadata: [{ key: 'name', value: id }], ...extra }
}

function group(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Partial<ModelNode> = {},
): ModelNode {
  return {
    id,
    kind: 'group',
    position: { x, y },
    size: { width, height },
    metadata: [{ key: 'name', value: id }],
    ...extra,
  }
}

function edge(id: string, source: string, target: string): ModelEdge {
  return { id, source, target }
}

function content(nodes: ModelNode[], edges: ModelEdge[] = []): GraphContent {
  return { nodes, edges }
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

function find(c: GraphContent, id: string): ModelNode {
  const found = c.nodes.find((n) => n.id === id)
  if (!found) throw new Error(`test setup: node ${id} not found`)
  return found
}

function abs(c: GraphContent, id: string) {
  return getAbsolutePosition(c.nodes, id)
}

function ids(c: GraphContent): string[] {
  return c.nodes.map((n) => n.id)
}

// ---------------------------------------------------------------------------
// Creation & basic accessors
// ---------------------------------------------------------------------------

describe('defaultIdGenerator', () => {
  it('returns UUID-looking, distinct strings', () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    const a = defaultIdGenerator()
    const b = defaultIdGenerator()
    expect(a).toMatch(uuid)
    expect(b).toMatch(uuid)
    expect(a).not.toBe(b)
  })
})

describe('createNode', () => {
  it('creates a plain node with the generated id, the given position and the default name', () => {
    const created = createNode({ x: 10, y: 20 }, counter())
    expect(created).toEqual({
      id: 'id-1',
      kind: 'node',
      position: { x: 10, y: 20 },
      metadata: [{ key: 'name', value: 'Neues Objekt' }],
    })
  })

  it('sets neither size nor parentId', () => {
    const created = createNode({ x: 0, y: 0 }, counter())
    expect('size' in created).toBe(false)
    expect('parentId' in created).toBe(false)
  })

  it('does not alias the passed position object', () => {
    const position = { x: 1, y: 2 }
    const created = createNode(position, counter())
    position.x = 99
    expect(created.position).toEqual({ x: 1, y: 2 })
  })

  it('draws a fresh id from the generator on every call', () => {
    const newId = counter('n')
    expect(createNode({ x: 0, y: 0 }, newId).id).toBe('n-1')
    expect(createNode({ x: 0, y: 0 }, newId).id).toBe('n-2')
  })

  it('falls back to the default id generator', () => {
    expect(createNode({ x: 0, y: 0 }).id).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('getSize', () => {
  it('returns the explicit size if set', () => {
    expect(getSize(node('a', 0, 0, { size: { width: 10, height: 20 } }))).toEqual({
      width: 10,
      height: 20,
    })
    expect(getSize(group('g', 0, 0, 500, 400))).toEqual({ width: 500, height: 400 })
  })

  it('defaults to NODE_SIZE for plain nodes and GROUP_DEFAULT_SIZE for groups', () => {
    expect(getSize(node('a', 0, 0))).toEqual(NODE_SIZE)
    const sizeless: ModelNode = { ...group('g', 0, 0, 1, 1) }
    delete sizeless.size
    expect(getSize(sizeless)).toEqual(GROUP_DEFAULT_SIZE)
  })

  it('does not hand out the shared default constants', () => {
    expect(getSize(node('a', 0, 0))).not.toBe(NODE_SIZE)
  })
})

describe('getAncestorIds', () => {
  const nodes = [
    group('outer', 0, 0, 800, 600),
    group('inner', 10, 10, 400, 300, { parentId: 'outer' }),
    node('leaf', 5, 5, { parentId: 'inner' }),
    node('top', 0, 0),
  ]

  it('lists ancestors nearest parent first', () => {
    expect(getAncestorIds(nodes, 'leaf')).toEqual(['inner', 'outer'])
    expect(getAncestorIds(nodes, 'inner')).toEqual(['outer'])
  })

  it('returns [] for top-level elements and unknown ids', () => {
    expect(getAncestorIds(nodes, 'top')).toEqual([])
    expect(getAncestorIds(nodes, 'outer')).toEqual([])
    expect(getAncestorIds(nodes, 'nope')).toEqual([])
  })

  it('stops at parents that do not exist', () => {
    expect(getAncestorIds([node('orphan', 0, 0, { parentId: 'missing' })], 'orphan')).toEqual([])
  })

  it('terminates on parent cycles without listing the element itself', () => {
    const cyclic = [
      group('a', 0, 0, 100, 100, { parentId: 'b' }),
      group('b', 0, 0, 100, 100, { parentId: 'a' }),
    ]
    expect(getAncestorIds(cyclic, 'a')).toEqual(['b'])
    expect(getAncestorIds([group('s', 0, 0, 1, 1, { parentId: 's' })], 's')).toEqual([])
  })
})

describe('getAbsolutePosition', () => {
  const nodes = [
    group('outer', 100, 200, 800, 600),
    group('inner', 10, 20, 400, 300, { parentId: 'outer' }),
    node('leaf', 1, 2, { parentId: 'inner' }),
    node('top', 7, 8),
  ]

  it('returns the own position for top-level elements', () => {
    expect(getAbsolutePosition(nodes, 'top')).toEqual({ x: 7, y: 8 })
  })

  it('sums relative positions up the parent chain', () => {
    expect(getAbsolutePosition(nodes, 'inner')).toEqual({ x: 110, y: 220 })
    expect(getAbsolutePosition(nodes, 'leaf')).toEqual({ x: 111, y: 222 })
  })

  it('returns the origin for unknown ids', () => {
    expect(getAbsolutePosition(nodes, 'nope')).toEqual({ x: 0, y: 0 })
  })

  it('terminates on parent cycles', () => {
    const cyclic = [
      group('a', 1, 1, 10, 10, { parentId: 'b' }),
      group('b', 2, 2, 10, 10, { parentId: 'a' }),
    ]
    const position = getAbsolutePosition(cyclic, 'a')
    expect(Number.isFinite(position.x)).toBe(true)
    expect(Number.isFinite(position.y)).toBe(true)
  })
})

describe('sortParentsFirst', () => {
  it('keeps an already ordered list unchanged', () => {
    const nodes = [node('a', 0, 0), group('g', 0, 0, 100, 100), node('c', 0, 0, { parentId: 'g' })]
    expect(sortParentsFirst(nodes)).toEqual(nodes)
  })

  it('places a parent right before its first child and keeps the rest stable', () => {
    const a = node('a', 0, 0)
    const child = node('c', 0, 0, { parentId: 'g' })
    const b = node('b', 0, 0)
    const g = group('g', 0, 0, 100, 100)
    expect(sortParentsFirst([a, child, b, g]).map((n) => n.id)).toEqual(['a', 'g', 'c', 'b'])
  })

  it('orders whole chains, even when fully reversed', () => {
    const nodes = [
      node('leaf', 0, 0, { parentId: 'inner' }),
      group('inner', 0, 0, 10, 10, { parentId: 'outer' }),
      group('outer', 0, 0, 10, 10),
    ]
    expect(sortParentsFirst(nodes).map((n) => n.id)).toEqual(['outer', 'inner', 'leaf'])
  })

  it('treats orphans (unknown parentId) as top level', () => {
    const nodes = [node('a', 0, 0, { parentId: 'missing' }), node('b', 0, 0)]
    expect(sortParentsFirst(nodes).map((n) => n.id)).toEqual(['a', 'b'])
  })

  it('terminates on parent cycles and keeps every node', () => {
    const nodes = [
      group('a', 0, 0, 10, 10, { parentId: 'b' }),
      group('b', 0, 0, 10, 10, { parentId: 'a' }),
      group('s', 0, 0, 10, 10, { parentId: 's' }),
    ]
    expect(sortParentsFirst(nodes).map((n) => n.id).sort()).toEqual(['a', 'b', 's'])
  })

  it('returns a new array with the same node objects and does not mutate the input', () => {
    const child = node('c', 0, 0, { parentId: 'g' })
    const parent = group('g', 0, 0, 10, 10)
    const input = deepFreeze([child, parent])
    const result = sortParentsFirst(input)
    expect(result).not.toBe(input)
    expect(result[0]).toBe(parent)
    expect(result[1]).toBe(child)
    expect(input.map((n) => n.id)).toEqual(['c', 'g'])
  })
})

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

describe('canGroup', () => {
  const nodes = [
    node('a', 0, 0),
    node('b', 0, 0),
    group('g1', 0, 0, 500, 500),
    group('g2', 600, 0, 500, 500),
    node('c1', 0, 0, { parentId: 'g1' }),
    node('c2', 0, 0, { parentId: 'g1' }),
    node('d1', 0, 0, { parentId: 'g2' }),
  ]

  it('allows one or several top-level elements', () => {
    expect(canGroup(nodes, ['a'])).toBe(true)
    expect(canGroup(nodes, ['a', 'b', 'g1'])).toBe(true)
  })

  it('allows several elements of the same group', () => {
    expect(canGroup(nodes, ['c1', 'c2'])).toBe(true)
  })

  it('rejects an empty selection, unknown ids and duplicate ids', () => {
    expect(canGroup(nodes, [])).toBe(false)
    expect(canGroup(nodes, ['a', 'nope'])).toBe(false)
    expect(canGroup(nodes, ['nope'])).toBe(false)
    expect(canGroup(nodes, ['a', 'a'])).toBe(false)
  })

  it('rejects elements with different parents', () => {
    expect(canGroup(nodes, ['a', 'c1'])).toBe(false)
    expect(canGroup(nodes, ['c1', 'd1'])).toBe(false)
    expect(canGroup(nodes, ['g1', 'c1'])).toBe(false)
  })
})

describe('groupElements', () => {
  it('wraps top-level elements into a new group with padding and header', () => {
    const c = content([node('a', 100, 100), node('b', 400, 200), node('far', 900, 900)])
    const { content: result, groupId } = groupElements(c, ['a', 'b'], counter('g'))

    expect(groupId).toBe('g-1')
    const created = find(result, groupId)
    expect(created.kind).toBe('group')
    expect(created.metadata).toEqual([{ key: 'name', value: 'Neue Gruppe' }])
    expect('parentId' in created).toBe(false)
    // bbox = (100,100)-(560,256)
    expect(created.position).toEqual({
      x: 100 - GROUP_PADDING,
      y: 100 - GROUP_PADDING - GROUP_HEADER_HEIGHT,
    })
    expect(created.position).toEqual({ x: 76, y: 44 })
    expect(created.size).toEqual({ width: 508, height: 236 })
  })

  it('makes the members children of the group without moving them on screen', () => {
    const c = content([node('a', 100, 100), node('b', 400, 200), node('far', 900, 900)])
    const before = { a: abs(c, 'a'), b: abs(c, 'b'), far: abs(c, 'far') }
    const { content: result, groupId } = groupElements(c, ['a', 'b'], counter())

    expect(find(result, 'a').parentId).toBe(groupId)
    expect(find(result, 'b').parentId).toBe(groupId)
    expect(find(result, 'a').position).toEqual({ x: 24, y: 56 })
    expect(find(result, 'b').position).toEqual({ x: 324, y: 156 })
    expect(abs(result, 'a')).toEqual(before.a)
    expect(abs(result, 'b')).toEqual(before.b)
    expect(abs(result, 'far')).toEqual(before.far)
  })

  it('leaves non-members and edges untouched', () => {
    const far = node('far', 900, 900)
    const edges = [edge('e1', 'a', 'far'), edge('e2', 'a', 'b')]
    const c = content([node('a', 0, 0), node('b', 0, 0), far], edges)
    const { content: result } = groupElements(c, ['a', 'b'], counter())
    expect(find(result, 'far')).toBe(far)
    expect(result.edges).toEqual(edges)
  })

  it('contains all members completely in the new group rectangle', () => {
    const c = content([
      node('a', -50, 30),
      node('b', 300, -20, { size: { width: 40, height: 400 } }),
      group('g', 10, 500, 200, 150),
    ])
    const { content: result, groupId } = groupElements(c, ['a', 'b', 'g'], counter())
    const outer = find(result, groupId)
    const { width, height } = outer.size!
    for (const id of ['a', 'b', 'g']) {
      const member = find(result, id)
      const size = getSize(member)
      expect(member.position.x).toBeGreaterThanOrEqual(GROUP_PADDING)
      expect(member.position.y).toBeGreaterThanOrEqual(GROUP_PADDING + GROUP_HEADER_HEIGHT)
      expect(member.position.x + size.width).toBeLessThanOrEqual(width - GROUP_PADDING)
      expect(member.position.y + size.height).toBeLessThanOrEqual(height - GROUP_PADDING)
    }
  })

  it('uses explicit sizes of members (also nested groups) for the bounding box', () => {
    const c = content([
      node('a', 0, 0, { size: { width: 100, height: 100 } }),
      group('g', 200, 300, 400, 200),
    ])
    const { content: result, groupId } = groupElements(c, ['a', 'g'], counter())
    // bbox = (0,0)-(600,500)
    expect(find(result, groupId).size).toEqual({
      width: 600 + 2 * GROUP_PADDING,
      height: 500 + 2 * GROUP_PADDING + GROUP_HEADER_HEIGHT,
    })
  })

  it('groups elements that already live inside a group (nested group, relative coordinates)', () => {
    const c = content([
      group('G', 500, 300, 800, 600),
      node('n1', 10, 20, { parentId: 'G' }),
      node('n2', 200, 80, { parentId: 'G' }),
      node('n3', 600, 400, { parentId: 'G' }),
    ])
    const before = { n1: abs(c, 'n1'), n2: abs(c, 'n2'), n3: abs(c, 'n3') }
    const { content: result, groupId } = groupElements(c, ['n1', 'n2'], counter())

    const created = find(result, groupId)
    expect(created.parentId).toBe('G')
    // bbox in G's space = (10,20)-(360,136)
    expect(created.position).toEqual({ x: -14, y: -36 })
    expect(created.size).toEqual({ width: 398, height: 196 })
    expect(find(result, 'n1').position).toEqual({ x: 24, y: 56 })
    expect(find(result, 'n2').position).toEqual({ x: 214, y: 116 })
    expect(find(result, 'n3').parentId).toBe('G')
    expect(abs(result, 'n1')).toEqual(before.n1)
    expect(abs(result, 'n2')).toEqual(before.n2)
    expect(abs(result, 'n3')).toEqual(before.n3)
    expect(getAncestorIds(result.nodes, 'n1')).toEqual([groupId, 'G'])
  })

  it('keeps the nodes in parents-first order', () => {
    const c = content([
      group('P', 0, 0, 900, 900),
      node('x', 500, 500, { parentId: 'P' }),
      node('a', 10, 10, { parentId: 'P' }),
      node('b', 100, 10, { parentId: 'P' }),
      node('y', 700, 700),
    ])
    const { content: result } = groupElements(c, ['a', 'b'], counter())
    expect(sortParentsFirst(result.nodes)).toEqual(result.nodes)
    expect(result.nodes).toHaveLength(6)
  })

  it('throws for elements with different parents', () => {
    const c = content([group('g', 0, 0, 500, 500), node('in', 10, 10, { parentId: 'g' }), node('out', 900, 0)])
    expect(canGroup(c.nodes, ['in', 'out'])).toBe(false)
    expect(() => groupElements(c, ['in', 'out'], counter())).toThrow()
  })

  it('throws for empty selections, unknown ids and duplicate ids', () => {
    const c = content([node('a', 0, 0)])
    expect(() => groupElements(c, [], counter())).toThrow()
    expect(() => groupElements(c, ['nope'], counter())).toThrow()
    expect(() => groupElements(c, ['a', 'a'], counter())).toThrow()
  })

  it('does not mutate its input', () => {
    const c = deepFreeze(content([node('a', 0, 0), node('b', 50, 50)], [edge('e', 'a', 'b')]))
    expect(() => groupElements(c, ['a', 'b'], counter())).not.toThrow()
    expect(c.nodes).toHaveLength(2)
    expect(find(c, 'a').parentId).toBeUndefined()
  })
})

describe('ungroup', () => {
  it('is a no-op (same reference) for unknown ids and plain nodes', () => {
    const c = content([node('a', 0, 0), group('g', 0, 0, 100, 100)])
    expect(ungroup(c, 'nope')).toBe(c)
    expect(ungroup(c, 'a')).toBe(c)
  })

  it('moves children to top level keeping their on-screen position', () => {
    const c = content([
      group('g', 100, 200, 500, 400),
      node('c1', 10, 20, { parentId: 'g' }),
      node('c2', 300, 50, { parentId: 'g' }),
      node('o', 900, 900),
    ])
    const before = { c1: abs(c, 'c1'), c2: abs(c, 'c2'), o: abs(c, 'o') }
    const result = ungroup(c, 'g')

    expect(ids(result)).toEqual(['c1', 'c2', 'o'])
    expect(find(result, 'c1').position).toEqual({ x: 110, y: 220 })
    expect('parentId' in find(result, 'c1')).toBe(false)
    expect(abs(result, 'c1')).toEqual(before.c1)
    expect(abs(result, 'c2')).toEqual(before.c2)
    expect(abs(result, 'o')).toEqual(before.o)
  })

  it('removes the group and all edges attached to it, keeps the others', () => {
    const c = content(
      [group('g', 0, 0, 500, 400), node('c1', 10, 10, { parentId: 'g' }), node('c2', 200, 10, { parentId: 'g' }), node('o', 900, 0)],
      [edge('in', 'o', 'g'), edge('out', 'g', 'o'), edge('inner', 'c1', 'c2'), edge('cross', 'c1', 'o')],
    )
    const result = ungroup(c, 'g')
    expect(result.edges.map((e) => e.id)).toEqual(['inner', 'cross'])
  })

  it('moves the children of a nested group to the outer group (positions converted)', () => {
    const c = content([
      group('G1', 100, 100, 900, 700),
      group('G2', 50, 60, 400, 300, { parentId: 'G1' }),
      node('c', 10, 20, { parentId: 'G2' }),
      node('sibling', 600, 20, { parentId: 'G1' }),
    ])
    const before = { c: abs(c, 'c'), G1: abs(c, 'G1'), sibling: abs(c, 'sibling') }
    expect(before.c).toEqual({ x: 160, y: 180 })

    const result = ungroup(c, 'G2')
    expect(ids(result)).toEqual(['G1', 'c', 'sibling'])
    expect(find(result, 'c').parentId).toBe('G1')
    expect(find(result, 'c').position).toEqual({ x: 60, y: 80 })
    expect(abs(result, 'c')).toEqual(before.c)
    expect(abs(result, 'G1')).toEqual(before.G1)
    expect(abs(result, 'sibling')).toEqual(before.sibling)
  })

  it('lifts a nested group to top level when its parent is dissolved; grandchildren stay untouched', () => {
    const leaf = node('c', 10, 20, { parentId: 'G2' })
    const c = content([group('G1', 100, 100, 900, 700), group('G2', 50, 60, 400, 300, { parentId: 'G1' }), leaf])
    const before = { G2: abs(c, 'G2'), c: abs(c, 'c') }

    const result = ungroup(c, 'G1')
    expect(find(result, 'G2').position).toEqual({ x: 150, y: 160 })
    expect('parentId' in find(result, 'G2')).toBe(false)
    expect(find(result, 'c')).toBe(leaf)
    expect(abs(result, 'G2')).toEqual(before.G2)
    expect(abs(result, 'c')).toEqual(before.c)
  })

  it('does not mutate its input', () => {
    const c = deepFreeze(
      content([group('g', 5, 5, 100, 100), node('c', 1, 1, { parentId: 'g' })], [edge('e', 'g', 'c')]),
    )
    const result = ungroup(c, 'g')
    expect(result).not.toBe(c)
    expect(c.nodes).toHaveLength(2)
    expect(c.edges).toHaveLength(1)
  })
})

describe('reparent', () => {
  const base = content([
    group('g', 200, 100, 400, 300),
    group('g2', 20, 30, 150, 150, { parentId: 'g' }),
    node('n', 250, 150),
    node('inner', 10, 10, { parentId: 'g' }),
  ])

  it('moves a top-level element into a group, preserving its on-screen position', () => {
    const before = abs(base, 'n')
    const result = reparent(base, 'n', 'g')
    expect(find(result, 'n').parentId).toBe('g')
    expect(find(result, 'n').position).toEqual({ x: 50, y: 50 })
    expect(abs(result, 'n')).toEqual(before)
  })

  it('moves an element into a nested group', () => {
    const before = abs(base, 'n')
    const result = reparent(base, 'n', 'g2')
    expect(find(result, 'n').position).toEqual({ x: 30, y: 20 })
    expect(abs(result, 'n')).toEqual(before)
  })

  it('moves an element out to top level (parentId removed)', () => {
    const before = abs(base, 'inner')
    const result = reparent(base, 'inner', undefined)
    expect('parentId' in find(result, 'inner')).toBe(false)
    expect(find(result, 'inner').position).toEqual({ x: 210, y: 110 })
    expect(abs(result, 'inner')).toEqual(before)
  })

  it('moves an element between groups', () => {
    const before = abs(base, 'inner')
    const result = reparent(base, 'inner', 'g2')
    expect(find(result, 'inner').parentId).toBe('g2')
    expect(abs(result, 'inner')).toEqual(before)
  })

  it('moves a whole group with its descendants without moving anything on screen', () => {
    const c = content([
      group('target', 1000, 1000, 600, 600),
      group('g', 200, 100, 400, 300),
      node('child', 10, 20, { parentId: 'g' }),
    ])
    const before = { g: abs(c, 'g'), child: abs(c, 'child') }
    const result = reparent(c, 'g', 'target')
    expect(find(result, 'g').position).toEqual({ x: -800, y: -900 })
    expect(find(result, 'child')).toBe(find(c, 'child'))
    expect(abs(result, 'g')).toEqual(before.g)
    expect(abs(result, 'child')).toEqual(before.child)
  })

  it('is a no-op (same reference) when the parent does not change or the id is unknown', () => {
    expect(reparent(base, 'n', undefined)).toBe(base)
    expect(reparent(base, 'inner', 'g')).toBe(base)
    expect(reparent(base, 'nope', 'g')).toBe(base)
  })

  it('leaves the edges untouched', () => {
    const c = content(base.nodes, [edge('e', 'n', 'inner')])
    expect(reparent(c, 'n', 'g').edges).toBe(c.edges)
  })

  it('throws if the new parent is not a group or does not exist', () => {
    expect(() => reparent(base, 'n', 'inner')).toThrow()
    expect(() => reparent(base, 'n', 'nope')).toThrow()
  })

  it('throws if the new parent is the element itself or one of its descendants', () => {
    expect(() => reparent(base, 'g', 'g')).toThrow()
    expect(() => reparent(base, 'g', 'g2')).toThrow()
    const deep = content([
      group('a', 0, 0, 900, 900),
      group('b', 10, 10, 800, 800, { parentId: 'a' }),
      group('c', 10, 10, 700, 700, { parentId: 'b' }),
    ])
    expect(() => reparent(deep, 'a', 'c')).toThrow()
  })

  it('does not mutate its input', () => {
    const c = deepFreeze(content([group('g', 10, 10, 100, 100), node('n', 50, 50)]))
    expect(() => reparent(c, 'n', 'g')).not.toThrow()
    expect(find(c, 'n').parentId).toBeUndefined()
  })
})

describe('findDropTargetGroup', () => {
  const nodes = [
    group('G1', 0, 0, 1000, 800),
    group('G2', 100, 100, 400, 300, { parentId: 'G1' }), // canvas (100,100)-(500,400)
    node('inG2', 50, 50, { parentId: 'G2' }), // canvas (150,150), centre (230,178)
    node('inG1', 600, 450, { parentId: 'G1' }), // canvas (600,450), centre (680,478)
    node('free', 200, 150), // centre (280,178) -> inside G2
    node('freeInG1Only', 700, 500), // centre (780,528) -> inside G1 only
    node('outside', 2000, 2000),
    node('edgeNode', 450, 350), // top-left in G2, centre (530,378) outside G2, inside G1
  ]

  it('picks the deepest group containing the element centre', () => {
    expect(findDropTargetGroup(nodes, 'free')).toBe('G2')
    expect(findDropTargetGroup(nodes, 'freeInG1Only')).toBe('G1')
  })

  it("returns the element's current parent when it is still the deepest match", () => {
    expect(findDropTargetGroup(nodes, 'inG2')).toBe('G2')
    expect(findDropTargetGroup(nodes, 'inG1')).toBe('G1')
  })

  it('returns undefined when no group contains the centre', () => {
    expect(findDropTargetGroup(nodes, 'outside')).toBeUndefined()
  })

  it('uses the centre, not the top-left corner', () => {
    expect(findDropTargetGroup(nodes, 'edgeNode')).toBe('G1')
  })

  it('uses the explicit size of the dragged element for its centre', () => {
    const c = [
      group('G', 0, 0, 300, 300),
      node('small', 100, 100, { size: { width: 20, height: 20 } }), // centre (110,110)
      node('wide', 250, 100, { size: { width: 400, height: 40 } }), // top-left inside, centre (450,120) outside
    ]
    expect(findDropTargetGroup(c, 'small')).toBe('G')
    expect(findDropTargetGroup(c, 'wide')).toBeUndefined()
  })

  it('never returns the element itself or one of its descendants', () => {
    const c = [
      group('G1', 0, 0, 2000, 2000),
      group('G2', 100, 100, 400, 300, { parentId: 'G1' }),
      group('G3', 0, 0, 400, 300, { parentId: 'G2' }), // same canvas rect as G2
    ]
    expect(findDropTargetGroup(c, 'G2')).toBe('G1')
    expect(findDropTargetGroup(c, 'G1')).toBeUndefined()
  })

  it('works with nested relative coordinates (converts to canvas space)', () => {
    const c = [
      group('A', 1000, 1000, 500, 500),
      group('B', 100, 100, 200, 200, { parentId: 'A' }), // canvas (1100,1100)-(1300,1300)
      node('n', 1150, 1150), // centre (1230,1178)
      node('m', 150, 150), // centre (230,178): would be inside B if coordinates were not converted
    ]
    expect(findDropTargetGroup(c, 'n')).toBe('B')
    expect(findDropTargetGroup(c, 'm')).toBeUndefined()
  })

  it('prefers the later (topmost) group when equally deep groups overlap', () => {
    const c = [group('A', 0, 0, 500, 500), group('B', 100, 100, 500, 500), node('n', 200, 200)]
    expect(findDropTargetGroup(c, 'n')).toBe('B')
  })

  it('returns undefined for unknown ids', () => {
    expect(findDropTargetGroup(nodes, 'nope')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------

describe('deleteElements', () => {
  it('deletes a plain node with all attached edges', () => {
    const c = content(
      [node('a', 0, 0), node('b', 0, 0), node('c', 0, 0)],
      [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('ac', 'a', 'c')],
    )
    const result = deleteElements(c, { nodeIds: ['b'], edgeIds: [] })
    expect(ids(result)).toEqual(['a', 'c'])
    expect(result.edges.map((e) => e.id)).toEqual(['ac'])
  })

  it('deletes only the listed edges when no nodes are listed', () => {
    const c = content([node('a', 0, 0), node('b', 0, 0)], [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')])
    const result = deleteElements(c, { nodeIds: [], edgeIds: ['e1'] })
    expect(ids(result)).toEqual(['a', 'b'])
    expect(result.edges.map((e) => e.id)).toEqual(['e2'])
  })

  it('handles nodes and edges in one call', () => {
    const c = content(
      [node('a', 0, 0), node('b', 0, 0), node('c', 0, 0)],
      [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('ca', 'c', 'a')],
    )
    const result = deleteElements(c, { nodeIds: ['a'], edgeIds: ['bc'] })
    expect(ids(result)).toEqual(['b', 'c'])
    expect(result.edges).toEqual([])
  })

  it('dissolves a deleted group: children survive and keep their on-screen position', () => {
    const c = content(
      [
        group('g', 100, 100, 500, 400),
        node('c1', 10, 10, { parentId: 'g' }),
        node('c2', 200, 10, { parentId: 'g' }),
        node('o', 900, 900),
      ],
      [edge('inner', 'c1', 'c2'), edge('toGroup', 'o', 'g'), edge('fromGroup', 'g', 'o'), edge('cross', 'o', 'c1')],
    )
    const before = { c1: abs(c, 'c1'), c2: abs(c, 'c2') }
    const result = deleteElements(c, { nodeIds: ['g'], edgeIds: [] })

    expect(ids(result)).toEqual(['c1', 'c2', 'o'])
    expect('parentId' in find(result, 'c1')).toBe(false)
    expect(find(result, 'c1').position).toEqual({ x: 110, y: 110 })
    expect(abs(result, 'c1')).toEqual(before.c1)
    expect(abs(result, 'c2')).toEqual(before.c2)
    expect(result.edges.map((e) => e.id)).toEqual(['inner', 'cross'])
  })

  it('moves the children of a deleted nested group up exactly one level', () => {
    const c = content([
      group('O', 0, 0, 800, 600),
      group('I', 50, 50, 400, 300, { parentId: 'O' }),
      node('L', 5, 5, { parentId: 'I' }),
      node('P', 300, 20, { parentId: 'O' }),
    ])
    const before = abs(c, 'L')
    const result = deleteElements(c, { nodeIds: ['I'], edgeIds: [] })
    expect(ids(result)).toEqual(['O', 'L', 'P'])
    expect(find(result, 'L').parentId).toBe('O')
    expect(find(result, 'L').position).toEqual({ x: 55, y: 55 })
    expect(abs(result, 'L')).toEqual(before)
    expect(find(result, 'P')).toBe(find(c, 'P'))
  })

  it('deleting an outer group lifts the inner group (with its subtree) to top level', () => {
    const leaf = node('L', 5, 5, { parentId: 'I' })
    const c = content([group('O', 100, 100, 800, 600), group('I', 50, 50, 400, 300, { parentId: 'O' }), leaf])
    const before = { I: abs(c, 'I'), L: abs(c, 'L') }
    const result = deleteElements(c, { nodeIds: ['O'], edgeIds: [] })
    expect(ids(result)).toEqual(['I', 'L'])
    expect(find(result, 'L')).toBe(leaf)
    expect(abs(result, 'I')).toEqual(before.I)
    expect(abs(result, 'L')).toEqual(before.L)
  })

  it('deleting a group and its nested group together lifts the grandchildren to the outer parent', () => {
    const c = content([
      group('O', 100, 100, 800, 600),
      group('I', 50, 50, 400, 300, { parentId: 'O' }),
      node('L', 5, 5, { parentId: 'I' }),
    ])
    const before = abs(c, 'L')
    const result = deleteElements(c, { nodeIds: ['I', 'O'], edgeIds: [] })
    expect(ids(result)).toEqual(['L'])
    expect('parentId' in find(result, 'L')).toBe(false)
    expect(abs(result, 'L')).toEqual(before)
  })

  it('deletes listed children together with a listed group; the remaining ones survive', () => {
    const c = content(
      [
        group('g', 100, 100, 500, 400),
        node('gone', 10, 10, { parentId: 'g' }),
        node('stays', 200, 10, { parentId: 'g' }),
      ],
      [edge('e1', 'gone', 'stays'), edge('e2', 'g', 'stays')],
    )
    const result = deleteElements(c, { nodeIds: ['g', 'gone'], edgeIds: [] })
    expect(ids(result)).toEqual(['stays'])
    expect(find(result, 'stays').position).toEqual({ x: 300, y: 110 })
    expect('parentId' in find(result, 'stays')).toBe(false)
    expect(result.edges).toEqual([])
  })

  it('removes a deleted child from its group without touching the group or its siblings', () => {
    const c = content([
      group('g', 0, 0, 500, 400),
      node('a', 10, 10, { parentId: 'g' }),
      node('b', 200, 10, { parentId: 'g' }),
    ])
    const result = deleteElements(c, { nodeIds: ['a'], edgeIds: [] })
    expect(ids(result)).toEqual(['g', 'b'])
    expect(find(result, 'b')).toBe(find(c, 'b'))
  })

  it('returns the same reference when nothing matches', () => {
    const c = content([node('a', 0, 0), node('b', 0, 0)], [edge('e', 'a', 'b')])
    expect(deleteElements(c, { nodeIds: [], edgeIds: [] })).toBe(c)
    expect(deleteElements(c, { nodeIds: ['nope'], edgeIds: ['nope'] })).toBe(c)
  })

  it('does not mutate its input', () => {
    const c = deepFreeze(
      content([group('g', 5, 5, 100, 100), node('c', 1, 1, { parentId: 'g' }), node('d', 0, 0)], [edge('e', 'g', 'd')]),
    )
    const result = deleteElements(c, { nodeIds: ['g', 'd'], edgeIds: ['e'] })
    expect(ids(result)).toEqual(['c'])
    expect(c.nodes).toHaveLength(3)
    expect(c.edges).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

describe('checkConnection', () => {
  const c = content(
    [
      node('a', 0, 0),
      node('b', 0, 0),
      group('g', 0, 0, 500, 500),
      group('inner', 10, 10, 300, 300, { parentId: 'g' }),
      node('leaf', 5, 5, { parentId: 'inner' }),
      node('sib', 400, 400, { parentId: 'g' }),
    ],
    [edge('ab', 'a', 'b')],
  )

  it('accepts a new edge between existing nodes', () => {
    expect(checkConnection(c, 'b', 'a')).toEqual({ ok: true }) // reverse direction is allowed
    expect(checkConnection(c, 'a', 'g')).toEqual({ ok: true })
    expect(checkConnection(c, 'leaf', 'sib')).toEqual({ ok: true })
  })

  it("rejects unknown nodes", () => {
    expect(checkConnection(c, 'nope', 'a')).toEqual({ ok: false, reason: 'unknown-node' })
    expect(checkConnection(c, 'a', 'nope')).toEqual({ ok: false, reason: 'unknown-node' })
    expect(checkConnection(c, 'nope', 'nope')).toEqual({ ok: false, reason: 'unknown-node' })
  })

  it('rejects self connections', () => {
    expect(checkConnection(c, 'a', 'a')).toEqual({ ok: false, reason: 'self' })
  })

  it('rejects an existing source/target pair', () => {
    expect(checkConnection(c, 'a', 'b')).toEqual({ ok: false, reason: 'duplicate' })
  })

  it('rejects connections between an element and its ancestor (either direction)', () => {
    expect(checkConnection(c, 'g', 'inner')).toEqual({ ok: false, reason: 'hierarchy' })
    expect(checkConnection(c, 'inner', 'g')).toEqual({ ok: false, reason: 'hierarchy' })
    expect(checkConnection(c, 'g', 'leaf')).toEqual({ ok: false, reason: 'hierarchy' })
    expect(checkConnection(c, 'leaf', 'g')).toEqual({ ok: false, reason: 'hierarchy' })
  })
})

describe('addEdge', () => {
  const base = content([node('a', 0, 0), node('b', 0, 0)], [edge('e0', 'a', 'b')])

  it('appends a directed edge with a generated id', () => {
    const result = addEdge(base, 'b', 'a', counter('e'))
    expect(result.edges).toEqual([edge('e0', 'a', 'b'), edge('e-1', 'b', 'a')])
    expect(result.nodes).toBe(base.nodes)
  })

  it('returns the same reference and consumes no id when the connection is invalid', () => {
    const newId = counter('e')
    expect(addEdge(base, 'a', 'b', newId)).toBe(base)
    expect(addEdge(base, 'a', 'a', newId)).toBe(base)
    expect(addEdge(base, 'a', 'zzz', newId)).toBe(base)
    expect(newId()).toBe('e-1')
  })

  it('does not mutate its input', () => {
    const c = deepFreeze(content([node('a', 0, 0), node('b', 0, 0)]))
    const result = addEdge(c, 'a', 'b', counter())
    expect(result.edges).toHaveLength(1)
    expect(c.edges).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Property updates
// ---------------------------------------------------------------------------

describe('setColor', () => {
  const colored = (id: string, color: string) =>
    node(id, 0, 0, { metadata: [{ key: 'name', value: id }, { key: 'color', value: color }, { key: 'owner', value: 'Anna' }] })

  it('sets the colour of every listed object and group, right after the name', () => {
    const c = content([node('a', 0, 0), group('g', 0, 0, 100, 100), node('b', 0, 0)])
    const result = setColor(c, ['a', 'g'], '#FF0000')

    expect(find(result, 'a').metadata).toEqual([{ key: 'name', value: 'a' }, { key: 'color', value: '#ff0000' }])
    expect(find(result, 'g').metadata[1]).toEqual({ key: 'color', value: '#ff0000' })
    expect(find(result, 'b')).toBe(find(c, 'b'))
  })

  it('replaces an existing colour and keeps the other entries', () => {
    const result = setColor(content([colored('a', '#00ff00')]), ['a'], '#112233')

    expect(find(result, 'a').metadata).toEqual([
      { key: 'name', value: 'a' },
      { key: 'color', value: '#112233' },
      { key: 'owner', value: 'Anna' },
    ])
  })

  it('removes the colour with undefined, also an invalid one', () => {
    const result = setColor(content([colored('a', '#00ff00'), colored('b', 'red')]), ['a', 'b'], undefined)

    for (const id of ['a', 'b']) {
      expect(find(result, id).metadata).toEqual([{ key: 'name', value: id }, { key: 'owner', value: 'Anna' }])
    }
  })

  it('keeps elements that already have the colour and returns the content when nothing changes', () => {
    const c = content([colored('a', '#112233'), node('b', 0, 0)])

    expect(setColor(c, ['a'], '#112233')).toBe(c)
    expect(setColor(c, ['b'], undefined)).toBe(c)
    expect(setColor(c, ['nope'], '#112233')).toBe(c)
    expect(find(setColor(c, ['a', 'b'], '#112233'), 'a')).toBe(find(c, 'a'))
  })

  it('ignores a value that is no #rrggbb colour', () => {
    const c = content([node('a', 0, 0)])

    expect(setColor(c, ['a'], 'red')).toBe(c)
    expect(setColor(c, ['a'], '#abc')).toBe(c)
  })

  it('does not mutate its input', () => {
    const c = deepFreeze(content([node('a', 0, 0)]))
    expect(() => setColor(c, ['a'], '#112233')).not.toThrow()
  })
})

describe('reconnectEdge', () => {
  const base = () =>
    content(
      [node('a', 0, 0), node('b', 300, 0), node('c', 600, 0), group('g', 0, 300, 300, 200), node('m', 24, 56, { parentId: 'g' })],
      [
        { id: 'e1', source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left', metadata: [{ key: 'name', value: 'hängt ab' }] },
        { id: 'e2', source: 'b', target: 'c' },
      ],
    )
  const edgeOf = (c: GraphContent, id: string) => c.edges.find((e) => e.id === id)!

  it('moves only the connector and keeps id, ends and name', () => {
    const result = reconnectEdge(base(), 'e1', { source: 'a', target: 'b', sourceHandle: 'bottom', targetHandle: 'top' })

    expect(edgeOf(result, 'e1')).toEqual({
      id: 'e1',
      source: 'a',
      target: 'b',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      metadata: [{ key: 'name', value: 'hängt ab' }],
    })
    expect(edgeOf(result, 'e2')).toBe(edgeOf(base(), 'e2') && result.edges[1])
  })

  it('can point to another element', () => {
    const result = reconnectEdge(base(), 'e1', { source: 'a', target: 'c', targetHandle: 'left' })

    expect(edgeOf(result, 'e1')).toMatchObject({ source: 'a', target: 'c', targetHandle: 'left', metadata: [{ key: 'name', value: 'hängt ab' }] })
    expect(edgeOf(result, 'e1').sourceHandle).toBeUndefined()
  })

  it('refuses what a new connection would not allow, but not the edge itself as a duplicate', () => {
    const c = base()

    expect(checkReconnection(c, 'e1', 'a', 'b').ok).toBe(true)
    expect(checkReconnection(c, 'e1', 'b', 'c')).toEqual({ ok: false, reason: 'duplicate' })
    expect(checkReconnection(c, 'e1', 'a', 'a')).toEqual({ ok: false, reason: 'self' })
    expect(checkReconnection(c, 'e1', 'g', 'm')).toEqual({ ok: false, reason: 'hierarchy' })
    expect(reconnectEdge(c, 'e1', { source: 'b', target: 'c' })).toBe(c)
  })

  it('returns the content when nothing changes or the edge is unknown', () => {
    const c = base()

    expect(reconnectEdge(c, 'e1', { source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left' })).toBe(c)
    expect(reconnectEdge(c, 'nope', { source: 'a', target: 'c' })).toBe(c)
  })

  it('does not mutate its input', () => {
    const c = deepFreeze(base())
    expect(() => reconnectEdge(c, 'e1', { source: 'a', target: 'c', targetHandle: 'top' })).not.toThrow()
  })
})

describe('renameElement', () => {
  const named = (id: string, extra: ModelNode['metadata'] = []) =>
    node(id, 0, 0, { metadata: [{ key: 'name', value: id }, ...extra] })

  it('sets the trimmed name and keeps every other entry in place', () => {
    const owner = { key: 'owner', value: 'Anna' }
    const c = content([named('a', [owner]), named('b')])
    const result = renameElement(c, 'a', '  Neu  ')

    expect(find(result, 'a').metadata).toEqual([{ key: 'name', value: 'Neu' }, owner])
    expect(find(result, 'b')).toBe(find(c, 'b'))
  })

  it('works for groups as well', () => {
    const c = content([group('g', 0, 0, 200, 100)])
    expect(find(renameElement(c, 'g', 'Backend'), 'g').metadata[0]).toEqual({ key: 'name', value: 'Backend' })
  })

  it('allows an empty name', () => {
    expect(find(renameElement(content([named('a')]), 'a', '  '), 'a').metadata[0].value).toBe('')
  })

  it('returns the same reference when nothing changes or the id is unknown', () => {
    const c = content([named('a')])
    expect(renameElement(c, 'a', 'a')).toBe(c)
    expect(renameElement(c, 'a', ' a ')).toBe(c)
    expect(renameElement(c, 'nope', 'x')).toBe(c)
  })

  it('adds a name entry to an element that has none', () => {
    const c = content([node('a', 0, 0, { metadata: [{ key: 'owner', value: 'Anna' }] })])
    expect(find(renameElement(c, 'a', 'Neu'), 'a').metadata).toEqual([
      { key: 'name', value: 'Neu' },
      { key: 'owner', value: 'Anna' },
    ])
  })

  it('does not mutate its input', () => {
    const c = deepFreeze(content([named('a')]))
    expect(() => renameElement(c, 'a', 'x')).not.toThrow()
  })
})

describe('updateMetadata', () => {
  it('replaces the metadata with its normalized form', () => {
    const other = node('b', 0, 0)
    const c = content([node('a', 0, 0), other])
    const result = updateMetadata(c, 'a', [
      { key: ' owner ', value: ' Anna ' },
      { key: '', value: 'dropped' },
      { key: 'name', value: ' Alpha ' },
    ])
    expect(find(result, 'a').metadata).toEqual([
      { key: 'name', value: 'Alpha' },
      { key: 'owner', value: 'Anna' },
    ])
    expect(find(result, 'b')).toBe(other)
  })

  it('guarantees a name entry even if none is passed', () => {
    const result = updateMetadata(content([node('a', 0, 0)]), 'a', [{ key: 'x', value: 'y' }])
    expect(find(result, 'a').metadata).toEqual([
      { key: 'name', value: '' },
      { key: 'x', value: 'y' },
    ])
  })

  it('returns the same reference for unknown ids', () => {
    const c = content([node('a', 0, 0)])
    expect(updateMetadata(c, 'nope', [])).toBe(c)
  })

  it('does not mutate its input', () => {
    const c = deepFreeze(content([node('a', 0, 0)]))
    const result = updateMetadata(c, 'a', [{ key: 'name', value: 'changed' }])
    expect(find(c, 'a').metadata).toEqual([{ key: 'name', value: 'a' }])
    expect(find(result, 'a').metadata).toEqual([{ key: 'name', value: 'changed' }])
  })
})

describe('findGroupAtPoint', () => {
  const nodes = [
    group('G1', 0, 0, 1000, 800),
    group('G2', 100, 100, 400, 300, { parentId: 'G1' }), // canvas (100,100)-(500,400)
    node('n', 200, 200),
  ]

  it('picks the deepest group containing the point', () => {
    expect(findGroupAtPoint(nodes, { x: 300, y: 300 })).toBe('G2')
    expect(findGroupAtPoint(nodes, { x: 800, y: 600 })).toBe('G1')
  })

  it('returns undefined outside every group', () => {
    expect(findGroupAtPoint(nodes, { x: 1500, y: 100 })).toBeUndefined()
    expect(findGroupAtPoint([node('a', 0, 0)], { x: 5, y: 5 })).toBeUndefined()
  })

  it('treats the rectangle borders as inside', () => {
    expect(findGroupAtPoint(nodes, { x: 500, y: 400 })).toBe('G2')
  })

  it('skips the excluded element and its descendants', () => {
    expect(findGroupAtPoint(nodes, { x: 300, y: 300 }, 'G2')).toBe('G1')
    expect(findGroupAtPoint(nodes, { x: 300, y: 300 }, 'G1')).toBeUndefined()
  })
})

describe('setStatus', () => {
  it('adds a canonical status entry after name and colour', () => {
    const a = node('a', 0, 0, {
      metadata: [
        { key: 'name', value: 'A' },
        { key: 'color', value: '#16a34a' },
        { key: 'owner', value: 'X' },
      ],
    })
    expect(find(setStatus(content([a]), 'a', 'in Arbeit'), 'a').metadata).toEqual([
      { key: 'name', value: 'A' },
      { key: 'color', value: '#16a34a' },
      { key: 'status', value: 'in Arbeit' },
      { key: 'owner', value: 'X' },
    ])
  })

  it('replaces the first status entry in place and writes the key canonically', () => {
    const a = node('a', 0, 0, {
      metadata: [
        { key: 'name', value: 'A' },
        { key: 'owner', value: 'X' },
        { key: ' Status ', value: 'erledigt' },
      ],
    })
    expect(find(setStatus(content([a]), 'a', 'fertig'), 'a').metadata).toEqual([
      { key: 'name', value: 'A' },
      { key: 'owner', value: 'X' },
      { key: 'status', value: 'fertig' },
    ])
  })

  it('returns the same reference when the status is already set', () => {
    const a = node('a', 0, 0, {
      metadata: [
        { key: 'name', value: 'A' },
        { key: 'status', value: 'fertig' },
      ],
    })
    const c = content([a])
    expect(setStatus(c, 'a', 'fertig')).toBe(c)
  })

  it('ignores groups and unknown ids', () => {
    const c = content([group('g', 0, 0, 100, 100)])
    expect(setStatus(c, 'g', 'fertig')).toBe(c)
    expect(setStatus(c, 'nope', 'fertig')).toBe(c)
  })

  it('keeps the reason when it is already blocked and drops it for any other status (one change)', () => {
    const a = node('a', 0, 0, {
      metadata: [
        { key: 'name', value: 'A' },
        { key: 'status', value: 'blockiert' },
        { key: 'blockiert_grund', value: 'Freigabe fehlt' },
        { key: 'owner', value: 'X' },
      ],
    })
    const c = content([a])
    expect(setStatus(c, 'a', 'blockiert')).toBe(c)
    expect(find(setStatus(c, 'a', 'in Arbeit'), 'a').metadata).toEqual([
      { key: 'name', value: 'A' },
      { key: 'status', value: 'in Arbeit' },
      { key: 'owner', value: 'X' },
    ])
  })

  it('removes a stray reason even when the status itself is unchanged', () => {
    const a = node('a', 0, 0, {
      metadata: [
        { key: 'name', value: 'A' },
        { key: 'status', value: 'offen' },
        { key: 'blockiert_grund', value: 'alt' },
      ],
    })
    expect(find(setStatus(content([a]), 'a', 'offen'), 'a').metadata).toEqual([
      { key: 'name', value: 'A' },
      { key: 'status', value: 'offen' },
    ])
  })

  it('does not mutate its input', () => {
    const c = deepFreeze(content([node('a', 0, 0)]))
    const result = setStatus(c, 'a', 'fertig')
    expect(find(c, 'a').metadata).toEqual([{ key: 'name', value: 'a' }])
    expect(find(result, 'a').metadata).toEqual([
      { key: 'name', value: 'a' },
      { key: 'status', value: 'fertig' },
    ])
  })
})

describe('moveNode', () => {
  it('sets the relative position and keeps everything else', () => {
    const original = node('a', 1, 2, { parentId: 'g' })
    const c = content([group('g', 0, 0, 10, 10), original, node('b', 5, 5)])
    const result = moveNode(c, 'a', { x: 30, y: 40 })
    expect(find(result, 'a')).toEqual({ ...original, position: { x: 30, y: 40 } })
    expect(find(result, 'b')).toBe(find(c, 'b'))
  })

  it('does not alias the passed position object', () => {
    const position = { x: 1, y: 1 }
    const result = moveNode(content([node('a', 0, 0)]), 'a', position)
    position.x = 99
    expect(find(result, 'a').position).toEqual({ x: 1, y: 1 })
  })

  it('returns the same reference for unknown ids', () => {
    const c = content([node('a', 0, 0)])
    expect(moveNode(c, 'nope', { x: 1, y: 1 })).toBe(c)
  })

  it('does not mutate its input', () => {
    const c = deepFreeze(content([node('a', 0, 0)]))
    expect(find(moveNode(c, 'a', { x: 9, y: 9 }), 'a').position).toEqual({ x: 9, y: 9 })
    expect(find(c, 'a').position).toEqual({ x: 0, y: 0 })
  })
})

describe('resizeNode', () => {
  it('sets the size of a group', () => {
    const result = resizeNode(content([group('g', 0, 0, 200, 200)]), 'g', { width: 640, height: 480 })
    expect(find(result, 'g').size).toEqual({ width: 640, height: 480 })
  })

  it('adds an explicit size to a plain node', () => {
    const result = resizeNode(content([node('a', 0, 0)]), 'a', { width: 300, height: 90 })
    expect(find(result, 'a').size).toEqual({ width: 300, height: 90 })
  })

  it('clamps groups to GROUP_MIN_SIZE', () => {
    const result = resizeNode(content([group('g', 0, 0, 200, 200)]), 'g', { width: 10, height: 20 })
    expect(find(result, 'g').size).toEqual(GROUP_MIN_SIZE)
  })

  it('clamps each dimension separately', () => {
    const result = resizeNode(content([group('g', 0, 0, 200, 200)]), 'g', { width: 1000, height: 5 })
    expect(find(result, 'g').size).toEqual({ width: 1000, height: GROUP_MIN_SIZE.height })
  })

  it('clamps plain nodes to 1x1', () => {
    const result = resizeNode(content([node('a', 0, 0)]), 'a', { width: -5, height: 0 })
    expect(find(result, 'a').size).toEqual({ width: 1, height: 1 })
  })

  it('falls back to the minimum for non-finite values', () => {
    const result = resizeNode(content([group('g', 0, 0, 200, 200)]), 'g', { width: NaN, height: Infinity })
    expect(find(result, 'g').size).toEqual(GROUP_MIN_SIZE)
  })

  it('returns the same reference for unknown ids', () => {
    const c = content([node('a', 0, 0)])
    expect(resizeNode(c, 'nope', { width: 5, height: 5 })).toBe(c)
  })

  it('does not mutate its input', () => {
    const c = deepFreeze(content([group('g', 0, 0, 200, 200)]))
    resizeNode(c, 'g', { width: 400, height: 400 })
    expect(find(c, 'g').size).toEqual({ width: 200, height: 200 })
  })
})

describe('wouldBreakHierarchy', () => {
  const g = (id: string, parentId?: string): ModelNode => ({
    id,
    kind: 'group',
    ...(parentId ? { parentId } : {}),
    position: { x: 0, y: 0 },
    size: { width: 300, height: 200 },
    metadata: [{ key: 'name', value: id }],
  })
  const e = (id: string, source: string, target: string): ModelEdge => ({ id, source, target })

  it('is false without edges and for moves to top level', () => {
    const content: GraphContent = { nodes: [g('G'), node('n', 0, 0, { parentId: 'G' })], edges: [] }
    expect(wouldBreakHierarchy(content, 'n', 'G')).toBe(false)
    expect(wouldBreakHierarchy(content, 'n', undefined)).toBe(false)
  })

  it('is true when an edge links the element and the new parent group (either direction)', () => {
    const nodes = [g('G'), node('n', 500, 0)]
    expect(wouldBreakHierarchy({ nodes, edges: [e('e', 'n', 'G')] }, 'n', 'G')).toBe(true)
    expect(wouldBreakHierarchy({ nodes, edges: [e('e', 'G', 'n')] }, 'n', 'G')).toBe(true)
  })

  it('is true for an edge to any ancestor of the new parent', () => {
    const nodes = [g('outer'), g('inner', 'outer'), node('n', 900, 0)]
    expect(wouldBreakHierarchy({ nodes, edges: [e('e', 'n', 'outer')] }, 'n', 'inner')).toBe(true)
  })

  it('considers the descendants of a moved group', () => {
    const nodes = [g('G'), g('moved'), node('child', 0, 0, { parentId: 'moved' })]
    expect(wouldBreakHierarchy({ nodes, edges: [e('e', 'child', 'G')] }, 'moved', 'G')).toBe(true)
  })

  it('ignores unrelated edges', () => {
    const nodes = [g('G'), node('n', 500, 0), node('m', 600, 0)]
    expect(wouldBreakHierarchy({ nodes, edges: [e('e', 'n', 'm')] }, 'n', 'G')).toBe(false)
  })
})

describe('pickSides', () => {
  const nodes = [
    node('c', 400, 400),
    node('right', 800, 400),
    node('left', 0, 400),
    node('below', 400, 800),
    node('above', 400, 0),
  ]

  it('connects the facing sides, horizontally when the dominant axis is x', () => {
    expect(pickSides(nodes, 'c', 'right')).toEqual({ sourceHandle: 'right', targetHandle: 'left' })
    expect(pickSides(nodes, 'c', 'left')).toEqual({ sourceHandle: 'left', targetHandle: 'right' })
  })

  it('connects vertically when the dominant axis is y', () => {
    expect(pickSides(nodes, 'c', 'below')).toEqual({ sourceHandle: 'bottom', targetHandle: 'top' })
    expect(pickSides(nodes, 'c', 'above')).toEqual({ sourceHandle: 'top', targetHandle: 'bottom' })
  })

  it('uses absolute positions of elements inside groups', () => {
    const grouped = [
      { ...node('g', 1000, 0), kind: 'group' as const, size: { width: 300, height: 200 } },
      node('in', 20, 40, { parentId: 'g' }),
      node('out', 0, 40),
    ]
    expect(pickSides(grouped, 'out', 'in')).toEqual({ sourceHandle: 'right', targetHandle: 'left' })
  })
})

describe('addEdge with connectors', () => {
  const base: GraphContent = { nodes: [node('a', 0, 0), node('b', 300, 0)], edges: [] }

  it('stores the chosen connectors on the edge', () => {
    const next = addEdge(base, 'a', 'b', counter(), { sourceHandle: 'bottom', targetHandle: 'top' })
    expect(next.edges).toEqual([
      { id: 'id-1', source: 'a', target: 'b', sourceHandle: 'bottom', targetHandle: 'top' },
    ])
  })

  it('omits connector keys that are not given', () => {
    const next = addEdge(base, 'a', 'b', counter(), { sourceHandle: 'right' })
    expect(next.edges[0]).toEqual({ id: 'id-1', source: 'a', target: 'b', sourceHandle: 'right' })
    expect('targetHandle' in next.edges[0]).toBe(false)
    expect('sourceHandle' in addEdge(base, 'a', 'b', counter()).edges[0]).toBe(false)
  })
})

describe('renameEdge', () => {
  const base: GraphContent = {
    nodes: [node('a', 0, 0), node('b', 300, 0)],
    edges: [
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'right' },
      { id: 'e2', source: 'b', target: 'a' },
    ],
  }

  it('sets the trimmed name as the same `name` entry elements have, and keeps everything else', () => {
    const next = renameEdge(base, 'e1', '  hängt ab von  ')
    expect(next.edges[0]).toEqual({
      id: 'e1',
      source: 'a',
      target: 'b',
      sourceHandle: 'right',
      metadata: [{ key: 'name', value: 'hängt ab von' }],
    })
    expect(next.edges[1]).toBe(base.edges[1])
    expect(next.nodes).toBe(base.nodes)
  })

  it('keeps other metadata entries and puts the name first', () => {
    const withOwner: GraphContent = {
      ...base,
      edges: [{ ...base.edges[0], metadata: [{ key: 'owner', value: 'Anna' }, { key: 'name', value: 'alt' }] }, base.edges[1]],
    }

    expect(renameEdge(withOwner, 'e1', 'neu').edges[0].metadata).toEqual([
      { key: 'name', value: 'neu' },
      { key: 'owner', value: 'Anna' },
    ])
  })

  it('removes the metadata again for blank text, unless other entries remain', () => {
    const named = renameEdge(base, 'e1', 'x')
    for (const blank of ['', '   ']) {
      expect('metadata' in renameEdge(named, 'e1', blank).edges[0]).toBe(false)
    }
    const withOwner: GraphContent = {
      ...base,
      edges: [{ ...base.edges[0], metadata: [{ key: 'name', value: 'x' }, { key: 'owner', value: 'Anna' }] }, base.edges[1]],
    }
    expect(renameEdge(withOwner, 'e1', '').edges[0].metadata).toEqual([
      { key: 'name', value: '' },
      { key: 'owner', value: 'Anna' },
    ])
  })

  it('returns the same content for unknown edges or an unchanged name', () => {
    expect(renameEdge(base, 'nope', 'x')).toBe(base)
    expect(renameEdge(base, 'e1', '')).toBe(base)
    const named = renameEdge(base, 'e1', 'x')
    expect(renameEdge(named, 'e1', ' x ')).toBe(named)
  })

  it('does not mutate its input', () => {
    const before = JSON.stringify(base)
    renameEdge(base, 'e1', 'x')
    expect(JSON.stringify(base)).toBe(before)
  })
})

describe('setBlockReason', () => {
  const blocked = (extra: { key: string; value: string }[] = []) =>
    node('a', 0, 0, {
      metadata: [{ key: 'name', value: 'A' }, { key: 'status', value: 'blockiert' }, ...extra],
    })

  it('writes the trimmed reason right after the status', () => {
    const a = node('a', 0, 0, {
      metadata: [
        { key: 'name', value: 'A' },
        { key: 'status', value: 'blockiert' },
        { key: 'owner', value: 'X' },
      ],
    })
    expect(find(setBlockReason(content([a]), 'a', '  Freigabe fehlt '), 'a').metadata).toEqual([
      { key: 'name', value: 'A' },
      { key: 'status', value: 'blockiert' },
      { key: 'blockiert_grund', value: 'Freigabe fehlt' },
      { key: 'owner', value: 'X' },
    ])
  })

  it('replaces an existing reason (written canonically) and removes it for a blank one', () => {
    const c = content([blocked([{ key: ' Blockiert_Grund', value: 'alt' }])])
    expect(find(setBlockReason(c, 'a', 'neu'), 'a').metadata).toEqual([
      { key: 'name', value: 'A' },
      { key: 'status', value: 'blockiert' },
      { key: 'blockiert_grund', value: 'neu' },
    ])
    expect(find(setBlockReason(c, 'a', '  '), 'a').metadata).toEqual([
      { key: 'name', value: 'A' },
      { key: 'status', value: 'blockiert' },
    ])
  })

  it('returns the same reference when nothing changes', () => {
    const c = content([blocked([{ key: 'blockiert_grund', value: 'Freigabe' }])])
    expect(setBlockReason(c, 'a', ' Freigabe ')).toBe(c)
    const without = content([blocked()])
    expect(setBlockReason(without, 'a', '')).toBe(without)
  })

  it('only applies to objects that are blocked', () => {
    const open = content([node('a', 0, 0)])
    expect(setBlockReason(open, 'a', 'x')).toBe(open)
    const g = content([group('g', 0, 0, 100, 100)])
    expect(setBlockReason(g, 'g', 'x')).toBe(g)
    expect(setBlockReason(g, 'nope', 'x')).toBe(g)
  })
})
