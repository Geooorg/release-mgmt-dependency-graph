import { describe, expect, it } from 'vitest'
import { exportFileName, parseModel, parseModelJson, serializeModel, toModel } from './serialize'
import type { ParseResult } from './serialize'
import type { GraphContent, GraphModel } from './types'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>

/** A valid untrusted input (plain JSON shape) that individual tests then break on purpose. */
function validInput(): { version: unknown; nodes: Json[]; edges: Json[] } {
  return {
    version: 1,
    nodes: [
      {
        id: 'g1',
        kind: 'group',
        position: { x: 0, y: 0 },
        size: { width: 400, height: 300 },
        metadata: [{ key: 'name', value: 'Gruppe' }],
      },
      {
        id: 'n1',
        kind: 'node',
        parentId: 'g1',
        position: { x: 24, y: 56 },
        metadata: [
          { key: 'name', value: 'A' },
          { key: 'owner', value: 'Anna' },
        ],
      },
      {
        id: 'n2',
        kind: 'node',
        position: { x: 500, y: 20 },
        size: { width: 200, height: 80 },
        metadata: [{ key: 'name', value: 'B' }],
      },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
  }
}

/** Appends an unreferenced plain node (4th node) so that breaking it cannot cascade into edges. */
function addLoneNode(input: ReturnType<typeof validInput>): Json {
  const lone: Json = { id: 'lone', kind: 'node', position: { x: 0, y: 0 } }
  input.nodes.push(lone)
  return lone
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

function errorsOf(result: ParseResult): string[] {
  if (result.ok) throw new Error('expected parse failure, got a model')
  return result.errors
}

function modelOf(result: ParseResult): GraphModel {
  if (!result.ok) throw new Error(`expected a model, got errors: ${result.errors.join(' | ')}`)
  return result.model
}

function allErrors(input: unknown): string {
  return errorsOf(parseModel(input)).join('\n')
}

const sampleModel: GraphModel = {
  version: 1,
  nodes: [
    {
      id: 'g1',
      kind: 'group',
      position: { x: -10.5, y: 20 },
      size: { width: 400, height: 300 },
      metadata: [
        { key: 'name', value: 'Gruppe "A"' },
        { key: 'note', value: 'Zeile 1\nZeile 2 – Ünïcödé' },
      ],
    },
    {
      id: 'n1',
      kind: 'node',
      parentId: 'g1',
      position: { x: 24, y: 56 },
      metadata: [{ key: 'name', value: 'A' }],
    },
    {
      id: 'n2',
      kind: 'node',
      position: { x: 500, y: 20 },
      size: { width: 200, height: 80 },
      metadata: [
        { key: 'name', value: '' },
        { key: 'empty', value: '' },
      ],
    },
  ],
  edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
}

// ---------------------------------------------------------------------------
// toModel
// ---------------------------------------------------------------------------

describe('toModel', () => {
  const content: GraphContent = {
    nodes: [
      { id: 'c', kind: 'node', parentId: 'g', position: { x: 0, y: 0 }, metadata: [{ key: 'name', value: 'c' }] },
      { id: 'g', kind: 'group', position: { x: 0, y: 0 }, size: { width: 200, height: 100 }, metadata: [{ key: 'name', value: 'g' }] },
    ],
    edges: [{ id: 'e', source: 'c', target: 'g' }],
  }

  it('adds the schema version and orders the nodes parents first', () => {
    const model = toModel(content)
    expect(model.version).toBe(1)
    expect(model.nodes.map((n) => n.id)).toEqual(['g', 'c'])
    expect(model.edges).toEqual(content.edges)
  })

  it('has the key order version, nodes, edges', () => {
    expect(Object.keys(toModel(content))).toEqual(['version', 'nodes', 'edges'])
  })

  it('does not mutate its input', () => {
    const frozen = deepFreeze(structuredClone(content))
    const model = toModel(frozen)
    expect(frozen.nodes.map((n) => n.id)).toEqual(['c', 'g'])
    expect(model.nodes).not.toBe(frozen.nodes)
  })
})

// ---------------------------------------------------------------------------
// parseModel
// ---------------------------------------------------------------------------

describe('parseModel: success', () => {
  it('accepts an empty graph', () => {
    expect(modelOf(parseModel({ version: 1, nodes: [], edges: [] }))).toEqual({
      version: 1,
      nodes: [],
      edges: [],
    })
  })

  it('accepts a valid graph with groups, nested nodes and edges', () => {
    const model = modelOf(parseModel(validInput()))
    expect(model.version).toBe(1)
    expect(model.nodes.map((n) => n.id)).toEqual(['g1', 'n1', 'n2'])
    expect(model.nodes[1]).toEqual({
      id: 'n1',
      kind: 'node',
      parentId: 'g1',
      position: { x: 24, y: 56 },
      metadata: [
        { key: 'name', value: 'A' },
        { key: 'owner', value: 'Anna' },
      ],
    })
    expect(model.nodes[2].size).toEqual({ width: 200, height: 80 })
    expect(model.edges).toEqual([{ id: 'e1', source: 'n1', target: 'n2' }])
  })

  it('does not set size or parentId when the input has none', () => {
    const model = modelOf(parseModel(validInput()))
    expect('size' in model.nodes[1]).toBe(false)
    expect('parentId' in model.nodes[0]).toBe(false)
  })

  it('tolerates missing metadata and yields an empty name entry', () => {
    const input = validInput()
    delete input.nodes[2].metadata
    expect(modelOf(parseModel(input)).nodes[2].metadata).toEqual([{ key: 'name', value: '' }])
  })

  it('normalizes metadata (trim, drop empty keys, name first)', () => {
    const input = validInput()
    input.nodes[1].metadata = [
      { key: ' owner ', value: ' Anna ' },
      { key: '  ', value: 'dropped' },
      { key: 'name', value: ' A ' },
    ]
    expect(modelOf(parseModel(input)).nodes[1].metadata).toEqual([
      { key: 'name', value: 'A' },
      { key: 'owner', value: 'Anna' },
    ])
  })

  it('allows both edge directions between two nodes', () => {
    const input = validInput()
    input.edges.push({ id: 'e2', source: 'n2', target: 'n1' })
    expect(modelOf(parseModel(input)).edges).toHaveLength(2)
  })

  it('orders the nodes parents first even if the input does not', () => {
    const input = validInput()
    input.nodes.reverse()
    const ids = modelOf(parseModel(input)).nodes.map((n) => n.id)
    expect(ids.indexOf('g1')).toBeLessThan(ids.indexOf('n1'))
    expect(ids).toHaveLength(3)
  })

  it('accepts nested groups', () => {
    const input = validInput()
    input.nodes.push({
      id: 'g2',
      kind: 'group',
      parentId: 'g1',
      position: { x: 5, y: 5 },
      size: { width: 100, height: 100 },
    })
    input.nodes[2].parentId = 'g2'
    expect(modelOf(parseModel(input)).nodes).toHaveLength(4)
  })

  it('does not mutate the input', () => {
    const input = deepFreeze(validInput())
    expect(parseModel(input).ok).toBe(true)
  })
})

describe('parseModel: untrusted input is never copied wholesale', () => {
  it('drops unknown properties on every level', () => {
    const input = validInput()
    Object.assign(input, { extra: 1 })
    Object.assign(input.nodes[0], { selected: true, data: { x: 1 } })
    Object.assign(input.nodes[0].position as Json, { z: 3 })
    Object.assign(input.nodes[2].size as Json, { depth: 1 })
    Object.assign((input.nodes[0].metadata as Json[])[0], { hidden: 'x' })
    Object.assign(input.edges[0], { label: 'x' })

    const model = modelOf(parseModel(input))
    expect(Object.keys(model).sort()).toEqual(['edges', 'nodes', 'version'])
    expect(Object.keys(model.nodes[0]).sort()).toEqual(['id', 'kind', 'metadata', 'position', 'size'])
    expect(Object.keys(model.nodes[0].position)).toEqual(['x', 'y'])
    expect(Object.keys(model.nodes[2].size ?? {})).toEqual(['width', 'height'])
    expect(Object.keys(model.nodes[0].metadata[0])).toEqual(['key', 'value'])
    expect(Object.keys(model.edges[0]).sort()).toEqual(['id', 'source', 'target'])
  })

  it('is not affected by __proto__ keys from JSON', () => {
    const text = JSON.stringify(validInput()).replace(
      '"version":1',
      '"version":1,"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}',
    )
    const result = parseModelJson(text)
    const model = modelOf(result)
    expect(({} as Json).polluted).toBeUndefined()
    expect(Object.getPrototypeOf(model)).toBe(Object.prototype)
    expect(Object.hasOwn(model, '__proto__')).toBe(false)
    expect(Object.hasOwn(model.nodes[0], '__proto__')).toBe(false)
  })

  it('treats a __proto__ metadata key as an ordinary entry', () => {
    const input = validInput()
    input.nodes[1].metadata = [
      { key: 'name', value: 'A' },
      { key: '__proto__', value: 'x' },
    ]
    const model = modelOf(parseModel(input))
    expect(model.nodes[1].metadata[1]).toEqual({ key: '__proto__', value: 'x' })
    expect(({} as Json).x).toBeUndefined()
  })
})

describe('parseModel: top level', () => {
  it.each([[null], [undefined], [42], ['text'], [true], [[]], [[1, 2]]])('rejects %j as document', (input) => {
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Graph/)
  })

  it('reports a missing version', () => {
    const input = validInput()
    delete (input as Json).version
    expect(allErrors(input)).toMatch(/Version.*fehlt/)
  })

  it.each([2, 0, '1', null, 1.5, {}])('reports unsupported version %j', (version) => {
    const input = validInput()
    input.version = version
    expect(allErrors(input)).toMatch(/Nicht unterstützte Version/)
  })

  it('names the unsupported version', () => {
    const input = validInput()
    input.version = 7
    expect(allErrors(input)).toContain('7')
  })

  it('requires nodes and edges to be arrays', () => {
    expect(allErrors({ version: 1, edges: [] })).toMatch(/"nodes"/)
    expect(allErrors({ version: 1, nodes: {}, edges: [] })).toMatch(/"nodes"/)
    expect(allErrors({ version: 1, nodes: [] })).toMatch(/"edges"/)
    expect(allErrors({ version: 1, nodes: [], edges: 'x' })).toMatch(/"edges"/)
    const both = errorsOf(parseModel({ version: 1 }))
    expect(both).toHaveLength(2)
  })
})

describe('parseModel: nodes', () => {
  it('rejects entries that are not objects and names their index', () => {
    const input = validInput()
    input.nodes.push(null as unknown as Json, 'x' as unknown as Json)
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(2)
    expect(errors[0]).toContain('Knoten 4')
    expect(errors[1]).toContain('Knoten 5')
  })

  it.each([undefined, '', 5, null])('rejects the id %j', (id) => {
    const input = validInput()
    addLoneNode(input).id = id
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('Knoten 4')
    expect(errors[0]).toMatch(/id/)
  })

  it('rejects duplicate ids and mentions the id and both positions', () => {
    const input = validInput()
    addLoneNode(input).id = 'n1'
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('"n1"')
    expect(errors[0]).toContain('Knoten 4')
    expect(errors[0]).toContain('Knoten 2')
  })

  it.each(['edge', 'Node', '', 1, undefined])('rejects the kind %j', (kind) => {
    const input = validInput()
    input.nodes[2].kind = kind
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/kind/)
    expect(errors[0]).toContain('"n2"')
  })

  it.each([
    ['missing', undefined],
    ['not an object', 'x'],
    ['x missing', { y: 1 }],
    ['y a string', { x: 1, y: '2' }],
    ['x NaN', { x: Number.NaN, y: 0 }],
    ['y Infinity', { x: 0, y: Infinity }],
  ])('rejects an invalid position (%s)', (_label, position) => {
    const input = validInput()
    input.nodes[2].position = position
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/position/)
  })

  it.each([
    ['zero width', { width: 0, height: 10 }],
    ['negative height', { width: 10, height: -1 }],
    ['width missing', { height: 10 }],
    ['string width', { width: '10', height: 10 }],
    ['NaN height', { width: 10, height: Number.NaN }],
    ['infinite width', { width: Infinity, height: 10 }],
    ['not an object', 5],
    ['null', null],
  ])('rejects an invalid size (%s)', (_label, size) => {
    const input = validInput()
    input.nodes[2].size = size
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/size/)
  })

  it('requires a size for groups', () => {
    const input = validInput()
    delete input.nodes[0].size
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('"g1"')
    expect(errors[0]).toMatch(/Gruppe.*Größe/)
  })

  it('does not require a size for plain nodes', () => {
    expect(parseModel(validInput()).ok).toBe(true)
  })

  it('rejects metadata that is not a list', () => {
    const input = validInput()
    input.nodes[2].metadata = { name: 'B' }
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/metadata/)
  })

  it('rejects metadata entries that are not {key: string, value: string}', () => {
    const input = validInput()
    input.nodes[2].metadata = [
      { key: 'name', value: 'B' },
      { key: 'a' },
      { key: 1, value: 'x' },
      'text',
      null,
    ]
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(4)
    expect(errors[0]).toContain('metadata[1]')
    expect(errors[3]).toContain('metadata[4]')
  })

  it('rejects duplicate metadata keys (after trimming) and names the key', () => {
    const input = validInput()
    input.nodes[1].metadata = [
      { key: 'name', value: 'A' },
      { key: 'owner', value: 'x' },
      { key: ' owner', value: 'y' },
    ]
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('"owner"')
    expect(errors[0]).toContain('"n1"')
  })

  it('rejects two name entries', () => {
    const input = validInput()
    input.nodes[1].metadata = [
      { key: 'name', value: 'A' },
      { key: 'name', value: 'B' },
    ]
    expect(allErrors(input)).toContain('"name"')
  })

  it('does not treat dropped empty keys as duplicates', () => {
    const input = validInput()
    input.nodes[1].metadata = [
      { key: 'name', value: 'A' },
      { key: '', value: 'x' },
      { key: ' ', value: 'y' },
    ]
    expect(parseModel(input).ok).toBe(true)
  })
})

