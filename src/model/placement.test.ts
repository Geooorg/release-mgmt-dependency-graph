import { describe, expect, it } from 'vitest'
import { getAbsolutePosition, getSize } from './graph'
import { addNodeAtPoint, findFreePosition, placeNewNode } from './placement'
import { box, content, counterIds, group } from '../test/fixtures'
import { NODE_SIZE } from './types'
import type { ModelNode, Point, Size } from './types'

function overlaps(a: Point, aSize: Size, b: Point, bSize: Size): boolean {
  return (
    a.x < b.x + bSize.width &&
    b.x < a.x + aSize.width &&
    a.y < b.y + bSize.height &&
    b.y < a.y + aSize.height
  )
}

describe('findFreePosition', () => {
  it('returns the preferred position when nothing is in the way', () => {
    expect(findFreePosition([], { x: 40, y: 50 })).toEqual({ x: 40, y: 50 })
    expect(findFreePosition([box('far', 2000, 2000)], { x: 40, y: 50 })).toEqual({ x: 40, y: 50 })
  })

  it('moves away from an occupied spot without overlapping it, staying close', () => {
    const nodes = [box('a', 100, 100)]
    const spot = findFreePosition(nodes, { x: 110, y: 105 })
    expect(overlaps(spot, NODE_SIZE, { x: 100, y: 100 }, NODE_SIZE)).toBe(false)
    expect(Math.abs(spot.x - 110)).toBeLessThanOrEqual(NODE_SIZE.width + 48)
    expect(Math.abs(spot.y - 105)).toBeLessThanOrEqual(NODE_SIZE.height + 48)
  })

  it('avoids many obstacles and groups', () => {
    const nodes: ModelNode[] = [
      group('g', 0, 0, 400, 300),
      box('a', 500, 0),
      box('b', 500, 100),
      box('c', 0, 400),
    ]
    const spot = findFreePosition(nodes, { x: 50, y: 50 })
    for (const n of nodes) {
      expect(overlaps(spot, NODE_SIZE, n.position, getSize(n))).toBe(false)
    }
  })

  it('uses absolute coordinates of children inside groups', () => {
    const nodes = [group('g', 1000, 1000, 300, 200), box('in', 20, 40, 'g')]
    // child sits at absolute (1020, 1040); the group itself blocks the whole area
    const spot = findFreePosition(nodes, { x: 1020, y: 1040 })
    expect(overlaps(spot, NODE_SIZE, { x: 1000, y: 1000 }, { width: 300, height: 200 })).toBe(false)
  })

  it('is deterministic', () => {
    const nodes = [box('a', 100, 100), box('b', 300, 100)]
    expect(findFreePosition(nodes, { x: 120, y: 110 })).toEqual(
      findFreePosition(nodes, { x: 120, y: 110 }),
    )
  })

  it('honours a custom size', () => {
    const size = { width: 400, height: 300 }
    const spot = findFreePosition([box('a', 0, 0)], { x: 0, y: 0 }, size)
    expect(overlaps(spot, size, { x: 0, y: 0 }, NODE_SIZE)).toBe(false)
  })
})

describe('findFreePosition with a scope', () => {
  it('ignores the listed elements as obstacles', () => {
    const nodes = [group('g', 0, 0, 600, 400)]
    expect(findFreePosition(nodes, { x: 100, y: 100 }, NODE_SIZE, 24, { ignoreIds: new Set(['g']) })).toEqual({
      x: 100,
      y: 100,
    })
  })

  it('stays inside the bounds', () => {
    const bounds = { left: 0, top: 0, right: 400, bottom: 300 }
    const nodes = [group('g', 0, 0, 400, 300), box('a', 100, 100, 'g')]
    const spot = findFreePosition(nodes, { x: 110, y: 110 }, NODE_SIZE, 24, {
      ignoreIds: new Set(['g']),
      bounds,
    })
    expect(spot.x).toBeGreaterThanOrEqual(0)
    expect(spot.y).toBeGreaterThanOrEqual(0)
    expect(spot.x + NODE_SIZE.width).toBeLessThanOrEqual(400)
    expect(spot.y + NODE_SIZE.height).toBeLessThanOrEqual(300)
    expect(overlaps(spot, NODE_SIZE, { x: 100, y: 100 }, NODE_SIZE)).toBe(false)
  })

  it('clamps the preferred spot into the bounds when nothing is free', () => {
    const bounds = { left: 0, top: 0, right: NODE_SIZE.width + 10, bottom: NODE_SIZE.height + 10 }
    const spot = findFreePosition([box('a', 0, 0)], { x: 500, y: -50 }, NODE_SIZE, 24, { bounds })
    expect(spot).toEqual({ x: 10, y: 0 })
  })
})

