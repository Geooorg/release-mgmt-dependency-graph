import { normalizeQuery } from './search'
import { resolveType } from './typing'
import { TYPE_KEY } from './types'
import type { MetadataEntry, ModelNode, TypeDef } from './types'

export interface FilterHit {
  id: string
  /** The stored entry that matched, as written (shown in the result list). */
  key: string
  value: string
}

/**
 * Objects and groups (not notes) with a metadata entry whose key and value both equal the given ones
 * completely (trimmed, case-insensitive, no substring match), in model order. An empty key finds nothing.
 * The entry `type` is compared by the name of its type (a known one), so the filter matches what the user sees.
 */
export function findByMetadata(
  nodes: readonly ModelNode[],
  key: string,
  value: string,
  types: readonly TypeDef[] = [],
): FilterHit[] {
  const wantedKey = normalizeQuery(key)
  if (wantedKey === '') return []
  const wantedValue = normalizeQuery(value)
  const hits: FilterHit[] = []
  for (const node of nodes) {
    if (node.kind === 'note') continue
    const shown = (e: MetadataEntry): string => {
      if (e.key !== TYPE_KEY) return e.value
      const resolved = resolveType(node.metadata, types)
      return resolved.state === 'known' ? resolved.def.name : e.value
    }
    const entry = node.metadata.find((e) => normalizeQuery(e.key) === wantedKey && normalizeQuery(shown(e)) === wantedValue)
    if (entry) hits.push({ id: node.id, key: entry.key, value: shown(entry) })
  }
  return hits
}
