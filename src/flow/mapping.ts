import { MarkerType, type Edge } from '@xyflow/react'
import { getSize, sortParentsFirst } from '../model/graph'
import { getName } from '../model/metadata'
import type { ModelEdge, ModelNode } from '../model/types'
import type { AppFlowNode } from './types'

export interface FlowUiState {
  selectedIds: ReadonlySet<string>
  connectSourceId: string | null
  dropTargetId: string | null
}

const EDGE_COLOR = '#2563eb'
const EDGE_COLOR_SELECTED = '#1e3a8a'

/** Model nodes -> React Flow nodes (parents first, sizes fixed from the model). */
export function toFlowNodes(nodes: readonly ModelNode[], ui: FlowUiState): AppFlowNode[] {
  return sortParentsFirst(nodes).map((node) => {
    const { width, height } = getSize(node)
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
      },
    } as AppFlowNode
  })
}

/** Directed blue edges with an arrow at the target. */
export function toFlowEdges(edges: readonly ModelEdge[], selectedIds: ReadonlySet<string>): Edge[] {
  return edges.map((edge) => {
    const selected = selectedIds.has(edge.id)
    const color = selected ? EDGE_COLOR_SELECTED : EDGE_COLOR
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      selected,
      style: { stroke: color, strokeWidth: selected ? 3 : 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color },
    }
  })
}
