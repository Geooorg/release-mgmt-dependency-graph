import { CLASS_KEY, ENTITY_KEY, VERSION_KEY } from './objectFields'
import { SOFT_KEY } from './softDependency'
import { BLOCK_REASON_KEY, STATUS_KEY } from './status'
import { COLOR_KEY, NAME_KEY, TYPE_KEY } from './types'
import type { ElementKind } from './types'

/**
 * RDF exchange format (Turtle). A minimal term model in the shape of RDF/JS, so the pure model code
 * needs no RDF library; `storage/rdfIo.ts` converts to and from `n3`.
 */

/** `rm` is this tool's own vocabulary (documented in the README). */
export const NS = {
  rm: 'urn:release-management:vocab:',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  dcterms: 'http://purl.org/dc/terms/',
} as const

export interface NamedNode {
  termType: 'NamedNode'
  value: string
}

export interface BlankNode {
  termType: 'BlankNode'
  value: string
}

export interface Literal {
  termType: 'Literal'
  value: string
  datatype: string
}

export type Subject = NamedNode | BlankNode
export type Term = NamedNode | BlankNode | Literal

export interface Triple {
  subject: Subject
  predicate: NamedNode
  object: Term
}

export const iri = (value: string): NamedNode => ({ termType: 'NamedNode', value })
export const blank = (label: string): BlankNode => ({ termType: 'BlankNode', value: label })
export const rm = (local: string): NamedNode => iri(NS.rm + local)
export const rdf = (local: string): NamedNode => iri(NS.rdf + local)
export const rdfs = (local: string): NamedNode => iri(NS.rdfs + local)
export const dcterms = (local: string): NamedNode => iri(NS.dcterms + local)

export const text = (value: string): Literal => ({ termType: 'Literal', value, datatype: `${NS.xsd}string` })
export const integer = (value: number): Literal => ({ termType: 'Literal', value: String(value), datatype: `${NS.xsd}integer` })
export const flag = (value: boolean): Literal => ({ termType: 'Literal', value: String(value), datatype: `${NS.xsd}boolean` })

/** Whole numbers as `xsd:integer`, everything else as `xsd:double` (JavaScript spelling, which is valid for both). */
export function numeric(value: number): Literal {
  if (Number.isSafeInteger(value)) return integer(value)
  return { termType: 'Literal', value: String(value), datatype: `${NS.xsd}double` }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const UUID_URN = 'urn:uuid:'
const ID_URN = 'urn:release-management:id:'

/** UUIDs become `urn:uuid:` IRIs; any other id (older files, tests) is percent-encoded under the tool namespace. */
export function idToIri(id: string): NamedNode {
  return iri(UUID_PATTERN.test(id) ? UUID_URN + id : ID_URN + encodeURIComponent(id))
}

/** Inverse of `idToIri`; an IRI of neither scheme is returned unchanged. */
export function iriToId(value: string): string {
  if (value.startsWith(UUID_URN)) return value.slice(UUID_URN.length)
  if (value.startsWith(ID_URN)) {
    const encoded = value.slice(ID_URN.length)
    try {
      return decodeURIComponent(encoded)
    } catch {
      return encoded
    }
  }
  return value
}

/** Predicate carrying the value of the type field `key` of the type `typeId`. */
export function fieldPredicate(typeId: string, key: string): NamedNode {
  return iri(`${idToIri(typeId).value}#${encodeURIComponent(key)}`)
}

/** Which element or connection a metadata list belongs to. */
export type EntryOwner = ElementKind | 'edge'

export interface FixedField {
  /** Metadata key (exact spelling). */
  key: string
  /** Predicate IRI that carries the value. */
  predicate: string
}

const LABEL = `${NS.rdfs}label`
const field = (key: string, predicate: string): FixedField => ({ key, predicate })

const COLORED: readonly FixedField[] = [field(NAME_KEY, LABEL), field(COLOR_KEY, `${NS.rm}color`)]

/**
 * The metadata entries that get their own predicate, in canonical order (name, color, status, blockiert_grund,
 * type, class, entity, version; connections: name, optional, type). Export and import both read this table.
 * Everything else is a type field or goes into the ordered free-field list.
 */
export const FIXED_FIELDS: Record<EntryOwner, readonly FixedField[]> = {
  node: [
    field(NAME_KEY, LABEL),
    field(COLOR_KEY, `${NS.rm}color`),
    field(STATUS_KEY, `${NS.rm}status`),
    field(BLOCK_REASON_KEY, `${NS.rm}blockReason`),
    field(TYPE_KEY, `${NS.rm}type`),
    field(CLASS_KEY, `${NS.rm}class`),
    field(ENTITY_KEY, `${NS.rm}entity`),
    field(VERSION_KEY, `${NS.rm}version`),
  ],
  group: COLORED,
  note: COLORED,
  edge: [field(NAME_KEY, LABEL), field(SOFT_KEY, `${NS.rm}optional`), field(TYPE_KEY, `${NS.rm}type`)],
}
