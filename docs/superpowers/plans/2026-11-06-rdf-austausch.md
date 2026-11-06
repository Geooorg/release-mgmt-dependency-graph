# RDF-Austausch (Turtle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export the project as a Turtle file (`.ttl`) and import such a file losslessly again (round trip); no import of foreign RDF.

**Architecture:** Two pure model modules map `GraphContent` to RDF triples and back (`model/rdfExport.ts`, `model/rdfImport.ts`, own minimal triple type in `model/rdfTerms.ts`). The import assembles a raw model object and hands it to the existing `parseModel`, so no second rule set exists. `n3` (parser/writer) lives only in `storage/rdfIo.ts` and is loaded with a dynamic `import()`. The UI gets one more export format and the import button accepts `.ttl`.

**Tech Stack:** TypeScript (strict, `erasableSyntaxOnly`), React 19, vitest (jsdom), `n3` (new runtime dependency, approved in the spec) with `@types/n3` (dev).

Spec: [2026-11-06-rdf-austausch-design.md](../specs/2026-11-06-rdf-austausch-design.md)

## Global Constraints

- **No commits or pushes** unless the user explicitly asks (project CLAUDE.md overrides the usual "commit often"). Each task ends with a *Checkpoint* step (tests/typecheck), not a commit.
- Schema version stays **5**; the JSON format and `public/graph.schema.json` do not change.
- New runtime dependency: **only `n3`** (plus `@types/n3` as devDependency). Node ≥ 22.12.
- Dependency direction: `components` → … → `store` → `model` → `i18n`. `model/` is pure (no React/DOM/browser API, no `n3`). `n3` is imported only in `src/storage/rdfIo.ts`, only via `await import('n3')`.
- Code style: TypeScript strict, no semicolons, single quotes, 2 spaces; identifiers and code comments **English**, comments only for the *why*.
- **No German in source files outside the catalogs and `*.test.ts[x]`.** `src/i18n/noHardcodedGerman.test.ts` scans every other `src/**/*.ts[x]` (including `src/test/*.ts`) for umlauts and words such as `Datei`, `Gruppe`, `Objekt`, `Verbindung`, `Abhängigkeit`, `wartet`. In `src/test/rdfFixtures.ts` write non-ASCII characters as `ü` escapes.
- New UI texts go into **all three** catalogs `de.ts`, `en.ts`, `fr.ts` (`en`/`fr` are typed `Catalog`; `tsc` fails on missing keys). Messages in model code take `t: Translate` (default `createTranslate('de')`).
- Data stays German (`status` values, keys `status`, `blockiert_grund`, `color`, `name`); the vocabulary writes them unchanged.
- RDF namespace of the vocabulary: `urn:release-management:vocab:` (prefix `rm:`), kept in one constant `NS.rm`.
- Final check before "done": `npm test && npm run typecheck && npm run lint && npm run build`.

## File Structure

| File | Responsibility |
|---|---|
| `src/model/rdfTerms.ts` (new) | Triple/term types, namespaces, term helpers, id↔IRI mapping, type-field predicate, table `FIXED_FIELDS` (fixed metadata keys ↔ predicates) shared by export and import |
| `src/model/rdfExport.ts` (new) | `toTriples(content)` – pure, deterministic |
| `src/model/rdfImport.ts` (new) | `modelFromTriples(triples, t)` – pure; builds the raw model and validates it with `parseModel` |
| `src/storage/rdfIo.ts` (new) | `looksLikeJson`, `triplesToTurtle`, `parseTurtle`, `exportTurtle`, `turtleToModelJson` (only place using `n3`) |
| `src/test/rdfFixtures.ts` (new) | Shared test content (`fullContent()`, `TRICKY`) |
| `src/model/serialize.ts` | `exportFileName` accepts `'ttl'` |
| `src/components/props.ts`, `ExportDialog.tsx` | Format `'rdf-file'`, failure feedback |
| `src/App.tsx` | `runExport` for `rdf-file`; `pickAndImport` accepts `.ttl`; `importFileText` |
| `src/i18n/de.ts`, `en.ts`, `fr.ts` | New keys `export.rdf*`, `export.failed`, `rdf.error.*`; adjusted help/toolbar texts |
| `README.md`, `CLAUDE.md`, spec | Documentation |

---

### Task 1: Dependency and vocabulary basics (`rdfTerms.ts`)

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm)
- Create: `src/model/rdfTerms.ts`
- Test: `src/model/rdfTerms.test.ts`

**Interfaces:**
- Produces (used by Tasks 2–4):
  - Types `NamedNode`, `BlankNode`, `Literal`, `Term`, `Subject` (`NamedNode | BlankNode`), `Triple` (`{ subject: Subject; predicate: NamedNode; object: Term }`), `EntryOwner` (`ElementKind | 'edge'`), `FixedField` (`{ key: string; predicate: string }`)
  - `NS` (`rm`, `rdf`, `rdfs`, `xsd`, `dcterms`)
  - `iri(value)`, `blank(label)`, `rm(local)`, `rdf(local)`, `rdfs(local)`, `dcterms(local)` → `NamedNode`
  - `text(value)`, `integer(n)`, `numeric(n)`, `flag(b)` → `Literal`
  - `idToIri(id): NamedNode`, `iriToId(value: string): string`, `fieldPredicate(typeId, key): NamedNode`
  - `FIXED_FIELDS: Record<EntryOwner, readonly FixedField[]>`

- [ ] **Step 1: Record the baseline bundle size and install the dependency**

Run:

```bash
npm run build 2>&1 | tail -15
```

Write the printed sizes of the `index-*.js` / main chunks into your notes (needed in Task 6). Then:

```bash
npm install n3
npm install -D @types/n3
git diff --stat package.json
```

Expected: `package.json` lists `"n3"` under `dependencies` and `"@types/n3"` under `devDependencies`.

- [ ] **Step 2: Write the failing test**

