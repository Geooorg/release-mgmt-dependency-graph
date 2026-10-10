import { normalizeMetadata } from './metadata'
import {
  BLOCK_REASON_KEY,
  STATUS_KEY,
  findBlockReasonEntry,
  findStatusEntry,
  getStatus,
  withBlockReasonEntry,
  withStatusEntry,
  type Status,
} from './status'
import {
  GROUP_DEFAULT_SIZE,
  GROUP_HEADER_HEIGHT,
  GROUP_MIN_SIZE,
  GROUP_PADDING,
  NAME_KEY,
  NODE_SIZE,
} from './types'
import type {
  GraphContent,
  HandleSide,
  IdGenerator,
  MetadataEntry,
  ModelEdge,
  ModelNode,
  Point,
  Size,
} from './types'

/** Default id generator: `crypto.randomUUID()`. */
export const defaultIdGenerator: IdGenerator = () => crypto.randomUUID()

export interface EdgeHandles {
  sourceHandle?: HandleSide
  targetHandle?: HandleSide
}

export type ConnectionCheck =
  | { ok: true }
  | { ok: false; reason: 'unknown-node' | 'self' | 'duplicate' | 'hierarchy' }

type NodeIndex = ReadonlyMap<string, ModelNode>

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function indexById(nodes: readonly ModelNode[]): NodeIndex {
  return new Map(nodes.map((node) => [node.id, node]))
}

/** Ancestors nearest first; stops at unknown parents and at cycles. */
function ancestorIdsIn(byId: NodeIndex, id: string): string[] {
  const ancestors: string[] = []
  const seen = new Set([id])
  let parentId = byId.get(id)?.parentId
  while (parentId !== undefined && byId.has(parentId) && !seen.has(parentId)) {
    ancestors.push(parentId)
    seen.add(parentId)
    parentId = byId.get(parentId)?.parentId
  }
  return ancestors
}

function absolutePositionIn(byId: NodeIndex, id: string): Point {
  const position = { x: 0, y: 0 }
  for (const nodeId of [id, ...ancestorIdsIn(byId, id)]) {
    const node = byId.get(nodeId)
    if (node === undefined) continue
    position.x += node.position.x
    position.y += node.position.y
  }
  return position
}

/** Copy of `node` with a new parent and position; `parentId` is removed (not set to undefined) for top level. */
function withParent(node: ModelNode, parentId: string | undefined, position: Point): ModelNode {
  const next: ModelNode = { ...node, position }
  if (parentId === undefined) delete next.parentId
  else next.parentId = parentId
  return next
}

