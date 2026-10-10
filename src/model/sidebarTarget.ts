/** What the sidebar shows; derived from the selection, never stored on its own. */
export type SidebarTarget =
  | { kind: 'none' }
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'multiple'; count: number }

/**
 * The sidebar follows the selection: exactly one element (object, group or edge) is edited,
 * several only produce a hint, none closes the sidebar. Objects and edges are mutually exclusive.
 */
export function sidebarTarget(
  selectedNodeIds: readonly string[],
  selectedEdgeIds: readonly string[],
): SidebarTarget {
  const count = selectedNodeIds.length + selectedEdgeIds.length
  if (count === 0) return { kind: 'none' }
  if (count > 1) return { kind: 'multiple', count }
  return selectedNodeIds.length === 1
    ? { kind: 'node', id: selectedNodeIds[0] }
    : { kind: 'edge', id: selectedEdgeIds[0] }
}

export function isSameTarget(a: SidebarTarget, b: SidebarTarget): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'multiple') return b.kind === 'multiple' && a.count === b.count
  if (a.kind === 'none') return true
  return b.kind === a.kind && a.id === b.id
}
