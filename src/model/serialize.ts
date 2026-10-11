import { createTranslate, type Translate } from '../i18n/translate'
import { sortParentsFirst } from './graph'
import { findDuplicateKeys, normalizeMetadata, tidyEdgeMetadata } from './metadata'
import { DEFAULT_PROJECT_NAME, isValidProjectName } from './projectName'
import { HANDLE_SIDES, LEGACY_SCHEMA_VERSION, NAME_KEY, PREVIOUS_SCHEMA_VERSION, SCHEMA_VERSION } from './types'
import type {
  ElementKind,
  GraphContent,
  GraphModel,
  HandleSide,
  MetadataEntry,
  ModelEdge,
  ModelNode,
  Point,
  Size,
} from './types'

export type ParseResult = { ok: true; model: GraphModel } | { ok: false; errors: string[] }

const MAX_ERRORS = 20
const MAX_QUOTED_LENGTH = 40

type Json = Record<string, unknown>
type Report = (message: string) => void

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** `GraphContent` -> `GraphModel` (adds `version`, orders nodes parents first). Does not mutate. */
export function toModel(content: GraphContent): GraphModel {
  return {
    version: SCHEMA_VERSION,
    ...(content.projectName !== undefined && { projectName: content.projectName }),
    nodes: sortParentsFirst(content.nodes),
    edges: content.edges,
  }
}

/** Pretty-printed JSON (2 spaces, trailing newline) with stable key order: version, nodes, edges. */
export function serializeModel(model: GraphModel): string {
  const canonical = {
    version: model.version,
    ...(model.projectName !== undefined && { projectName: model.projectName }),
    nodes: model.nodes.map(canonicalNode),
    edges: model.edges.map(canonicalEdge),
  }
  return `${JSON.stringify(canonical, null, 2)}\n`
}

/** Fixed key order inside an edge; connectors and metadata only when set. */
function canonicalEdge(edge: ModelEdge): ModelEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    ...(edge.sourceHandle && { sourceHandle: edge.sourceHandle }),
    ...(edge.targetHandle && { targetHandle: edge.targetHandle }),
    ...(edge.metadata && { metadata: edge.metadata.map((entry) => ({ key: entry.key, value: entry.value })) }),
  }
}

/** Fixed key order inside an element, independent of how the object was built. */
function canonicalNode(node: ModelNode) {
  return {
    id: node.id,
    kind: node.kind,
    parentId: node.parentId,
    position: { x: node.position.x, y: node.position.y },
    size: node.size && { width: node.size.width, height: node.size.height },
    metadata: node.metadata.map((entry) => ({ key: entry.key, value: entry.value })),
  }
}

/**
 * `<project name>_<YYYY-MM-DD>_<HHmmss>.<extension>` (`json` unless told otherwise) using the LOCAL
 * time of `date`, e.g. `Release-Management_2026-10-09_141022.json`. A name that is not file-safe
 * falls back to the default.
 */