describe('parseModel: parent relations', () => {
  it('rejects a parentId that is not a string', () => {
    const input = validInput()
    input.nodes[1].parentId = 5
    expect(allErrors(input)).toMatch(/parentId/)
  })

  it('rejects a parentId pointing to a missing node', () => {
    const input = validInput()
    input.nodes[1].parentId = 'missing'
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('"missing"')
    expect(errors[0]).toContain('"n1"')
  })

  it('rejects a parentId pointing to a plain node', () => {
    const input = validInput()
    input.nodes[0].parentId = 'n2'
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/keine Gruppe/)
  })

  it('detects a parent cycle once and names the members', () => {
    const input = validInput()
    input.nodes[0].parentId = 'g2'
    input.nodes.push({
      id: 'g2',
      kind: 'group',
      parentId: 'g1',
      position: { x: 0, y: 0 },
      size: { width: 10, height: 10 },
    })
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Zyklus/)
    expect(errors[0]).toContain('g1')
    expect(errors[0]).toContain('g2')
  })

  it('detects a group that is its own parent', () => {
    const input = validInput()
    input.nodes[0].parentId = 'g1'
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Zyklus/)
  })
})

describe('parseModel: edges', () => {
  it('rejects entries that are not objects', () => {
    const input = validInput()
    input.edges.push(7 as unknown as Json)
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('Kante 2')
  })

  it.each([undefined, '', 3])('rejects the edge id %j', (id) => {
    const input = validInput()
    input.edges[0].id = id
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('Kante 1')
  })

  it('rejects duplicate edge ids', () => {
    const input = validInput()
    input.edges.push({ id: 'e1', source: 'n2', target: 'n1' })
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('"e1"')
    expect(errors[0]).toContain('Kante 2')
  })

  it('rejects an edge pointing to a missing node and names it', () => {
    const input = validInput()
    input.edges.push({ id: 'e2', source: 'n1', target: 'ghost' })
    input.edges.push({ id: 'e3', source: 'phantom', target: 'n1' })
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(2)
    expect(errors[0]).toContain('Kante 2')
    expect(errors[0]).toContain('"ghost"')
    expect(errors[1]).toContain('Kante 3')
    expect(errors[1]).toContain('"phantom"')
  })

  it('rejects an edge whose source or target is not a string', () => {
    const input = validInput()
    input.edges[0].source = 5
    expect(allErrors(input)).toMatch(/source/)
    const input2 = validInput()
    delete input2.edges[0].target
    expect(allErrors(input2)).toMatch(/target/)
  })

  it('rejects self-referencing edges', () => {
    const input = validInput()
    input.edges[0].target = 'n1'
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/identisch/)
  })

  it('rejects a duplicate source/target pair', () => {
    const input = validInput()
    input.edges.push({ id: 'e2', source: 'n1', target: 'n2' })
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('Kante 2')
    expect(errors[0]).toContain('Kante 1')
  })

  it('does not report edge endpoints as unknown just because their node has another problem', () => {
    const input = validInput()
    input.nodes[2].kind = 'bogus'
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/kind/)
  })
})

