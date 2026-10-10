import { describe, expect, it } from 'vitest'
import { getSize } from './graph'
import { findFreePosition } from './placement'
import { box, group } from '../test/fixtures'
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
