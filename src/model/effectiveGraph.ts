import type { GraphContent } from './types'

/**
 * The explicit edge list resolved to object level, as a dependency graph. An arrow `A -> B` means
 * "A comes before B" (B depends on A), so the graph runs against the arrows: from a dependent to its
 * prerequisites. An arrow to or from a group applies to every (nested) object inside that group.
 */
export interface EffectiveGraph {
  /** Objects, plus groups without any object inside (they stand for themselves), in node order. */
  vertices: string[]
  /** Every vertex maps to its direct prerequisites (the sources of the arrows into it), in vertex order. */
  prerequisites: ReadonlyMap<string, readonly string[]>
  /** Ids of the explicit edges that make `dependent` depend on `prerequisite`; empty if there is none. */
  edgeIdsOf: (dependent: string, prerequisite: string) => readonly string[]
  /** Vertices an element stands for: itself, or all nested objects of a group (the group itself if empty). */
  leavesOf: (id: string) => readonly string[]
}

/** Objects an element stands for: itself, or all nested objects of a group (itself if it has none). */
function collectLeaves(content: GraphContent): Map<string, string[]> {
  const byId = new Map(content.nodes.map((n) => [n.id, n]))
  const inside = new Map<string, string[]>()
  for (const node of content.nodes) {
    if (node.kind !== 'node') continue
    const seen = new Set<string>([node.id])
    // The guard keeps a corrupt parent loop from spinning forever.
    for (let parent = node.parentId; parent !== undefined && !seen.has(parent); parent = byId.get(parent)?.parentId) {
      seen.add(parent)
      const list = inside.get(parent)
      if (list) list.push(node.id)
      else inside.set(parent, [node.id])
    }
  }
  const leaves = new Map<string, string[]>()
  for (const node of content.nodes) {
    // A note has no connections and takes no part in any dependency.
    if (node.kind === 'note') leaves.set(node.id, [])
    else leaves.set(node.id, node.kind === 'node' ? [node.id] : (inside.get(node.id) ?? [node.id]))
  }
  return leaves
}

export function buildEffectiveGraph(content: GraphContent): EffectiveGraph {
  const leaves = collectLeaves(content)
  const vertices = content.nodes
    .filter((n) => n.kind === 'node' || (n.kind === 'group' && leaves.get(n.id)?.[0] === n.id))
    .map((n) => n.id)
  const order = new Map(vertices.map((id, index) => [id, index]))

  const pairs = new Map<string, Map<string, string[]>>(vertices.map((id) => [id, new Map()]))
  for (const edge of content.edges) {
    for (const dependent of leaves.get(edge.target) ?? []) {
      for (const prerequisite of leaves.get(edge.source) ?? []) {
        if (dependent === prerequisite) continue
        const found = pairs.get(dependent)
        if (!found) continue
        const ids = found.get(prerequisite)
        if (ids) ids.push(edge.id)
        else found.set(prerequisite, [edge.id])
      }
    }
  }

  const prerequisites = new Map<string, string[]>()
  for (const [dependent, found] of pairs) {
    prerequisites.set(
      dependent,
      [...found.keys()].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)),
    )
  }
  return {
    vertices,
    prerequisites,
    edgeIdsOf: (dependent, prerequisite) => pairs.get(dependent)?.get(prerequisite) ?? [],
    leavesOf: (id) => leaves.get(id) ?? [],
  }
}
