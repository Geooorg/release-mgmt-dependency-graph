import { describe, expect, it } from 'vitest'
import { box, content, edge, group } from '../test/fixtures'
import { contentFingerprint } from './fingerprint'

const base = content([box('a', 0, 0), box('b', 200, 0)], [edge('e', 'a', 'b')])

describe('contentFingerprint', () => {
  it('is deterministic and a 16-digit hex string', () => {
    expect(contentFingerprint(base)).toBe(contentFingerprint(base))
    expect(contentFingerprint(base)).toMatch(/^[0-9a-f]{16}$/)
  })

  it('is equal for equal content, regardless of object identity', () => {
    const copy = content(base.nodes.map((n) => ({ ...n })), base.edges.map((e) => ({ ...e })))
    expect(contentFingerprint(copy)).toBe(contentFingerprint(base))
  })

  it('does not depend on the order parents and children are stored in', () => {
    const nodes = [box('c', 10, 10, 'g'), group('g', 0, 0, 300, 200)]
    expect(contentFingerprint(content(nodes))).toBe(contentFingerprint(content([...nodes].reverse())))
  })

  it('changes with every kind of model change', () => {
    const fp = contentFingerprint(base)
    const moved = content([box('a', 1, 0), base.nodes[1]], base.edges)
    const renamed = { ...base, projectName: 'Anders' }
    const noEdge = content(base.nodes)
    const labelled = content(base.nodes, [{ ...base.edges[0], metadata: [{ key: 'name', value: 'x' }] }])
    const metadata = content(
      [{ ...base.nodes[0], metadata: [...base.nodes[0].metadata, { key: 'status', value: 'fertig' }] }, base.nodes[1]],
      base.edges,
    )
    for (const changed of [moved, renamed, noEdge, labelled, metadata]) {
      expect(contentFingerprint(changed)).not.toBe(fp)
    }
  })

  it('handles non-ASCII text and an empty model', () => {
    const umlaut = content([{ ...box('a', 0, 0), metadata: [{ key: 'name', value: 'Größe' }] }])
    expect(contentFingerprint(umlaut)).not.toBe(contentFingerprint(content([box('a', 0, 0)])))
    expect(contentFingerprint(content([]))).toMatch(/^[0-9a-f]{16}$/)
  })
})
