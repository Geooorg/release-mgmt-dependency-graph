import { createTranslate } from '../i18n/translate'
import type { Translate } from '../i18n/translate'
import { tidyEdgeMetadata } from './metadata'
import { FIXED_FIELDS, NS, fieldPredicate, iriToId } from './rdfTerms'
import type { EntryOwner, NamedNode, Subject, Term, Triple } from './rdfTerms'
import { parseModel } from './serialize'
import type { ParseResult } from './serialize'
import { EDGE_ROLES, SCHEMA_VERSION, TYPE_KEY } from './types'
import type { ElementKind, MetadataEntry } from './types'

const RM = NS.rm
const RDF_TYPE = `${NS.rdf}type`
const RDF_FIRST = `${NS.rdf}first`
const RDF_REST = `${NS.rdf}rest`
const RDF_NIL = `${NS.rdf}nil`

const NODE_CLASSES: readonly (readonly [string, ElementKind])[] = [
  ['Node', 'node'],
  ['Group', 'group'],
  ['Note', 'note'],
]

interface Index {
  all(subject: Subject, predicate: string): Term[]
  one(subject: Subject, predicate: string): Term | undefined
  subjectsOfType(classIri: string): Subject[]
  /** Items of the RDF list starting at `head`; empty for `rdf:nil`, a missing head or a broken list. */
  list(head: Term | undefined): Term[]
}

/** A type read from the file: the raw object for the catalog plus what the entries need to find its fields. */
interface ReadType {
  id: string
  fieldKeys: string[]
  raw: Record<string, unknown>
}

const keyOf = (term: Term): string => `${term.termType}|${term.value}`
const isSubject = (term: Term): term is Subject => term.termType !== 'Literal'
const isNamed = (term: Term): term is NamedNode => term.termType === 'NamedNode'

const textOf = (term: Term | undefined): string | undefined => (term?.termType === 'Literal' ? term.value : undefined)

