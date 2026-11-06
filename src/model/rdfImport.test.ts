import { describe, expect, it } from 'vitest'
import { counterIds } from '../test/fixtures'
import { AWKWARD_ID, UUID_EDGE_ID, UUID_ID, fixtureCatalog, fullContent } from '../test/rdfFixtures'
import { createDefaultContent } from './defaultModel'
import { toTriples } from './rdfExport'
import { modelFromTriples } from './rdfImport'
import { NS, blank, idToIri, integer, iri, rm, text } from './rdfTerms'
import type { Triple } from './rdfTerms'
import { parseModelJson, serializeModel, toModel } from './serialize'
import type { ParseResult } from './serialize'
import { createTranslate } from '../i18n/translate'
import type { GraphContent } from './types'

const t = createTranslate('de')

function modelOf(result: ParseResult) {
  if (!result.ok) throw new Error(result.errors.join('\n'))
  return result.model
}

/** What the JSON path makes of the content: the reference for the RDF path. */
function viaJson(content: GraphContent) {
  return modelOf(parseModelJson(serializeModel(toModel(content))))
}

const UUID_A = '3f2b8a52-9d0e-4c1a-8b6f-0a1b2c3d4e5f'
const UUID_B = '0c9d8e7f-6a5b-4c3d-9e2f-1a0b9c8d7e6f'

const uuidContent: GraphContent = {
  nodes: [
    { id: UUID_A, kind: 'node', position: { x: 0, y: 0 }, metadata: [{ key: 'name', value: 'A' }, { key: 'class', value: 'java.lang.Object' }, { key: 'entity', value: '' }, { key: 'version', value: '' }] },
    { id: UUID_B, kind: 'node', position: { x: 200, y: 0 }, metadata: [{ key: 'name', value: 'B' }, { key: 'class', value: 'java.lang.Object' }, { key: 'entity', value: '' }, { key: 'version', value: '' }] },
  ],
  edges: [{ id: '11111111-2222-4333-8444-555555555555', source: UUID_A, target: UUID_B }],
}

/** A node whose `type` entry is the empty string (a type reference that points at nothing). */
function emptyTypeContent(): GraphContent {
  const content = fullContent()
  const nodes = content.nodes.map((node) =>
    node.id === 'worker' ? { ...node, metadata: [node.metadata[0], { key: 'type', value: '' }, ...node.metadata.slice(1)] } : node,
  )
  return { ...content, nodes }
}

describe('modelFromTriples: round trip', () => {
  it.each<[string, () => GraphContent]>([
    ['a project that uses every part of the format', fullContent],
    ['the starter graph', () => createDefaultContent(counterIds())],
    ['an empty graph', () => ({ nodes: [], edges: [] })],
    ['UUID ids', () => uuidContent],
    ['an element with an empty type entry', emptyTypeContent],
  ])('returns %s unchanged', (_name, build) => {
    const content = build()
    expect(modelOf(modelFromTriples(toTriples(content), t))).toEqual(viaJson(content))
  })

  it('keeps an empty type entry (the model accepts it, so it must not vanish)', () => {
    const model = modelOf(modelFromTriples(toTriples(emptyTypeContent()), t))
    expect(model.nodes.find((node) => node.id === 'worker')?.metadata).toContainEqual({ key: 'type', value: '' })
  })

  it('has fixtures the JSON path accepts without changing them', () => {
    const content = fullContent()
    const model = viaJson(content)
    expect(model.nodes.map((node) => node.id).sort()).toEqual(content.nodes.map((node) => node.id).sort())
    expect(model.nodes.map((node) => [node.id, node.metadata]).sort()).toEqual(content.nodes.map((node) => [node.id, node.metadata]).sort())
    expect(model.edges).toEqual(content.edges)
    expect(model.catalog).toEqual(fixtureCatalog)
  })

  it('keeps UUID ids, awkward ids and nested groups', () => {
    const model = modelOf(modelFromTriples(toTriples(fullContent()), t))
    expect(model.nodes.find((node) => node.id === UUID_ID)?.kind).toBe('node')
    expect(model.nodes.find((node) => node.id === AWKWARD_ID)?.metadata[0].value).toBe('Awkward')
    expect(model.nodes.find((node) => node.id === 'sub')?.parentId).toBe('team')
    expect(model.nodes.find((node) => node.id === 'worker')?.parentId).toBe('sub')
    expect(model.edges.find((edge) => edge.id === UUID_EDGE_ID)).toMatchObject({ source: 'api', target: UUID_ID })
  })

  it('keeps the order of the free fields and of the options of a select field', () => {
    const model = modelOf(modelFromTriples(toTriples(fullContent()), t))
    const awkward = model.nodes.find((node) => node.id === AWKWARD_ID)
    expect(awkward?.metadata.map((entry) => entry.key)).toEqual([
      'name', 'type', 'class', 'entity', 'version', 'Team name', 'Qualität', 'Zeta', 'Alpha', 'Middle',
    ])
    const tier = model.catalog.elementTypes[0].fields.find((field) => field.key === 'Tier')
    expect(tier?.options).toEqual(['3', '1', '2'])
  })

  it('ignores triples it does not know (the shortcuts and foreign data)', () => {
    const extra: Triple[] = [
      { subject: iri('urn:x:a'), predicate: iri('urn:x:p'), object: text('foreign') },
      { subject: idToIri('api'), predicate: iri('urn:x:p'), object: text('on a known resource') },
    ]
    const content = fullContent()
    expect(modelOf(modelFromTriples([...extra, ...toTriples(content)], t))).toEqual(viaJson(content))
  })

  it('does not depend on the order of the triples', () => {
    const content = fullContent()
    expect(modelOf(modelFromTriples([...toTriples(content)].reverse(), t))).toEqual(viaJson(content))
  })

  it('restores the order of nodes, edges and types from rm:index', () => {
    const content = fullContent()
    const model = modelOf(modelFromTriples([...toTriples(content)].reverse(), t))
    expect(model.edges.map((e) => e.id)).toEqual(content.edges.map((e) => e.id))
    expect(model.catalog.edgeTypes.map((x) => x.id)).toEqual(['t-call', 't-desc'])
  })

  it('writes the type fields in catalog order behind the fixed entries', () => {
    const model = modelOf(modelFromTriples(toTriples(fullContent()), t))
    const api = model.nodes.find((n) => n.id === 'api')
    expect(api?.metadata.map((e) => e.key)).toEqual([
      'name', 'color', 'status', 'type', 'class', 'entity', 'version', 'Owner', 'Tier', 'Public', 'Free field',
    ])
  })
})

