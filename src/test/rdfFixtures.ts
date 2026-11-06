import type { Catalog, GraphContent, MetadataEntry, ModelEdge, ModelNode } from '../model/types'

/** A free-text value with everything a Turtle writer has to escape: newline, quotes, hash, backslash, tab, umlaut, CJK. */
export const TRICKY = 'line 1\nline 2 "quoted" # not a comment \\ back\ttab \u00fc \u4e2d'

export const fixtureCatalog: Catalog = {
  elementTypes: [
    {
      id: 't-svc',
      name: 'Service',
      color: '#16a34a',
      icon: 'service',
      fields: [
        { key: 'Owner', kind: 'text', required: true, default: 'Team A' },
        { key: 'Tier', kind: 'select', options: ['1', '2', '3'], default: '1' },
        { key: 'Public', kind: 'boolean', default: 'nein' },
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
 * A project that uses every part of the format: groups (nested ids, a group edge), a note, a typed object with
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
  ]
  return { projectName: 'My-Project_1.0', catalog: fixtureCatalog, nodes, edges }
}
