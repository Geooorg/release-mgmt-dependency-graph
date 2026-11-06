import { describe, expect, it } from 'vitest'
import { fullContent } from '../test/rdfFixtures'
import { findSharedIds, toTriples } from './rdfExport'
import { NS, idToIri } from './rdfTerms'
import type { Term, Triple } from './rdfTerms'
import type { GraphContent } from './types'

const id = (value: string) => idToIri(value).value
const RM = NS.rm
const RDF_TYPE = `${NS.rdf}type`
const LABEL = `${NS.rdfs}label`

function valuesOf(triples: readonly Triple[], subject: string, predicate: string): Term[] {
  return triples.filter((t) => t.subject.value === subject && t.predicate.value === predicate).map((t) => t.object)
}

const one = (triples: readonly Triple[], subject: string, predicate: string) => valuesOf(triples, subject, predicate)[0]

describe('toTriples: project', () => {
  const triples = toTriples(fullContent())
  const project = triples.find((t) => t.predicate.value === RDF_TYPE && t.object.value === `${RM}Project`)

  it('writes one project resource with the schema version and name', () => {
    expect(project?.subject.termType).toBe('BlankNode')
    const subject = project?.subject.value ?? ''
    expect(one(triples, subject, `${RM}schemaVersion`)).toEqual({ termType: 'Literal', value: '5', datatype: `${NS.xsd}integer` })
    expect(one(triples, subject, LABEL)?.value).toBe('My-Project_1.0')
  })

  it('omits the label when the project has no name', () => {
    const without = toTriples({ ...fullContent(), projectName: undefined })
    const subject = without.find((t) => t.object.value === `${RM}Project`)?.subject.value ?? ''
    expect(valuesOf(without, subject, LABEL)).toEqual([])
  })

  it('writes an empty graph as just the project', () => {
    expect(toTriples({ nodes: [], edges: [] })).toHaveLength(2)
  })
})

describe('toTriples: elements', () => {
  const triples = toTriples(fullContent())

  it('writes class, index, parent, label, position and size', () => {
    const api = id('api')
    expect(one(triples, api, RDF_TYPE)?.value).toBe(`${RM}Node`)
    expect(one(triples, api, `${RM}index`)?.value).toBe('2')
    expect(one(triples, api, `${NS.dcterms}isPartOf`)).toEqual(idToIri('team'))
    expect(one(triples, api, LABEL)?.value).toBe('API "Gateway"')
    expect(one(triples, api, `${RM}x`)).toMatchObject({ value: '24', datatype: `${NS.xsd}integer` })
    expect(one(triples, api, `${RM}y`)).toMatchObject({ value: '56.5', datatype: `${NS.xsd}double` })
    expect(valuesOf(triples, api, `${RM}width`)).toEqual([])
    expect(one(triples, id('queue'), `${RM}width`)?.value).toBe('200')
  })

  it('writes the fixed entries as their own predicates', () => {
    const api = id('api')
    expect(one(triples, api, `${RM}color`)?.value).toBe('#ff0000')
    expect(one(triples, api, `${RM}status`)?.value).toBe('in Arbeit')
    expect(one(triples, api, `${RM}class`)?.value).toBe('java.lang.Object')
    expect(one(triples, api, `${RM}entity`)?.value).toBe('E-1')
    expect(one(triples, id('db'), `${RM}blockReason`)?.value).toBe('waiting for approval')
  })

  it('writes the name even when it is empty', () => {
    expect(one(triples, id('db'), LABEL)?.value).toBe('')
  })

  it('writes the type as an IRI, and as a class only when the catalog knows it', () => {
    expect(one(triples, id('api'), `${RM}type`)).toEqual(idToIri('t-svc'))
    expect(valuesOf(triples, id('api'), RDF_TYPE)).toContainEqual(idToIri('t-svc'))
    expect(one(triples, id('queue'), `${RM}type`)).toEqual(idToIri('gone'))
    expect(valuesOf(triples, id('queue'), RDF_TYPE)).not.toContainEqual(idToIri('gone'))
  })

  it('writes type fields as predicates of the type and keeps other entries in an ordered list', () => {
    const api = id('api')
    expect(one(triples, api, `${id('t-svc')}#Owner`)?.value).toBe('Team A')
    expect(one(triples, api, `${id('t-svc')}#Tier`)?.value).toBe('2')
    expect(one(triples, api, `${RM}metadata`)?.termType).toBe('BlankNode')
    expect(valuesOf(triples, id('db'), `${RM}metadata`)).toEqual([])
  })

  it('keeps entries of an unknown type in the list', () => {
    const content = fullContent()
    const api = content.nodes.find((n) => n.id === 'api')
    if (api) api.metadata = api.metadata.map((e) => (e.key === 'type' ? { key: 'type', value: 'gone' } : e))
    const unknown = toTriples(content)
    expect(valuesOf(unknown, id('api'), `${id('t-svc')}#Owner`)).toEqual([])
    expect(one(unknown, id('api'), `${RM}metadata`)?.termType).toBe('BlankNode')
  })

  it('writes groups and notes without object fields', () => {
    expect(one(triples, id('team'), RDF_TYPE)?.value).toBe(`${RM}Group`)
    expect(one(triples, id('team'), `${RM}width`)?.value).toBe('400')
    expect(one(triples, id('team'), `${RM}color`)?.value).toBe('#112233')
    expect(valuesOf(triples, id('team'), `${RM}class`)).toEqual([])
    expect(one(triples, id('sticky'), RDF_TYPE)?.value).toBe(`${RM}Note`)
    expect(one(triples, id('sticky'), LABEL)?.value).toBe('multi\nline note')
  })
})

