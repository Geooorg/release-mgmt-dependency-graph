import { defaultIdGenerator, getAbsolutePosition, sortParentsFirst } from './graph'
import { growGroupsToFit } from './groupGrowth'
import type { GraphContent, IdGenerator, ModelNode, Point } from './types'

/** A copied element together with where it was on the canvas (needed when its group is gone at paste time). */
export interface ClipboardEntry {
  node: ModelNode
  absolute: Point
}

/** Copied objects and groups, parents first. Connections are never part of it. */
export interface ElementClipboard {
  entries: ClipboardEntry[]
}

/**
 * Copies the listed objects and groups, plus everything inside a listed group (a group without its
 * content would be an empty shell). Connections are not copied. undefined when nothing was found.
 */
export function copyElements(content: GraphContent, ids: readonly string[]): ElementClipboard | undefined {
  const wanted = new Set(ids.filter((id) => content.nodes.some((n) => n.id === id)))
  // Descendants of copied groups; parents come first once sorted, so one pass is enough.
  for (const node of sortParentsFirst(content.nodes)) {
    if (node.parentId !== undefined && wanted.has(node.parentId)) wanted.add(node.id)
  }
  if (wanted.size === 0) return undefined
  const entries = sortParentsFirst(content.nodes.filter((n) => wanted.has(n.id))).map((node) => ({
    node,
    absolute: getAbsolutePosition(content.nodes, node.id),
  }))
  return { entries }
}

export interface PasteResult {
  content: GraphContent
  /** The new top-level copies (what gets selected); their members are inside them. */
  rootIds: string[]
  /** All new elements. */
  count: number
}

/**
 * Inserts copies with fresh ids, moved by `offset`. The copies keep their arrangement and group
 * membership among themselves; a copy whose group still exists goes into that group again
 * (the group grows if needed), otherwise to the top level at its old canvas position. Existing
 * connections are untouched and no new ones are made.
 */
export function pasteElements(
  content: GraphContent,
  clipboard: ElementClipboard,
  offset: Point,
  newId: IdGenerator = defaultIdGenerator,
): PasteResult {
  const copied = new Set(clipboard.entries.map((entry) => entry.node.id))
  const idOf = new Map(clipboard.entries.map((entry) => [entry.node.id, newId()]))
  const groups = new Set(content.nodes.filter((n) => n.kind === 'group').map((n) => n.id))

  const rootIds: string[] = []
  const created = clipboard.entries.map(({ node, absolute }): ModelNode => {
    const id = idOf.get(node.id)!
    const isRoot = node.parentId === undefined || !copied.has(node.parentId)
    const metadata = node.metadata.map((entry) => ({ key: entry.key, value: entry.value }))
    const size = node.size && { width: node.size.width, height: node.size.height }
    if (!isRoot) {
      const position = { x: node.position.x, y: node.position.y }
      return { id, kind: node.kind, parentId: idOf.get(node.parentId!), position, ...(size && { size }), metadata }
    }
    rootIds.push(id)
    const parentId = node.parentId !== undefined && groups.has(node.parentId) ? node.parentId : undefined
    const base = parentId === undefined ? absolute : node.position
    const position = { x: base.x + offset.x, y: base.y + offset.y }
    return { id, kind: node.kind, ...(parentId !== undefined && { parentId }), position, ...(size && { size }), metadata }
  })

  let next: GraphContent = { ...content, nodes: [...content.nodes, ...created] }
  for (const id of rootIds) next = growGroupsToFit(next, id)
  return { content: next, rootIds, count: created.length }
}
