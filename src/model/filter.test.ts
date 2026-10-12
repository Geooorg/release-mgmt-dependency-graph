import { describe, expect, it } from 'vitest'
import { box, group, note } from '../test/fixtures'
import { findByMetadata } from './filter'
import type { MetadataEntry, ModelNode } from './types'

const withMeta = (base: ModelNode, name: string, ...entries: [string, string][]): ModelNode => ({
  ...base,
  metadata: [{ key: 'name', value: name }, ...entries.map(([key, value]): MetadataEntry => ({ key, value }))],
})

describe('findByMetadata', () => {
  const nodes = [
    withMeta(box('a', 0, 0), 'A', ['team', 'Backend']),
    withMeta(box('b', 0, 0), 'B', ['team', 'Backend Core']),
    withMeta(group('g', 0, 0, 100, 100), 'G', ['Team', ' backend ']),
    withMeta(note('n', 0, 0), 'N', ['team', 'Backend']),
  ]

  it('matches key and value completely, ignoring case and surrounding spaces, in model order', () => {
    expect(findByMetadata(nodes, ' TEAM ', 'backend').map((hit) => hit.id)).toEqual(['a', 'g'])
  })

  it('does not match parts of a value or key', () => {
    expect(findByMetadata(nodes, 'team', 'back')).toEqual([])
    expect(findByMetadata(nodes, 'tea', 'Backend')).toEqual([])
  })

  it('skips notes', () => {
    expect(findByMetadata(nodes, 'team', 'Backend').map((hit) => hit.id)).not.toContain('n')
  })

  it('finds nothing without a key; an empty value matches entries with an empty value', () => {
    expect(findByMetadata(nodes, '  ', 'Backend')).toEqual([])
    expect(findByMetadata([withMeta(box('e', 0, 0), 'E', ['tag', ''])], 'tag', '')).toEqual([
      { id: 'e', key: 'tag', value: '' },
    ])
  })

  it('reports the entry as stored', () => {
    expect(findByMetadata(nodes, 'team', 'backend')[1]).toEqual({ id: 'g', key: 'Team', value: ' backend ' })
  })

  it('can match the name entry', () => {
    expect(findByMetadata(nodes, 'name', 'b')).toEqual([{ id: 'b', key: 'name', value: 'B' }])
  })
})
