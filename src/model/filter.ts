import { normalizeQuery } from './search'
import type { ModelNode } from './types'

export interface FilterHit {
  id: string
  /** The stored entry that matched, as written (shown in the result list). */
  key: string
  value: string
}

/**
 * Objects and groups (not notes) with a metadata entry whose key and value both equal the given ones
 * completely (trimmed, case-insensitive, no substring match), in model order. An empty key finds nothing.
 */
export function findByMetadata(nodes: readonly ModelNode[], key: string, value: string): FilterHit[] {
  const wantedKey = normalizeQuery(key)
  if (wantedKey === '') return []
  const wantedValue = normalizeQuery(value)
  const hits: FilterHit[] = []
  for (const node of nodes) {
    if (node.kind === 'note') continue
    const entry = node.metadata.find(
      (e) => normalizeQuery(e.key) === wantedKey && normalizeQuery(e.value) === wantedValue,
    )
    if (entry) hits.push({ id: node.id, key: entry.key, value: entry.value })
  }
  return hits
}