export function exportFileName(
  date: Date = new Date(),
  projectName: string = DEFAULT_PROJECT_NAME,
  extension: 'json' | 'svg' = 'json',
): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, '0')
  const name = isValidProjectName(projectName) ? projectName : DEFAULT_PROJECT_NAME
  const day = `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `${name}_${day}_${time}.${extension}`
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/** `JSON.parse` + `parseModel`; invalid JSON yields a single `parse.json` error (the reason is the engine's own text). */
export function parseModelJson(text: string, t: Translate = createTranslate('de')): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { ok: false, errors: [t('parse.json', { reason })] }
  }
  return parseModel(parsed, t)
}

/**
 * Validates and normalizes untrusted input (parsed JSON from localStorage or an imported file).
 * Collects ALL problems as human-readable messages in the language of `t` (German by default, max 20)
 * instead of stopping at the first.
 * Rules:
 *  - top-level object with `version === 3`, or the older `version === 2` (the same without notes) or
 *    `version === 1` whose edge `label` becomes the `name` metadata entry (else error mentioning the
 *    unsupported/missing version)
 *  - `nodes` and `edges` arrays
 *  - node: non-empty string `id` (unique), `kind` 'node'|'group'|'note', `position` with finite x/y,
 *    `size` (optional for nodes, required for groups) with finite width/height > 0,
 *    `metadata` array of `{key: string, value: string}` (missing metadata is tolerated -> []),
 *    optional `parentId` that references an existing node of kind 'group', no parent cycles
 *  - metadata is normalized with `normalizeMetadata`; duplicate keys (after trim) are an error
 *  - edge: unique non-empty string `id`, `source`/`target` reference existing nodes (not notes), source !== target,
 *    no duplicate (source,target) pair, optional `metadata` like an element's (duplicate keys are an error)
 *  - unknown extra properties are ignored
 * On success the model has nodes ordered parents first.
 */
export function parseModel(input: unknown, t: Translate = createTranslate('de')): ParseResult {
  if (!isRecord(input)) {
    return { ok: false, errors: [t('parse.notObject')] }
  }

  const errors: string[] = []
  const report: Report = (message) => {
    if (errors.length < MAX_ERRORS) errors.push(message)
  }

  checkVersion(input.version, report, t)

  let projectName: string | undefined
  if (input.projectName !== undefined) {
    if (typeof input.projectName === 'string' && isValidProjectName(input.projectName)) {
      projectName = input.projectName
    } else {
      report(t('parse.projectName', { rule: t('projectName.rule') }))
    }
  }

  let nodes: ModelNode[] = []
  let nodeIds = new Set<string>()
  let noteIds = new Set<string>()
  if (Array.isArray(input.nodes)) {
    const parsed = parseNodes(input.nodes, report, t)
    nodes = parsed.nodes
    nodeIds = parsed.ids
    noteIds = parsed.noteIds
  } else {
    report(t('parse.nodesNotList'))
  }

  let edges: ModelEdge[] = []
  if (Array.isArray(input.edges)) {
    edges = parseEdges(input.edges, nodeIds, noteIds, report, input.version === LEGACY_SCHEMA_VERSION, t)
  } else {
    report(t('parse.edgesNotList'))
  }

  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    model: {
      version: SCHEMA_VERSION,
      ...(projectName !== undefined && { projectName }),
      nodes: sortParentsFirst(nodes),
      edges,
    },
  }
}

function checkVersion(version: unknown, report: Report, t: Translate): void {
  if (version === SCHEMA_VERSION || version === PREVIOUS_SCHEMA_VERSION || version === LEGACY_SCHEMA_VERSION) return
  if (version === undefined) {
    report(t('parse.version.missing', { expected: SCHEMA_VERSION }))
  } else {
    report(t('parse.version.unsupported', { value: show(version, t), expected: SCHEMA_VERSION }))
  }
}

// --- nodes -----------------------------------------------------------------

interface ParsedNodes {
  /** Fully valid nodes in input order. */
  nodes: ModelNode[]
  /** Every distinct valid id seen, including those of nodes that have other problems. */
  ids: Set<string>
  /** Ids of the notes among the valid nodes. */
  noteIds: Set<string>
}

function parseNodes(raw: readonly unknown[], report: Report, t: Translate): ParsedNodes {
  const firstIndexById = new Map<string, number>()
  const nodes: ModelNode[] = []
  raw.forEach((value, index) => {
    const node = parseNode(value, index, firstIndexById, report, t)
    if (node !== undefined) nodes.push(node)
  })

  checkParents(nodes, firstIndexById, report, t)
  return { nodes, ids: new Set(firstIndexById.keys()), noteIds: new Set(nodes.filter((n) => n.kind === 'note').map((n) => n.id)) }
}

function parseNode(
  value: unknown,
  index: number,
  firstIndexById: Map<string, number>,
  report: Report,
  t: Translate,
): ModelNode | undefined {
  if (!isRecord(value)) {
    report(t('parse.node.notObject', { index: index + 1 }))
    return undefined
  }

  const label = isNonEmptyString(value.id)
    ? t('parse.node.labelWithId', { index: index + 1, id: quote(value.id) })
    : t('parse.node.label', { index: index + 1 })
  const problems: string[] = []
  const fail = (message: string): void => {
    problems.push(t('parse.problem', { label, message }))
  }

  const id = isNonEmptyString(value.id) ? value.id : undefined
  if (id === undefined) {
    fail(t('parse.id.invalid'))
  } else if (firstIndexById.has(id)) {
    fail(t('parse.node.idTaken', { index: (firstIndexById.get(id) ?? 0) + 1 }))
  } else {
    firstIndexById.set(id, index)
  }

  const kind = parseKind(value.kind)
  if (kind === undefined) fail(t('parse.node.kind'))

  const position = parsePoint(value.position)
  if (position === undefined) fail(t('parse.node.position'))

  let size: Size | undefined
  if (value.size !== undefined) {
    size = parseSize(value.size)
    if (size === undefined) fail(t('parse.node.size'))
  } else if (kind === 'group') {
    fail(t('parse.node.groupSize'))
  }

  const metadata = parseMetadata(value.metadata, fail, t)
  for (const key of findDuplicateKeys(metadata)) {
    fail(t('parse.metadata.duplicateKey', { key: quote(key) }))
  }

  let parentId: string | undefined
  if (value.parentId !== undefined) {
    if (typeof value.parentId === 'string') parentId = value.parentId
    else fail(t('parse.node.parentIdType'))
  }

  if (problems.length > 0 || id === undefined || kind === undefined || position === undefined) {
    for (const problem of problems) report(problem)
    return undefined
  }
  return {
    id,
    kind,
    ...(parentId === undefined ? {} : { parentId }),
    position,
    ...(size === undefined ? {} : { size }),
    metadata,
  }
}

function parseKind(value: unknown): ElementKind | undefined {
  return value === 'node' || value === 'group' || value === 'note' ? value : undefined
}

function parsePoint(value: unknown): Point | undefined {
  if (!isRecord(value)) return undefined
  const { x, y } = value
  return isFiniteNumber(x) && isFiniteNumber(y) ? { x, y } : undefined
}

function parseSize(value: unknown): Size | undefined {
  if (!isRecord(value)) return undefined
  const { width, height } = value
  return isFiniteNumber(width) && isFiniteNumber(height) && width > 0 && height > 0
    ? { width, height }
    : undefined
}

/** Missing metadata is tolerated; invalid entries are reported and skipped. Result is normalized. */
function parseMetadata(value: unknown, fail: (message: string) => void, t: Translate): MetadataEntry[] {
  if (value === undefined) return normalizeMetadata([])
  if (!Array.isArray(value)) {
    fail(t('parse.metadata.notList'))
    return normalizeMetadata([])
  }
  const entries: MetadataEntry[] = []
  value.forEach((entry: unknown, index) => {
    if (isRecord(entry) && typeof entry.key === 'string' && typeof entry.value === 'string') {
      entries.push({ key: entry.key, value: entry.value })
    } else {
      fail(t('parse.metadata.entry', { index }))
    }
  })
  return normalizeMetadata(entries)
}

/** parentId must reference an existing group; the parent chain must not contain a cycle. */
function checkParents(
  nodes: readonly ModelNode[],
  firstIndexById: ReadonlyMap<string, number>,
  report: Report,
  t: Translate,
): void {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const parentOf = new Map<string, string>()

  for (const node of nodes) {
    if (node.parentId === undefined) continue
    const label = t('parse.node.labelWithId', { index: (firstIndexById.get(node.id) ?? 0) + 1, id: quote(node.id) })
    const problem = (message: string) => report(t('parse.problem', { label, message }))
    const parent = byId.get(node.parentId)
    if (parent !== undefined) {
      if (parent.kind === 'group') parentOf.set(node.id, parent.id)
      else problem(t('parse.parent.notGroup', { id: quote(node.parentId) }))
    } else if (!firstIndexById.has(node.parentId)) {
      // A parent that exists but is itself invalid has already been reported.
      problem(t('parse.parent.missing', { id: quote(node.parentId) }))
    }
  }

  for (const cycle of findCycles(nodes, parentOf)) {
    report(t('parse.parent.cycle', { path: cycle.map(quote).join(' → ') }))
  }
}

/** Each cycle once, as the closed id path `[a, b, a]` (child -> parent direction). */
function findCycles(nodes: readonly ModelNode[], parentOf: ReadonlyMap<string, string>): string[][] {
  const cycles: string[][] = []
  const finished = new Set<string>()
  for (const { id: start } of nodes) {
    const path: string[] = []
    const positionInPath = new Map<string, number>()
    let current: string | undefined = start
    while (current !== undefined && !finished.has(current)) {
      const seenAt = positionInPath.get(current)
      if (seenAt !== undefined) {
        cycles.push([...path.slice(seenAt), current])
        break
      }
      positionInPath.set(current, path.length)
      path.push(current)
      current = parentOf.get(current)
    }
    for (const id of path) finished.add(id)
  }
  return cycles
}

// --- edges -----------------------------------------------------------------

function parseEdges(
  raw: readonly unknown[],
  nodeIds: ReadonlySet<string>,
  noteIds: ReadonlySet<string>,
  report: Report,
  legacy: boolean,
  t: Translate,
): ModelEdge[] {
  const firstIndexById = new Map<string, number>()
  const firstIndexByPair = new Map<string, number>()
  const edges: ModelEdge[] = []

  raw.forEach((value, index) => {
    if (!isRecord(value)) {
      report(t('parse.edge.notObject', { index: index + 1 }))
      return
    }
    const label = isNonEmptyString(value.id)
      ? t('parse.edge.labelWithId', { index: index + 1, id: quote(value.id) })
      : t('parse.edge.label', { index: index + 1 })
    const problems: string[] = []
    const fail = (message: string): void => {
      problems.push(t('parse.problem', { label, message }))
    }

    const id = isNonEmptyString(value.id) ? value.id : undefined
    if (id === undefined) {
      fail(t('parse.id.invalid'))
    } else if (firstIndexById.has(id)) {
      fail(t('parse.edge.idTaken', { index: (firstIndexById.get(id) ?? 0) + 1 }))
    } else {
      firstIndexById.set(id, index)
    }

    const { source, target } = value
    if (typeof source !== 'string' || typeof target !== 'string') {
      fail(t('parse.edge.endpointType'))
    } else {
      if (!nodeIds.has(source)) fail(t('parse.edge.sourceMissing', { id: quote(source) }))
      if (!nodeIds.has(target)) fail(t('parse.edge.targetMissing', { id: quote(target) }))
      if (noteIds.has(source) || noteIds.has(target)) fail(t('parse.edge.note'))
      if (source === target) {
        fail(t('parse.edge.selfLoop'))
      } else {
        const pair = JSON.stringify([source, target])
        const firstWithPair = firstIndexByPair.get(pair)
        if (firstWithPair !== undefined) {
          fail(t('parse.edge.duplicate', { source: quote(source), target: quote(target), index: firstWithPair + 1 }))
        } else {
          firstIndexByPair.set(pair, index)
        }
      }
    }

    const handles: Pick<ModelEdge, 'sourceHandle' | 'targetHandle'> = {}
    for (const field of ['sourceHandle', 'targetHandle'] as const) {
      const raw = value[field]
      if (raw === undefined) continue
      if (typeof raw === 'string' && (HANDLE_SIDES as readonly string[]).includes(raw)) {
        handles[field] = raw as HandleSide
      } else {
        fail(t('parse.edge.handle', { field, sides: HANDLE_SIDES.map((side) => quote(side)).join(', ') }))
      }
    }

    let metadata: MetadataEntry[] | undefined
    if (legacy) {
      // Version 1: the caption was a plain `label`.
      if (value.label !== undefined) {
        if (typeof value.label === 'string') metadata = tidyEdgeMetadata([{ key: NAME_KEY, value: value.label }])
        else fail(t('parse.edge.labelType'))
      }
    } else if (value.metadata !== undefined) {
      const entries = parseMetadata(value.metadata, fail, t)
      for (const key of findDuplicateKeys(entries)) fail(t('parse.metadata.duplicateKey', { key: quote(key) }))
      metadata = tidyEdgeMetadata(entries)
    }

    if (problems.length > 0 || id === undefined || typeof source !== 'string' || typeof target !== 'string') {
      for (const problem of problems) report(problem)
      return
    }
    edges.push({ id, source, target, ...handles, ...(metadata && { metadata }) })
  })
  return edges
}

// --- small helpers ---------------------------------------------------------

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

/** Untrusted text for error messages: JSON-escaped, quoted and shortened. */
function quote(text: string): string {
  const shortened = text.length > MAX_QUOTED_LENGTH ? `${text.slice(0, MAX_QUOTED_LENGTH)}…` : text
  return JSON.stringify(shortened)
}

/** Untrusted value for error messages. */
function show(value: unknown, t: Translate): string {
  if (typeof value === 'string') return quote(value)
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return t(Array.isArray(value) ? 'parse.value.list' : 'parse.value.object')
}
