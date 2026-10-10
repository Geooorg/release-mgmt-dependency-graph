import type { Node } from '@xyflow/react'

/** Data handed to the custom React Flow node components. */
export interface FlowNodeData extends Record<string, unknown> {
  /** Value of the `name` metadata field (may be empty). */
  name: string
  /** UUID, shown shortened as a fallback label. */
  id: string
  /** Node is the already picked source while in "Verbinden" mode. */
  isConnectSource: boolean
  /** Group highlighted as drop target while dragging a node over it. */
  isDropTarget: boolean
}

export type BoxFlowNode = Node<FlowNodeData, 'box'>
export type GroupFlowNode = Node<FlowNodeData, 'group'>
export type AppFlowNode = BoxFlowNode | GroupFlowNode

export type ConnectMode = 'off' | 'pickSource' | 'pickTarget'
