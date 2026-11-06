import { getEdgeRoles } from './edgeRoles'
import {
  FIXED_FIELDS,
  blank,
  dcterms,
  fieldPredicate,
  flag,
  idToIri,
  integer,
  iri,
  numeric,
  rdf,
  rdfs,
  rm,
  text,
} from './rdfTerms'
import type { BlankNode, EntryOwner, NamedNode, Subject, Term, Triple } from './rdfTerms'
import { isSoftEdge } from './softDependency'
import { getTypeId } from './typing'
import { EMPTY_CATALOG, NAME_KEY, SCHEMA_VERSION, TYPE_KEY } from './types'
import type { EdgeRole, ElementKind, GraphContent, MetadataEntry, TypeDef } from './types'

const KIND_CLASS: Record<ElementKind, string> = { node: 'Node', group: 'Group', note: 'Note' }

const ROLE_PREDICATE: Record<EdgeRole, NamedNode> = {
  sequence: rm('precedes'),
  dependency: dcterms('requires'),
  flow: rm('flowsTo'),
}

interface Sink {
  triples: Triple[]
  add(subject: Subject, predicate: NamedNode, object: Term): void
  blank(): BlankNode
  /** An RDF list of `items`; `rdf:nil` when empty. */
  list(items: readonly Term[]): Term
}

function createSink(): Sink {
  const triples: Triple[] = []
  let blanks = 0
  const sink: Sink = {
    triples,
    add: (subject, predicate, object) => {
      triples.push({ subject, predicate, object })
    },
    blank: () => blank(`b${blanks++}`),
    list: (items) => {
      const cells = items.map(() => sink.blank())
      items.forEach((item, position) => {
        sink.add(cells[position], rdf('first'), item)
        sink.add(cells[position], rdf('rest'), position + 1 < cells.length ? cells[position + 1] : rdf('nil'))
      })
      return cells[0] ?? rdf('nil')
    },
  }
  return sink
}

/**
 * Ids used more than once across nodes, connections and types (also within one collection), in order of first
 * occurrence. They all map to the same IRI scheme, so such resources would collapse into one in RDF.
 */
export function findSharedIds(content: GraphContent): string[] {
  const catalog = content.catalog ?? EMPTY_CATALOG
  const ids = [...content.nodes, ...content.edges, ...catalog.elementTypes, ...catalog.edgeTypes].map((item) => item.id)
  const seen = new Set<string>()
  const shared = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) shared.add(id)
    seen.add(id)
  }
  return ids.filter((id, position) => shared.has(id) && ids.indexOf(id) === position)
}

/**
 * The project as RDF triples (vocabulary: README, "RDF-Austausch"). Pure and deterministic: the same content gives
 * the same triples in the same order. `rm:index` records the position in the lists of nodes, edges and types.
 */
export function toTriples(content: GraphContent): Triple[] {
  const [sharedId] = findSharedIds(content)
  if (sharedId !== undefined) throw new Error(`Cannot write RDF: the id "${sharedId}" is used by more than one resource`)
  const catalog = content.catalog ?? EMPTY_CATALOG
  const sink = createSink()
  writeProject(sink, content)
  writeTypes(sink, catalog.elementTypes, 'ElementType')
  writeTypes(sink, catalog.edgeTypes, 'EdgeType')
  writeNodes(sink, content, catalog.elementTypes)
  writeEdges(sink, content, catalog.edgeTypes)
  return sink.triples
}

function writeProject(sink: Sink, content: GraphContent): void {
  const project = sink.blank()
  sink.add(project, rdf('type'), rm('Project'))
  sink.add(project, rm('schemaVersion'), integer(SCHEMA_VERSION))
  if (content.projectName !== undefined) sink.add(project, rdfs('label'), text(content.projectName))
}

function writeTypes(sink: Sink, types: readonly TypeDef[], kind: 'ElementType' | 'EdgeType'): void {
  types.forEach((type, position) => {
    const subject = idToIri(type.id)
    sink.add(subject, rdf('type'), kind === 'EdgeType' ? rdf('Property') : rdfs('Class'))
    sink.add(subject, rdf('type'), rm(kind))
    sink.add(subject, rdfs('label'), text(type.name))
    if (type.color !== undefined) sink.add(subject, rm('color'), text(type.color))
    if (type.icon !== undefined) sink.add(subject, rm('icon'), text(type.icon))
    for (const role of type.roles ?? []) sink.add(subject, rm('role'), text(role))
    sink.add(subject, rm('index'), integer(position))
    const fields = type.fields.map((field) => {
      const cell = sink.blank()
      sink.add(cell, rm('key'), text(field.key))
      sink.add(cell, rm('kind'), text(field.kind))
      if (field.options !== undefined) sink.add(cell, rm('options'), sink.list(field.options.map((option) => text(option))))
      if (field.required) sink.add(cell, rm('required'), flag(true))
      if (field.default !== undefined) sink.add(cell, rm('default'), text(field.default))
      const predicate = fieldPredicate(type.id, field.key)
      sink.add(predicate, rdf('type'), rdf('Property'))
      sink.add(predicate, rdfs('label'), text(field.key))
      sink.add(predicate, rdfs('domain'), subject)
      return cell
    })
    sink.add(subject, rm('field'), sink.list(fields))
  })
}

