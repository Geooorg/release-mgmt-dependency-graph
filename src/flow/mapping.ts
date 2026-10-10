import { MarkerType, type Edge } from '@xyflow/react'
import { getSize, pickSides, sortParentsFirst } from '../model/graph'
import { displayName, getColor, getContrastColor, getName } from '../model/metadata'
import { joinNames, type ProjectAnalysis } from '../model/releaseAnalysis'
import type { ModelEdge, ModelNode } from '../model/types'
import type { AppFlowNode } from './types'

export interface FlowUiState {
  selectedIds: ReadonlySet<string>
  connectSourceId: string | null
  dropTargetId: string | null
  /** Elements/edges of the highlighted dependency graph (empty = none). */
  dependencyNodeIds: ReadonlySet<string>
  dependencyEdgeIds: ReadonlySet<string>
  /** Elements that are part of a dependency cycle. */
  cycleNodeIds: ReadonlySet<string>
  /** Status and blockers of the project; undefined = no status marks. */
  analysis?: ProjectAnalysis
  /** Element flashing after a click in the analysis panel. */
  revealedId?: string | null
}

const EDGE_COLOR = '#2563eb'
const EDGE_COLOR_SELECTED = '#1e3a8a'
const EDGE_COLOR_DEPENDENCY = '#dc2626'
const EDGE_COLOR_CYCLE = '#9333ea'
const EDGE_COLOR_CYCLE_SELECTED = '#6b21a8'
const CYCLE_DASH = '6 4'
const NO_IDS: ReadonlySet<string> = new Set()

/** "Prefix: A, B, …" with at most five names. */
function listNames(prefix: string, names: readonly string[]): string {
  return `${prefix}: ${joinNames(names)}`
}

/** Model nodes -> React Flow nodes (parents first, sizes fixed from the model). */
export function toFlowNodes(nodes: readonly ModelNode[], ui: FlowUiState): AppFlowNode[] {
  const names = new Map(nodes.map((n) => [n.id, displayName(n)]))
  const namesOf = (ids: readonly string[]) => ids.map((id) => names.get(id) ?? id.slice(0, 8))
  const { analysis } = ui

  // Red flag: status `blockiert` (a group: a member has it). It wins over the hourglass.
  const blockedTitle = (node: ModelNode): string | undefined => {
    if (!analysis?.blockedIds.has(node.id)) return undefined
    if (node.kind === 'group') {
      return listNames('Enthält blockierte Objekte', namesOf(analysis.blockedMembers.get(node.id) ?? []))
    }
    const reason = analysis.blockReasons.get(node.id)
    const title = reason === undefined ? 'Blockiert (kein Grund angegeben)' : `Blockiert: ${reason}`
    const waiting = analysis.waitingFor.get(node.id) ?? []
    return waiting.length > 0 ? `${title} – ${listNames('wartet außerdem auf', namesOf(waiting))}` : title
  }

  // Hourglass: unfinished, not blocked, with an unfinished direct prerequisite (a group: a member waits).
  // Finished objects carry neither flag nor hourglass.
  const waitingTitle = (node: ModelNode): string | undefined => {
    if (!analysis?.waitingIds.has(node.id)) return undefined
    if (node.kind === 'group') {
      return listNames('Enthält wartende Objekte', namesOf(analysis.waitingMembers.get(node.id) ?? []))
    }
    return listNames('Wartet auf', namesOf(analysis.waitingFor.get(node.id) ?? []))
  }

  return sortParentsFirst(nodes).map((node) => {
    const { width, height } = getSize(node)
    const color = getColor(node.metadata)
    return {
      id: node.id,
      type: node.kind === 'group' ? 'group' : 'box',
      position: node.position,
      parentId: node.parentId,
      width,
      height,
      selected: ui.selectedIds.has(node.id),
      data: {
        id: node.id,
        name: getName(node.metadata),
        isConnectSource: ui.connectSourceId === node.id,
        isDropTarget: ui.dropTargetId === node.id,
        isDependency: ui.dependencyNodeIds.has(node.id),
        isInCycle: ui.cycleNodeIds.has(node.id),
        isRevealed: ui.revealedId === node.id,
        status: analysis?.statusById.get(node.id),
        statusRaw: analysis?.statusInfoById.get(node.id)?.raw,
        statusKnown: analysis?.statusInfoById.get(node.id)?.known,
        blockedTitle: blockedTitle(node),
        waitingTitle: waitingTitle(node),
        color,
        textColor: color && getContrastColor(color),
      },
    } as AppFlowNode
  })
}

/**
 * Directed edges with an arrow at the target: blue, darker when selected, thick red when part of
 * the highlighted dependency graph. Edges in a cycle are purple and dashed; the dependency colour
 * wins over the cycle colour, the dashes stay. Connectors are the ones the edge was drawn between; edges
 * without stored connectors (older files) get the facing sides.
 */
export function toFlowEdges(
  edges: readonly ModelEdge[],
  selectedIds: ReadonlySet<string>,
  dependencyIds: ReadonlySet<string>,
  nodes: readonly ModelNode[],
  cycleIds: ReadonlySet<string> = NO_IDS,
): Edge[] {
  return edges.map((edge) => {
    const facing = edge.sourceHandle && edge.targetHandle ? undefined : pickSides(nodes, edge.source, edge.target)
    const selected = selectedIds.has(edge.id)
    const dependency = dependencyIds.has(edge.id)
    const cyclic = cycleIds.has(edge.id)
    const color = dependency
      ? EDGE_COLOR_DEPENDENCY
      : cyclic
        ? selected
          ? EDGE_COLOR_CYCLE_SELECTED
          : EDGE_COLOR_CYCLE
        : selected
          ? EDGE_COLOR_SELECTED
          : EDGE_COLOR
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? facing?.sourceHandle,
      targetHandle: edge.targetHandle ?? facing?.targetHandle,
      selected,
      label: edge.label,
      labelStyle: { fill: color, fontWeight: 600, fontSize: 13 },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 4,
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.92, stroke: color, strokeWidth: 1 },
      // Highlighted edges paint above everything else.
      zIndex: dependency ? 1000 : undefined,
      style: {
        stroke: color,
        strokeWidth: dependency ? 6 : selected || cyclic ? 3 : 2,
        strokeDasharray: cyclic ? CYCLE_DASH : undefined,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: dependency ? 12 : 20, height: dependency ? 12 : 20 },
    }
  })
}
