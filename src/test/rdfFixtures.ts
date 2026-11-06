import type { Catalog, GraphContent, MetadataEntry, ModelEdge, ModelNode } from '../model/types'

/** A free-text value with everything a Turtle writer has to escape: newline, quotes, hash, backslash, tab, umlaut, CJK. */
export const TRICKY = 'line 1\nline 2 "quoted" # not a comment \\ back\ttab \u00fc \u4e2d'

/** An id with a space, hash, slash and a non-ASCII character: it has to survive the IRI encoding. */
export const AWKWARD_ID = 'a b#1/\u00fc'

/** A real UUID, which the RDF format writes as a `urn:uuid:` IRI. */
export const UUID_ID = '3f2b8a52-9d0e-4c1a-8b6f-0a1b2c3d4e5f'

/** A second UUID, the id of a connection that references the UUID element. */
export const UUID_EDGE_ID = '0c9d8e7f-6a5b-4c3d-9e2f-1a0b9c8d7e6f'

export const fixtureCatalog: Catalog = {
  elementTypes: [
    {
      id: 't-svc',
      name: 'Service',
      color: '#16a34a',
      icon: 'service',
      fields: [
        { key: 'Owner', kind: 'text', required: true, default: 'Team A' },
        { key: 'Tier', kind: 'select', options: ['3', '1', '2'], default: '1' },
        { key: 'Public', kind: 'boolean', default: 'nein' },
      ],
    },
    {
      id: `t ${AWKWARD_ID}`,
      name: 'Awkward',
      fields: [
        { key: 'Team name', kind: 'text' },
        { key: 'Qualit\u00e4t', kind: 'text' },
      ],
    },
  ],
  edgeTypes: [
    {
      id: 't-call',
      name: 'Call',
      color: '#ff8800',
      roles: ['dependency', 'flow'],
      fields: [{ key: 'Protocol', kind: 'text' }],
    },
    { id: 't-desc', name: 'Describes', fields: [] },
  ],
}

const objectTail = (entity = '', version = ''): MetadataEntry[] => [
  { key: 'class', value: 'java.lang.Object' },
  { key: 'entity', value: entity },
  { key: 'version', value: version },
]

/**
 * A project that uses every part of the format: groups (also a group inside a group, a group edge), UUID ids, an id
 * and type fields whose keys need IRI escaping, several free fields in a deliberate non-alphabetical order, a note, a typed object with
 * type fields and a free field, a blocked object, an unknown object type, typed / optional / unknown-type /
 * plain connections with connectors. Metadata is in canonical order, so the JSON round trip leaves it as is.
 */
export function fullContent(): GraphContent {
  const nodes: ModelNode[] = [
    {
      id: 'team',
      kind: 'group',
      position: { x: 40, y: 40 },
      size: { width: 400, height: 300 },
      metadata: [
        { key: 'name', value: 'Team' },
        { key: 'color', value: '#112233' },
      ],
    },
    {
      id: 'team2',
      kind: 'group',
      position: { x: 500, y: 40 },
      size: { width: 200, height: 200 },
      metadata: [{ key: 'name', value: 'Team 2' }],
    },
    {
      id: 'api',
      kind: 'node',
      parentId: 'team',
      position: { x: 24, y: 56.5 },
      metadata: [
        { key: 'name', value: 'API "Gateway"' },
        { key: 'color', value: '#ff0000' },
        { key: 'status', value: 'in Arbeit' },
        { key: 'type', value: 't-svc' },
        ...objectTail('E-1', '1.2'),
        { key: 'Owner', value: 'Team A' },
        { key: 'Tier', value: '2' },
        { key: 'Public', value: 'nein' },
        { key: 'Free field', value: TRICKY },
      ],
    },
    {
      id: 'db',
      kind: 'node',
      parentId: 'team',
      position: { x: 200, y: 56.5 },
      metadata: [
        { key: 'name', value: '' },
        { key: 'status', value: 'blockiert' },
        { key: 'blockiert_grund', value: 'waiting for approval' },
        ...objectTail(),
      ],
    },
    {
      id: 'queue',
      kind: 'node',
      position: { x: 520, y: 300 },
      size: { width: 200, height: 80 },
      metadata: [{ key: 'name', value: 'Queue' }, { key: 'status', value: 'unbekannt' }, { key: 'type', value: 'gone' }, ...objectTail()],
    },
    {
      id: 'sticky',
      kind: 'note',
      position: { x: 40, y: 400 },
      size: { width: 160, height: 120 },
      metadata: [
        { key: 'name', value: 'multi\nline note' },
        { key: 'color', value: '#fef08a' },
      ],
    },
    {
      id: 'sub',
      kind: 'group',
      parentId: 'team',
      position: { x: 20, y: 150 },
      size: { width: 260, height: 120 },
      metadata: [{ key: 'name', value: 'Sub team' }],
    },
    {
      id: 'worker',
      kind: 'node',
      parentId: 'sub',
      position: { x: 16, y: 32 },
      metadata: [{ key: 'name', value: 'Worker' }, ...objectTail()],
    },
    {
      id: UUID_ID,
      kind: 'node',
      position: { x: 760, y: 40 },
      metadata: [{ key: 'name', value: 'UUID element' }, ...objectTail()],
    },
    {
      id: AWKWARD_ID,
      kind: 'node',
      position: { x: 760, y: 200 },
      metadata: [
        { key: 'name', value: 'Awkward' },
        { key: 'type', value: `t ${AWKWARD_ID}` },
        ...objectTail(),
        { key: 'Team name', value: 'Platform' },
        { key: 'Qualit\u00e4t', value: 'gut \u00fc' },
        { key: 'Zeta', value: '1' },
        { key: 'Alpha', value: '2' },
        { key: 'Middle', value: '3' },
      ],
    },
  ]
  const edges: ModelEdge[] = [
    {
      id: 'e1',
      source: 'api',
      target: 'db',
      sourceHandle: 'right',
      targetHandle: 'left',
      metadata: [
        { key: 'name', value: 'calls' },
        { key: 'type', value: 't-call' },
        { key: 'Protocol', value: 'gRPC' },
        { key: 'Extra', value: 'x' },
      ],
    },
    {
      id: 'e2',
      source: 'db',
      target: 'queue',
      metadata: [
        { key: 'name', value: '' },
        { key: 'optional', value: 'ja' },
      ],
    },
    {
      id: 'e3',
      source: 'queue',
      target: 'team2',
      metadata: [
        { key: 'name', value: 'x' },
        { key: 'type', value: 't-desc' },
      ],
    },
    {
      id: 'e4',
      source: 'api',
      target: 'queue',
      metadata: [
        { key: 'name', value: '' },
        { key: 'type', value: 'gone-edge' },
      ],
    },
    { id: 'e5', source: 'team2', target: 'api' },
    { id: UUID_EDGE_ID, source: 'api', target: UUID_ID },
    { id: 'e7', source: UUID_ID, target: AWKWARD_ID, sourceHandle: 'bottom', targetHandle: 'top' },
    { id: 'e8', source: 'worker', target: 'queue' },
  ]
  return { projectName: 'My-Project_1.0', catalog: fixtureCatalog, nodes, edges }
}
