import { buildEffectiveGraph } from './effectiveGraph'
import type { GraphContent } from './types'

/**
 * `prerequisites`: what the selection depends on (against the arrows); `dependents`: what depends on it
 * (along the arrows); `closure`: the transitive closure, both of them. Each side keeps its direction, so a
 * sibling (another prerequisite of a dependent) is not part of the closure.
 */
export type DependencyDirection = 'prerequisites' | 'dependents' | 'closure'

/** UI state: highlight off, or the traversal direction. */
export type DependencyMode = 'off' | DependencyDirection

export interface DependencyResult {
  /** Explicit edges that produce a step of the traversal. */
  edgeIds: Set<string>
  /** Every element reached, excluding the start elements themselves. */
  nodeIds: Set<string>
  /** Objects reached against the arrows (not the start), nearest first, then in node order. */
  prerequisiteIds: string[]
  /** Objects reached along the arrows (not the start), nearest first, then in node order. */
  dependentIds: string[]
}

/**
 * Dependency graph of the start elements: everything reachable transitively from them on object
 * level in the chosen direction (see `buildEffectiveGraph`, so an edge to a group counts for all its
 * members); for `closure` each side is walked in its own direction. Finished objects are walked through. Starting
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

  const dependents = new Map<string, string[]>(graph.vertices.map((id) => [id, []]))
  for (const [dependent, prerequisites] of graph.prerequisites) {
    for (const prerequisite of prerequisites) dependents.get(prerequisite)?.push(dependent)
  }

  const edgeIds = new Set<string>()
  const nodeIds = new Set<string>()
  const order = new Map(content.nodes.map((n, i) => [n.id, i]))
  /** Breadth-first in one direction only; returns the reached objects, nearest first. */
  const walk = (backwards: boolean): string[] => {
    const distance = new Map<string, number>(Array.from(starts, (id) => [id, 0]))
    const queue = [...starts]
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head]
      const neighbours = (backwards ? graph.prerequisites.get(current) : dependents.get(current)) ?? []
      for (const next of neighbours) {
        const ids = backwards ? graph.edgeIdsOf(current, next) : graph.edgeIdsOf(next, current)
        for (const id of ids) edgeIds.add(id)
        if (!startElements.has(next)) nodeIds.add(next)
        if (!distance.has(next)) {
          distance.set(next, (distance.get(current) ?? 0) + 1)
          queue.push(next)
        }
      }
    }
    return [...distance.keys()]
      .filter((id) => !startElements.has(id) && byId.get(id)?.kind === 'node')
      .sort((a, b) => (distance.get(a) ?? 0) - (distance.get(b) ?? 0) || (order.get(a) ?? 0) - (order.get(b) ?? 0))
  }
  const prerequisiteIds = direction === 'dependents' ? [] : walk(true)
  const dependentIds = direction === 'prerequisites' ? [] : walk(false)

  for (const edge of content.edges) {
    if (!edgeIds.has(edge.id)) continue
    for (const id of [edge.source, edge.target]) {
      if (byId.get(id)?.kind === 'group' && !startElements.has(id) && !containers.has(id)) nodeIds.add(id)
    }
  }
  return { edgeIds, nodeIds, prerequisiteIds, dependentIds }
}
