import { getName } from './metadata'
import type { ModelNode } from './types'

/** Search text as compared: surrounding spaces do not count, case does not either. */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase()
}

/**
 * Ids of the objects and groups whose `name` starts with `query` (case-insensitive), in model order.
 * An empty query finds nothing.
 */
export function findByName(nodes: readonly ModelNode[], query: string): string[] {
  const wanted = normalizeQuery(query)
  if (wanted === '') return []
  return nodes.filter((node) => getName(node.metadata).trim().toLowerCase().startsWith(wanted)).map((node) => node.id)
}

/**
 * The hit to jump to next: the one after `currentId` in `hits`, wrapping around to the first;
 * the first one when there is no current hit (or it is not among them any more).
 */
export function nextHit(hits: readonly string[], currentId: string | null): string | undefined {
  if (hits.length === 0) return undefined
  const at = currentId === null ? -1 : hits.indexOf(currentId)
  return hits[(at + 1) % hits.length]
}
