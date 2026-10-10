import { buildEffectiveGraph, type EffectiveGraph } from './effectiveGraph'
import type { GraphContent } from './types'

export interface CycleResult {
  /** One entry per cycle (strongly connected component of 2+ objects): its element ids in node order. */
  cycles: string[][]
  /** All elements that are part of a cycle. */
  nodeIds: Set<string>
  /** All explicit edges that contribute to a dependency inside a cycle. */
  edgeIds: Set<string>
}

/** Iterative Tarjan: component index per vertex index (no recursion, safe for large graphs). */
function stronglyConnectedComponents(successors: readonly (readonly number[])[]): number[] {
  const count = successors.length
  const index = new Array<number>(count).fill(-1)
  const low = new Array<number>(count).fill(0)
  const onStack = new Array<boolean>(count).fill(false)
  const component = new Array<number>(count).fill(-1)
  const stack: number[] = []
  let counter = 0
  let components = 0

  for (let root = 0; root < count; root++) {
    if (index[root] !== -1) continue
    const work: { vertex: number; next: number }[] = [{ vertex: root, next: 0 }]
    index[root] = low[root] = counter++
    stack.push(root)
    onStack[root] = true

    while (work.length > 0) {
      const frame = work[work.length - 1]
      const v = frame.vertex
      if (frame.next < successors[v].length) {
        const w = successors[v][frame.next++]
        if (index[w] === -1) {
          index[w] = low[w] = counter++
          stack.push(w)
          onStack[w] = true
          work.push({ vertex: w, next: 0 })
        } else if (onStack[w]) {
          low[v] = Math.min(low[v], index[w])
        }
        continue
      }
      work.pop()
      if (work.length > 0) {
        const parent = work[work.length - 1].vertex
        low[parent] = Math.min(low[parent], low[v])
      }
      if (low[v] === index[v]) {
        let w: number
        do {
          w = stack.pop() as number
          onStack[w] = false
          component[w] = components
        } while (w !== v)
        components++
      }
    }
  }
  return component
}

/**
 * Dependency cycles of the graph, evaluated on object level (see `buildEffectiveGraph`): every
 * strongly connected component of two or more objects is a cycle. Pure and deterministic:
 * members follow the node order, cycles are ordered by their first member.
 */
export function findCycles(
  content: GraphContent,
  graph: EffectiveGraph = buildEffectiveGraph(content),
): CycleResult {
  const { vertices } = graph
  const position = new Map(vertices.map((id, i) => [id, i]))
  const successors = vertices.map((id) =>
    (graph.successors.get(id) ?? []).map((to) => position.get(to) as number),
  )
  const component = stronglyConnectedComponents(successors)

  const members = new Map<number, number[]>()
  vertices.forEach((_, i) => {
    const list = members.get(component[i])
    if (list) list.push(i)
    else members.set(component[i], [i])
  })

  const cycles: string[][] = []
  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()
  for (const list of [...members.values()].filter((m) => m.length > 1).sort((a, b) => a[0] - b[0])) {
    cycles.push(list.map((i) => vertices[i]))
    for (const from of list) {
      nodeIds.add(vertices[from])
      for (const to of successors[from]) {
        if (component[to] !== component[from]) continue
        for (const id of graph.edgeIdsOf(vertices[from], vertices[to])) edgeIds.add(id)
      }
    }
  }
  return { cycles, nodeIds, edgeIds }
}