describe('parseModel: error collection', () => {
  it('collects problems from all areas in one run', () => {
    const input = validInput()
    input.version = 2
    delete input.nodes[0].size // group without size
    input.nodes[1].parentId = 'missing'
    input.nodes[2].id = 'g1' // duplicate id
    input.edges.push({ id: 'e2', source: 'n1', target: 'nowhere' })
    const text = allErrors(input)
    expect(text).toMatch(/Version/)
    expect(text).toMatch(/Größe/)
    expect(text).toContain('"missing"')
    expect(text).toMatch(/bereits/)
    expect(text).toContain('"nowhere"')
    expect(errorsOf(parseModel(input)).length).toBeGreaterThanOrEqual(5)
  })

  it('reports at most 20 errors', () => {
    const input = validInput()
    for (let i = 0; i < 60; i++) input.nodes.push({ id: `bad-${i}`, kind: 'nope', position: 1 })
    const errors = errorsOf(parseModel(input))
    expect(errors).toHaveLength(20)
  })

  it('produces readable German messages', () => {
    const input = validInput()
    input.nodes[2].kind = 'x'
    expect(errorsOf(parseModel(input))[0]).toMatch(/^Knoten 3 \(id "n2"\): kind muss/)
  })

  it('shortens very long ids in messages', () => {
    const input = validInput()
    input.nodes[2].id = 'x'.repeat(5000)
    input.nodes[2].kind = 'bogus'
    const [message] = errorsOf(parseModel(input))
    expect(message.length).toBeLessThan(300)
  })
})

