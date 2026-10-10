/**
 * Domain types for the dependency graph.
 *
 * These types ARE the persisted/exported schema (localStorage + JSON export).
 * Positions of nodes with a `parentId` are relative to that parent group.
 */

export const SCHEMA_VERSION = 1

/** One free-form metadata field. Order is significant and preserved. */
export interface MetadataEntry {
  key: string
  value: string
}

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

/** `node` = blue box (object), `group` = container acting as a sub-graph. */
export type ElementKind = 'node' | 'group'

export interface ModelNode {
  /** UUID, generated on creation, never editable. */
  id: string
  kind: ElementKind
  /** Id of the containing group; undefined = top level. Must reference a node of kind `group`. */
  parentId?: string
  /** Relative to the parent group, or to the canvas origin when there is no parent. */
  position: Point
  /** Required for groups. For plain nodes: optional, defaults to NODE_SIZE. */
  size?: Size
  /** Always contains exactly one `name` entry at index 0 (see model/metadata.ts). */
  metadata: MetadataEntry[]
}

/** Every element has four connectors, one per side. */
export const HANDLE_SIDES = ['top', 'right', 'bottom', 'left'] as const
export type HandleSide = (typeof HANDLE_SIDES)[number]

/** Directed edge: from `source` to `target`, optionally attached to specific connectors. */
export interface ModelEdge {
  id: string
  source: string
  target: string
  /** Connector on the source element; undefined = renderer picks. */
  sourceHandle?: HandleSide
  /** Connector on the target element; undefined = renderer picks. */
  targetHandle?: HandleSide
}

/** Graph content without the schema version (what the store works on). */
export interface GraphContent {
  nodes: ModelNode[]
  edges: ModelEdge[]
}

/** Persisted / exported document. */
export interface GraphModel extends GraphContent {
  version: typeof SCHEMA_VERSION
}

export type IdGenerator = () => string

// Layout constants (flow coordinates).
export const NODE_SIZE: Size = { width: 160, height: 56 }
export const GROUP_PADDING = 24
export const GROUP_HEADER_HEIGHT = 32
export const GROUP_MIN_SIZE: Size = { width: 160, height: 96 }
export const GROUP_DEFAULT_SIZE: Size = { width: 320, height: 200 }

export const NAME_KEY = 'name'
/** Optional metadata field holding the element colour as `#rrggbb`. */
export const COLOR_KEY = 'color'
export const DEFAULT_COLOR = '#2563eb'
