/**
 * Domain types for the dependency graph.
 *
 * These types ARE the persisted/exported schema (localStorage + JSON export).
 * Positions of nodes with a `parentId` are relative to that parent group.
 */

export const SCHEMA_VERSION = 4

/** Older format that is still imported: an edge had a plain `label` instead of `metadata`. */
export const LEGACY_SCHEMA_VERSION = 1

/** Version 2 had no notes; otherwise it reads exactly like the current one. */
export const PREVIOUS_SCHEMA_VERSION = 2

/** Version 3 had no `class`/`entity` entries on objects; they are added with their defaults on import. */
export const VERSION_BEFORE_OBJECT_FIELDS = 3

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

/**
 * `node` = blue box (object), `group` = container acting as a sub-graph, `note` = free sticky note
 * (no connections; its text is the `name` entry, the only other entry is `color`).
 */
export type ElementKind = 'node' | 'group' | 'note'

export interface ModelNode {
  /** UUID, generated on creation, never editable. */
  id: string
  kind: ElementKind
  /** Id of the containing group; undefined = top level. Must reference a node of kind `group`. */
  parentId?: string
  /** Relative to the parent group, or to the canvas origin when there is no parent. */
  position: Point
  /** Required for groups. For plain nodes and notes: optional, defaults to NODE_SIZE / NOTE_DEFAULT_SIZE. */
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
  /** Optional, like the metadata of an element: the `name` entry is the caption shown on the edge. Absent = unnamed. */
  metadata?: MetadataEntry[]
}

/** Graph content without the schema version (what the store works on). */
export interface GraphContent {
  nodes: ModelNode[]
  edges: ModelEdge[]
  /** Name of the project, `A-Z a-z 0-9 - _ .` only; undefined = default ("Release-Management"). */
  projectName?: string
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
export const NOTE_DEFAULT_SIZE: Size = { width: 160, height: 120 }
export const NOTE_MIN_SIZE: Size = { width: 80, height: 56 }
/** Sticky-note yellow: the colour of a note without a `color` entry. */
export const NOTE_DEFAULT_COLOR = '#fef08a'

export const NAME_KEY = 'name'
/** Optional metadata field holding the element colour as `#rrggbb`. */
export const COLOR_KEY = 'color'
export const DEFAULT_COLOR = '#2563eb'
