import { getAbsolutePosition, getSize } from './graph'
import { NODE_SIZE } from './types'
import type { ModelNode, Point, Size } from './types'

const GRID_STEP = 24
const SEARCH_RADIUS = 20

/** Candidate offsets on a grid, nearest first (ties broken by y, then x) so results are deterministic. */
const OFFSETS: Point[] = (() => {
  const offsets: Point[] = []
  for (let i = -SEARCH_RADIUS; i <= SEARCH_RADIUS; i++) {
    for (let j = -SEARCH_RADIUS; j <= SEARCH_RADIUS; j++) {
      offsets.push({ x: i * GRID_STEP, y: j * GRID_STEP })
    }
  }
  const dist = (p: Point) => p.x * p.x + p.y * p.y
  return offsets.sort((a, b) => dist(a) - dist(b) || a.y - b.y || a.x - b.x)
})()

/**
 * Nearest spot to `preferred` (top-left corner, canvas coordinates) where an element of `size`
 * overlaps no existing element (groups and children included) and keeps `gap` distance.
 * Falls back to `preferred` if the surroundings are completely full.
 */
export function findFreePosition(
  nodes: readonly ModelNode[],
  preferred: Point,
  size: Size = NODE_SIZE,
  gap = GRID_STEP,
): Point {
  const obstacles = nodes.map((node) => {
    const { x, y } = getAbsolutePosition(nodes, node.id)
    const { width, height } = getSize(node)
    return { left: x - gap, top: y - gap, right: x + width + gap, bottom: y + height + gap }
  })
  const isFree = ({ x, y }: Point) =>
    obstacles.every(
      (o) => x >= o.right || x + size.width <= o.left || y >= o.bottom || y + size.height <= o.top,
    )
  for (const offset of OFFSETS) {
    const candidate = { x: preferred.x + offset.x, y: preferred.y + offset.y }
    if (isFree(candidate)) return candidate
  }
  return preferred
}