function writeNodes(sink: Sink, content: GraphContent, types: readonly TypeDef[]): void {
  content.nodes.forEach((node, position) => {
    const subject = idToIri(node.id)
    sink.add(subject, rdf('type'), rm(KIND_CLASS[node.kind]))
    sink.add(subject, rm('index'), integer(position))
    if (node.parentId !== undefined) sink.add(subject, dcterms('isPartOf'), idToIri(node.parentId))
    sink.add(subject, rm('x'), numeric(node.position.x))
    sink.add(subject, rm('y'), numeric(node.position.y))
    if (node.size !== undefined) {
      sink.add(subject, rm('width'), numeric(node.size.width))
      sink.add(subject, rm('height'), numeric(node.size.height))
    }
    writeEntries(sink, subject, node.kind, node.metadata, node.kind === 'node' ? types : [])
  })
}

function writeEdges(sink: Sink, content: GraphContent, types: readonly TypeDef[]): void {
  content.edges.forEach((edge, position) => {
    const subject = idToIri(edge.id)
    const from = idToIri(edge.source)
    const to = idToIri(edge.target)
    sink.add(subject, rdf('type'), rm('Edge'))
    sink.add(subject, rm('source'), from)
    sink.add(subject, rm('target'), to)
    if (edge.sourceHandle !== undefined) sink.add(subject, rm('sourceHandle'), text(edge.sourceHandle))
    if (edge.targetHandle !== undefined) sink.add(subject, rm('targetHandle'), text(edge.targetHandle))
    sink.add(subject, rm('index'), integer(position))
    const entries = edge.metadata ?? []
    writeEntries(sink, subject, 'edge', entries, types)

    // Shortcuts for third parties; the import reads the connection resource above and ignores these.
    const soft = isSoftEdge(edge)
    for (const role of getEdgeRoles(edge, content.catalog)) {
      sink.add(from, role === 'sequence' && soft ? rm('softPrecedes') : ROLE_PREDICATE[role], to)
    }
    const typeId = getTypeId(entries)
    if (typeId !== undefined) sink.add(from, idToIri(typeId), to)
  })
}

/**
 * Writes the metadata of one element or connection: fixed entries (exact key spelling) as their own predicates,
 * type fields of a known type as predicates of that type, everything else as an ordered list of key/value pairs.
 */
function writeEntries(
  sink: Sink,
  subject: Subject,
  owner: EntryOwner,
  entries: readonly MetadataEntry[],
  types: readonly TypeDef[],
): void {
  const fixed = new Map(FIXED_FIELDS[owner].map((field) => [field.key, field.predicate]))
  const typeId = owner === 'node' || owner === 'edge' ? getTypeId(entries) : undefined
  const def = typeId === undefined ? undefined : types.find((type) => type.id === typeId)
  const fieldKeys = new Set(def?.fields.map((field) => field.key))
  const free: MetadataEntry[] = []

  for (const entry of entries) {
    const predicate = fixed.get(entry.key)
    if (predicate !== undefined) {
      // An unnamed connection carries no label: the import drops the empty name the same way.
      if (owner === 'edge' && entry.key === NAME_KEY && entry.value === '') continue
      sink.add(subject, iri(predicate), entry.key === TYPE_KEY ? idToIri(entry.value) : text(entry.value))
    } else if (def !== undefined && fieldKeys.has(entry.key)) {
      sink.add(subject, fieldPredicate(def.id, entry.key), text(entry.value))
    } else {
      free.push(entry)
    }
  }
  // Only objects are instances of their type; a connection type is an rdf:Property, not a class.
  if (def !== undefined && owner === 'node') sink.add(subject, rdf('type'), idToIri(def.id))
  if (free.length > 0) {
    const pairs = free.map((entry) => {
      const pair = sink.blank()
      sink.add(pair, rm('key'), text(entry.key))
      sink.add(pair, rm('value'), text(entry.value))
      return pair
    })
    sink.add(subject, rm('metadata'), sink.list(pairs))
  }
}
