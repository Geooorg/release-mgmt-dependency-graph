import { describe, expect, it } from 'vitest'
import { createDefaultContent } from './defaultModel'
import { checkConnection } from './graph'
import { getName } from './metadata'
import { parseModel, toModel } from './serialize'
import type { IdGenerator } from './types'
import { NODE_SIZE } from './types'

function counter(prefix = 'id'): IdGenerator {
  let n = 0
  return () => `${prefix}-${++n}`
}

describe('createDefaultContent', () => {
  it('creates two plain nodes "Projekt A" and "Projekt B" and one edge A -> B', () => {
    const { nodes, edges } = createDefaultContent(counter())
    expect(nodes).toHaveLength(2)
    expect(nodes.map((n) => n.kind)).toEqual(['node', 'node'])
    expect(nodes.map((n) => getName(n.metadata))).toEqual(['Projekt A', 'Projekt B'])
    expect(edges).toHaveLength(1)
    expect(edges[0].source).toBe(nodes[0].id)
    expect(edges[0].target).toBe(nodes[1].id)
  })

  it('draws ids from the injected generator in the order node A, node B, edge', () => {
    const { nodes, edges } = createDefaultContent(counter('x'))
    expect(nodes.map((n) => n.id)).toEqual(['x-1', 'x-2'])
    expect(edges.map((e) => e.id)).toEqual(['x-3'])
  })

  it('places the nodes side by side without overlap', () => {
    const [a, b] = createDefaultContent(counter()).nodes
    expect(a.position.y).toBe(b.position.y)
    expect(b.position.x).toBeGreaterThan(a.position.x + NODE_SIZE.width)
  })

  it('creates top-level nodes with normalized metadata', () => {
    for (const n of createDefaultContent(counter()).nodes) {
      expect('parentId' in n).toBe(false)
      expect(n.metadata).toEqual([{ key: 'name', value: getName(n.metadata) }])
    }
  })

  it('is deterministic for a deterministic generator', () => {
    expect(createDefaultContent(counter())).toEqual(createDefaultContent(counter()))
  })

  it('works with the default id generator and yields distinct ids', () => {
    const { nodes, edges } = createDefaultContent()
    const all = [...nodes.map((n) => n.id), ...edges.map((e) => e.id)]
    expect(new Set(all).size).toBe(3)
  })

  it('produces a graph that is valid for the parser and for the edge rules', () => {
    const content = createDefaultContent(counter())
    expect(parseModel(toModel(content)).ok).toBe(true)
    const [a, b] = content.nodes
    expect(checkConnection(content, a.id, b.id)).toEqual({ ok: false, reason: 'duplicate' })
    expect(checkConnection(content, b.id, a.id)).toEqual({ ok: true })
  })
})