Create `src/model/rdfTerms.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  FIXED_FIELDS,
  NS,
  fieldPredicate,
  flag,
  idToIri,
  integer,
  iriToId,
  numeric,
  rm,
  text,
} from './rdfTerms'

const UUID = '3f2b8a52-9d0e-4c1a-8b6f-0a1b2c3d4e5f'

describe('idToIri / iriToId', () => {
  it('writes a UUID as a urn:uuid IRI', () => {
    expect(idToIri(UUID)).toEqual({ termType: 'NamedNode', value: `urn:uuid:${UUID}` })
  })

  it('writes any other id percent-encoded under the tool namespace', () => {
    expect(idToIri('a b/ü').value).toBe('urn:release-management:id:a%20b%2F%C3%BC')
  })

  it.each([UUID, 'plain', 'a b/ü', 'x#y', '', 'urn:uuid:not-a-uuid'])('maps %j back to itself', (id) => {
    expect(iriToId(idToIri(id).value)).toBe(id)
  })

  it('returns a foreign IRI unchanged', () => {
    expect(iriToId('https://example.org/thing')).toBe('https://example.org/thing')
  })

  it('survives a broken percent sequence', () => {
    expect(iriToId('urn:release-management:id:%E0%A4%A')).toBe('%E0%A4%A')
  })
})

describe('fieldPredicate', () => {
  it('appends the percent-encoded key as a fragment of the type IRI', () => {
    expect(fieldPredicate('t-svc', 'Owner Team').value).toBe('urn:release-management:id:t-svc#Owner%20Team')
    expect(fieldPredicate(UUID, 'Tier').value).toBe(`urn:uuid:${UUID}#Tier`)
  })
})

describe('literals', () => {
  it('types integers, other numbers and flags', () => {
    expect(integer(3)).toEqual({ termType: 'Literal', value: '3', datatype: `${NS.xsd}integer` })
    expect(numeric(120)).toEqual(integer(120))
    expect(numeric(56.5)).toEqual({ termType: 'Literal', value: '56.5', datatype: `${NS.xsd}double` })
    expect(numeric(-0.25).datatype).toBe(`${NS.xsd}double`)
    expect(numeric(1e21)).toEqual({ termType: 'Literal', value: '1e+21', datatype: `${NS.xsd}double` })
    expect(flag(true)).toEqual({ termType: 'Literal', value: 'true', datatype: `${NS.xsd}boolean` })
    expect(text('x').datatype).toBe(`${NS.xsd}string`)
  })

  it('builds vocabulary IRIs', () => {
    expect(rm('Project').value).toBe('urn:release-management:vocab:Project')
  })
})

