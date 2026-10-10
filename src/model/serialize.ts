import { sortParentsFirst } from './graph'
import { findDuplicateKeys, normalizeMetadata } from './metadata'
import { DEFAULT_PROJECT_NAME, PROJECT_NAME_RULE, isValidProjectName } from './projectName'
import { HANDLE_SIDES, SCHEMA_VERSION } from './types'
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

/** Fixed key order inside an edge; connectors and label only when set. */
function canonicalEdge(edge: ModelEdge): ModelEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    ...(edge.sourceHandle && { sourceHandle: edge.sourceHandle }),
    ...(edge.targetHandle && { targetHandle: edge.targetHandle }),
    ...(edge.label && { label: edge.label }),
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
 * `<project name>_<YYYY-MM-DD>_<HHmmss>.json` using the LOCAL time of `date`, e.g.
 * `Release-Management_2026-10-09_141022.json`. A name that is not file-safe falls back to the default.
 */
export function exportFileName(
  date: Date = new Date(),
  projectName: string = DEFAULT_PROJECT_NAME,
): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, '0')
  const name = isValidProjectName(projectName) ? projectName : DEFAULT_PROJECT_NAME
  const day = `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `${name}_${day}_${time}.json`
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/** `JSON.parse` + `parseModel`; invalid JSON yields `{ ok: false, errors: ['Keine gültige JSON-Datei: ...'] }`. */
export function parseModelJson(text: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { ok: false, errors: [`Keine gültige JSON-Datei: ${reason}`] }
  }
  return parseModel(parsed)
}

/**
 * Validates and normalizes untrusted input (parsed JSON from localStorage or an imported file).
 * Collects ALL problems as human-readable German messages (max 20) instead of stopping at the first.
 * Rules:
 *  - top-level object with `version === 1` (else error mentioning the unsupported/missing version)
 *  - `nodes` and `edges` arrays
 *  - node: non-empty string `id` (unique), `kind` 'node'|'group', `position` with finite x/y,
 *    `size` (optional for nodes, required for groups) with finite width/height > 0,
 *    `metadata` array of `{key: string, value: string}` (missing metadata is tolerated -> []),
 *    optional `parentId` that references an existing node of kind 'group', no parent cycles
 *  - metadata is normalized with `normalizeMetadata`; duplicate keys (after trim) are an error
 *  - edge: unique non-empty string `id`, `source`/`target` reference existing nodes, source !== target,
 *    no duplicate (source,target) pair
 *  - unknown extra properties are ignored
 * On success the model has nodes ordered parents first.
 */
export function parseModel(input: unknown): ParseResult {
  if (!isRecord(input)) {
    return { ok: false, errors: ['Die Datei enthält kein gültiges Graph-Objekt.'] }
  }

  const errors: string[] = []
  const report: Report = (message) => {
    if (errors.length < MAX_ERRORS) errors.push(message)
  }

  checkVersion(input.version, report)

  let projectName: string | undefined
  if (input.projectName !== undefined) {
    if (typeof input.projectName === 'string' && isValidProjectName(input.projectName)) {
      projectName = input.projectName
    } else {
      report(`projectName ist ungültig: muss 1 bis 100 Zeichen lang sein. ${PROJECT_NAME_RULE}`)
    }
  }

  let nodes: ModelNode[] = []
  let nodeIds = new Set<string>()
  if (Array.isArray(input.nodes)) {
    const parsed = parseNodes(input.nodes, report)
    nodes = parsed.nodes
    nodeIds = parsed.ids
  } else {
    report('Das Feld "nodes" muss eine Liste sein.')
  }

  let edges: ModelEdge[] = []
  if (Array.isArray(input.edges)) {
    edges = parseEdges(input.edges, nodeIds, report)
  } else {
    report('Das Feld "edges" muss eine Liste sein.')
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

function checkVersion(version: unknown, report: Report): void {
  if (version === SCHEMA_VERSION) return
  if (version === undefined) {
    report(`Die Versionsangabe (version) fehlt. Erwartet wird Version ${SCHEMA_VERSION}.`)
  } else {
    report(`Nicht unterstützte Version: ${show(version)}. Erwartet wird Version ${SCHEMA_VERSION}.`)
  }
}

// --- nodes -----------------------------------------------------------------

interface ParsedNodes {
  /** Fully valid nodes in input order. */
  nodes: ModelNode[]
  /** Every distinct valid id seen, including those of nodes that have other problems. */
  ids: Set<string>
}

function parseNodes(raw: readonly unknown[], report: Report): ParsedNodes {
  const firstIndexById = new Map<string, number>()
  const nodes: ModelNode[] = []
  raw.forEach((value, index) => {
    const node = parseNode(value, index, firstIndexById, report)
    if (node !== undefined) nodes.push(node)
  })

  checkParents(nodes, firstIndexById, report)
  return { nodes, ids: new Set(firstIndexById.keys()) }
}

function parseNode(
  value: unknown,
  index: number,
  firstIndexById: Map<string, number>,
  report: Report,
): ModelNode | undefined {
  if (!isRecord(value)) {
    report(`Knoten ${index + 1} ist kein Objekt.`)
    return undefined
  }

  const label = isNonEmptyString(value.id)
    ? `Knoten ${index + 1} (id ${quote(value.id)})`
    : `Knoten ${index + 1}`
  const problems: string[] = []
  const fail = (message: string): void => {
    problems.push(`${label}: ${message}`)
  }

  const id = isNonEmptyString(value.id) ? value.id : undefined
  if (id === undefined) {
    fail('Die id fehlt oder ist kein nicht-leerer Text.')
  } else if (firstIndexById.has(id)) {
    fail(`Die id ist bereits bei Knoten ${(firstIndexById.get(id) ?? 0) + 1} vergeben.`)
  } else {
    firstIndexById.set(id, index)
  }

  const kind = parseKind(value.kind)
  if (kind === undefined) fail('kind muss "node" oder "group" sein.')

  const position = parsePoint(value.position)
  if (position === undefined) fail('position benötigt endliche Zahlen x und y.')

  let size: Size | undefined
  if (value.size !== undefined) {
    size = parseSize(value.size)
    if (size === undefined) fail('size benötigt endliche Zahlen width und height größer als 0.')
  } else if (kind === 'group') {
    fail('Eine Gruppe benötigt eine Größe (size).')
  }

  const metadata = parseMetadata(value.metadata, fail)
  for (const key of findDuplicateKeys(metadata)) {
    fail(`Der Metadaten-Schlüssel ${quote(key)} kommt mehrfach vor.`)
  }

  let parentId: string | undefined
  if (value.parentId !== undefined) {
    if (typeof value.parentId === 'string') parentId = value.parentId
    else fail('parentId muss ein Text sein.')
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
  return value === 'node' || value === 'group' ? value : undefined
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
function parseMetadata(value: unknown, fail: (message: string) => void): MetadataEntry[] {
  if (value === undefined) return normalizeMetadata([])
  if (!Array.isArray(value)) {
    fail('metadata muss eine Liste sein.')
    return normalizeMetadata([])
  }
  const entries: MetadataEntry[] = []
  value.forEach((entry: unknown, index) => {
    if (isRecord(entry) && typeof entry.key === 'string' && typeof entry.value === 'string') {
      entries.push({ key: entry.key, value: entry.value })
    } else {
      fail(`metadata[${index}] benötigt die Texte key und value.`)
    }
  })
  return normalizeMetadata(entries)
}

/** parentId must reference an existing group; the parent chain must not contain a cycle. */
function checkParents(
  nodes: readonly ModelNode[],
  firstIndexById: ReadonlyMap<string, number>,
  report: Report,
): void {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const parentOf = new Map<string, string>()

  for (const node of nodes) {
    if (node.parentId === undefined) continue
    const label = `Knoten ${(firstIndexById.get(node.id) ?? 0) + 1} (id ${quote(node.id)})`
    const parent = byId.get(node.parentId)
    if (parent !== undefined) {
      if (parent.kind === 'group') parentOf.set(node.id, parent.id)
      else report(`${label}: parentId ${quote(node.parentId)} verweist auf einen Knoten, der keine Gruppe ist.`)
    } else if (!firstIndexById.has(node.parentId)) {
      // A parent that exists but is itself invalid has already been reported.
      report(`${label}: parentId ${quote(node.parentId)} verweist auf keinen vorhandenen Knoten.`)
    }
  }

  for (const cycle of findCycles(nodes, parentOf)) {
    report(`Zyklus in der Gruppenzuordnung (parentId): ${cycle.map(quote).join(' → ')}.`)
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
  report: Report,
): ModelEdge[] {
  const firstIndexById = new Map<string, number>()
  const firstIndexByPair = new Map<string, number>()
  const edges: ModelEdge[] = []

  raw.forEach((value, index) => {
    if (!isRecord(value)) {
      report(`Kante ${index + 1} ist kein Objekt.`)
      return
    }
    const label = isNonEmptyString(value.id)
      ? `Kante ${index + 1} (id ${quote(value.id)})`
      : `Kante ${index + 1}`
    const problems: string[] = []
    const fail = (message: string): void => {
      problems.push(`${label}: ${message}`)
    }

    const id = isNonEmptyString(value.id) ? value.id : undefined
    if (id === undefined) {
      fail('Die id fehlt oder ist kein nicht-leerer Text.')
    } else if (firstIndexById.has(id)) {
      fail(`Die id ist bereits bei Kante ${(firstIndexById.get(id) ?? 0) + 1} vergeben.`)
    } else {
      firstIndexById.set(id, index)
    }

    const { source, target } = value
    if (typeof source !== 'string' || typeof target !== 'string') {
      fail('source und target müssen Texte sein.')
    } else {
      if (!nodeIds.has(source)) fail(`source ${quote(source)} verweist auf keinen vorhandenen Knoten.`)
      if (!nodeIds.has(target)) fail(`target ${quote(target)} verweist auf keinen vorhandenen Knoten.`)
      if (source === target) {
        fail('source und target sind identisch.')
      } else {
        const pair = JSON.stringify([source, target])
        const firstWithPair = firstIndexByPair.get(pair)
        if (firstWithPair !== undefined) {
          fail(`Es gibt bereits eine Kante von ${quote(source)} nach ${quote(target)} (Kante ${firstWithPair + 1}).`)
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
        fail(`${field} muss ${HANDLE_SIDES.map((side) => quote(side)).join(', ')} sein.`)
      }
    }

    let caption: string | undefined
    if (value.label !== undefined) {
      if (typeof value.label === 'string') caption = value.label.trim() || undefined
      else fail('label muss ein Text sein.')
    }

    if (problems.length > 0 || id === undefined || typeof source !== 'string' || typeof target !== 'string') {
      for (const problem of problems) report(problem)
      return
    }
    edges.push({ id, source, target, ...handles, ...(caption && { label: caption }) })
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
function show(value: unknown): string {
  if (typeof value === 'string') return quote(value)
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return Array.isArray(value) ? 'Liste' : 'Objekt'
}
