import type { GraphContent } from './types'

/** `outgoing`: what the selection depends on (along the edges); `incoming`: what depends on it; `both`: whole connected part. */
export type DependencyDirection = 'outgoing' | 'incoming' | 'both'

/** UI state: highlight off, or the traversal direction. */
export type DependencyMode = 'off' | DependencyDirection

export interface DependencyResult {
  /** Every edge traversed on the way. */
  edgeIds: Set<string>
  /** Every element reached, excluding the start elements themselves. */
  nodeIds: Set<string>
}

/**
 * Dependency graph of the start elements: all edges and elements reachable transitively from them.
 * Starting at a group also starts at all its (nested) members. Reaching a group does not expand it.
 * Terminates on cycles. Pure; unknown start ids are ignored.
 */
export function findDependencies(
  content: GraphContent,
  startIds: readonly string[],
  direction: DependencyDirection,
): DependencyResult {
  const known = new Set(content.nodes.map((n) => n.id))
  const starts = new Set(startIds.filter((id) => known.has(id)))
  // Members of start groups (any depth) start too.
  for (let grew = true; grew; ) {
    grew = false
    for (const node of content.nodes) {
      if (node.parentId !== undefined && starts.has(node.parentId) && !starts.has(node.id)) {
        starts.add(node.id)
        grew = true
      }
    }
  }

  const edgeIds = new Set<string>()
  const nodeIds = new Set<string>()
  const visited = new Set(starts)
  const queue = [...starts]
  while (queue.length > 0) {
    const current = queue.shift() as string
    for (const edge of content.edges) {
      const forward = direction !== 'incoming' && edge.source === current
      const backward = direction !== 'outgoing' && edge.target === current
      if (!forward && !backward) continue
      edgeIds.add(edge.id)
      const next = forward ? edge.target : edge.source
      if (!starts.has(next)) nodeIds.add(next)
      if (!visited.has(next)) {
        visited.add(next)
        queue.push(next)
      }
    }
  }
  return { edgeIds, nodeIds }
}
