import type { Node } from '@xyflow/react'
import type { Status } from '../model/status'

/** Data handed to the custom React Flow node components. */
export interface FlowNodeData extends Record<string, unknown> {
  /** Value of the `name` metadata field (may be empty). */
  name: string
  /** UUID, shown shortened as a fallback label. */
  id: string
  /** Node is the already picked source of the connect tool. */
  isConnectSource: boolean
  /** Group highlighted as drop target while dragging a node over it. */
  isDropTarget: boolean
  /** Element is part of the highlighted dependency graph. */
  isDependency: boolean
  /** Element is part of a dependency cycle. */
  isInCycle: boolean
  /** Element was just revealed from the analysis panel (short flash). */
  isRevealed: boolean
  /** Effective release status of an object (undefined for groups). */
  status?: Status
  /** Trimmed raw status value; undefined = not set (objects only). */
  statusRaw?: string
  /** False = the raw status value is none of the four and counts as `offen` (objects only). */
  statusKnown?: boolean
  /** Tooltip text of the red flag; set = the element (a group: one of its members) has the status `blockiert`. */
  blockedTitle?: string
  /** Tooltip text of the hourglass; set = the element (a group: one of its members) waits for an unfinished prerequisite. */
  waitingTitle?: string
  /** `#rrggbb` from the `color` metadata field; undefined = default blue. */
  color?: string
  /** Readable text colour for `color`. */
  textColor?: string
}

export type BoxFlowNode = Node<FlowNodeData, 'box'>
export type GroupFlowNode = Node<FlowNodeData, 'group'>
export type NoteFlowNode = Node<FlowNodeData, 'note'>
export type AppFlowNode = BoxFlowNode | GroupFlowNode | NoteFlowNode