describe('toTriples: connections', () => {
  const triples = toTriples(fullContent())

  it('writes the connection resource with ends, connectors, label and type', () => {
    const e1 = id('e1')
    expect(one(triples, e1, RDF_TYPE)?.value).toBe(`${RM}Edge`)
    expect(one(triples, e1, `${RM}source`)).toEqual(idToIri('api'))
    expect(one(triples, e1, `${RM}target`)).toEqual(idToIri('db'))
    expect(one(triples, e1, `${RM}sourceHandle`)?.value).toBe('right')
    expect(one(triples, e1, `${RM}targetHandle`)?.value).toBe('left')
    expect(one(triples, e1, LABEL)?.value).toBe('calls')
    expect(one(triples, e1, `${RM}type`)).toEqual(idToIri('t-call'))
    expect(one(triples, e1, `${id('t-call')}#Protocol`)?.value).toBe('gRPC')
    expect(one(triples, e1, `${RM}metadata`)?.termType).toBe('BlankNode')
    expect(valuesOf(triples, id('e5'), `${RM}sourceHandle`)).toEqual([])
  })

  it('does not make a connection an instance of its type (the type is a property, not a class)', () => {
    expect(valuesOf(triples, id('e1'), RDF_TYPE).map((t) => t.value)).toEqual([`${RM}Edge`])
  })

  it('leaves out an empty label and writes the optional marker', () => {
    expect(valuesOf(triples, id('e2'), LABEL)).toEqual([])
    expect(one(triples, id('e2'), `${RM}optional`)?.value).toBe('ja')
  })

  const between = (source: string, target: string) =>
    triples
      .filter((t) => t.subject.value === id(source) && t.object.value === id(target) && t.subject.termType === 'NamedNode')
      .map((t) => t.predicate.value)
      .sort()

  it('adds one shortcut per effective role, plus the type IRI as predicate', () => {
    expect(between('api', 'db')).toEqual([`${NS.dcterms}requires`, `${RM}flowsTo`, id('t-call')].sort())
  })

  it('uses the soft predicate for an optional untyped connection', () => {
    expect(between('db', 'queue')).toEqual([`${RM}softPrecedes`])
  })

  it('writes only the type predicate for descriptive and unknown types', () => {
    expect(between('queue', 'team2')).toEqual([id('t-desc')])
    expect(between('api', 'queue')).toEqual([id('gone-edge')])
  })

  it('treats a connection without a type as a sequence', () => {
    expect(between('team2', 'api')).toEqual([`${RM}precedes`])
  })
})

