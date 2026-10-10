import { buildEffectiveGraph } from './effectiveGraph'
import type { GraphContent } from './types'

/** `outgoing`: what the selection depends on (its prerequisites); `incoming`: what depends on it; `both`: whole connected part. */
export type DependencyDirection = 'outgoing' | 'incoming' | 'both'

/** UI state: highlight off, or the traversal direction. */
export type DependencyMode = 'off' | DependencyDirection

export interface DependencyResult {
  /** Explicit edges that produce a step of the traversal. */
  edgeIds: Set<string>
  /** Every element reached, excluding the start elements themselves. */
  nodeIds: Set<string>
}

/**
 * Dependency graph of the start elements: everything reachable transitively from them on object
 * level (see `buildEffectiveGraph`, so an edge to a group counts for all its members). Starting
 * at a group starts at all its (nested) members. Besides the reached objects, a group is reported
 * when an edge of the traversal ends at it (unless it contains a start). Terminates on cycles.
 * Pure; unknown start ids are ignored.
 */
export function findDependencies(
  content: GraphContent,
  startIds: readonly string[],
  direction: DependencyDirection,
): DependencyResult {
  const graph = buildEffectiveGraph(content)
  const byId = new Map(content.nodes.map((n) => [n.id, n]))
  /** Groups around an element, nearest first; a corrupt parent loop ends the walk. */
  const ancestors = (id: string): string[] => {
    const result: string[] = []
    const seen = new Set([id])
    for (let at = byId.get(id)?.parentId; at !== undefined && !seen.has(at); at = byId.get(at)?.parentId) {
      seen.add(at)
      result.push(at)
    }
    return result
  }

  const selected = new Set(startIds.filter((id) => byId.has(id)))
  const starts = new Set<string>()
  for (const id of selected) for (const leaf of graph.leavesOf(id)) starts.add(leaf)

  // "The start" = the selected elements and everything inside selected groups. The groups around
  // a start object are not reported either: their edges are the start's own edges.
  const startElements = new Set<string>([...selected, ...starts])
  for (const node of content.nodes) {
    if (ancestors(node.id).some((a) => selected.has(a))) startElements.add(node.id)
  }
  const containers = new Set([...starts].flatMap(ancestors))

  const predecessors = new Map<string, string[]>(graph.vertices.map((id) => [id, []]))
  for (const [from, targets] of graph.successors) {
    for (const to of targets) predecessors.get(to)?.push(from)
  }

  const edgeIds = new Set<string>()
  const nodeIds = new Set<string>()
  const visited = new Set(starts)
  const queue = [...starts]
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]
    const steps: { next: string; from: string; to: string }[] = []
    if (direction !== 'incoming') {
      for (const next of graph.successors.get(current) ?? []) steps.push({ next, from: current, to: next })
    }
    if (direction !== 'outgoing') {
      for (const next of predecessors.get(current) ?? []) steps.push({ next, from: next, to: current })
    }
    for (const { next, from, to } of steps) {
      for (const id of graph.edgeIdsOf(from, to)) edgeIds.add(id)
      if (!startElements.has(next)) nodeIds.add(next)
      if (!visited.has(next)) {
        visited.add(next)
        queue.push(next)
      }
    }
  }

  for (const edge of content.edges) {
    if (!edgeIds.has(edge.id)) continue
    for (const id of [edge.source, edge.target]) {
      if (byId.get(id)?.kind === 'group' && !startElements.has(id) && !containers.has(id)) nodeIds.add(id)
    }
  }
  return { edgeIds, nodeIds }
}