/** Applies `update` to the node with `id`; unknown id -> the very same `content`. */
function updateNode(
  content: GraphContent,
  id: string,
  update: (node: ModelNode) => ModelNode,
): GraphContent {
  if (!content.nodes.some((node) => node.id === id)) return content
  return { ...content, nodes: content.nodes.map((node) => (node.id === id ? update(node) : node)) }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * All functions below are PURE and immutable: they never mutate their arguments and return
 * new objects. Functions that cannot apply (invalid ids, rule violations) either say so in
 * their doc comment (throw) or return the input `content` unchanged (no-op).
 */

/** Creates a plain node: kind 'node', name 'Neues Objekt', metadata normalized, no explicit size. */
export function createNode(position: Point, newId: IdGenerator = defaultIdGenerator): ModelNode {
  return {
    id: newId(),
    kind: 'node',
    position: { x: position.x, y: position.y },
    metadata: normalizeMetadata([{ key: NAME_KEY, value: 'Neues Objekt' }]),
  }
}

/** Effective size: `node.size` if set, otherwise NODE_SIZE (plain nodes) / GROUP_DEFAULT_SIZE (groups). */
export function getSize(node: ModelNode): Size {
  if (node.size !== undefined) return node.size
  return { ...(node.kind === 'group' ? GROUP_DEFAULT_SIZE : NODE_SIZE) }
}

/** Ids of all ancestors, nearest parent first. Unknown id -> []. Must be robust against parent cycles. */
export function getAncestorIds(nodes: readonly ModelNode[], id: string): string[] {
  return ancestorIdsIn(indexById(nodes), id)
}

/** Position of the node's top-left corner in canvas coordinates (sum of relative positions up the parent chain). */
export function getAbsolutePosition(nodes: readonly ModelNode[], id: string): Point {
  return absolutePositionIn(indexById(nodes), id)
}

/** Parents before children (stable otherwise). React Flow requires this order. Orphans (unknown parentId) are treated as top level. */
export function sortParentsFirst(nodes: readonly ModelNode[]): ModelNode[] {
  const byId = indexById(nodes)
  // Tracked by object identity so that (invalid) duplicate ids cannot make nodes disappear.
  const done = new Set<ModelNode>()
  const inProgress = new Set<ModelNode>()
  const sorted: ModelNode[] = []

  const visit = (node: ModelNode): void => {
    if (done.has(node) || inProgress.has(node)) return
    inProgress.add(node)
    const parent = node.parentId === undefined ? undefined : byId.get(node.parentId)
    if (parent !== undefined) visit(parent)
    inProgress.delete(node)
    done.add(node)
    sorted.push(node)
  }

  for (const node of nodes) visit(node)
  return sorted
}

/**
 * Grouping is possible iff: `ids` is non-empty, every id exists, ids are unique, and all
 * elements have the same `parentId` (all top level, or all in the same group).
 */
export function canGroup(nodes: readonly ModelNode[], ids: readonly string[]): boolean {
  if (ids.length === 0 || new Set(ids).size !== ids.length) return false
  const byId = indexById(nodes)
  const members = ids.map((id) => byId.get(id))
  const first = members[0]
  if (first === undefined) return false
  return members.every((member) => member !== undefined && member.parentId === first.parentId)
}

/**
 * Wraps the given elements into a NEW group (kind 'group', name 'Neue Gruppe').
 * The group gets the common parent of the elements. Its rectangle is the bounding box of the
 * elements (in the common parent's coordinate space) enlarged by GROUP_PADDING on all sides and
 * additionally by GROUP_HEADER_HEIGHT on top. Members become children of the group and their
 * positions are converted to be relative to the group, so they do not move on screen.
 * Throws if !canGroup. Returns the new content and the id of the group.
 */
export function groupElements(
  content: GraphContent,
  ids: readonly string[],
  newId: IdGenerator = defaultIdGenerator,
): { content: GraphContent; groupId: string } {
  if (!canGroup(content.nodes, ids)) {
    throw new Error('Cannot group: selection is empty, unknown, duplicated or has different parents')
  }
  const selected = new Set(ids)
  const members = content.nodes.filter((node) => selected.has(node.id))
  const { parentId } = members[0]

  // Members share a parent, so their positions are already in the same coordinate space.
  const left = Math.min(...members.map((m) => m.position.x))
  const top = Math.min(...members.map((m) => m.position.y))
  const right = Math.max(...members.map((m) => m.position.x + getSize(m).width))
  const bottom = Math.max(...members.map((m) => m.position.y + getSize(m).height))

  const origin: Point = { x: left - GROUP_PADDING, y: top - GROUP_PADDING - GROUP_HEADER_HEIGHT }
  const group: ModelNode = {
    id: newId(),
    kind: 'group',
    position: origin,
    size: {
      width: right - left + 2 * GROUP_PADDING,
      height: bottom - top + 2 * GROUP_PADDING + GROUP_HEADER_HEIGHT,
    },
    metadata: normalizeMetadata([{ key: NAME_KEY, value: 'Neue Gruppe' }]),
  }
  if (parentId !== undefined) group.parentId = parentId

  // The group is inserted right before its first member, which keeps parents-first order intact.
  let groupInserted = false
  const nodes = content.nodes.flatMap((node) => {
    if (!selected.has(node.id)) return [node]
    const member = withParent(node, group.id, {
      x: node.position.x - origin.x,
      y: node.position.y - origin.y,
    })
    if (groupInserted) return [member]
    groupInserted = true
    return [group, member]
  })

  return { content: { ...content, nodes }, groupId: group.id }
}

/**
 * Dissolves a group: its children move to the group's parent (or top level), keeping their
 * on-screen position (relative position + group position). The group and all edges attached to
 * the group are removed. No-op if `groupId` is unknown or not a group.
 */
export function ungroup(content: GraphContent, groupId: string): GraphContent {
  const group = content.nodes.find((node) => node.id === groupId)
  if (group === undefined || group.kind !== 'group') return content

  const nodes = content.nodes
    .filter((node) => node.id !== groupId)
    .map((node) =>
      node.parentId === groupId
        ? withParent(node, group.parentId, {
            x: node.position.x + group.position.x,
            y: node.position.y + group.position.y,
          })
        : node,
    )
  const edges = content.edges.filter((edge) => edge.source !== groupId && edge.target !== groupId)
  return { ...content, nodes, edges }
}

/**
 * Moves an element into another group (or to top level when `newParentId` is undefined),
 * preserving its on-screen position. No-op if the parent does not change.
 * Throws if `newParentId` is not a group, equals `id`, or is a descendant of `id`.
 */
export function reparent(
  content: GraphContent,
  id: string,
  newParentId: string | undefined,
): GraphContent {
  const byId = indexById(content.nodes)
  const node = byId.get(id)
  if (node === undefined || node.parentId === newParentId) return content

  let parentOrigin: Point = { x: 0, y: 0 }
  if (newParentId !== undefined) {
    if (newParentId === id) throw new Error(`Cannot move "${id}" into itself`)
    if (byId.get(newParentId)?.kind !== 'group') {
      throw new Error(`Cannot move "${id}": "${newParentId}" is not a group`)
    }
    if (ancestorIdsIn(byId, newParentId).includes(id)) {
      throw new Error(`Cannot move "${id}" into its own descendant "${newParentId}"`)
    }
    parentOrigin = absolutePositionIn(byId, newParentId)
  }

  const absolute = absolutePositionIn(byId, id)
  const moved = withParent(node, newParentId, {
    x: absolute.x - parentOrigin.x,
    y: absolute.y - parentOrigin.y,
  })
  return { ...content, nodes: content.nodes.map((n) => (n.id === id ? moved : n)) }
}

/**
 * Would moving `id` under `newParentId` leave an edge between the moved subtree (the element and
 * all its descendants) and the new parent chain? Such an edge (group <-> own member) violates the
 * edge rules of `checkConnection`, and `reparent` does not touch edges, so callers check first.
 */
export function wouldBreakHierarchy(
  content: GraphContent,
  id: string,
  newParentId: string | undefined,
): boolean {
  if (newParentId === undefined) return false
  const byId = indexById(content.nodes)
  const subtree = new Set([id])
  // Parents precede children only after sorting; iterate until no more descendants are found.
  for (let grew = true; grew; ) {
    grew = false
    for (const n of content.nodes) {
      if (n.parentId !== undefined && subtree.has(n.parentId) && !subtree.has(n.id)) {
        subtree.add(n.id)
        grew = true
      }
    }
  }
  const chain = new Set([newParentId, ...ancestorIdsIn(byId, newParentId)])
  return content.edges.some(
    (e) =>
      (subtree.has(e.source) && chain.has(e.target)) ||
      (subtree.has(e.target) && chain.has(e.source)),
  )
}

/**
 * Deepest group whose rectangle contains `point` (canvas coordinates). With `excludedId`, that
 * element and its descendants are never returned (a dragged group must not be dropped into itself).
 * undefined if there is none.
 */
export function findGroupAtPoint(
  nodes: readonly ModelNode[],
  point: Point,
  excludedId?: string,
): string | undefined {
  const byId = indexById(nodes)
  let best: { id: string; depth: number } | undefined
  for (const candidate of nodes) {
    if (candidate.kind !== 'group' || candidate.id === excludedId) continue
    const ancestors = ancestorIdsIn(byId, candidate.id)
    if (excludedId !== undefined && ancestors.includes(excludedId)) continue

    const topLeft = absolutePositionIn(byId, candidate.id)
    const { width, height } = getSize(candidate)
    const contains =
      point.x >= topLeft.x &&
      point.x <= topLeft.x + width &&
      point.y >= topLeft.y &&
      point.y <= topLeft.y + height
    // `>=`: among equally deep (overlapping) groups the later one wins, it is rendered on top.
    if (contains && (best === undefined || ancestors.length >= best.depth)) {
      best = { id: candidate.id, depth: ancestors.length }
    }
  }
  return best?.id
}

/**
 * Deepest group (never `id` itself, never a descendant of `id`) whose rectangle contains the
 * centre of element `id` (canvas coordinates). undefined if there is none.
 */
export function findDropTargetGroup(nodes: readonly ModelNode[], id: string): string | undefined {
  const dragged = nodes.find((n) => n.id === id)
  if (dragged === undefined) return undefined

  const origin = getAbsolutePosition(nodes, id)
  const size = getSize(dragged)
  return findGroupAtPoint(nodes, { x: origin.x + size.width / 2, y: origin.y + size.height / 2 }, id)
}

/**
 * Deletes the given edges and elements. Deleting a plain node removes it and all attached edges.
 * Deleting a GROUP dissolves it (see `ungroup`): its children survive and move up one level;
 * only the group and its attached edges are removed. If a group and some of its children are both
 * listed, the listed children are deleted and the remaining ones survive.
 */
export function deleteElements(
  content: GraphContent,
  selection: { nodeIds: readonly string[]; edgeIds: readonly string[] },
): GraphContent {
  const selectedNodes = new Set(selection.nodeIds)
  const selectedEdges = new Set(selection.edgeIds)
  const removedPlain = new Set(
    content.nodes.filter((n) => n.kind === 'node' && selectedNodes.has(n.id)).map((n) => n.id),
  )
  const groupIds = content.nodes.filter((n) => n.kind === 'group' && selectedNodes.has(n.id)).map((n) => n.id)

  let result: GraphContent = {
    ...content,
    nodes: content.nodes.filter((node) => !removedPlain.has(node.id)),
    edges: content.edges.filter(
      (edge) =>
        !selectedEdges.has(edge.id) && !removedPlain.has(edge.source) && !removedPlain.has(edge.target),
    ),
  }
  // Dissolving in any order gives the same result: positions are converted level by level.
  for (const groupId of groupIds) result = ungroup(result, groupId)

  const unchanged =
    result.nodes.length === content.nodes.length && result.edges.length === content.edges.length
  return unchanged ? content : result
}

/**
 * Is `source` -> `target` a valid new edge?
 *  - 'unknown-node': source or target does not exist
 *  - 'self': source === target
 *  - 'duplicate': an edge with the same source AND target exists (reverse direction is allowed)
 *  - 'hierarchy': one of them is an ancestor of the other (group -> own member)
 */
export function checkConnection(
  content: GraphContent,
  source: string,
  target: string,
): ConnectionCheck {
  const byId = indexById(content.nodes)
  if (!byId.has(source) || !byId.has(target)) return { ok: false, reason: 'unknown-node' }
  if (source === target) return { ok: false, reason: 'self' }
  if (content.edges.some((edge) => edge.source === source && edge.target === target)) {
    return { ok: false, reason: 'duplicate' }
  }
  if (ancestorIdsIn(byId, source).includes(target) || ancestorIdsIn(byId, target).includes(source)) {
    return { ok: false, reason: 'hierarchy' }
  }
  return { ok: true }
}

/** Adds a directed edge if `checkConnection` is ok, otherwise returns `content` unchanged (same reference). */
export function addEdge(
  content: GraphContent,
  source: string,
  target: string,
  newId: IdGenerator = defaultIdGenerator,
  handles: EdgeHandles = {},
): GraphContent {
  if (!checkConnection(content, source, target).ok) return content
  const edge: ModelEdge = { id: newId(), source, target }
  if (handles.sourceHandle) edge.sourceHandle = handles.sourceHandle
  if (handles.targetHandle) edge.targetHandle = handles.targetHandle
  return { ...content, edges: [...content.edges, edge] }
}

/**
 * Connectors that face each other, for connections made without dragging between two specific
 * connectors (toolbar "Verbinden"): horizontal if the centres differ more in x than in y.
 */
export function pickSides(
  nodes: readonly ModelNode[],
  sourceId: string,
  targetId: string,
): Required<EdgeHandles> {
  const centre = (id: string): Point => {
    const node = nodes.find((n) => n.id === id)
    const { x, y } = getAbsolutePosition(nodes, id)
    const { width, height } = node ? getSize(node) : NODE_SIZE
    return { x: x + width / 2, y: y + height / 2 }
  }
  const from = centre(sourceId)
  const to = centre(targetId)
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 'right', targetHandle: 'left' }
      : { sourceHandle: 'left', targetHandle: 'right' }
  }
  return dy >= 0
    ? { sourceHandle: 'bottom', targetHandle: 'top' }
    : { sourceHandle: 'top', targetHandle: 'bottom' }
}