describe('toTriples: catalog', () => {
  const triples = toTriples(fullContent())

  it('writes types as classes (objects) and properties (connections) with their settings', () => {
    const svc = id('t-svc')
    expect(valuesOf(triples, svc, RDF_TYPE).map((t) => t.value).sort()).toEqual([`${NS.rdfs}Class`, `${RM}ElementType`].sort())
    expect(one(triples, svc, LABEL)?.value).toBe('Service')
    expect(one(triples, svc, `${RM}color`)?.value).toBe('#16a34a')
    expect(one(triples, svc, `${RM}icon`)?.value).toBe('service')
    expect(one(triples, svc, `${RM}index`)?.value).toBe('0')
    const call = id('t-call')
    expect(valuesOf(triples, call, RDF_TYPE).map((t) => t.value).sort()).toEqual([`${NS.rdf}Property`, `${RM}EdgeType`].sort())
    expect(valuesOf(triples, call, `${RM}role`).map((t) => t.value)).toEqual(['dependency', 'flow'])
    expect(one(triples, id('t-desc'), `${RM}index`)?.value).toBe('1')
  })

  it('describes each type field as a property of its type', () => {
    const owner = `${id('t-svc')}#Owner`
    expect(one(triples, owner, RDF_TYPE)?.value).toBe(`${NS.rdf}Property`)
    expect(one(triples, owner, LABEL)?.value).toBe('Owner')
    expect(one(triples, owner, `${NS.rdfs}domain`)).toEqual(idToIri('t-svc'))
  })

  it('writes the fields of a type as a list, an empty one as rdf:nil', () => {
    expect(one(triples, id('t-svc'), `${RM}field`)?.termType).toBe('BlankNode')
    expect(one(triples, id('t-desc'), `${RM}field`)).toEqual({ termType: 'NamedNode', value: `${NS.rdf}nil` })
  })
})

describe('shared ids', () => {
  const node = (nodeId: string) => ({ id: nodeId, kind: 'node' as const, position: { x: 0, y: 0 }, metadata: [{ key: 'name', value: nodeId }] })
  const withCatalog = (content: GraphContent, elementIds: string[], edgeIds: string[]): GraphContent => ({
    ...content,
    catalog: {
      elementTypes: elementIds.map((typeId) => ({ id: typeId, name: typeId, fields: [] })),
      edgeTypes: edgeIds.map((typeId) => ({ id: typeId, name: typeId, fields: [] })),
    },
  })
  const clashes: [string, GraphContent][] = [
    ['a node and a connection', { nodes: [node('a'), node('b')], edges: [{ id: 'a', source: 'a', target: 'b' }] }],
    ['a node and an element type', withCatalog({ nodes: [node('a')], edges: [] }, ['a'], [])],
    ['a connection and a connection type', withCatalog({ nodes: [node('a'), node('b')], edges: [{ id: 'x', source: 'a', target: 'b' }] }, [], ['x'])],
    ['two nodes', { nodes: [node('a'), node('a')], edges: [] }],
  ]

  it('finds none in a project with distinct ids', () => {
    expect(findSharedIds(fullContent())).toEqual([])
  })

  it.each(clashes)('finds the id shared by %s', (_name, content) => {
    expect(findSharedIds(content)).toHaveLength(1)
  })

  it('lists each shared id once, in order of first occurrence', () => {
    const content = withCatalog(
      { nodes: [node('a'), node('b'), node('a')], edges: [{ id: 'b', source: 'a', target: 'b' }, { id: 'a', source: 'b', target: 'a' }] },
      ['b'],
      [],
    )
    expect(findSharedIds(content)).toEqual(['a', 'b'])
  })

  it.each(clashes)('refuses to write RDF for %s', (_name, content) => {
    expect(() => toTriples(content)).toThrow(/Cannot write RDF.*"(a|x)"/)
  })
})

describe('toTriples: determinism', () => {
  it('returns the same triples for the same content', () => {
    expect(toTriples(fullContent())).toEqual(toTriples(fullContent()))
  })

  it('does not change its input', () => {
    const content = fullContent()
    const copy = structuredClone(content)
    toTriples(content)
    expect(content).toEqual(copy)
  })
})
