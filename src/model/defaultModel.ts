import { addEdge, createNode, defaultIdGenerator } from './graph'
import { normalizeMetadata } from './metadata'
import { NAME_KEY, NODE_SIZE } from './types'
import type { GraphContent, IdGenerator, ModelNode } from './types'

const START = { x: 120, y: 120 }
const GAP = 120

function namedNode(name: string, x: number, newId: IdGenerator): ModelNode {
  return {
    ...createNode({ x, y: START.y }, newId),
    metadata: normalizeMetadata([{ key: NAME_KEY, value: name }]),
  }
}

/** Initial graph for first-time users: two connected plain nodes "Projekt A" -> "Projekt B", side by side. */
export function createDefaultContent(newId: IdGenerator = defaultIdGenerator): GraphContent {
  // Ids are drawn in a fixed order: node A, node B, edge.
  const a = namedNode('Projekt A', START.x, newId)
  const b = namedNode('Projekt B', START.x + NODE_SIZE.width + GAP, newId)
  return addEdge({ nodes: [a, b], edges: [] }, a.id, b.id, newId)
}