/** Replaces the metadata of one element with `normalizeMetadata(entries)`. Unknown id -> unchanged. */
export function updateMetadata(
  content: GraphContent,
  id: string,
  entries: readonly MetadataEntry[],
): GraphContent {
  return updateNode(content, id, (node) => ({ ...node, metadata: normalizeMetadata(entries) }))
}

/**
 * Sets the status of an object (not of a group, which has none) the way the sidebar does: the
 * entry is written as `status` and the metadata normalized. Any status other than `blockiert`
 * also removes the block reason. Already set / unknown id / group -> unchanged.
 */
export function setStatus(content: GraphContent, id: string, status: Status): GraphContent {
  const target = content.nodes.find((n) => n.id === id)
  if (target === undefined || target.kind !== 'node') return content
  const current = findStatusEntry(target.metadata)
  const reasonStays = status === 'blockiert' || findBlockReasonEntry(target.metadata) === undefined
  if (current !== undefined && current.key === STATUS_KEY && current.value === status && reasonStays) return content
  return updateMetadata(content, id, withStatusEntry(target.metadata, status))
}

/**
 * Sets the reason of a blocked object (trimmed, canonical key right after `status`; blank removes
 * it). Only objects with the status `blockiert` have a reason. No actual change / unknown id /
 * group / not blocked -> unchanged.
 */