// ---------------------------------------------------------------------------
// parseModelJson
// ---------------------------------------------------------------------------

describe('parseModelJson', () => {
  it('parses valid JSON text', () => {
    expect(modelOf(parseModelJson(JSON.stringify(validInput()))).nodes).toHaveLength(3)
  })

  it.each(['', '{', 'not json', "{'a': 1}", '{"version": 1,}'])('rejects invalid JSON %j', (text) => {
    const errors = errorsOf(parseModelJson(text))
    expect(errors).toHaveLength(1)
    expect(errors[0].startsWith('Keine gültige JSON-Datei: ')).toBe(true)
    expect(errors[0].length).toBeGreaterThan('Keine gültige JSON-Datei: '.length)
  })

  it('passes valid JSON with the wrong shape on to the model validation', () => {
    expect(errorsOf(parseModelJson('null'))[0]).toMatch(/Graph/)
    expect(errorsOf(parseModelJson('{"version":1}'))).toHaveLength(2)
    expect(allErrors(JSON.parse('{"version":3,"nodes":[],"edges":[]}'))).toMatch(/Version/)
  })
})

// ---------------------------------------------------------------------------
// serializeModel & round trip
// ---------------------------------------------------------------------------

describe('serializeModel', () => {
  it('writes pretty-printed JSON with two spaces and a trailing newline', () => {
    const text = serializeModel({ version: 1, nodes: [], edges: [] })
    expect(text).toBe('{\n  "version": 1,\n  "nodes": [],\n  "edges": []\n}\n')
  })

  it('uses the stable key order version, nodes, edges and a canonical order inside the elements', () => {
    // Deliberately built with scrambled key order.
    const scrambled = {
      edges: [{ target: 'n', source: 'n', id: 'e' }],
      nodes: [
        {
          metadata: [{ value: 'N', key: 'name' }],
          size: { height: 2, width: 1 },
          position: { y: 4, x: 3 },
          parentId: 'g',
          kind: 'node',
          id: 'n',
        },
      ],
      version: 1,
    } as unknown as GraphModel
    const parsed = JSON.parse(serializeModel(scrambled)) as GraphModel
    expect(Object.keys(parsed)).toEqual(['version', 'nodes', 'edges'])
    expect(Object.keys(parsed.nodes[0])).toEqual(['id', 'kind', 'parentId', 'position', 'size', 'metadata'])
    expect(Object.keys(parsed.nodes[0].position)).toEqual(['x', 'y'])
    expect(Object.keys(parsed.nodes[0].size ?? {})).toEqual(['width', 'height'])
    expect(Object.keys(parsed.nodes[0].metadata[0])).toEqual(['key', 'value'])
    expect(Object.keys(parsed.edges[0])).toEqual(['id', 'source', 'target'])
  })

  it('omits undefined optional properties', () => {
    const text = serializeModel({
      version: 1,
      nodes: [
        { id: 'a', kind: 'node', parentId: undefined, size: undefined, position: { x: 0, y: 0 }, metadata: [] },
      ],
      edges: [],
    })
    expect(text).not.toContain('parentId')
    expect(text).not.toContain('size')
  })

  it('is deterministic', () => {
    expect(serializeModel(sampleModel)).toBe(serializeModel(sampleModel))
  })

  it('does not mutate the model', () => {
    const frozen = deepFreeze(structuredClone(sampleModel))
    expect(() => serializeModel(frozen)).not.toThrow()
  })
})

