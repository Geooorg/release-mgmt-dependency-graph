import type { GraphContent, IdGenerator, ModelEdge, ModelNode } from '../model/types'

/** Deterministic ids: 'id-1', 'id-2', … */
export function counterIds(prefix = 'id'): IdGenerator {
  let n = 0
  return () => `${prefix}-${++n}`
}

export function box(id: string, x: number, y: number, parentId?: string): ModelNode {
  return { id, kind: 'node', parentId, position: { x, y }, metadata: [{ key: 'name', value: id }] }
}

/** A sticky note with the given text (its `name` entry). */
export function note(id: string, x: number, y: number, text = '', parentId?: string): ModelNode {
  return { id, kind: 'note', parentId, position: { x, y }, metadata: [{ key: 'name', value: text }] }
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

/** An edge marked as a soft (optional) dependency. */
export function softEdge(id: string, source: string, target: string): ModelEdge {
  return { id, source, target, metadata: [{ key: 'name', value: '' }, { key: 'optional', value: 'ja' }] }
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
