import { MarkerType, type Edge } from '@xyflow/react'
import { getSize, pickSides, sortParentsFirst } from '../model/graph'
import { getColor, getContrastColor, getName } from '../model/metadata'
import type { ModelEdge, ModelNode } from '../model/types'
import type { AppFlowNode } from './types'

export interface FlowUiState {
  selectedIds: ReadonlySet<string>
  connectSourceId: string | null
  dropTargetId: string | null
  /** Elements/edges of the highlighted dependency graph (empty = none). */
  dependencyNodeIds: ReadonlySet<string>
  dependencyEdgeIds: ReadonlySet<string>
}

const EDGE_COLOR = '#2563eb'
const EDGE_COLOR_SELECTED = '#1e3a8a'
const EDGE_COLOR_DEPENDENCY = '#dc2626'

/** Model nodes -> React Flow nodes (parents first, sizes fixed from the model). */
export function toFlowNodes(nodes: readonly ModelNode[], ui: FlowUiState): AppFlowNode[] {
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
        color,
        textColor: color && getContrastColor(color),
      },
    } as AppFlowNode
  })
}

/**
 * Directed edges with an arrow at the target: blue, darker when selected, thick red when part of
 * the highlighted dependency graph. Connectors are the ones the edge was drawn between; edges
 * without stored connectors (older files) get the facing sides.
 */
export function toFlowEdges(
  edges: readonly ModelEdge[],
  selectedIds: ReadonlySet<string>,
  dependencyIds: ReadonlySet<string>,
  nodes: readonly ModelNode[],
): Edge[] {
  return edges.map((edge) => {
    const facing = edge.sourceHandle && edge.targetHandle ? undefined : pickSides(nodes, edge.source, edge.target)
    const selected = selectedIds.has(edge.id)
    const dependency = dependencyIds.has(edge.id)
    const color = dependency ? EDGE_COLOR_DEPENDENCY : selected ? EDGE_COLOR_SELECTED : EDGE_COLOR
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
      style: { stroke: color, strokeWidth: dependency ? 6 : selected ? 3 : 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: dependency ? 12 : 20, height: dependency ? 12 : 20 },
    }
  })
}