describe('round trip', () => {
  it('parseModelJson(serializeModel(model)) equals the model', () => {
    const text = serializeModel(sampleModel)
    expect(modelOf(parseModelJson(text))).toEqual(sampleModel)
  })

  it('serialize(parse(serialize(model))) is byte-identical', () => {
    const once = serializeModel(sampleModel)
    const twice = serializeModel(modelOf(parseModelJson(once)))
    expect(twice).toBe(once)
  })

  it('survives special characters in metadata', () => {
    const model = toModel({
      nodes: [
        {
          id: 'n',
          kind: 'node',
          position: { x: 1, y: 2 },
          metadata: [
            { key: 'name', value: '"quoted" \\ back\tslash' },
            { key: 'emoji ✓', value: '日本語 \u2028 Ende' },
          ],
        },
      ],
      edges: [],
    })
    expect(modelOf(parseModelJson(serializeModel(model)))).toEqual(model)
  })
})

// ---------------------------------------------------------------------------
// exportFileName
// ---------------------------------------------------------------------------

describe('exportFileName', () => {
  it('uses the local date as release-management-YYYY-MM-DD.json', () => {
    expect(exportFileName(new Date(2026, 9, 10))).toBe('release-management-2026-10-10.json')
  })

  it('zero-pads month and day', () => {
    expect(exportFileName(new Date(2026, 0, 5))).toBe('release-management-2026-01-05.json')
  })

  it('uses the local (not UTC) date, also late in the evening and at midnight', () => {
    expect(exportFileName(new Date(2026, 11, 31, 23, 59, 59))).toBe('release-management-2026-12-31.json')
    expect(exportFileName(new Date(2027, 0, 1, 0, 0, 0))).toBe('release-management-2027-01-01.json')
  })

  it('defaults to today', () => {
    expect(exportFileName()).toMatch(/^release-management-\d{4}-\d{2}-\d{2}\.json$/)
  })
})