export function setBlockReason(content: GraphContent, id: string, reason: string): GraphContent {
  const target = content.nodes.find((n) => n.id === id)
  if (target === undefined || target.kind !== 'node' || getStatus(target.metadata) !== 'blockiert') return content
  const text = reason.trim()
  const current = findBlockReasonEntry(target.metadata)
  if (current === undefined ? text === '' : current.key === BLOCK_REASON_KEY && current.value === text) return content
  return updateMetadata(content, id, withBlockReasonEntry(target.metadata, text))
}

/** Sets the (relative) position of one element. Unknown id -> unchanged. */
export function moveNode(content: GraphContent, id: string, position: Point): GraphContent {
  return updateNode(content, id, (node) => ({ ...node, position: { x: position.x, y: position.y } }))
}

/** Sets the size of one element (clamped to at least GROUP_MIN_SIZE for groups, 1x1 otherwise). Unknown id -> unchanged. */
export function resizeNode(content: GraphContent, id: string, size: Size): GraphContent {
  return updateNode(content, id, (node) => {
    const min = node.kind === 'group' ? GROUP_MIN_SIZE : { width: 1, height: 1 }
    return {
      ...node,
      size: { width: clampAtLeast(size.width, min.width), height: clampAtLeast(size.height, min.height) },
    }
  })
}

/** `value`, but at least `min`; NaN/Infinity fall back to `min`. */
function clampAtLeast(value: number, min: number): number {
  return Number.isFinite(value) ? Math.max(value, min) : min
}

/**
 * Sets the caption of an edge (trimmed; blank removes it). Unknown edge or no actual change ->
 * the same `content` reference.
 */
export function updateEdgeLabel(content: GraphContent, id: string, label: string): GraphContent {
  const edge = content.edges.find((e) => e.id === id)
  const text = label.trim()
  if (edge === undefined || (edge.label ?? '') === text) return content
  const { label: _old, ...rest } = edge
  const updated: ModelEdge = text === '' ? rest : { ...rest, label: text }
  return { ...content, edges: content.edges.map((e) => (e.id === id ? updated : e)) }
}
