import Ajv2020 from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import schema from '../../public/graph.schema.json'
import { box, counterIds, group, note } from '../test/fixtures'
import { createDefaultContent } from './defaultModel'
import { addEdge } from './graph'
import { parseModel, serializeModel, toModel } from './serialize'
import { SCHEMA_VERSION } from './types'

const ajv = new Ajv2020({ allErrors: true })
const validate = ajv.compile(schema)

const entry = (key: string, value: string) => ({ key, value })
const base = () => ({
  version: 3,
  nodes: [
    { id: 'g', kind: 'group', position: { x: 0, y: 0 }, size: { width: 300, height: 200 }, metadata: [entry('name', 'G')] },
    { id: 'a', kind: 'node', parentId: 'g', position: { x: 24, y: 56 }, metadata: [entry('name', 'A')] },
    { id: 'b', kind: 'node', position: { x: 400, y: 0 }, metadata: [entry('name', 'B')] },
  ],
  edges: [{ id: 'e', source: 'a', target: 'b' }],
})

describe('graph.schema.json', () => {
  it('is a valid schema for the current format version', () => {
    expect(schema.properties.version.const).toBe(SCHEMA_VERSION)
  })

  it('accepts what the app exports', () => {
    const ids = counterIds()
    const grouped = { nodes: [group('g', 0, 0, 300, 200), box('a', 24, 56, 'g'), box('b', 400, 0)], edges: [] }
    const content = addEdge(addEdge(grouped, 'a', 'b', ids, { sourceHandle: 'right', targetHandle: 'left' }), 'g', 'b', ids)
    content.edges[0] = { ...content.edges[0], metadata: [{ key: 'name', value: 'hängt ab von' }] }

    for (const exported of [
      serializeModel(toModel({ ...createDefaultContent(counterIds()), projectName: 'Mein-Projekt_1.0' })),
      serializeModel(toModel(content)),
      serializeModel(toModel({ nodes: [], edges: [] })),
      serializeModel(toModel({ nodes: [note('n', 0, 0, 'Plan'), { ...note('m', 50, 50), size: { width: 90, height: 60 } }], edges: [] })),
    ]) {
      expect(validate(JSON.parse(exported)), JSON.stringify(validate.errors)).toBe(true)
    }
  })

  describe('agrees with the importer on the structure', () => {
    const cases: [string, (doc: ReturnType<typeof base>) => unknown][] = [
      ['valid', (d) => d],
      ['missing version', ({ version: _version, ...rest }) => rest],
      ['unknown version', (d) => ({ ...d, version: 4 })],
      ['a note', (d) => ({ ...d, nodes: [...d.nodes, { id: 'n', kind: 'note', position: { x: 0, y: 0 }, metadata: [entry('name', 'Text')] }] })],
      ['nodes not a list', (d) => ({ ...d, nodes: {} })],
      ['edges missing', ({ edges: _edges, ...rest }) => rest],
      ['unknown kind', (d) => ({ ...d, nodes: [{ ...d.nodes[2], kind: 'box' }] })],
      ['position without y', (d) => ({ ...d, nodes: [{ ...d.nodes[2], position: { x: 1 } }] })],
      ['group without size', (d) => ({ ...d, nodes: [{ ...d.nodes[0], size: undefined }] })],
      ['size of zero', (d) => ({ ...d, nodes: [{ ...d.nodes[2], size: { width: 0, height: 5 } }] })],
      ['metadata value not a text', (d) => ({ ...d, nodes: [{ ...d.nodes[2], metadata: [{ key: 'name', value: 1 }] }] })],
      ['empty id', (d) => ({ ...d, nodes: [{ ...d.nodes[2], id: '' }] })],
      ['project name with a space', (d) => ({ ...d, projectName: 'Mein Projekt' })],
      ['project name too long', (d) => ({ ...d, projectName: 'a'.repeat(101) })],
      ['project name of 100 characters', (d) => ({ ...d, projectName: 'a'.repeat(100) })],
      ['edge without target', (d) => ({ ...d, edges: [{ id: 'e', source: 'a' }] })],
      ['unknown connector side', (d) => ({ ...d, edges: [{ ...d.edges[0], sourceHandle: 'middle' }] })],
      ['edge metadata not a list', (d) => ({ ...d, edges: [{ ...d.edges[0], metadata: 'x' }] })],
      ['edge metadata entry without a value', (d) => ({ ...d, edges: [{ ...d.edges[0], metadata: [{ key: 'name' }] }] })],
      ['a named edge', (d) => ({ ...d, edges: [{ ...d.edges[0], metadata: [{ key: 'name', value: 'braucht' }] }] })],
    ]

    it.each(cases)('%s', (_name, change) => {
      const doc = JSON.parse(JSON.stringify(base()))
      const changed = change(doc)
      expect(validate(JSON.parse(JSON.stringify(changed)))).toBe(parseModel(changed).ok)
    })
  })

  describe('leaves the cross-references to the app', () => {
    it.each([
      ['a duplicate id', (d: ReturnType<typeof base>) => ({ ...d, nodes: [d.nodes[1], d.nodes[1]] })],
      ['an edge to nothing', (d: ReturnType<typeof base>) => ({ ...d, edges: [{ id: 'e', source: 'a', target: 'zzz' }] })],
      ['a self loop', (d: ReturnType<typeof base>) => ({ ...d, edges: [{ id: 'e', source: 'a', target: 'a' }] })],
      ['a parent that is no group', (d: ReturnType<typeof base>) => ({ ...d, nodes: [d.nodes[2], { ...d.nodes[1], parentId: 'b' }] })],
      [
        'duplicate metadata keys',
        (d: ReturnType<typeof base>) => ({ ...d, nodes: [{ ...d.nodes[2], metadata: [entry('name', 'x'), entry('name', 'y')] }] }),
      ],
    ])('%s is valid for the schema but rejected on import', (_name, change) => {
      const changed = change(base())
      expect(validate(changed)).toBe(true)
      expect(parseModel(changed).ok).toBe(false)
    })
  })

  it('is stricter than the importer about unknown properties (catches typos)', () => {
    const doc = { ...base(), nodes: [{ ...base().nodes[2], colour: 'red' }], edges: [] }

    expect(validate(doc)).toBe(false)
    expect(parseModel(doc).ok).toBe(true)
  })
})