function numberOf(term: Term | undefined): number | undefined {
  const value = textOf(term)
  if (value === undefined || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const fail = (message: string): ParseResult => ({ ok: false, errors: [message] })

function createIndex(triples: readonly Triple[]): Index {
  const bySubject = new Map<string, Triple[]>()
  for (const triple of triples) {
    const key = keyOf(triple.subject)
    const known = bySubject.get(key)
    if (known === undefined) bySubject.set(key, [triple])
    else known.push(triple)
  }

  const all = (subject: Subject, predicate: string): Term[] =>
    (bySubject.get(keyOf(subject)) ?? []).filter((triple) => triple.predicate.value === predicate).map((triple) => triple.object)
  const one = (subject: Subject, predicate: string): Term | undefined => all(subject, predicate)[0]

  const subjectsOfType = (classIri: string): Subject[] => {
    const seen = new Set<string>()
    const result: Subject[] = []
    for (const triple of triples) {
      if (triple.predicate.value !== RDF_TYPE || !isNamed(triple.object) || triple.object.value !== classIri) continue
      const key = keyOf(triple.subject)
      if (seen.has(key)) continue
      seen.add(key)
      result.push(triple.subject)
    }
    return result
  }

  const list = (head: Term | undefined): Term[] => {
    const items: Term[] = []
    const seen = new Set<string>()
    let cell: Term | undefined = head
    while (cell !== undefined && isSubject(cell) && !(isNamed(cell) && cell.value === RDF_NIL) && !seen.has(keyOf(cell))) {
      seen.add(keyOf(cell))
      const first = one(cell, RDF_FIRST)
      if (first !== undefined) items.push(first)
      cell = one(cell, RDF_REST)
    }
    return items
  }

  return { all, one, subjectsOfType, list }
}

/** Sorts by `rm:index`; items without one go last, ties keep the order of the file. */
function inIndexOrder<T extends { subject: Subject }>(index: Index, items: T[]): T[] {
  return items
    .map((item, position) => ({ item, position, order: numberOf(index.one(item.subject, `${RM}index`)) ?? Infinity }))
    .sort((a, b) => (a.order === b.order ? a.position - b.position : a.order < b.order ? -1 : 1))
    .map(({ item }) => item)
}

/**
 * Metadata in canonical order: fixed entries, then the type fields in catalog order, then the free list.
 * Built directly in that order (the same table the export uses), so no later reordering is needed.
 */
function readEntries(index: Index, subject: Subject, owner: EntryOwner, types: readonly ReadType[]): MetadataEntry[] {
  const entries: MetadataEntry[] = []
  let typeId: string | undefined
  for (const { key, predicate } of FIXED_FIELDS[owner]) {
    const object = index.one(subject, predicate)
    const value = key === TYPE_KEY && object !== undefined && isNamed(object) ? iriToId(object.value) : textOf(object)
    if (value === undefined) continue
    entries.push({ key, value })
    if (key === TYPE_KEY) typeId = value
  }

  const def = typeId === undefined ? undefined : types.find((type) => type.id === typeId)
  if (def !== undefined) {
    for (const key of def.fieldKeys) {
      const value = textOf(index.one(subject, fieldPredicate(def.id, key).value))
      if (value !== undefined) entries.push({ key, value })
    }
  }

  for (const pair of index.list(index.one(subject, `${RM}metadata`))) {
    if (!isSubject(pair)) continue
    const key = textOf(index.one(pair, `${RM}key`))
    const value = textOf(index.one(pair, `${RM}value`))
    if (key !== undefined && value !== undefined) entries.push({ key, value })
  }
  return entries
}

function readField(index: Index, cell: Subject): Record<string, unknown> {
  const optionsHead = index.one(cell, `${RM}options`)
  const options = optionsHead === undefined ? undefined : index.list(optionsHead).map(textOf).filter((o) => o !== undefined)
  const required = textOf(index.one(cell, `${RM}required`)) === 'true'
  const fallback = textOf(index.one(cell, `${RM}default`))
  return {
    key: textOf(index.one(cell, `${RM}key`)),
    kind: textOf(index.one(cell, `${RM}kind`)),
    ...(options !== undefined && { options }),
    ...(required && { required: true }),
    ...(fallback !== undefined && { default: fallback }),
  }
}

const rank = (role: string): number => {
  const position = (EDGE_ROLES as readonly string[]).indexOf(role)
  return position === -1 ? EDGE_ROLES.length : position
}

function readTypes(index: Index, kind: 'ElementType' | 'EdgeType'): ReadType[] {
  const named = index.subjectsOfType(RM + kind).filter(isNamed).map((subject) => ({ subject }))
  return inIndexOrder(index, named).map(({ subject }) => {
    const id = iriToId(subject.value)
    const fields = index.list(index.one(subject, `${RM}field`)).filter(isSubject).map((cell) => readField(index, cell))
    const color = textOf(index.one(subject, `${RM}color`))
    const icon = textOf(index.one(subject, `${RM}icon`))
    const roles = index
      .all(subject, `${RM}role`)
      .map(textOf)
      .filter((role) => role !== undefined)
      .sort((a, b) => rank(a) - rank(b))
    const raw: Record<string, unknown> = {
      id,
      name: textOf(index.one(subject, `${NS.rdfs}label`)) ?? '',
      ...(color !== undefined && { color }),
      ...(icon !== undefined && { icon }),
      ...(kind === 'EdgeType' && roles.length > 0 && { roles }),
      fields,
    }
    return { id, fieldKeys: fields.flatMap((field) => (typeof field.key === 'string' ? [field.key] : [])), raw }
  })
}

function readNodes(index: Index, types: readonly ReadType[]): unknown[] {
  const found = NODE_CLASSES.flatMap(([local, kind]) =>
    index.subjectsOfType(RM + local).filter(isNamed).map((subject) => ({ subject, kind })),
  )
  return inIndexOrder(index, found).map(({ subject, kind }) => {
    const parent = index.one(subject, `${NS.dcterms}isPartOf`)
    const width = numberOf(index.one(subject, `${RM}width`))
    const height = numberOf(index.one(subject, `${RM}height`))
    return {
      id: iriToId(subject.value),
      kind,
      ...(parent !== undefined && isNamed(parent) && { parentId: iriToId(parent.value) }),
      position: { x: numberOf(index.one(subject, `${RM}x`)), y: numberOf(index.one(subject, `${RM}y`)) },
      ...(width !== undefined && height !== undefined && { size: { width, height } }),
      metadata: readEntries(index, subject, kind, kind === 'node' ? types : []),
    }
  })
}

function readEdges(index: Index, types: readonly ReadType[], errors: string[], t: Translate): unknown[] {
  const named = index.subjectsOfType(`${RM}Edge`).filter(isNamed).map((subject) => ({ subject }))
  const edges: unknown[] = []
  for (const { subject } of inIndexOrder(index, named)) {
    const id = iriToId(subject.value)
    const source = index.one(subject, `${RM}source`)
    const target = index.one(subject, `${RM}target`)
    if (source === undefined || target === undefined || !isNamed(source) || !isNamed(target)) {
      errors.push(t('rdf.error.edgeEnds', { id }))
      continue
    }
    const sourceHandle = textOf(index.one(subject, `${RM}sourceHandle`))
    const targetHandle = textOf(index.one(subject, `${RM}targetHandle`))
    const metadata = tidyEdgeMetadata(readEntries(index, subject, 'edge', types))
    edges.push({
      id,
      source: iriToId(source.value),
      target: iriToId(target.value),
      ...(sourceHandle !== undefined && { sourceHandle }),
      ...(targetHandle !== undefined && { targetHandle }),
      ...(metadata !== undefined && { metadata }),
    })
  }
  return edges
}

/**
 * Reads triples written by `toTriples` back into a model. Only the resources of the tool's own vocabulary count;
 * the shortcut triples and any foreign triples are ignored. The assembled object goes through `parseModel`, so every
 * model rule (unique ids, parents, connections, catalog) applies exactly as for a JSON file.
 */
export function modelFromTriples(triples: readonly Triple[], t: Translate = createTranslate('de')): ParseResult {
  const index = createIndex(triples)
  const projects = index.subjectsOfType(`${RM}Project`)
  if (projects.length !== 1) return fail(t('rdf.error.notThisTool'))
  const project = projects[0]
  const version = numberOf(index.one(project, `${RM}schemaVersion`))
  if (version === undefined) return fail(t('rdf.error.notThisTool'))
  if (version !== SCHEMA_VERSION) return fail(t('rdf.error.version', { found: version, expected: SCHEMA_VERSION }))

  const elementTypes = readTypes(index, 'ElementType')
  const edgeTypes = readTypes(index, 'EdgeType')
  const nodes = readNodes(index, elementTypes)
  const errors: string[] = []
  const edges = readEdges(index, edgeTypes, errors, t)
  if (errors.length > 0) return { ok: false, errors }

  const projectName = textOf(index.one(project, `${NS.rdfs}label`))
  return parseModel(
    {
      version: SCHEMA_VERSION,
      ...(projectName !== undefined && { projectName }),
      catalog: { elementTypes: elementTypes.map((type) => type.raw), edgeTypes: edgeTypes.map((type) => type.raw) },
      nodes,
      edges,
    },
    t,
  )
}
