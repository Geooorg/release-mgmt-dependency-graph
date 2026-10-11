import { NAME_KEY } from './types'
import type { MetadataEntry } from './types'

/**
 * A soft (optional) dependency is an edge whose metadata holds `optional: ja`. Like `status`, key and
 * value are data and stay German in every interface language. A soft edge is drawn dotted and is left
 * out of the critical path; everything else (waiting, prerequisites, cycles) still counts it.
 */
export const SOFT_KEY = 'optional'
export const SOFT_VALUE = 'ja'

export function isOptionalKey(key: string): boolean {
  return key.trim().toLowerCase() === SOFT_KEY
}

export function isSoftEdge(edge: { metadata?: readonly MetadataEntry[] }): boolean {
  const entry = edge.metadata?.find((e) => isOptionalKey(e.key))
  return entry !== undefined && entry.value.trim().toLowerCase() === SOFT_VALUE
}

/**
 * The entries with the canonical `optional: ja` right after `name` (soft), or without any `optional`
 * entry (not soft). Not normalized.
 */
export function withSoftEntry(entries: readonly MetadataEntry[], soft: boolean): MetadataEntry[] {
  const others = entries.filter((entry) => !isOptionalKey(entry.key))
  if (!soft) return others
  const at = others.findIndex((entry) => entry.key === NAME_KEY) + 1
  return [...others.slice(0, at), { key: SOFT_KEY, value: SOFT_VALUE }, ...others.slice(at)]
}