describe('FIXED_FIELDS', () => {
  const keys = (owner: keyof typeof FIXED_FIELDS) => FIXED_FIELDS[owner].map((field) => field.key)

  it('lists the fixed entries of each owner in canonical order', () => {
    expect(keys('node')).toEqual(['name', 'color', 'status', 'blockiert_grund', 'type', 'class', 'entity', 'version'])
    expect(keys('group')).toEqual(['name', 'color'])
    expect(keys('note')).toEqual(['name', 'color'])
    expect(keys('edge')).toEqual(['name', 'optional', 'type'])
  })

  it('maps the name to rdfs:label', () => {
    expect(FIXED_FIELDS.node[0].predicate).toBe(`${NS.rdfs}label`)
  })

  it('uses distinct predicates within an owner', () => {
    for (const owner of ['node', 'group', 'note', 'edge'] as const) {
      const predicates = FIXED_FIELDS[owner].map((field) => field.predicate)
      expect(new Set(predicates).size).toBe(predicates.length)
    }
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/model/rdfTerms.test.ts`
Expected: FAIL (cannot resolve `./rdfTerms`).

- [ ] **Step 4: Write the implementation**

Create `src/model/rdfTerms.ts`:

```ts
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/model/rdfTerms.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 6: Checkpoint**

Run: `npm run typecheck && npm run lint`
Expected: no errors. (Do not commit.)

---

### Task 2: Export (`rdfExport.ts`) and shared fixtures

**Files:**
- Create: `src/test/rdfFixtures.ts`, `src/model/rdfExport.ts`
- Test: `src/model/rdfExport.test.ts`

**Interfaces:**
- Consumes: everything from Task 1; `getEdgeRoles(edge, catalog)` (`edgeRoles.ts`), `isSoftEdge(edge)` (`softDependency.ts`), `getTypeId(entries)` (`typing.ts`), `SCHEMA_VERSION`, `EMPTY_CATALOG` (`types.ts`).
- Produces: `toTriples(content: GraphContent): Triple[]`; fixtures `fullContent(): GraphContent`, `TRICKY: string`, `fixtureCatalog: Catalog` (used by Tasks 3 and 4).

- [ ] **Step 1: Create the shared fixtures**

Create `src/test/rdfFixtures.ts` (non-ASCII only as escapes, no German words – see Global Constraints):

```ts
import type { Catalog, GraphContent, MetadataEntry, ModelEdge, ModelNode } from '../model/types'

/** A free-text value with everything a Turtle writer has to escape: newline, quotes, hash, backslash, tab, umlaut, CJK. */
export const TRICKY = 'line 1\nline 2 "quoted" # not a comment \\ back\ttab ü 中'

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
```

- [ ] **Step 2: Write the failing test**

Create `src/model/rdfExport.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { fullContent } from '../test/rdfFixtures'
import { toTriples } from './rdfExport'
import { NS, idToIri } from './rdfTerms'
import type { Term, Triple } from './rdfTerms'

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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/model/rdfExport.test.ts`
Expected: FAIL (cannot resolve `./rdfExport`).

- [ ] **Step 4: Write the implementation**

Create `src/model/rdfExport.ts`:

```ts
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
 * The project as RDF triples (vocabulary: README, "RDF-Austausch"). Pure and deterministic: the same content gives
 * the same triples in the same order. `rm:index` records the position in the lists of nodes, edges and types.
 */
export function toTriples(content: GraphContent): Triple[] {
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
  if (def !== undefined) sink.add(subject, rdf('type'), idToIri(def.id))
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/model/rdfExport.test.ts`
Expected: PASS. If one assertion fails, fix the **implementation** only when it contradicts the spec; fix the test only if the expectation was wrong (e.g. an index count).

- [ ] **Step 6: Checkpoint**

Run: `npm run typecheck && npm run lint && npx vitest run src/i18n/noHardcodedGerman.test.ts`
Expected: no errors (the German-text scan also covers `src/test/rdfFixtures.ts` and the new model files).

---

### Task 3: Import (`rdfImport.ts`), error messages and the round-trip tests

**Files:**
- Create: `src/model/rdfImport.ts`
- Modify: `src/i18n/de.ts`, `src/i18n/en.ts`, `src/i18n/fr.ts` (add `rdf.error.*`)
- Test: `src/model/rdfImport.test.ts`

**Interfaces:**
- Consumes: Task 1 and 2 (`toTriples`, `FIXED_FIELDS`, `fieldPredicate`, `iriToId`, …), `parseModel`/`ParseResult`/`toModel`/`serializeModel`/`parseModelJson` (`serialize.ts`), `tidyEdgeMetadata` (`metadata.ts`), `EDGE_ROLES`, `SCHEMA_VERSION`, `TYPE_KEY` (`types.ts`), `createTranslate`/`Translate`.
- Produces: `modelFromTriples(triples: readonly Triple[], t?: Translate): ParseResult` (used by Task 4).

- [ ] **Step 1: Add the message keys to the three catalogs**

In `src/i18n/de.ts` add (next to the other `notice.import.*` keys, alphabetical grouping does not matter):

```ts
  'rdf.error.notThisTool':
    'Die Datei stammt nicht aus diesem Werkzeug (kein Projekt gefunden). Der Import fremder RDF-Daten ist noch nicht möglich.',
  'rdf.error.version': 'Die Datei hat die Schema-Version {found}; unterstützt wird {expected}.',
  'rdf.error.edgeEnds': 'Die Verbindung {id} hat keinen gültigen Anfang oder kein gültiges Ende.',
  'rdf.error.syntax': 'Die Datei ist kein gültiges Turtle: {reason}',
```

In `src/i18n/en.ts`:

```ts
  'rdf.error.notThisTool':
    'This file does not come from this tool (no project found). Importing foreign RDF data is not supported yet.',
  'rdf.error.version': 'The file has schema version {found}; version {expected} is supported.',
  'rdf.error.edgeEnds': 'Connection {id} has no valid start or end.',
  'rdf.error.syntax': 'The file is not valid Turtle: {reason}',
```

In `src/i18n/fr.ts`:

```ts
  'rdf.error.notThisTool':
    'Ce fichier ne provient pas de cet outil (aucun projet trouvé). L’import de données RDF externes n’est pas encore possible.',
  'rdf.error.version': 'Le fichier a la version de schéma {found} ; la version {expected} est prise en charge.',
  'rdf.error.edgeEnds': 'La liaison {id} n’a pas d’origine ou de destination valide.',
  'rdf.error.syntax': 'Le fichier n’est pas du Turtle valide : {reason}',
```

Match the quote style and apostrophe handling the existing entries of each file use (if `fr.ts` uses `'…'` strings with `’`, keep the typographic apostrophe as written here).

Run: `npm run typecheck`
Expected: PASS (the catalogs stay in sync).

- [ ] **Step 2: Write the failing tests**

Create `src/model/rdfImport.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { counterIds } from '../test/fixtures'
import { fullContent } from '../test/rdfFixtures'
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

describe('modelFromTriples: round trip', () => {
  it.each<[string, () => GraphContent]>([
    ['a project that uses every part of the format', fullContent],
    ['the starter graph', () => createDefaultContent(counterIds())],
    ['an empty graph', () => ({ nodes: [], edges: [] })],
    ['UUID ids', () => uuidContent],
  ])('returns %s unchanged', (_name, build) => {
    const content = build()
    expect(modelOf(modelFromTriples(toTriples(content), t))).toEqual(viaJson(content))
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

describe('modelFromTriples: errors', () => {
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
```

> `counterIds` is exported by `src/test/fixtures.ts` (`counterIds(prefix = 'id')`).

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/model/rdfImport.test.ts`
Expected: FAIL (cannot resolve `./rdfImport`).

- [ ] **Step 4: Write the implementation**

Create `src/model/rdfImport.ts`:

```ts
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

const rank = (role: string): number => {
  const position = (EDGE_ROLES as readonly string[]).indexOf(role)
  return position === -1 ? EDGE_ROLES.length : position
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/model/rdfImport.test.ts src/model/rdfExport.test.ts src/model/rdfTerms.test.ts`
Expected: PASS.

Likely points to check if a round-trip case fails (decide by comparing the two models with `expect(a).toEqual(b)` output):
- A type-field order difference means the fixture's stored order is not the catalog order → fix the **fixture** (the spec fixes the import to catalog order).
- `parseCatalog` rejecting the fixture catalog (`parse.catalog.*` error) → adjust the **fixture** to what `checkTypeDef` accepts.

- [ ] **Step 6: Checkpoint**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green (including `catalog.test.ts`, which compares placeholders across the three catalogs).

---

### Task 4: Turtle reading and writing (`storage/rdfIo.ts`)

**Files:**
- Create: `src/storage/rdfIo.ts`
- Test: `src/storage/rdfIo.test.ts`

**Interfaces:**
- Consumes: `toTriples`, `modelFromTriples`, `serializeModel`, `toModel`, `Triple`/`Term`/`iri`/`blank`/`NS`, `createTranslate`/`Translate`, `GraphContent`.
- Produces (used by Task 5):
  - `looksLikeJson(text: string): boolean`
  - `triplesToTurtle(triples: readonly Triple[]): Promise<string>`
  - `parseTurtle(text: string): Promise<{ ok: true; triples: Triple[] } | { ok: false; reason: string }>`
  - `exportTurtle(content: GraphContent): Promise<string>`
  - `turtleToModelJson(text: string, t?: Translate): Promise<{ ok: true; json: string } | { ok: false; errors: string[] }>`

- [ ] **Step 1: Write the failing tests**

Create `src/storage/rdfIo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/translate'
import { fullContent } from '../test/rdfFixtures'
import { toTriples } from '../model/rdfExport'
import { modelFromTriples } from '../model/rdfImport'
import { parseModelJson, serializeModel, toModel } from '../model/serialize'
import { exportTurtle, looksLikeJson, parseTurtle, triplesToTurtle, turtleToModelJson } from './rdfIo'

const t = createTranslate('de')

describe('looksLikeJson', () => {
  it.each([
    ['{"version":5}', true],
    ['  \n{', true],
    ['﻿{"a":1}', true],
    ['@prefix rm: <urn:x:> .', false],
    ['', false],
  ])('%j -> %s', (text, expected) => {
    expect(looksLikeJson(text)).toBe(expected)
  })
})

describe('exportTurtle', () => {
  it('writes prefixes and the project resource', async () => {
    const turtle = await exportTurtle(fullContent())
    expect(turtle).toContain('@prefix rm: <urn:release-management:vocab:>')
    expect(turtle).toContain('rm:schemaVersion 5')
    expect(turtle).toContain('rm:Project')
  })

  it('is deterministic', async () => {
    expect(await exportTurtle(fullContent())).toBe(await exportTurtle(fullContent()))
  })
})

describe('Turtle text round trip', () => {
  it('reads back the triples of the written file as the same model', async () => {
    const content = fullContent()
    const parsed = await parseTurtle(await triplesToTurtle(toTriples(content)))
    if (!parsed.ok) throw new Error(parsed.reason)
    const result = modelFromTriples(parsed.triples, t)
    const expected = parseModelJson(serializeModel(toModel(content)))
    expect(result).toEqual(expected)
    expect(result.ok).toBe(true)
  })

  it('survives newlines, quotes, backslashes, tabs and non-ASCII text', async () => {
    const content = fullContent()
    const result = await turtleToModelJson(await exportTurtle(content), t)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const reread = parseModelJson(result.json)
    expect(reread).toEqual(parseModelJson(serializeModel(toModel(content))))
  })
})

describe('turtleToModelJson', () => {
  it('reports a syntax error with the parser reason', async () => {
    const result = await turtleToModelJson('<urn:a> <urn:b> .', t)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatch(/^Die Datei ist kein gültiges Turtle: .*line 1/i)
  })

  it('rejects valid Turtle that is not a project of this tool', async () => {
    const result = await turtleToModelJson('<urn:a> <urn:b> "c" .', t)
    expect(result).toEqual({ ok: false, errors: [t('rdf.error.notThisTool')] })
  })

  it('rejects an empty file', async () => {
    expect(await turtleToModelJson('', t)).toEqual({ ok: false, errors: [t('rdf.error.notThisTool')] })
  })
})

describe('parseTurtle', () => {
  it('keeps datatypes and ignores language tags in the value', async () => {
    const parsed = await parseTurtle('<urn:a> <urn:n> 3 ; <urn:l> "hi"@en ; <urn:d> 1.5e0 .')
    if (!parsed.ok) throw new Error(parsed.reason)
    const objects = parsed.triples.map((triple) => triple.object)
    expect(objects[0]).toMatchObject({ termType: 'Literal', value: '3', datatype: 'http://www.w3.org/2001/XMLSchema#integer' })
    expect(objects[1]).toMatchObject({ termType: 'Literal', value: 'hi' })
    expect(objects[2]).toMatchObject({ termType: 'Literal', datatype: 'http://www.w3.org/2001/XMLSchema#double' })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/storage/rdfIo.test.ts`
Expected: FAIL (cannot resolve `./rdfIo`).

- [ ] **Step 3: Write the implementation**

Create `src/storage/rdfIo.ts`:

```ts
import { createTranslate } from '../i18n/translate'
import type { Translate } from '../i18n/translate'
import { toTriples } from '../model/rdfExport'
import { modelFromTriples } from '../model/rdfImport'
import { NS, blank, iri } from '../model/rdfTerms'
import type { Literal, Subject, Term, Triple } from '../model/rdfTerms'
import { serializeModel } from '../model/serialize'
import type { GraphContent } from '../model/types'

/**
 * Turtle reading and writing. The only place that uses `n3`, loaded on demand so the main bundle stays small.
 * The model code works on its own minimal triples (`model/rdfTerms.ts`); this file converts.
 */

const PREFIXES = { rm: NS.rm, rdf: NS.rdf, rdfs: NS.rdfs, xsd: NS.xsd, dcterms: NS.dcterms }

/** A project file is either the JSON model (starts with `{`) or Turtle. */
export function looksLikeJson(text: string): boolean {
  return text.trimStart().startsWith('{')
}

export async function triplesToTurtle(triples: readonly Triple[]): Promise<string> {
  const { Writer, DataFactory } = await import('n3')
  const { namedNode, blankNode, literal, quad } = DataFactory
  const subjectOf = (subject: Subject) => (subject.termType === 'NamedNode' ? namedNode(subject.value) : blankNode(subject.value))
  const objectOf = (object: Term) => {
    if (object.termType === 'NamedNode') return namedNode(object.value)
    if (object.termType === 'BlankNode') return blankNode(object.value)
    return literal(object.value, namedNode(object.datatype))
  }
  const writer = new Writer({ prefixes: PREFIXES })
  for (const triple of triples) {
    writer.addQuad(quad(subjectOf(triple.subject), namedNode(triple.predicate.value), objectOf(triple.object)))
  }
  return new Promise((resolve, reject) => {
    writer.end((error, result) => (error ? reject(error) : resolve(result)))
  })
}

export type TurtleParse = { ok: true; triples: Triple[] } | { ok: false; reason: string }

/** Parses Turtle (also N-Triples). A syntax error is a result; failing to load the parser is an exception. */
export async function parseTurtle(text: string): Promise<TurtleParse> {
  const { Parser } = await import('n3')
  let quads
  try {
    quads = new Parser({ format: 'Turtle' }).parse(text)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
  const triples: Triple[] = []
  for (const quad of quads) {
    if (quad.graph.termType !== 'DefaultGraph' || quad.predicate.termType !== 'NamedNode') continue
    const subject = quad.subject.termType === 'NamedNode' ? iri(quad.subject.value) : quad.subject.termType === 'BlankNode' ? blank(quad.subject.value) : undefined
    let object: Term | undefined
    if (quad.object.termType === 'NamedNode') object = iri(quad.object.value)
    else if (quad.object.termType === 'BlankNode') object = blank(quad.object.value)
    else if (quad.object.termType === 'Literal') {
      const literal: Literal = { termType: 'Literal', value: quad.object.value, datatype: quad.object.datatype.value }
      object = literal
    }
    if (subject !== undefined && object !== undefined) triples.push({ subject, predicate: iri(quad.predicate.value), object })
  }
  return { ok: true, triples }
}

export async function exportTurtle(content: GraphContent): Promise<string> {
  return triplesToTurtle(toTriples(content))
}

export type TurtleImport = { ok: true; json: string } | { ok: false; errors: string[] }

/**
 * Turtle text -> the JSON text of the model, ready for the store's `importText`. Everything the model rules reject
 * comes back as `errors`; only a failure to load the parser throws.
 */
export async function turtleToModelJson(text: string, t: Translate = createTranslate('de')): Promise<TurtleImport> {
  const parsed = await parseTurtle(text)
  if (!parsed.ok) return { ok: false, errors: [t('rdf.error.syntax', { reason: parsed.reason })] }
  const result = modelFromTriples(parsed.triples, t)
  if (!result.ok) return { ok: false, errors: result.errors }
  return { ok: true, json: serializeModel(result.model) }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/storage/rdfIo.test.ts`
Expected: PASS. Checks if something fails:
- The `rdf.error.syntax` assertion in the syntax-error test compares a prefix of the German message; if it is brittle for you, assert `result.errors[0]` starts with `t('rdf.error.syntax', { reason: '' }).trimEnd()` instead.
- If `tsc` complains about the `Writer` callback types, use the signature from `@types/n3` (`(error: Error, result: string) => void`).

- [ ] **Step 5: Checkpoint**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green.

---

### Task 5: Wire the UI (export format, import of `.ttl`)

**Files:**
- Modify: `src/model/serialize.ts` (`exportFileName`), `src/components/props.ts`, `src/components/ExportDialog.tsx`, `src/App.tsx`, `src/i18n/de.ts`, `src/i18n/en.ts`, `src/i18n/fr.ts`
- Test: `src/model/serialize.test.ts` (extend), `src/components/ExportDialog.test.tsx` (extend)

**Interfaces:**
- Consumes: Task 4 functions; `exportFileName`, `downloadTextFile`, `pickTextFile`, `graphStore.getState().importText / notify / markExported`.
- Produces: user-visible feature.

- [ ] **Step 1: Write the failing tests**

In `src/model/serialize.test.ts` find the existing `exportFileName` tests (`grep -n "exportFileName" src/model/serialize.test.ts`) and add:

```ts
  it('accepts the ttl extension', () => {
    const date = new Date(2026, 9, 9, 14, 10, 22)
    expect(exportFileName(date, 'Release-Management', 'ttl')).toBe('Release-Management_2026-10-09_141022.ttl')
  })
```

In `src/components/ExportDialog.test.tsx`:

1. Change the expectation in `offers JSON file, SVG and JSON (clipboard), the file preselected` to four radios, RDF second (rename the test title accordingly):

```ts
    expect(screen.getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual([
      expect.stringContaining('JSON-Datei'),
      expect.stringContaining('RDF (Turtle)'),
      expect.stringContaining('SVG'),
      expect.stringContaining('JSON (Zwischenablage)'),
    ])
```

2. Add a row to the `it.each` table: `['RDF \\(Turtle\\)', 'rdf-file'],` (before `'SVG'`).

3. Add at the end of the `describe`:

```ts
  it('stays open and says so when a file export fails', async () => {
    const props = makeProps({ onExport: vi.fn(() => Promise.resolve(false)) })
    render(<ExportDialog {...props} />)

    await userEvent.click(option('RDF \\(Turtle\\)'))
    await userEvent.click(screen.getByRole('button', { name: 'Exportieren' }))

    expect(screen.getByRole('status')).toHaveTextContent('Der Export ist fehlgeschlagen')
    expect(props.onClose).not.toHaveBeenCalled()
  })
```

Run: `npx vitest run src/model/serialize.test.ts src/components/ExportDialog.test.tsx`
Expected: the `ExportDialog` tests FAIL (no RDF option yet). The new `exportFileName` test already passes at runtime (vitest does not type-check); it pins the behaviour while Step 3 widens the type, and `npm run typecheck` in Step 5 catches the type side.

- [ ] **Step 2: Add the texts to the three catalogs**

`src/i18n/de.ts` – new keys (next to the other `export.*` keys):

```ts
  'export.rdf': 'RDF (Turtle)',
  'export.rdf.hint':
    'Das Projekt als Turtle-Datei (.ttl) herunterladen, lesbar für RDF-Werkzeuge. Sie lässt sich wieder importieren.',
  'export.failed': 'Der Export ist fehlgeschlagen. Bitte noch einmal versuchen oder „JSON-Datei“ wählen.',
```

`src/i18n/en.ts` (keep the quotes the file uses for “JSON file” – check the existing `export.copyFailed` and `export.json` entries and reuse their wording):

```ts
  'export.rdf': 'RDF (Turtle)',
  'export.rdf.hint': 'Download the project as a Turtle file (.ttl), readable by RDF tools. It can be imported again.',
  'export.failed': 'The export failed. Please try again or choose “JSON file”.',
```

`src/i18n/fr.ts` (reuse the label of `export.json` in the quotes):

```ts
  'export.rdf': 'RDF (Turtle)',
  'export.rdf.hint': 'Télécharger le projet en fichier Turtle (.ttl), lisible par les outils RDF. Il peut être réimporté.',
  'export.failed': 'L’export a échoué. Réessayez ou choisissez « Fichier JSON ».',
```

Also replace these existing values in all three catalogs:

| Key | `de` | `en` | `fr` |
|---|---|---|---|
| `toolbar.export.title` | `Das Projekt exportieren: als JSON-Datei, als RDF-Datei (Turtle), als SVG-Grafik oder als JSON in die Zwischenablage` | `Export the project: as a JSON file, as an RDF file (Turtle), as an SVG graphic or as JSON to the clipboard` | `Exporter le projet : en fichier JSON, en fichier RDF (Turtle), en image SVG ou en JSON dans le presse-papiers` |
| `toolbar.import.title` | `Ein Projekt aus einer JSON- oder RDF-Datei (Turtle, nur aus diesem Werkzeug exportiert) laden. Es ersetzt das aktuelle Projekt; vorher wird gefragt und bei nicht exportierten Änderungen gewarnt.` | `Load a project from a JSON or RDF file (Turtle, only files exported by this tool). It replaces the current project; you are asked first and warned about unexported changes.` | `Charger un projet depuis un fichier JSON ou RDF (Turtle, uniquement exporté par cet outil). Il remplace le projet actuel ; une confirmation est demandée et les modifications non exportées sont signalées.` |

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Implement the dialog and the file-name extension**

`src/model/serialize.ts` – widen the parameter type of `exportFileName` and its doc comment:

```ts
  extension: 'json' | 'svg' | 'ttl' = 'json',
```

`src/components/props.ts` – replace the `ExportFormat` doc comment and type:

```ts
/** What the export dialog offers: the project as a JSON file or an RDF (Turtle) file, the graph as an SVG file, the project as JSON text on the clipboard. */
export type ExportFormat = 'json-file' | 'rdf-file' | 'svg' | 'json-clipboard'
```

`src/components/ExportDialog.tsx`:

1. In `FORMATS` insert after the `json-file` row: `{ value: 'rdf-file', labelKey: 'export.rdf', hintKey: 'export.rdf.hint' },`
2. `type Feedback = 'none' | 'copied' | 'failed' | 'fileFailed'`
3. In `submit`, replace the file branch:

```ts
    // A download speaks for itself; the clipboard needs a word.
    if (format !== 'json-clipboard') {
      if (ok) onClose()
      else setFeedback('fileFailed')
      return
    }
```

4. In the status paragraph add a line below the `failed` line:

```tsx
        {feedback === 'fileFailed' && t('export.failed')}
```

Also update the component's doc comment ("JSON file, RDF file, SVG file or JSON text on the clipboard").

- [ ] **Step 4: Wire `App.tsx`**

1. Imports: change the storage import and add the rdf one:

```ts
import { downloadTextFile, pickTextFile } from './storage/fileIO'
import { exportTurtle, looksLikeJson, turtleToModelJson } from './storage/rdfIo'
```

2. In `runExport`, add the `rdf-file` branch before the SVG one and update the comment above the function ("Files, the clipboard JSON and the Turtle file are full copies … and so count as an export; the SVG is not"):

```ts
    if (format === 'rdf-file') {
      try {
        downloadTextFile(exportFileName(new Date(), name, 'ttl'), await exportTurtle(content), 'text/turtle')
      } catch {
        return false
      }
      state.markExported()
      return true
    }
```

3. Replace `pickAndImport` and add `importFileText` right above it:

```ts
  // JSON files go straight to the store; Turtle files are converted first (the parser loads on demand).
  const importFileText = async (text: string) => {
    const store = graphStore.getState()
    if (looksLikeJson(text)) {
      store.importText(text)
      return
    }
    try {
      const result = await turtleToModelJson(text, t)
      if (result.ok) store.importText(result.json)
      else store.notify({ kind: 'error', message: { key: 'notice.import.failed' }, details: result.errors })
    } catch (error) {
      store.notify({
        kind: 'error',
        message: { key: 'notice.import.failed' },
        details: [error instanceof Error ? error.message : String(error)],
      })
    }
  }

  // Both import paths call this synchronously from the click handler (no `await` before the picker),
  // so the file picker still counts as user-initiated.
  const pickAndImport = async () => {
    setImportDialog(null)
    const text = await pickTextFile('.json,application/json,.ttl,text/turtle')
    if (text === null) return
    await importFileText(text)
  }
```

If `notify`'s parameter type rejects the object (the shape of `Notice` is at `src/store/graphStore.ts:52`), adapt the literal to that type.

- [ ] **Step 5: Run the tests**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS. If a test asserts the old toolbar title strings (`toolbar.export.title`, `toolbar.import.title`), update that assertion to the new text from Step 2.

- [ ] **Step 6: Check in the browser (DE, EN, FR)**

Start the dev server (`preview_start` with the name from `.claude/launch.json`, else `npm run dev`) and verify, with screenshots or `read_page`:

1. Toolbar → Export: four options, order JSON-Datei, RDF (Turtle), SVG, JSON (Zwischenablage); the hint of RDF is readable; switch language to EN and FR and check labels/hints fit the dialog.
2. Choose RDF (Turtle) → Exportieren: the dialog closes, no console error (`read_console_messages`), a `.ttl` download starts (network tab shows the lazy `n3` chunk loading from the same origin).
3. Toolbar width at 1024 px in both modes unchanged (only titles changed; no layout change expected).
4. The native file picker cannot be driven; the import path is covered by `rdfIo.test.ts`. Ask the user to do one manual round trip (export `.ttl`, import it, compare) and report it as **not verified by me** if not done.

- [ ] **Step 7: Checkpoint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all green.

---

### Task 6: Documentation, bundle check, final verification

**Files:**
- Modify: `README.md`, `CLAUDE.md`, `src/i18n/de.ts`, `src/i18n/en.ts`, `src/i18n/fr.ts` (help text, agent note), `docs/superpowers/specs/2026-11-06-rdf-austausch-design.md`

- [ ] **Step 1: README**

In `README.md`:

1. Requirement 25 (`grep -n "^25\." README.md`): change "mit drei Formaten" to "mit vier Formaten" and insert after the JSON-Datei entry: "**RDF (Turtle)** (`.ttl`; lesbar für RDF-Werkzeuge, wieder importierbar, siehe „RDF-Austausch“)"; extend "Der **Dateiname** lautet … `.json` bzw. `.svg`" to "`.json`, `.ttl` bzw. `.svg`"; extend "JSON-Datei und Zwischenablage zählen als exportiert" to "JSON-Datei, Turtle-Datei und Zwischenablage zählen als exportiert".
2. Requirement 26: "Der Benutzer kann ein Modell aus einer **JSON-Datei importieren**" → "aus einer **JSON- oder Turtle-Datei importieren** (Turtle nur, wenn sie aus diesem Werkzeug exportiert wurde)".
3. Table row "Export" (`grep -n "^| Export" README.md`): add "**RDF (Turtle)** (lädt `<Projektname>_<Datum>_<Uhrzeit>.ttl` herunter, zählt als exportiert), " before "**SVG**". Row "Import": append "Die Dateiauswahl nimmt `.json` und `.ttl`."
4. Add a new section before `## Projektstruktur`:

````markdown
## RDF-Austausch (Turtle)

Der Export „RDF (Turtle)“ schreibt das Projekt als Turtle-Datei, die sich mit diesem Werkzeug **verlustfrei** wieder importieren lässt und für andere RDF-Werkzeuge (SPARQL, Triple Stores) lesbar ist. Importiert werden nur Dateien dieses Werkzeugs; fremdes RDF wird mit einer Meldung abgelehnt. Das JSON bleibt das Speicherformat (`SCHEMA_VERSION` 5), RDF ist ein reines Austauschformat. Die Umsetzung liegt in `src/model/rdfExport.ts` / `rdfImport.ts` (rein) und `src/storage/rdfIo.ts` (Bibliothek `n3`, bei Bedarf nachgeladen).

Namensraum `rm:` = `urn:release-management:vocab:`. Ressourcen heißen `urn:uuid:<id>`; eine id, die keine UUID ist, steht als `urn:release-management:id:<kodiert>`.

| Modell | RDF |
|---|---|
| Projekt | Blank Node `a rm:Project; rm:schemaVersion 5; rdfs:label <Projektname>` |
| Objekt / Gruppe / Notiz | `a rm:Node / rm:Group / rm:Note; rdfs:label <name>; rm:x, rm:y (relativ zur Gruppe); rm:width, rm:height; rm:index` |
| Gruppenzugehörigkeit | `dcterms:isPartOf <Gruppe>` am Mitglied |
| feste Felder | `rm:color`, `rm:status`, `rm:blockReason`, `rm:class`, `rm:entity`, `rm:version`, `rm:type <Typ>` (zusätzlich `rdf:type <Typ>`, wenn der Typ im Katalog steht) |
| Typfelder | Prädikat `<Typ-IRI>#<Feldname>` (kodiert), je Feld mit `rdfs:label` und `rdfs:domain` beschrieben |
| freie Felder | geordnete `rdf:List` aus `[ rm:key …; rm:value … ]` unter `rm:metadata` |
| Verbindung | `a rm:Edge; rm:source; rm:target; rm:sourceHandle; rm:targetHandle; rdfs:label; rm:optional; rm:type; rm:index` |
| Verbindung (Abkürzung für Dritte) | `<A> rm:precedes <B>` (Reihenfolge; `rm:softPrecedes` bei optionaler Abhängigkeit), `dcterms:requires` (Abhängigkeit), `rm:flowsTo` (Datenfluss), dazu die Typ-IRI als Prädikat; der Import liest sie nicht |
| Typ | `a rdfs:Class, rm:ElementType` bzw. `a rdf:Property, rm:EdgeType; rdfs:label; rm:color; rm:icon; rm:role; rm:field (…); rm:index` |

Alle Metadatenwerte stehen als einfache Zeichenketten, auch `ja`/`nein` und die Statuswerte. Die Semantik „Verbindungen zu oder von einer Gruppe gelten für alle Mitglieder“ gehört zum Werkzeug, nicht zu RDF. Der Import stellt die Typfelder in der Reihenfolge des Katalogs wieder her.
````

- [ ] **Step 2: Help text and agent note (all three languages)**

1. `help.file.body` in `de.ts`, `en.ts`, `fr.ts`: replace the "Export" and "Import" bullets with the following (keep the other bullets of each language as they are; translate for `en`/`fr` in the same sentence structure as the neighbouring bullets):

   - de: `- „Export“ öffnet einen Dialog: Das Projekt lässt sich als JSON-Datei <Projektname>_<Datum>_<Uhrzeit>.json herunterladen, als RDF-Datei (Turtle, .ttl; für RDF-Werkzeuge lesbar und wieder importierbar), der Graph als SVG-Grafik (gleiche Namensform, nicht importierbar) oder das Projekt als JSON-Text in die Zwischenablage kopieren.` and `- „Import“ lädt eine JSON- oder Turtle-Datei und ersetzt das aktuelle Projekt; Turtle-Dateien müssen aus diesem Werkzeug stammen. Vorher wird gefragt, bei nicht exportierten Änderungen zusätzlich gewarnt.`
   - en: `- “Export” opens a dialog: download the project as a JSON file <project name>_<date>_<time>.json, as an RDF file (Turtle, .ttl; readable by RDF tools and importable again), the graph as an SVG graphic (same name form, not importable), or copy the project as JSON text to the clipboard.` and `- “Import” loads a JSON or Turtle file and replaces the current project; Turtle files must come from this tool. You are asked first, and warned about unexported changes.`
   - fr: `- « Export » ouvre une boîte de dialogue : télécharger le projet en fichier JSON <nom du projet>_<date>_<heure>.json, en fichier RDF (Turtle, .ttl ; lisible par les outils RDF et réimportable), le graphe en image SVG (même forme de nom, non importable), ou copier le projet en JSON dans le presse-papiers.` and `- « Import » charge un fichier JSON ou Turtle et remplace le projet actuel ; les fichiers Turtle doivent provenir de cet outil. Une confirmation est demandée, avec un avertissement en cas de modifications non exportées.`

   Keep each catalog's existing quote style and placeholder spelling (`<Projektname>` etc.); `components/helpBody.ts` parses the bullets, so run `npx vitest run src/components` afterwards.

2. Agent help: `grep -n "Datei-Import/-Export" src/i18n/de.ts` finds the key that says file import/export is unreliable for agents; append one sentence in each language: de `Das gilt auch für den Export als RDF (Turtle) und den Import von .ttl-Dateien; Agenten nutzen das JSON.` / en `This also applies to the RDF (Turtle) export and the import of .ttl files; agents should use the JSON.` / fr `Cela vaut aussi pour l’export RDF (Turtle) et l’import de fichiers .ttl ; les agents utilisent le JSON.` Do not add placeholders (the component passes fixed params).

- [ ] **Step 3: CLAUDE.md**

In `CLAUDE.md`, under the **Export** bullet in "Store und UI-Zustand", append a new bullet right after it:

```markdown
- **RDF (Turtle)**: Export-Format `rdf-file` (`ExportFormat`), Import über dieselbe Dateiauswahl (`.json`/`.ttl`, Erkennung am ersten Zeichen in `App.importFileText`). Rein in `model/rdfExport.ts` (`toTriples`) / `model/rdfImport.ts` (`modelFromTriples` → rohes Objekt → `parseModel`, keine zweite Regelmenge) mit eigenem Tripel-Typ in `model/rdfTerms.ts` (Vokabular `rm:` = `urn:release-management:vocab:`, Tabelle `FIXED_FIELDS` für Export **und** Import); `n3` nur in `storage/rdfIo.ts` und nur per `await import('n3')`. Nur eigene Dateien sind importierbar (Round-Trip), fremdes RDF wird abgewiesen. Ändert sich das Datenmodell (neues Feld, neuer Eintrag), Vokabular in beiden Richtungen, `src/test/rdfFixtures.ts`, den Round-Trip-Test und den README-Abschnitt „RDF-Austausch“ mitpflegen. `SCHEMA_VERSION` bleibt unberührt (RDF ist kein Speicherformat). Alle Metadatenwerte stehen als einfache Zeichenketten; Typfelder kommen beim Import in Katalogreihenfolge zurück.
```

And in the "Harte Randbedingungen" bullet about new runtime dependencies append: " Ausnahme (genehmigt, nur nachgeladen): `n3` für den RDF-Austausch."

- [ ] **Step 4: Check that the spec matches what was built**

The spec was already aligned with the decisions made while planning (id scheme for non-UUID ids, `rm:type` always an IRI, `rm:required` as `xsd:boolean`, canonical metadata order built directly, type-field order decided, `rdfIo` API). Re-read it once against the finished code and correct any deviation that crept in during implementation.

- [ ] **Step 5: Final verification and bundle comparison**

Run:

```bash
npm test && npm run typecheck && npm run lint && npm run build 2>&1 | tail -25
```

Expected: all green. Compare the chunk list with the baseline from Task 1 Step 1: the main `index-*.js` size must be (nearly) unchanged and a separate chunk containing `n3` must exist. Report the baseline and new sizes (raw and gzip as printed) to the user. If the main bundle grew noticeably, find the static `import` of `n3` (only `await import('n3')` is allowed) and fix it.

Also run the subpath build the project documents: `npm run build -- --base=/release-management/` and confirm it succeeds.

- [ ] **Step 6: Report**

State plainly: what was verified (tests, typecheck, lint, build, browser check of the dialog in DE/EN/FR) and what was not (a manual file-picker import of a `.ttl`, unless the user did it). Nothing is committed; offer a commit only if the user asks.

---

## Self-Review (done against the spec)

- **Scope/Umfang** → Tasks 2–5 (export, import of own files only, UI). Foreign RDF is rejected in `modelFromTriples` (`rdf.error.notThisTool`).
- **Vocabulary** (project, elements, groups via `dcterms:isPartOf`, notes, fixed fields, type fields, free list, edges with shortcuts, catalog) → `toTriples` (Task 2) and `modelFromTriples` (Task 3), pinned by the tests in both.
- **Architecture** (pure model, `n3` only in `storage/`, lazy) → Tasks 1–4; checked in Task 6 Step 5.
- **Import through `parseModel`** → Task 3; rule violations are reported like for JSON.
- **Errors** (syntax, no project, version, missing end, model rules) → Tasks 3 and 4 tests.
- **Round trip** (starter graph, nested/UUID ids, notes, all field kinds, multiple roles, optional edge, unknown types and statuses, empty values, special characters, empty catalog) → `rdfImport.test.ts`, `rdfIo.test.ts` with `fullContent()`.
- **UI** (export format, `.ttl` pick, `markExported`, failure feedback) → Task 5; help, README, CLAUDE.md, agent note → Task 6.
- **Open points of the spec**: namespace fixed as `urn:release-management:vocab:` (one constant `NS.rm`); type-field order decided (catalog order) and written back into the spec; `n3` size measured in Task 6 Step 5; independent Turtle syntax check is covered by the round trip through `n3`'s own parser plus the manual check by the user (no second parser is added, to keep to one new dependency).
- Types used across tasks: `Triple`, `Subject`, `Term`, `EntryOwner`, `FIXED_FIELDS`, `idToIri`/`iriToId`, `fieldPredicate`, `toTriples`, `modelFromTriples`, `parseTurtle`, `triplesToTurtle`, `exportTurtle`, `turtleToModelJson`, `looksLikeJson` – names match in all tasks.
