/**
 * Domain types for the dependency graph.
 *
 * These types ARE the persisted/exported schema (localStorage + JSON export).
 * Positions of nodes with a `parentId` are relative to that parent group.
 */

export const SCHEMA_VERSION = 5

/** Version 4 had no type catalog; it is read as an empty catalog. */
export const VERSION_BEFORE_CATALOG = 4

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
  /** Types of objects and connections; undefined = no types defined (same as the empty catalog). */
  catalog?: Catalog
}

/** Persisted / exported document. */
export interface GraphModel extends GraphContent {
  version: typeof SCHEMA_VERSION
  catalog: Catalog
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

/** Fixed icon set for types (drawn as inline SVG, see components/TypeIcon.tsx). */
export const ICON_KEYS = ['service', 'database', 'queue', 'user', 'cloud', 'external', 'process', 'storage'] as const
export type IconKey = (typeof ICON_KEYS)[number]

export const FIELD_KINDS = ['text', 'select', 'boolean'] as const
export type FieldKind = (typeof FIELD_KINDS)[number]

/** One field a type defines; its value is an ordinary metadata entry under `key`. */
export interface FieldDef {
  /** Metadata key; trimmed, unique within the type, never a reserved key. */
  key: string
  kind: FieldKind
  /** `select` only: at least one, no duplicates. */
  options?: string[]
  required?: boolean
  /** `boolean`: 'ja' | 'nein'; `select`: one of the options; `text`: any. Absent = empty. */
  default?: string
}

/**
 * What the arrow of a connection type means (see model/edgeRoles.ts): `sequence` = A comes before B,
 * `dependency` = A depends on B, `flow` = data flows from A to B. `sequence` and `dependency` exclude each other.
 */
export const EDGE_ROLES = ['sequence', 'dependency', 'flow'] as const
export type EdgeRole = (typeof EDGE_ROLES)[number]

export interface TypeDef {
  /** UUID, generated once, never editable; elements refer to a type by it. */
  id: string
  /** Display name, unique within its list (trimmed, case-insensitive). */
  name: string
  /** `#rrggbb` default colour of elements of this type. */
  color?: string
  icon?: IconKey
  /** Connection types only: what the arrow means. Absent or empty = descriptive only. */
  roles?: EdgeRole[]
  fields: FieldDef[]
}

export interface Catalog {
  /** Types of objects (`kind: 'node'`). */
  elementTypes: TypeDef[]
  /** Types of connections. */
  edgeTypes: TypeDef[]
}

export const EMPTY_CATALOG: Catalog = { elementTypes: [], edgeTypes: [] }

/** Metadata entry holding the id of the element's type. */
export const TYPE_KEY = 'type'
