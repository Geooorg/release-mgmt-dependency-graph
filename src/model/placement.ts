import {
  createNode,
  createNote,
  defaultIdGenerator,
  findGroupAtPoint,
  getAbsolutePosition,
  getAncestorIds,
  getSize,
  reparent,
} from './graph'
import { growGroupsToFit } from './groupGrowth'
import { GROUP_HEADER_HEIGHT, NODE_SIZE, NOTE_DEFAULT_SIZE } from './types'
import type { GraphContent, IdGenerator, ModelNode, Point, Size } from './types'

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

/** Rectangle in canvas coordinates. */
export interface Bounds {
  left: number
  top: number
  right: number
  bottom: number
}

/** Narrows `findFreePosition`: elements to disregard as obstacles and an area the result must stay in. */
export interface PlacementScope {
  ignoreIds?: ReadonlySet<string>
  bounds?: Bounds
}

/**
 * Nearest spot to `preferred` (top-left corner, canvas coordinates) where an element of `size`
 * overlaps no existing element (groups and children included) and keeps `gap` distance.
 * With a `scope`, the listed elements do not count as obstacles and the element stays inside the
 * bounds. Falls back to `preferred` (clamped into the bounds) if the surroundings are completely full.
 */
export function findFreePosition(
  nodes: readonly ModelNode[],
  preferred: Point,
  size: Size = NODE_SIZE,
  gap = GRID_STEP,
  scope: PlacementScope = {},
): Point {
  const { bounds } = scope
  const isInside = ({ x, y }: Point) =>
    bounds === undefined ||
    (x >= bounds.left && y >= bounds.top && x + size.width <= bounds.right && y + size.height <= bounds.bottom)
  const isFree = freeSpotTest(nodes, size, gap, scope.ignoreIds)
  for (const offset of OFFSETS) {
    const candidate = { x: preferred.x + offset.x, y: preferred.y + offset.y }
    if (isInside(candidate) && isFree(candidate)) return candidate
  }
  if (bounds === undefined) return preferred
  return {
    x: Math.max(bounds.left, Math.min(preferred.x, bounds.right - size.width)),
    y: Math.max(bounds.top, Math.min(preferred.y, bounds.bottom - size.height)),
  }
}

/** Whether an element of `size` at a top-left corner overlaps no obstacle (each kept `gap` away). */
function freeSpotTest(
  nodes: readonly ModelNode[],
  size: Size,
  gap: number,
  ignoreIds?: ReadonlySet<string>,
): (corner: Point) => boolean {
  const obstacles = nodes.filter((node) => !ignoreIds?.has(node.id)).map((node) => {
    const { x, y } = getAbsolutePosition(nodes, node.id)
    const { width, height } = getSize(node)
    return { left: x - gap, top: y - gap, right: x + width + gap, bottom: y + height + gap }
  })
  return ({ x, y }) =>
    obstacles.every(
      (o) => x >= o.right || x + size.width <= o.left || y >= o.bottom || y + size.height <= o.top,
    )
}

export interface NewNodePlacement {
  /** Top-left corner in canvas coordinates. */
  position: Point
  /** Deepest group at the click point; the new object becomes its member. */
  parentId?: string
}

/**
 * Where a new object goes when it is created at `center` (canvas coordinates): centred on the
 * point, moved to the nearest free spot. Inside a group it joins the deepest one at the point and
 * stays below its header and within its frame while there is room; in a full group it goes just
 * beyond the right or bottom edge (see `addNodeAtPoint`, which then grows the group).
 */
export function placeNewNode(nodes: readonly ModelNode[], center: Point, size: Size = NODE_SIZE): NewNodePlacement {
  const preferred = { x: center.x - size.width / 2, y: center.y - size.height / 2 }
  const parentId = findGroupAtPoint(nodes, center)
  if (parentId === undefined) return { position: findFreePosition(nodes, preferred, size) }

  const parent = nodes.find((n) => n.id === parentId)
  if (parent === undefined) return { position: findFreePosition(nodes, preferred, size) }
  const origin = getAbsolutePosition(nodes, parentId)
  const frame = getSize(parent)
  const inner: Bounds = {
    left: origin.x,
    top: origin.y + GROUP_HEADER_HEIGHT,
    right: origin.x + frame.width,
    bottom: origin.y + frame.height,
  }
  // The group and its ancestors surround the spot; only their other contents are in the way.
  const scope = { ignoreIds: new Set([parentId, ...getAncestorIds(nodes, parentId)]) }
  let position = findFreePosition(nodes, preferred, size, GRID_STEP, { ...scope, bounds: inner })
  // A full group has no free spot inside: look a little beyond its right and bottom edge, the group then grows.
  if (!freeSpotTest(nodes, size, GRID_STEP, scope.ignoreIds)(position)) {
    const outer = { ...inner, right: inner.right + size.width + GRID_STEP, bottom: inner.bottom + size.height + GRID_STEP }
    position = findFreePosition(nodes, preferred, size, GRID_STEP, { ...scope, bounds: outer })
  }
  return { position, parentId }
}

/**
 * Adds a new object centred at `center` (see `placeNewNode`), as a member of the group there if any;
 * a group that has no room left grows (with its parents) to hold it.
 */
export function addNodeAtPoint(
  content: GraphContent,
  center: Point,
  newId: IdGenerator = defaultIdGenerator,
  name?: string,
): { content: GraphContent; nodeId: string } {
  const { position, parentId } = placeNewNode(content.nodes, center)
  const node = createNode(position, newId, name)
  const added = { ...content, nodes: [...content.nodes, node] }
  // `reparent` keeps the on-screen position and turns it into one relative to the group.
  if (parentId === undefined) return { content: added, nodeId: node.id }
  return { content: growGroupsToFit(reparent(added, node.id, parentId), node.id), nodeId: node.id }
}

/**
 * Adds an empty sticky note centred exactly at `center` (notes may overlap anything, so there is no
 * search for a free spot), as a member of the deepest group there if any; that group grows to hold it.
 */
export function addNoteAtPoint(
  content: GraphContent,
  center: Point,
  newId: IdGenerator = defaultIdGenerator,
): { content: GraphContent; nodeId: string } {
  const position = { x: center.x - NOTE_DEFAULT_SIZE.width / 2, y: center.y - NOTE_DEFAULT_SIZE.height / 2 }
  const note = createNote(position, newId)
  const added = { ...content, nodes: [...content.nodes, note] }
  const parentId = findGroupAtPoint(content.nodes, center)
  if (parentId === undefined) return { content: added, nodeId: note.id }
  return { content: growGroupsToFit(reparent(added, note.id, parentId), note.id), nodeId: note.id }
}
