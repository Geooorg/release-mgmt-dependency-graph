import type { GraphContent, IdGenerator, ModelEdge, ModelNode } from '../model/types'

/** Deterministic ids: 'id-1', 'id-2', … */
export function counterIds(prefix = 'id'): IdGenerator {
  let n = 0
  return () => `${prefix}-${++n}`
}

export function box(id: string, x: number, y: number, parentId?: string): ModelNode {
  return { id, kind: 'node', parentId, position: { x, y }, metadata: [{ key: 'name', value: id }] }
}

export function group(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  parentId?: string,
): ModelNode {
  return {
    id,
    kind: 'group',
    parentId,
    position: { x, y },
    size: { width, height },
    metadata: [{ key: 'name', value: id }],
  }
}

/** The element with an added `status` metadata entry. */
export function withStatus(node: ModelNode, status: string): ModelNode {
  return { ...node, metadata: [...node.metadata, { key: 'status', value: status }] }
}

export function edge(id: string, source: string, target: string): ModelEdge {
  return { id, source, target }
}

export function content(nodes: ModelNode[], edges: ModelEdge[] = []): GraphContent {
  return { nodes, edges }
}

/** In-memory `Storage` replacement. */
export function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial))
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  }
}