describe('placeNewNode', () => {
  it('centres the object on the point outside every group', () => {
    const placed = placeNewNode([], { x: 500, y: 300 })
    expect(placed.parentId).toBeUndefined()
    expect(placed.position).toEqual({
      x: 500 - NODE_SIZE.width / 2,
      y: 300 - NODE_SIZE.height / 2,
    })
  })

  it('moves next to an object that is in the way', () => {
    const nodes = [box('a', 400, 250)]
    const placed = placeNewNode(nodes, { x: 500, y: 300 })
    expect(placed.parentId).toBeUndefined()
    expect(overlaps(placed.position, NODE_SIZE, { x: 400, y: 250 }, NODE_SIZE)).toBe(false)
  })

  it('joins the deepest group at the point and stays inside it', () => {
    const nodes = [group('outer', 0, 0, 1000, 800), group('inner', 100, 100, 400, 300, 'outer')]
    const placed = placeNewNode(nodes, { x: 300, y: 250 })
    expect(placed.parentId).toBe('inner')
    // absolute spot, centred on the click while it is free
    expect(placed.position).toEqual({ x: 300 - NODE_SIZE.width / 2, y: 250 - NODE_SIZE.height / 2 })
  })

  it('avoids the members of the group and keeps inside the group near its edge', () => {
    const nodes = [group('g', 100, 100, 400, 300), box('m', 100, 100, 'g')]
    const placed = placeNewNode(nodes, { x: 490, y: 390 })
    expect(placed.parentId).toBe('g')
    expect(placed.position.x).toBeGreaterThanOrEqual(100)
    expect(placed.position.y).toBeGreaterThanOrEqual(100)
    expect(placed.position.x + NODE_SIZE.width).toBeLessThanOrEqual(500)
    expect(placed.position.y + NODE_SIZE.height).toBeLessThanOrEqual(400)
  })
})

describe('a full group', () => {
  // 3 columns x 1 row of members fill the inner area exactly: 24 + 3 * 160 + 2 * 24 + 24 = 576 wide.
  const full = () => [
    group('g', 0, 0, 576, 136),
    box('m1', 24, 56, 'g'),
    box('m2', 208, 56, 'g'),
    box('m3', 392, 56, 'g'),
  ]

  it('places a new object just beyond its edge instead of on top of the members', () => {
    const nodes = full()
    const placed = placeNewNode(nodes, { x: 300, y: 84 })

    expect(placed.parentId).toBe('g')
    for (const member of ['m1', 'm2', 'm3']) {
      const at = getAbsolutePosition(nodes, member)
      expect(overlaps(placed.position, NODE_SIZE, at, NODE_SIZE)).toBe(false)
    }
  })

  it('grows when the object is added, as a single change', () => {
    const result = addNodeAtPoint(content(full()), { x: 300, y: 84 }, counterIds())
    const added = result.content.nodes.find((n) => n.id === result.nodeId)!
    const g = result.content.nodes.find((n) => n.id === 'g')!

    expect(added.parentId).toBe('g')
    expect(added.position.x + NODE_SIZE.width).toBeLessThanOrEqual(g.size!.width - 24)
    expect(added.position.y + NODE_SIZE.height).toBeLessThanOrEqual(g.size!.height - 24)
    expect(g.size!.width * g.size!.height).toBeGreaterThan(576 * 136)
  })

  it('does not grow while there is room', () => {
    const result = addNodeAtPoint(content([group('g', 0, 0, 600, 400)]), { x: 300, y: 200 }, counterIds())

    expect(result.content.nodes.find((n) => n.id === 'g')!.size).toEqual({ width: 600, height: 400 })
  })
})

describe('addNodeAtPoint', () => {
  it('names the new object as given', () => {
    const result = addNodeAtPoint(content([]), { x: 300, y: 200 }, counterIds(), 'New object')
    expect(result.content.nodes[0].metadata).toEqual([{ key: 'name', value: 'New object' }])
  })

  it('adds a top-level object centred on the point', () => {
    const result = addNodeAtPoint(content([]), { x: 500, y: 300 }, counterIds())
    expect(result.nodeId).toBe('id-1')
    expect(result.content.nodes).toHaveLength(1)
    expect(result.content.nodes[0].parentId).toBeUndefined()
    expect(result.content.nodes[0].position).toEqual({
      x: 500 - NODE_SIZE.width / 2,
      y: 300 - NODE_SIZE.height / 2,
    })
  })

  it('makes the object a member of the group at the point, with a position relative to it', () => {
    const result = addNodeAtPoint(content([group('g', 100, 200, 600, 400)]), { x: 400, y: 400 }, counterIds())
    const added = result.content.nodes.find((n) => n.id === result.nodeId)
    expect(added?.parentId).toBe('g')
    expect(added?.position).toEqual({
      x: 400 - NODE_SIZE.width / 2 - 100,
      y: 400 - NODE_SIZE.height / 2 - 200,
    })
  })

  it('keeps the edges and does not mutate the input', () => {
    const input = content([box('a', 0, 0), box('b', 300, 0)], [{ id: 'e', source: 'a', target: 'b' }])
    const frozen = JSON.stringify(input)
    const result = addNodeAtPoint(input, { x: 1000, y: 1000 }, counterIds())
    expect(result.content.edges).toBe(input.edges)
    expect(JSON.stringify(input)).toBe(frozen)
  })
})
