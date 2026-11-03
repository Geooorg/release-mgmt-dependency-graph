import { resolveType } from './typing'
import type { Catalog, EdgeRole, GraphContent, ModelEdge } from './types'

/**
 * What a connection means. The type of a connection says it: `sequence` (A comes before B), `dependency`
 * (A depends on B) or `flow` (data flows from A to B). A connection without a type means `sequence`, as
 * it always did; a connection whose type is not in the catalog means nothing, because its meaning is unknown.
 */
const UNTYPED: readonly EdgeRole[] = ['sequence']
const NO_ROLES: readonly EdgeRole[] = []

export type AnalysisPurpose = 'status' | 'highlight'
export type ArrowHead = 'closed' | 'open'

export interface EdgeRoleCounts {
  sequence: number
  dependency: number
  /** Connections with neither role: descriptive, flow only or of an unknown type. */
  none: number
}

/**
 * The roles of a connection. A typed connection without a catalog (or with a type missing from it) resolves
 * to an unknown type and has no roles; only a connection without a type means `sequence`.
 */
export function getEdgeRoles(edge: Pick<ModelEdge, 'metadata'>, catalog?: Catalog): readonly EdgeRole[] {
  const resolved = resolveType(edge.metadata ?? [], catalog?.edgeTypes ?? [])
  if (resolved.state === 'none') return UNTYPED
  if (resolved.state === 'unknown') return NO_ROLES
  return resolved.def.roles ?? NO_ROLES
}

/** Whether the roles take part in the analyses that exist today (status and highlights). */
export function hasAnalysisRole(roles: readonly EdgeRole[]): boolean {
  return roles.includes('sequence') || roles.includes('dependency')
}

/** The open head marks a dependency; everything else keeps the filled triangle. */
export function arrowHeadFor(roles: readonly EdgeRole[]): ArrowHead {
  return roles.includes('dependency') ? 'open' : 'closed'
}

/**
 * The content the analyses read. `status`: only `sequence` connections. `highlight`: `sequence` connections
 * plus `dependency` connections with their ends swapped (A depends on B reads as "B comes before A"), same id,
 * so the highlight finds the edge it has to draw. The analyses themselves stay unchanged.
 * Nothing to filter or turn -> the very same content.
 * For ANALYSIS ONLY: a swapped connection keeps its old handles, so this content must never be used for drawing.
 */
export function analysisContent(content: GraphContent, purpose: AnalysisPurpose): GraphContent {
  let changed = false
  const edges: ModelEdge[] = []
  for (const edge of content.edges) {
    const roles = getEdgeRoles(edge, content.catalog)
    if (roles.includes('sequence')) {
      edges.push(edge)
    } else if (purpose === 'highlight' && roles.includes('dependency')) {
      edges.push({ ...edge, source: edge.target, target: edge.source })
      changed = true
    } else {
      changed = true
    }
  }
  return changed ? { ...content, edges } : content
}

export function countEdgeRoles(content: GraphContent): EdgeRoleCounts {
  const counts: EdgeRoleCounts = { sequence: 0, dependency: 0, none: 0 }
  for (const edge of content.edges) {
    const roles = getEdgeRoles(edge, content.catalog)
    if (roles.includes('sequence')) counts.sequence += 1
    else if (roles.includes('dependency')) counts.dependency += 1
    else counts.none += 1
  }
  return counts
}