describe('modelFromTriples: entry order', () => {
  it('restores the canonical order, not the stored one (fixed entries first, free fields last)', () => {
    const content: GraphContent = {
      nodes: [
        {
          id: 'n',
          kind: 'node',
          position: { x: 0, y: 0 },
          metadata: [{ key: 'name', value: 'N' }, { key: 'foo', value: 'bar' }, { key: 'color', value: '#112233' }],
        },
      ],
      edges: [],
    }
    const model = modelOf(modelFromTriples(toTriples(content), t))
    expect(model.nodes[0].metadata).toEqual([
      { key: 'name', value: 'N' },
      { key: 'color', value: '#112233' },
      { key: 'class', value: 'java.lang.Object' },
      { key: 'entity', value: '' },
      { key: 'version', value: '' },
      { key: 'foo', value: 'bar' },
    ])
  })
})

describe('modelFromTriples: errors', () => {
  const classTriple = (subject: Triple['subject'], local: string): Triple => ({
    subject,
    predicate: iri(`${NS.rdf}type`),
    object: rm(local),
  })

  it('rejects two projects', () => {
    const triples = [...toTriples(fullContent()), classTriple(blank('other'), 'Project')]
    expect(modelFromTriples(triples, t)).toEqual({ ok: false, errors: [t('rdf.error.notThisTool')] })
  })

  it('names an id that is used for a node and a connection', () => {
    const triples = [...toTriples(fullContent()), classTriple(idToIri('api'), 'Edge')]
    expect(modelFromTriples(triples, t)).toEqual({ ok: false, errors: [t('rdf.error.sharedId', { id: 'api' })] })
  })

  it('names an id that is used for a type and a node, once per id', () => {
    const triples = [
      ...toTriples(fullContent()),
      classTriple(idToIri('t-svc'), 'Node'),
      classTriple(idToIri('t-svc'), 'Group'),
      classTriple(idToIri(UUID_ID), 'Note'),
    ]
    const result = modelFromTriples(triples, t)
    expect(result.ok).toBe(false)
    const errors = result.ok ? [] : result.errors
    expect(errors).toHaveLength(2)
    expect(errors).toEqual(expect.arrayContaining([t('rdf.error.sharedId', { id: 't-svc' }), t('rdf.error.sharedId', { id: UUID_ID })]))
  })

  it('rejects data without a project resource', () => {
    const result = modelFromTriples([{ subject: iri('urn:x:a'), predicate: iri('urn:x:p'), object: text('x') }], t)
    expect(result).toEqual({ ok: false, errors: [t('rdf.error.notThisTool')] })
  })

  it('rejects an empty triple list', () => {
    expect(modelFromTriples([], t)).toEqual({ ok: false, errors: [t('rdf.error.notThisTool')] })
  })

  it('rejects a project without a schema version', () => {
    const project = blank('p')
    const triples: Triple[] = [{ subject: project, predicate: iri(`${NS.rdf}type`), object: rm('Project') }]
    expect(modelFromTriples(triples, t)).toEqual({ ok: false, errors: [t('rdf.error.notThisTool')] })
  })

  it('rejects a version it does not know', () => {
    const triples = toTriples(fullContent()).map((triple) =>
      triple.predicate.value === `${NS.rm}schemaVersion` ? { ...triple, object: integer(6) } : triple,
    )
    expect(modelFromTriples(triples, t)).toEqual({ ok: false, errors: [t('rdf.error.version', { found: 6, expected: 5 })] })
  })

  it('names a connection that lacks its end', () => {
    const triples = toTriples(fullContent()).filter(
      (triple) => !(triple.subject.value === idToIri('e1').value && triple.predicate.value === `${NS.rm}target`),
    )
    const result = modelFromTriples(triples, t)
    expect(result).toEqual({ ok: false, errors: [t('rdf.error.edgeEnds', { id: 'e1' })] })
  })

  it('reports what the model rules reject (here: a connection to a missing element)', () => {
    const triples = toTriples(fullContent()).filter(
      (triple) => !(triple.subject.value === idToIri('db').value && triple.predicate.value === `${NS.rdf}type`),
    )
    const result = modelFromTriples(triples, t)
    expect(result.ok).toBe(false)
    expect(result.ok ? [] : result.errors.join('\n')).toContain('db')
  })
})