describe('edge connectors', () => {
  const withHandles = (extra: Json) => {
    const input = validInput()
    input.edges = [{ id: 'e1', source: 'n1', target: 'n2', ...extra }]
    return input
  }

  it('keeps valid sourceHandle/targetHandle', () => {
    const result = parseModel(withHandles({ sourceHandle: 'bottom', targetHandle: 'top' }))
    expect(result.ok && result.model.edges[0]).toEqual({
      id: 'e1',
      source: 'n1',
      target: 'n2',
      sourceHandle: 'bottom',
      targetHandle: 'top',
    })
  })

  it('stays compatible with edges that have no connectors', () => {
    const result = parseModel(withHandles({}))
    expect(result.ok && result.model.edges[0]).toEqual({ id: 'e1', source: 'n1', target: 'n2' })
  })

  it('rejects unknown connector names with a readable message', () => {
    const result = parseModel(withHandles({ sourceHandle: 'diagonal' }))
    expect(result.ok).toBe(false)
    expect(!result.ok && result.errors.join('\n')).toMatch(/sourceHandle/)
  })

  it('serializes connectors in a stable key order and round-trips them', () => {
    const model: GraphModel = {
      version: 1,
      nodes: [
        { id: 'a', kind: 'node', position: { x: 0, y: 0 }, metadata: [{ key: 'name', value: 'A' }] },
        { id: 'b', kind: 'node', position: { x: 9, y: 0 }, metadata: [{ key: 'name', value: 'B' }] },
      ],
      edges: [{ targetHandle: 'left', sourceHandle: 'right', target: 'b', source: 'a', id: 'e' }],
    }
    const text = serializeModel(model)
    expect(text.indexOf('"sourceHandle"')).toBeGreaterThan(text.indexOf('"target"'))
    expect(text.indexOf('"targetHandle"')).toBeGreaterThan(text.indexOf('"sourceHandle"'))
    const back = parseModelJson(text)
    expect(back.ok && back.model.edges).toEqual(model.edges)
  })
})
