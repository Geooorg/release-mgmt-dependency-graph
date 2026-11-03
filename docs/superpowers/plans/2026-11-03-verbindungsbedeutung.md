# Bedeutung von Verbindungstypen und Analyse – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jeder Verbindungstyp legt fest, was sein Pfeil bedeutet (Reihenfolge, Abhängigkeit, Datenfluss); die Analysen nutzen nur passende Verbindungen, und die Oberfläche zeigt, was zählt.

**Architecture:** `TypeDef.roles` (nur Verbindungstypen) im Katalog. Eine reine Funktion `analysisContent(content, purpose)` in `model/edgeRoles.ts` filtert und dreht die Kanten, bevor die unveränderten Analysefunktionen sie lesen; `App.tsx` ruft sie mit Katalog-Inhalt auf. Darstellung (Pfeilspitze, Dämpfung), Dialog-Block, Sidebar-Zeile und Panel-Zeile sind props-getrieben.

**Tech Stack:** React 19, TypeScript strict, zustand, @xyflow/react, Vitest (jsdom), ajv (nur Tests). Keine neuen Laufzeit-Abhängigkeiten.

Spec: `docs/superpowers/specs/2026-11-03-verbindungsbedeutung-design.md` (baut auf `2026-11-03-typisierte-elemente-design.md` auf).

## Global Constraints

- **Nicht committen**, solange der Nutzer es nicht ausdrücklich verlangt (CLAUDE.md). Die Schritte „Checkpoint“ ersetzen den Commit-Schritt; ob und wo committet wird (Branch oder `main`), klärt der Controller beim Start der Ausführung mit dem Nutzer.
- Vor „fertig“ immer: `npm test && npm run typecheck && npm run lint && npm run build`.
- Keine neuen Laufzeit-Abhängigkeiten. Node ≥ 22.12.
- Abhängigkeitsrichtung: `components` (nur Props und `useT`) · `flow`/`App` → `store` → `model` → `i18n`. `model/` bleibt rein und immutabel (kein React/DOM).
- TypeScript strict, `erasableSyntaxOnly` (keine `enum`, Parameter-Properties, Namespaces). Kein Semikolon, einfache Anführungszeichen, 2 Leerzeichen. Bezeichner und Code-Kommentare **Englisch**, Kommentare nur für das *Warum*. Komponenten-Dateien exportieren nur Komponenten.
- **Neue Texte immer in alle drei Kataloge** `src/i18n/de.ts` (Referenz), `en.ts`, `fr.ts`; Werte **ohne** Markdown-Backticks. `tsc` bricht bei fehlenden Schlüsseln.
- **Rollen** (Spec): `sequence` = „A kommt vor B“, `dependency` = „A hängt von B ab“, `flow` = „Daten fließen von A nach B“. Nur bei `edgeTypes`. `sequence` und `dependency` schließen sich an einem Typ aus; `flow` lässt sich mit jeder der beiden kombinieren. Fehlt `roles` oder ist es leer: nur beschreibend.
- **Wirksame Rollen einer Verbindung:** ohne Typ `['sequence']`; bekannter Typ seine `roles`; unbekannter Typ keine.
- **Status-Berechnung** (wartet, blockiert, kritischer Pfad auch als Hervorhebung, Zyklen-Button) nutzt nur `sequence`. **Hervorhebungen** „← Voraussetzungen“, „→ Betroffene“, „↔ Trans. Hülle“ nutzen `sequence` und `dependency` (`dependency` mit vertauschten Enden, Kanten-ID bleibt).
- **Schema-Version bleibt 5** (nicht ausgeliefert, nichts gepusht): keine Migration. Version-5-Dateien ohne `roles` lesen sich als „nur beschreibend“.
- Pfeilspitzen: gefülltes Dreieck (`closed`) für alles außer Abhängigkeit; offene Spitze (`open`, „V“) für Typen mit `dependency`. Keine neue Linienart (gepunktet = optional, gestrichelt = Zyklus).
- Im Analysemodus werden Verbindungen gedämpft, die weder `sequence` noch `dependency` haben (auch reines `flow`), außer sie sind ausgewählt oder hervorgehoben.
- Die Katalogaktionen bleiben im Analysemodus gesperrt (`structureLocked`); die Modellfunktionen der Analysen (`releaseAnalysis.ts`, `cycles.ts`, `dependency.ts`, `effectiveGraph.ts`) bleiben **unverändert**.
- Tests deterministisch: IDs über `counterIds()` aus `src/test/fixtures.ts` (`'id-1'`, …), Fixtures `box`, `group`, `edge` ebendort.

## Dateiübersicht

| Datei | Aufgabe |
|---|---|
| `src/model/types.ts` (ändern) | `EDGE_ROLES`, `EdgeRole`, `TypeDef.roles?` |
| `src/model/catalog.ts` (ändern) | Rollen in `tidyType`, neue Probleme, `checkTypeDef(def, others, side?)` |
| `src/model/catalogParse.ts`, `src/model/serialize.ts` (ändern) | Rollen lesen und schreiben |
| `public/graph.schema.json`, `public/catalog.schema.json` (ändern) | `roles` im Typ |
| `src/model/catalogTemplates.ts` (ändern) | Rollen der Vorlagen |
| `src/model/edgeRoles.ts` (neu) | `getEdgeRoles`, `analysisContent`, `countEdgeRoles`, `arrowHeadFor`, `hasAnalysisRole` |
| `src/App.tsx` (ändern) | Analysen mit Status-/Hervorhebungs-Inhalt, Props für Sidebar und Panel |
| `src/flow/mapping.ts`, `src/flow/Canvas.tsx`, `src/flow/svgExport.ts` (ändern) | Pfeilspitzen, Dämpfung |
| `src/components/icons.tsx`, `edgeRoleLabels.ts` (neu), `TypeCatalogDialog.tsx`, `SidebarEdgeForm.tsx`, `AnalysisPanel.tsx`, `props.ts`, `components.css` (ändern) | Dialog-Block, Sidebar-Zeile, Panel-Zeile |
| `src/i18n/de.ts`, `en.ts`, `fr.ts`, `AgentHelp.tsx`, README, CLAUDE.md (ändern) | Texte und Doku |

---

### Task 1: Rollen im Katalog, Format und Vorlagen

**Files:**
- Modify: `src/model/types.ts`, `src/model/catalog.ts`, `src/model/catalogParse.ts`, `src/model/serialize.ts`, `src/model/catalogTemplates.ts`, `public/graph.schema.json`, `public/catalog.schema.json`, `src/i18n/de.ts`, `en.ts`, `fr.ts`
- Test: `src/model/catalog.test.ts`, `src/model/serialize.test.ts`, `src/model/schema.test.ts`, `src/model/catalogSchema.test.ts`, `src/model/catalogTemplates.test.ts`

**Interfaces:**
- Produces (`types.ts`): `EDGE_ROLES = ['sequence', 'dependency', 'flow'] as const`, `type EdgeRole`, `TypeDef.roles?: EdgeRole[]`.
- Produces (`catalog.ts`): `TypeProblem` um `'roles.conflict' | 'roles.onElementType'` erweitert (+ Einträge in `TYPE_PROBLEM_KEYS`); `checkTypeDef(def: TypeDef, others: readonly TypeDef[], side?: CatalogSide): TypeProblem[]`; `tidyType` sortiert Rollen in der Reihenfolge von `EDGE_ROLES`, entfernt Doppelte und lässt ein leeres Feld weg.
- Consumes: bestehende `tidyType`, `checkTypeDef`, `parseCatalog`, `canonicalType`.

- [ ] **Step 1: Failing tests schreiben**

In `src/model/catalog.test.ts` ergänzen (Importe `checkTypeDef`, `tidyType`, `addType`, `replaceType` stehen dort schon; `EMPTY_CATALOG`, `Catalog`, `TypeDef` ebenso – fehlende Importe ergänzen):

```ts
describe('connection roles', () => {
  const edgeType = (roles?: TypeDef['roles']): TypeDef => ({ id: 'e1', name: 'Aufruf', fields: [], ...(roles && { roles }) })

  it('tidies roles into canonical order without duplicates and drops an empty list', () => {
    expect(tidyType(edgeType(['flow', 'dependency', 'flow'])).roles).toEqual(['dependency', 'flow'])
    expect('roles' in tidyType(edgeType([]))).toBe(false)
  })

  it('accepts every combination except sequence together with dependency', () => {
    expect(checkTypeDef(edgeType(['sequence', 'flow']), [], 'edgeTypes')).toEqual([])
    expect(checkTypeDef(edgeType(['dependency', 'flow']), [], 'edgeTypes')).toEqual([])
    expect(checkTypeDef(edgeType(['sequence', 'dependency']), [], 'edgeTypes')).toEqual(['roles.conflict'])
  })

  it('rejects roles on an element type but only when the side is known', () => {
    expect(checkTypeDef(edgeType(['flow']), [], 'elementTypes')).toEqual(['roles.onElementType'])
    expect(checkTypeDef(edgeType(['flow']), [])).toEqual([])
  })

  it('keeps roles through replaceType and refuses a conflicting update', () => {
    const catalog: Catalog = { elementTypes: [], edgeTypes: [edgeType()] }
    const updated = replaceType(catalog, 'edgeTypes', edgeType(['dependency', 'flow']))
    expect(updated.edgeTypes[0].roles).toEqual(['dependency', 'flow'])
    expect(replaceType(catalog, 'edgeTypes', edgeType(['sequence', 'dependency']))).toBe(catalog)
  })

  it('refuses roles on a new element type via replaceType', () => {
    const catalog: Catalog = { elementTypes: [{ id: 't1', name: 'Service', fields: [] }], edgeTypes: [] }
    expect(replaceType(catalog, 'elementTypes', { id: 't1', name: 'Service', fields: [], roles: ['flow'] })).toBe(catalog)
  })
})
```

In `src/model/serialize.test.ts` im bestehenden `describe('catalog (schema version 5)')` ergänzen (dort sind `entry`, `source(...)` und `typed` definiert; falls die Namen abweichen, die vorhandenen Hilfen benutzen):

```ts
  it('keeps the roles of a connection type through export and import', () => {
    const catalog = {
      elementTypes: [],
      edgeTypes: [{ id: 'e1', name: 'Aufruf', roles: ['flow', 'dependency'], fields: [] }],
    }
    const parsed = parseModel(source({ catalog }))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.model.catalog.edgeTypes[0].roles).toEqual(['dependency', 'flow'])
    const again = parseModel(JSON.parse(serializeModel(parsed.model)))
    expect(again).toEqual(parsed)
    const text = serializeModel(parsed.model)
    expect(text.indexOf('"roles"')).toBeGreaterThan(text.indexOf('"name": "Aufruf"'))
    expect(text.indexOf('"roles"')).toBeLessThan(text.indexOf('"fields"'))
  })

  it('reads a version 5 file without roles as descriptive', () => {
    const parsed = parseModel(source({ catalog: { elementTypes: [], edgeTypes: [{ id: 'e1', name: 'Aufruf', fields: [] }] } }))
    expect(parsed.ok && parsed.model.catalog.edgeTypes[0].roles).toBeFalsy()
  })

  it.each([
    ['an unknown role', { id: 'e1', name: 'A', roles: ['magic'], fields: [] }],
    ['roles that are not a list', { id: 'e1', name: 'A', roles: 'flow', fields: [] }],
  ])('rejects %s', (_label, type) => {
    const parsed = parseModel(source({ catalog: { elementTypes: [], edgeTypes: [type] } }))
    expect(parsed.ok).toBe(false)
  })

  it('rejects sequence together with dependency and roles on an element type', () => {
    const conflict = parseModel(source({ catalog: { elementTypes: [], edgeTypes: [{ id: 'e1', name: 'A', roles: ['sequence', 'dependency'], fields: [] }] } }))
    const onElement = parseModel(source({ catalog: { elementTypes: [{ id: 't1', name: 'A', roles: ['flow'], fields: [] }], edgeTypes: [] } }))
    expect(conflict.ok).toBe(false)
    expect(onElement.ok).toBe(false)
  })
```

In `src/model/schema.test.ts` (dort `validate`, `serializeModel`, `toModel`, `box` sind vorhanden) ergänzen:

```ts
it('accepts roles on a connection type and rejects an unknown role or a duplicate', () => {
  const withRoles = (roles: unknown) => ({
    ...JSON.parse(serializeModel(toModel({ nodes: [box('a', 0, 0)], edges: [] }))),
    catalog: { elementTypes: [], edgeTypes: [{ id: 'e1', name: 'Aufruf', roles, fields: [] }] },
  })
  expect(validate(withRoles(['dependency', 'flow']))).toBe(true)
  expect(validate(withRoles(['magic']))).toBe(false)
  expect(validate(withRoles(['flow', 'flow']))).toBe(false)
})

it('documents that the schema cannot express sequence + dependency, while the importer rejects it', () => {
  const file = {
    ...JSON.parse(serializeModel(toModel({ nodes: [box('a', 0, 0)], edges: [] }))),
    catalog: { elementTypes: [], edgeTypes: [{ id: 'e1', name: 'Aufruf', roles: ['sequence', 'dependency'], fields: [] }] },
  }
  expect(validate(file)).toBe(true)
  expect(parseModel(file).ok).toBe(false)
})
```

In `src/model/catalogSchema.test.ts` ergänzen (dort `validate` für `catalog.schema.json`):

```ts
it('accepts roles and rejects an unknown role', () => {
  const file = (roles: unknown) => ({
    catalogVersion: 1,
    catalog: { elementTypes: [], edgeTypes: [{ id: 'e1', name: 'Aufruf', roles, fields: [] }] },
  })
  expect(validate(file(['flow']))).toBe(true)
  expect(validate(file(['magic']))).toBe(false)
})
```

In `src/model/catalogTemplates.test.ts` ergänzen (`checkTypeDef`, `TEMPLATE_IDS`, `templateCatalog` sind importiert; die Prüfung dort muss jetzt die Seite übergeben):

```ts
it.each(TEMPLATE_IDS)('template %s passes the checks with its side and keeps connection roles on connections only', (id) => {
  const catalog = templateCatalog(id)
  for (const side of ['elementTypes', 'edgeTypes'] as const) {
    for (const type of catalog[side]) expect(checkTypeDef(type, catalog[side], side)).toEqual([])
  }
  expect(catalog.elementTypes.every((type) => type.roles === undefined)).toBe(true)
})

it('gives the example connection types their meaning', () => {
  expect(templateCatalog('it-services').edgeTypes[0].roles).toEqual(['dependency', 'flow'])
  expect(templateCatalog('dataflow').edgeTypes[0].roles).toEqual(['flow'])
})
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx vitest run src/model/catalog.test.ts src/model/serialize.test.ts src/model/schema.test.ts src/model/catalogSchema.test.ts src/model/catalogTemplates.test.ts`
Expected: FAIL (`roles` nicht bekannt / `roles.conflict` fehlt; TypeScript-Fehler in Tests werden von Vitest nicht gemeldet, die Laufzeitprüfungen schlagen fehl).

- [ ] **Step 3: `types.ts` ergänzen**

Vor `export interface TypeDef` einfügen:

```ts
/**
 * What the arrow of a connection type means (see model/edgeRoles.ts): `sequence` = A comes before B,
 * `dependency` = A depends on B, `flow` = data flows from A to B. `sequence` and `dependency` exclude each other.
 */
export const EDGE_ROLES = ['sequence', 'dependency', 'flow'] as const
export type EdgeRole = (typeof EDGE_ROLES)[number]
```

In `TypeDef` nach `icon?: IconKey`:

```ts
  /** Connection types only: what the arrow means. Absent or empty = descriptive only. */
  roles?: EdgeRole[]
```

- [ ] **Step 4: `catalog.ts` anpassen**

Import ergänzen: `import { EDGE_ROLES } from './types'` und `EdgeRole` in die `import type`-Zeile.

`TypeProblem` um die beiden Werte erweitern (`| 'roles.conflict' | 'roles.onElementType'`) und `TYPE_PROBLEM_KEYS` um

```ts
  'roles.conflict': 'catalog.problem.roles.conflict',
  'roles.onElementType': 'catalog.problem.roles.onElementType',
```

`tidyType` ersetzen:

```ts
function tidyRoles(roles: readonly EdgeRole[] | undefined): EdgeRole[] {
  return EDGE_ROLES.filter((role) => roles?.includes(role))
}

/** The type in canonical form (fixed key order, trimmed texts, no empty optional parts). Does not validate. */
export function tidyType(def: TypeDef): TypeDef {
  const roles = tidyRoles(def.roles)
  return {
    id: def.id,
    name: def.name.trim(),
    ...(def.color !== undefined && def.color.trim() !== '' && { color: def.color.trim().toLowerCase() }),
    ...(def.icon !== undefined && { icon: def.icon }),
    ...(roles.length > 0 && { roles }),
    fields: def.fields.map(tidyField),
  }
}
```

`checkTypeDef` bekommt den Parameter `side` und die Regeln (Signatur und die zwei neuen Zeilen; der Rest bleibt):

```ts
export function checkTypeDef(def: TypeDef, others: readonly TypeDef[], side?: CatalogSide): TypeProblem[] {
  const problems = new Set<TypeProblem>()
  // … bestehende Prüfungen von Name, Farbe und Feldern unverändert …
  const roles = def.roles ?? []
  if (side === 'elementTypes' && roles.length > 0) problems.add('roles.onElementType')
  if (roles.includes('sequence') && roles.includes('dependency')) problems.add('roles.conflict')
  return [...problems]
}
```

(Die zwei neuen `if`-Zeilen kommen direkt vor `return [...problems]`.) Doc-Kommentar ergänzen: `side` – nur wenn bekannt, wird `roles` auf Objekttypen abgelehnt.

`addType` und `replaceType` übergeben die Seite:

```ts
  if (checkTypeDef(type, catalog[side], side).length > 0) return undefined
```

```ts
  if (checkTypeDef(tidy, list, side).length > 0) return catalog
```

- [ ] **Step 5: `catalogParse.ts` anpassen**

Importe: `EDGE_ROLES` zur Value-Importzeile aus `./types`, `EdgeRole` zur `import type`-Zeile.

In `parseTypeDef` nach der `icon`-Prüfung:

```ts
  if (
    value.roles !== undefined &&
    !(Array.isArray(value.roles) && value.roles.every((role) => (EDGE_ROLES as readonly unknown[]).includes(role)))
  ) {
    return undefined
  }
```

und im `tidyType({...})`-Aufruf nach `icon`:

```ts
    ...(value.roles !== undefined && { roles: value.roles as EdgeRole[] }),
```

In `parseCatalog`, in der Schleife, die `checkTypeDef(def, result[side])` aufruft, die Seite mitgeben: `checkTypeDef(def, result[side], side)`.

- [ ] **Step 6: `serialize.ts` anpassen**

In `canonicalType` nach `icon`:

```ts
    ...(type.roles !== undefined && type.roles.length > 0 && { roles: [...type.roles] }),
```

- [ ] **Step 7: Schemas ergänzen**

In `public/graph.schema.json` und `public/catalog.schema.json` jeweils unter `$defs.typeDef.properties` nach `icon`:

```json
        "roles": {
          "type": "array",
          "uniqueItems": true,
          "items": { "enum": ["sequence", "dependency", "flow"] }
        },
```

Die `description` beider Dateien um diesen Satz am Ende ergänzen: `Verbindungstypen können roles haben (Bedeutung des Pfeils: sequence = A kommt vor B, dependency = A hängt von B ab, flow = Daten fließen von A nach B); ohne roles ist der Typ nur beschreibend. Nicht ausdrückbar und erst beim Import geprüft: roles nur bei edgeTypes, sequence und dependency nicht zusammen.` (In `graph.schema.json` hängt der Satz an den bestehenden Satz „Nicht ausdrückbar …“ an, den Teil „roles nur bei edgeTypes …“ in dessen Aufzählung einordnen.)

- [ ] **Step 8: Vorlagen**

In `src/model/catalogTemplates.ts` die zwei Verbindungstypen ändern:

```ts
      { id: 'call', name: 'Aufruf', color: '#2563eb', roles: ['dependency', 'flow'], fields: [] },
```

```ts
      { id: 'flow', name: 'Datenfluss', color: '#dc2626', roles: ['flow'], fields: [] },
```

`serializeCatalog` spreadet `...type`; die Schlüsselreihenfolge entspricht damit der Reihenfolge im Literal (`id, name, color, roles, fields`), das passt zur kanonischen Reihenfolge mit `icon` zwischen `color` und `roles` (Verbindungstypen der Vorlagen haben kein Icon).

- [ ] **Step 9: Meldungen in alle drei Kataloge**

| Schlüssel | de | en | fr |
|---|---|---|---|
| `catalog.problem.roles.conflict` | Reihenfolge und Abhängigkeit schließen sich an einem Typ aus. | Sequence and dependency exclude each other on one type. | Ordre et dépendance s’excluent mutuellement pour un type. |
| `catalog.problem.roles.onElementType` | Objekttypen haben keine Verbindungsbedeutung (roles). | Element types have no connection meaning (roles). | Les types d’objets n’ont pas de signification de liaison (roles). |

- [ ] **Step 10: App-Aufruf anpassen und alles prüfen**

In `src/App.tsx` die Stelle `problemsOf` (`grep -n "checkTypeDef" src/App.tsx`) auf `checkTypeDef(tidyType(type), catalog[side], side)` ändern.

Run: `npx vitest run src/model src/i18n && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 11: Checkpoint** – nicht committen.

---

### Task 2: `model/edgeRoles.ts`

**Files:**
- Create: `src/model/edgeRoles.ts`
- Test: `src/model/edgeRoles.test.ts`

**Interfaces:**
- Produces:

```ts
export type AnalysisPurpose = 'status' | 'highlight'
export type ArrowHead = 'closed' | 'open'
export interface EdgeRoleCounts { sequence: number; dependency: number; none: number }
export function getEdgeRoles(edge: Pick<ModelEdge, 'metadata'>, catalog?: Catalog): readonly EdgeRole[]
export function hasAnalysisRole(roles: readonly EdgeRole[]): boolean   // sequence or dependency
export function arrowHeadFor(roles: readonly EdgeRole[]): ArrowHead     // 'open' iff dependency
export function analysisContent(content: GraphContent, purpose: AnalysisPurpose): GraphContent
export function countEdgeRoles(content: GraphContent): EdgeRoleCounts
```

- Consumes: `resolveType` (`typing.ts`), `Catalog`, `EdgeRole`, `GraphContent`, `ModelEdge`, `findCycles` (`cycles.ts`), `findDependencies` (`dependency.ts`), `analyzeProject` (`releaseAnalysis.ts`) in den Tests.

- [ ] **Step 1: Failing test** – `src/model/edgeRoles.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { box, edge } from '../test/fixtures'
import { findCycles } from './cycles'
import { findDependencies } from './dependency'
import {
  analysisContent,
  arrowHeadFor,
  countEdgeRoles,
  getEdgeRoles,
  hasAnalysisRole,
} from './edgeRoles'
import { analyzeProject } from './releaseAnalysis'
import type { Catalog, EdgeRole, GraphContent, ModelEdge } from './types'

const typed = (id: string, source: string, target: string, typeId: string): ModelEdge => ({
  id,
  source,
  target,
  metadata: [
    { key: 'name', value: '' },
    { key: 'type', value: typeId },
  ],
})
const catalog = (roles: Record<string, EdgeRole[]>): Catalog => ({
  elementTypes: [],
  edgeTypes: Object.entries(roles).map(([id, list]) => ({ id, name: id, fields: [], ...(list.length > 0 && { roles: list }) })),
})

describe('getEdgeRoles', () => {
  const c = catalog({ call: ['dependency', 'flow'], note: [] })

  it('counts an untyped connection as sequence', () => {
    expect(getEdgeRoles(edge('e', 'a', 'b'), c)).toEqual(['sequence'])
    expect(getEdgeRoles(edge('e', 'a', 'b'))).toEqual(['sequence'])
  })

  it('returns the roles of a known type, none for a descriptive one', () => {
    expect(getEdgeRoles(typed('e', 'a', 'b', 'call'), c)).toEqual(['dependency', 'flow'])
    expect(getEdgeRoles(typed('e', 'a', 'b', 'note'), c)).toEqual([])
  })

  it('returns no role for an unknown type', () => {
    expect(getEdgeRoles(typed('e', 'a', 'b', 'gone'), c)).toEqual([])
  })
})

describe('arrowHeadFor / hasAnalysisRole', () => {
  it('uses the open head only for dependency', () => {
    expect(arrowHeadFor(['dependency'])).toBe('open')
    expect(arrowHeadFor(['dependency', 'flow'])).toBe('open')
    expect(arrowHeadFor(['sequence'])).toBe('closed')
    expect(arrowHeadFor(['flow'])).toBe('closed')
    expect(arrowHeadFor([])).toBe('closed')
  })

  it('treats only sequence and dependency as roles of the available analyses', () => {
    expect(hasAnalysisRole(['sequence'])).toBe(true)
    expect(hasAnalysisRole(['dependency', 'flow'])).toBe(true)
    expect(hasAnalysisRole(['flow'])).toBe(false)
    expect(hasAnalysisRole([])).toBe(false)
  })
})

describe('analysisContent', () => {
  const nodes = [box('a', 0, 0), box('b', 200, 0), box('c', 400, 0)]
  const c = catalog({ seq: ['sequence'], dep: ['dependency'], flow: ['flow'], none: [] })
  const make = (edges: ModelEdge[]): GraphContent => ({ nodes, edges, catalog: c })

  it('returns the very same content when every connection is untyped', () => {
    const plain = make([edge('e1', 'a', 'b'), edge('e2', 'b', 'c')])
    expect(analysisContent(plain, 'status')).toBe(plain)
    expect(analysisContent(plain, 'highlight')).toBe(plain)
  })

  it('status keeps only sequence connections', () => {
    const content = make([edge('e1', 'a', 'b'), typed('e2', 'b', 'c', 'dep'), typed('e3', 'a', 'c', 'flow'), typed('e4', 'a', 'c', 'none')])
    expect(analysisContent(content, 'status').edges.map((e) => e.id)).toEqual(['e1'])
  })

  it('highlight keeps sequence as is and turns dependency around, keeping the id', () => {
    const content = make([edge('e1', 'a', 'b'), typed('e2', 'b', 'c', 'dep'), typed('e3', 'a', 'c', 'flow')])
    const result = analysisContent(content, 'highlight').edges
    expect(result.map((e) => [e.id, e.source, e.target])).toEqual([
      ['e1', 'a', 'b'],
      ['e2', 'c', 'b'],
    ])
  })

  it('treats a connection of an unknown type as no role', () => {
    const content = make([typed('e1', 'a', 'b', 'gone')])
    expect(analysisContent(content, 'status').edges).toEqual([])
    expect(analysisContent(content, 'highlight').edges).toEqual([])
  })

  it('does not report a cycle for mutual calls, but would for mutual sequence connections', () => {
    const calls = make([typed('e1', 'a', 'b', 'dep'), typed('e2', 'b', 'a', 'dep')])
    expect(findCycles(analysisContent(calls, 'status')).edgeIds.size).toBe(0)
    const order = make([edge('e1', 'a', 'b'), edge('e2', 'b', 'a')])
    expect(findCycles(analysisContent(order, 'status')).edgeIds.size).toBe(2)
  })

  it('does not make a dependency connection wait, but finds it in the highlight with the right direction', () => {
    // a calls b: a depends on b, so b is a prerequisite of a
    const content = make([typed('e1', 'a', 'b', 'dep')])
    const status = analyzeProject(analysisContent(content, 'status'))
    expect(status.waitingIds.size).toBe(0)
    const highlight = findDependencies(analysisContent(content, 'highlight'), ['a'], 'prerequisites')
    expect(highlight.prerequisiteIds).toEqual(['b'])
    expect([...highlight.edgeIds]).toEqual(['e1'])
    const impact = findDependencies(analysisContent(content, 'highlight'), ['b'], 'dependents')
    expect(impact.dependentIds).toEqual(['a'])
  })

  it('leaves the results of a plain release project unchanged', () => {
    const plain = make([edge('e1', 'a', 'b'), edge('e2', 'b', 'c')])
    expect(analyzeProject(analysisContent(plain, 'status'))).toEqual(analyzeProject(plain))
  })
})

describe('countEdgeRoles', () => {
  it('counts sequence, dependency and connections without a role of the available analyses', () => {
    const c = catalog({ dep: ['dependency'], flow: ['flow'], none: [] })
    const content: GraphContent = {
      nodes: [box('a', 0, 0), box('b', 100, 0)],
      edges: [edge('e1', 'a', 'b'), typed('e2', 'a', 'b', 'dep'), typed('e3', 'a', 'b', 'flow'), typed('e4', 'a', 'b', 'none'), typed('e5', 'a', 'b', 'gone')],
      catalog: c,
    }
    expect(countEdgeRoles(content)).toEqual({ sequence: 1, dependency: 1, none: 3 })
  })
})
```

(Die Fixture-Kanten `e2…e5` teilen sich Quelle und Ziel; das ist für `countEdgeRoles` unerheblich. `findDependencies(...).prerequisiteIds`/`edgeIds`/`dependentIds` sind die in `dependency.ts` dokumentierten Felder.)

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx vitest run src/model/edgeRoles.test.ts`
Expected: FAIL (`./edgeRoles` nicht gefunden).

- [ ] **Step 3: `src/model/edgeRoles.ts` schreiben**

```ts
import { resolveType } from './typing'
import type { Catalog, EdgeRole, GraphContent, ModelEdge } from './types'

/**
 * What a connection means. The type of a connection says it: `sequence` (A comes before B), `dependency`
 * (A depends on B) or `flow` (data flows from A to B). A connection without a type means `sequence`, as
 * it always did; a connection whose type is not in the catalog means nothing, because its meaning is unknown.
 */
const UNTYPED: readonly EdgeRole[] = ['sequence']
const NO_ROLES: readonly EdgeRole[] = []

export type AnalysisPurpose = 'status' | 'highlight'
export type ArrowHead = 'closed' | 'open'

export interface EdgeRoleCounts {
  sequence: number
  dependency: number
  /** Connections with neither role: descriptive, flow only or of an unknown type. */
  none: number
}

export function getEdgeRoles(edge: Pick<ModelEdge, 'metadata'>, catalog?: Catalog): readonly EdgeRole[] {
  const resolved = resolveType(edge.metadata ?? [], catalog?.edgeTypes ?? [])
  if (resolved.state === 'none') return UNTYPED
  if (resolved.state === 'unknown') return NO_ROLES
  return resolved.def.roles ?? NO_ROLES
}

/** Whether the roles take part in the analyses that exist today (status and highlights). */
export function hasAnalysisRole(roles: readonly EdgeRole[]): boolean {
  return roles.includes('sequence') || roles.includes('dependency')
}

/** The open head marks a dependency; everything else keeps the filled triangle. */
export function arrowHeadFor(roles: readonly EdgeRole[]): ArrowHead {
  return roles.includes('dependency') ? 'open' : 'closed'
}

/**
 * The content the analyses read. `status`: only `sequence` connections. `highlight`: `sequence` connections
 * plus `dependency` connections with their ends swapped (A depends on B reads as "B comes before A"), same id,
 * so the highlight finds the edge it has to draw. The analyses themselves stay unchanged.
 * Nothing to filter or turn -> the very same content.
 */
export function analysisContent(content: GraphContent, purpose: AnalysisPurpose): GraphContent {
  let changed = false
  const edges: ModelEdge[] = []
  for (const edge of content.edges) {
    const roles = getEdgeRoles(edge, content.catalog)
    if (roles.includes('sequence')) {
      edges.push(edge)
    } else if (purpose === 'highlight' && roles.includes('dependency')) {
      edges.push({ ...edge, source: edge.target, target: edge.source })
      changed = true
    } else {
      changed = true
    }
  }
  return changed ? { ...content, edges } : content
}

export function countEdgeRoles(content: GraphContent): EdgeRoleCounts {
  const counts: EdgeRoleCounts = { sequence: 0, dependency: 0, none: 0 }
  for (const edge of content.edges) {
    const roles = getEdgeRoles(edge, content.catalog)
    if (roles.includes('sequence')) counts.sequence += 1
    else if (roles.includes('dependency')) counts.dependency += 1
    else counts.none += 1
  }
  return counts
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/model/edgeRoles.test.ts src/model`
Expected: PASS. Zeigt der Test `findDependencies(...)` abweichende Feldnamen oder Reihenfolgen, die Erwartung an die in `src/model/dependency.ts` dokumentierte Form anpassen (nicht die Implementierung).

- [ ] **Step 5: Typecheck und Lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Checkpoint** – nicht committen.

---

### Task 3: Analysen mit Rollen speisen (`App.tsx`)

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `analysisContent`, `countEdgeRoles` (Task 2), `selectContent` (vorhanden), `catalog` (in `App.tsx` bereits als Store-Wert vorhanden; mit `grep -n "const catalog" src/App.tsx` prüfen).
- Produces: `statusContent`, `highlightContent` (`GraphContent`, intern in `App`).

- [ ] **Step 1: Failing Test** – `src/App.test.tsx`

Zuerst den bestehenden Aufbau lesen: `grep -n "Zyklen\|cycle" src/App.test.tsx` zeigt, wie ein Test ein Projekt mit Zyklus in den Store legt und den Zyklen-Button findet. Den dortigen Aufbau (Store füllen über `graphStore`, Modus wechseln, Zyklen-Button per Rolle/Label suchen) für diesen Test verwenden. Ergänzen:

```tsx
it('does not report a dependency cycle for mutual calls whose type is only a dependency', async () => {
  const catalog = {
    elementTypes: [],
    edgeTypes: [{ id: 'call', name: 'Aufruf', roles: ['dependency', 'flow'], fields: [] }],
  }
  const call = (id: string, source: string, target: string) => ({
    id,
    source,
    target,
    metadata: [
      { key: 'name', value: '' },
      { key: 'type', value: 'call' },
    ],
  })
  // Same setup as the existing cycle test of this file, with typed connections and the catalog.
  seedProject({
    nodes: [boxNode('a'), boxNode('b')],
    edges: [call('e1', 'a', 'b'), call('e2', 'b', 'a')],
    catalog,
  })
  render(<App />)
  await userEvent.click(screen.getByRole('button', { name: /Analysieren/ }))
  expect(screen.queryByRole('button', { name: /Zyklus|Zyklen/ })).toBeNull()
})

it('still reports the cycle when the same mutual connections are untyped', async () => {
  seedProject({ nodes: [boxNode('a'), boxNode('b')], edges: [{ id: 'e1', source: 'a', target: 'b' }, { id: 'e2', source: 'b', target: 'a' }] })
  render(<App />)
  await userEvent.click(screen.getByRole('button', { name: /Analysieren/ }))
  expect(screen.getByRole('button', { name: /Zyklus|Zyklen/ })).toBeTruthy()
})
```

`seedProject` und `boxNode` stehen für die Hilfen, mit denen der vorhandene Zyklus-Test sein Projekt anlegt; die tatsächlichen Namen und Aufrufe aus der Datei übernehmen (ggf. `graphStore.setState({ nodes, edges, catalog })`, wie andere Tests dort).

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx vitest run src/App.test.tsx`
Expected: der erste neue Test FAIL (Zyklen-Button erscheint), der zweite PASS.

- [ ] **Step 3: Verdrahtung**

In `src/App.tsx` Import ergänzen: `import { analysisContent, countEdgeRoles } from './model/edgeRoles'`.

Direkt vor `const cycles = useMemo(...)` (ca. Zeile 211) einfügen:

```tsx
  // The analyses read different connections: the status analysis only follows `sequence` connections, the
  // highlights also follow `dependency` connections (turned around). The catalog has to be part of the content,
  // otherwise typed connections would lose their meaning.
  const statusContent = useMemo(() => analysisContent({ nodes, edges, catalog }, 'status'), [nodes, edges, catalog])
  const highlightContent = useMemo(
    () => analysisContent({ nodes, edges, catalog }, 'highlight'),
    [nodes, edges, catalog],
  )
```

Die vier Analyse-Aufrufe ändern (Abhängigkeitslisten anpassen):

```tsx
  const cycles = useMemo(() => findCycles(statusContent), [statusContent])
  const analysis = useMemo(() => analyzeProject(statusContent), [statusContent])
```

```tsx
    () => (panelVisible || drawCritical ? analyzeSelection(statusContent, selectedNodeIds) : null),
    [panelVisible, drawCritical, statusContent, selectedNodeIds],
```

```tsx
        ? { direction: dependencyDirection, ...findDependencies(highlightContent, selectedNodeIds, dependencyDirection) }
        : null,
    [dependencyDirection, highlightContent, selectedNodeIds],
```

```tsx
    () => (panelVisible && selection ? toPanelProps(statusContent, analysis, selection, dependencies) : null),
    [panelVisible, selection, statusContent, analysis, dependencies],
```

`formatAnalysisMarkdown(selectContent(state), …)` (ca. Zeile 450) liest nur Namen aus dem Inhalt: mit `grep -n "content.edges" src/model/releaseAnalysis.ts` prüfen, ob die Funktion Kanten berechnet. Wenn ja, `analysisContent(selectContent(state), 'status')` übergeben; wenn nein, unverändert lassen.

- [ ] **Step 4: Tests, Typecheck, Lint, Build**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS (Regression: alle bestehenden Analyse-Tests bleiben grün).

- [ ] **Step 5: Checkpoint** – nicht committen.

---

### Task 4: Pfeilspitzen und Dämpfung (Fläche und SVG)

**Files:**
- Modify: `src/flow/mapping.ts`, `src/flow/Canvas.tsx`, `src/flow/svgExport.ts`
- Test: `src/flow/mapping.test.ts`, `src/flow/svgExport.test.ts`

**Interfaces:**
- Consumes: `getEdgeRoles`, `arrowHeadFor`, `hasAnalysisRole`, `ArrowHead` (Task 2).
- Produces: `toFlowEdges(edges, selectedIds, dependencyIds, nodes, cycleIds, t, catalog, analyzing?: boolean)`; SVG-Marker-IDs `arrow` / `arrow-<hex>` (gefüllt, wie bisher) und `arrow-open` / `arrow-<hex>-open` (offen).

- [ ] **Step 1: Failing tests**

In `src/flow/mapping.test.ts` ergänzen (Aufbau der bestehenden `toFlowEdges`-Tests übernehmen: dort sind `box`, die Hilfsfunktionen für `selectedIds`/`dependencyIds` und das Typ-Edge-Beispiel aus Task 6 des letzten Plans zu finden; `grep -n "toFlowEdges" src/flow/mapping.test.ts | head -3`):

```ts
describe('arrow heads and dimming by meaning', () => {
  const nodes = [box('a', 0, 0), box('b', 200, 0)]
  const catalog = {
    elementTypes: [],
    edgeTypes: [
      { id: 'dep', name: 'Aufruf', roles: ['dependency' as const, 'flow' as const], fields: [] },
      { id: 'flow', name: 'Datenfluss', roles: ['flow' as const], fields: [] },
      { id: 'none', name: 'Notiz', fields: [] },
    ],
  }
  const typedEdge = (typeId: string) => ({
    id: 'e',
    source: 'a',
    target: 'b',
    metadata: [
      { key: 'name', value: '' },
      { key: 'type', value: typeId },
    ],
  })
  const flowEdge = (edge: ModelEdge, analyzing = false, selected = new Set<string>()) =>
    toFlowEdges([edge], selected, new Set(), nodes, new Set(), undefined, catalog, analyzing)[0]

  it('uses the open head for a dependency and the filled one for everything else', () => {
    expect((flowEdge(typedEdge('dep')).markerEnd as { type: string }).type).toBe(MarkerType.Arrow)
    expect((flowEdge(typedEdge('flow')).markerEnd as { type: string }).type).toBe(MarkerType.ArrowClosed)
    expect((flowEdge({ id: 'e', source: 'a', target: 'b' }).markerEnd as { type: string }).type).toBe(MarkerType.ArrowClosed)
  })

  it('dims connections without sequence or dependency only in the analysis mode', () => {
    expect(flowEdge(typedEdge('flow'), true).style?.opacity).toBeLessThan(1)
    expect(flowEdge(typedEdge('none'), true).style?.opacity).toBeLessThan(1)
    expect(flowEdge(typedEdge('flow'), false).style?.opacity).toBeUndefined()
    expect(flowEdge(typedEdge('dep'), true).style?.opacity).toBeUndefined()
    expect(flowEdge({ id: 'e', source: 'a', target: 'b' }, true).style?.opacity).toBeUndefined()
  })

  it('does not dim a selected connection', () => {
    expect(flowEdge(typedEdge('none'), true, new Set(['e'])).style?.opacity).toBeUndefined()
  })
})
```

(Importe in der Testdatei ergänzen: `MarkerType` aus `@xyflow/react`, `ModelEdge` als Typ.)

In `src/flow/svgExport.test.ts` ergänzen (Aufbau der vorhandenen Tests übernehmen):

```ts
describe('arrow heads by meaning', () => {
  const catalog = {
    elementTypes: [],
    edgeTypes: [
      { id: 'dep', name: 'Aufruf', roles: ['dependency' as const], fields: [] },
      { id: 'red', name: 'Rot', color: '#dc2626', roles: ['dependency' as const], fields: [] },
    ],
  }
  const typedEdge = (id: string, typeId: string) => ({
    id,
    source: 'a',
    target: 'b',
    metadata: [
      { key: 'name', value: '' },
      { key: 'type', value: typeId },
    ],
  })

  it('draws an open head for a dependency and keeps the filled one for the rest', () => {
    const svg = buildSvg({ nodes: [box('a', 0, 0), box('b', 300, 0)], edges: [typedEdge('e1', 'dep')], catalog })
    expect(svg).toContain('marker-end="url(#arrow-open)"')
    expect(svg).toMatch(/<marker id="arrow-open"[^>]*><polyline /)
    expect(svg).toMatch(/<marker id="arrow"[^>]*><polygon /)
  })

  it('creates the marker per colour and head kind', () => {
    const svg = buildSvg({ nodes: [box('a', 0, 0), box('b', 300, 0)], edges: [typedEdge('e1', 'red')], catalog })
    expect(svg).toContain('marker-end="url(#arrow-dc2626-open)"')
    expect(svg).toContain('<marker id="arrow-dc2626-open"')
  })

  it('draws a plain connection with the filled head as before', () => {
    const svg = buildSvg({ nodes: [box('a', 0, 0), box('b', 300, 0)], edges: [{ id: 'e1', source: 'a', target: 'b' }] })
    expect(svg).toContain('marker-end="url(#arrow)"')
  })
})
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx vitest run src/flow/mapping.test.ts src/flow/svgExport.test.ts`
Expected: FAIL.

- [ ] **Step 3: `mapping.ts`**

Import ergänzen: `import { arrowHeadFor, getEdgeRoles, hasAnalysisRole } from '../model/edgeRoles'`.

Signatur von `toFlowEdges` um den letzten Parameter erweitern und das Doc ergänzen (`In the analysis mode, connections that no analysis uses are dimmed.`):

```ts
  catalog?: Catalog,
  analyzing = false,
): Edge[] {
```

Im `edges.map`-Block nach `const soft = isSoftEdge(edge)`:

```ts
    const roles = getEdgeRoles(edge, catalog)
    const open = arrowHeadFor(roles) === 'open'
    // Selected and highlighted connections stay readable; only the ones no analysis reads fade out.
    const dimmed = analyzing && !selected && !dependency && !hasAnalysisRole(roles)
```

`labelStyle` und `style` und `markerEnd` ändern:

```ts
      labelStyle: { fill: color, fontWeight: 600, fontSize: 13, opacity: dimmed ? DIMMED_OPACITY : undefined },
```

```ts
      style: {
        stroke: color,
        strokeWidth: width,
        strokeDasharray: soft ? softDash(width) : cyclic ? CYCLE_DASH : undefined,
        strokeLinecap: soft ? 'round' : undefined,
        opacity: dimmed ? DIMMED_OPACITY : undefined,
      },
      markerEnd: {
        type: open ? MarkerType.Arrow : MarkerType.ArrowClosed,
        color,
        width: dependency ? 12 : 20,
        height: dependency ? 12 : 20,
        ...(open && { strokeWidth: 2 }),
      },
```

Konstante bei den anderen Konstanten oben: `const DIMMED_OPACITY = 0.35`.

- [ ] **Step 4: `Canvas.tsx`**

Den Aufruf (ca. Zeile 100) und seine Abhängigkeiten ändern:

```tsx
    () => toFlowEdges(edges, new Set(selectedEdgeIds), highlight.edgeIds, nodes, cycles.edgeIds, t, catalog, analyzing),
    [edges, nodes, selectedEdgeIds, highlight, cycles, t, catalog, analyzing],
```

(`analyzing` steht in `Canvas.tsx` schon in Zeile 66, vor diesem Aufruf; falls nicht, die Deklaration nach oben ziehen.)

- [ ] **Step 5: `svgExport.ts`**

Import: `import { arrowHeadFor, getEdgeRoles, type ArrowHead } from '../model/edgeRoles'`.

`arrowId` und `arrowMarker` ersetzen:

```ts
const arrowId = (color: string, head: ArrowHead): string => {
  const base = color === EDGE_COLOR ? 'arrow' : `arrow-${color.slice(1)}`
  return head === 'open' ? `${base}-open` : base
}

/** Arrow head in one colour; the marker follows the colour of its line. `open` is the dependency head. */
function arrowMarker(color: string, head: ArrowHead): string {
  const shape =
    head === 'open'
      ? `<polyline points="-10,-8 0,0 -10,8" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<polygon points="-10,-8 0,0 -10,8" fill="${color}" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`
  return `<marker id="${arrowId(color, head)}" viewBox="-10 -10 20 20" markerWidth="20" markerHeight="20" markerUnits="userSpaceOnUse" orient="auto" refX="0" refY="0">${shape}</marker>`
}
```

In `buildSvg` statt `arrowColors`:

```ts
  const arrowKinds = new Map<string, { color: string; head: ArrowHead }>([
    [arrowId(EDGE_COLOR, 'closed'), { color: EDGE_COLOR, head: 'closed' }],
  ])
```

in der Kantenschleife (ersetzt `arrowColors.add(stroke)`):

```ts
    const head = arrowHeadFor(getEdgeRoles(edge, content.catalog))
    arrowKinds.set(arrowId(stroke, head), { color: stroke, head })
```

`marker-end="url(#${arrowId(stroke, head)})"` und in `<defs>`:

```ts
    `<defs>${[...arrowKinds.values()].map(({ color, head }) => arrowMarker(color, head)).join('')}</defs>`,
```

- [ ] **Step 6: Tests, Typecheck, Lint**

Run: `npx vitest run src/flow && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 7: Checkpoint** – nicht committen.

---

### Task 5: Dialog-Block, Sidebar-Zeile, Panel-Zeile

**Files:**
- Create: `src/components/edgeRoleLabels.ts`
- Modify: `src/components/icons.tsx`, `src/components/TypeCatalogDialog.tsx`, `src/components/SidebarEdgeForm.tsx`, `src/components/AnalysisPanel.tsx`, `src/components/props.ts`, `src/components/components.css`, `src/App.tsx`, `src/i18n/de.ts`, `en.ts`, `fr.ts`
- Test: `src/components/TypeCatalogDialog.test.tsx`, `src/components/Sidebar.test.tsx`, `src/components/AnalysisPanel.test.tsx`

**Interfaces:**
- Produces (`edgeRoleLabels.ts`): `EDGE_ROLE_NAME_KEYS: Record<EdgeRole, MessageKey>` und `EDGE_ROLE_HINT_KEYS: Record<EdgeRole, MessageKey>`.
- Produces (`props.ts`): `SidebarElement.meaning?: EdgeMeaning` mit `export interface EdgeMeaning { state: 'untyped' | 'known' | 'unknown'; roles: EdgeRole[] }`; `AnalysisPanelProps.edgeSummary: { sequence: number; dependency: number; none: number } | null`.
- Produces (`icons.tsx`): `ArrowHeadIcon({ head }: { head: ArrowHead })`.
- Consumes: `ArrowHead`, `EDGE_ROLES`, `EdgeRole`, `getEdgeRoles`, `countEdgeRoles` (Tasks 1–2).

- [ ] **Step 1: Meldungen in alle drei Kataloge**

| Schlüssel | de | en | fr |
|---|---|---|---|
| `types.roles` | Bedeutung | Meaning | Signification |
| `types.role.sequence` | Reihenfolge | Sequence | Ordre |
| `types.role.sequence.hint` | A kommt vor B | A comes before B | A vient avant B |
| `types.role.dependency` | Abhängigkeit | Dependency | Dépendance |
| `types.role.dependency.hint` | A hängt von B ab | A depends on B | A dépend de B |
| `types.role.flow` | Datenfluss | Data flow | Flux de données |
| `types.role.flow.hint` | Daten fließen von A nach B | Data flows from A to B | Les données circulent de A vers B |
| `types.roles.none` | Nur beschreibend: wird in keiner Analyse berücksichtigt. | Descriptive only: not used by any analysis. | Descriptif uniquement : n’est utilisé par aucune analyse. |
| `types.roles.exclusive` | Reihenfolge und Abhängigkeit schließen sich aus. | Sequence and dependency exclude each other. | Ordre et dépendance s’excluent mutuellement. |
| `sidebar.field.meaning` | Bedeutung | Meaning | Signification |
| `sidebar.meaning.untyped` | Reihenfolge (ohne Typ) | Sequence (no type) | Ordre (sans type) |
| `sidebar.meaning.none` | Nur beschreibend | Descriptive only | Descriptif uniquement |
| `sidebar.meaning.unknown` | Unbekannter Typ: zählt für keine Analyse | Unknown type: counts for no analysis | Type inconnu : ne compte pour aucune analyse |
| `analysis.edges` | Berücksichtigt: {sequence} Reihenfolge, {dependency} Abhängigkeit; {none} ohne Bedeutung für diese Analysen | Considered: {sequence} sequence, {dependency} dependency; {none} without meaning for these analyses | Pris en compte : {sequence} ordre, {dependency} dépendance ; {none} sans signification pour ces analyses |

Prüfen, ob `t(key, params)` Zahlen als Parameter annimmt (`src/i18n/translate.ts`); sonst `String(...)` übergeben.

- [ ] **Step 2: Failing tests**

`src/components/TypeCatalogDialog.test.tsx` (Aufbau und `baseProps` der bestehenden Tests übernehmen; dort gibt es bereits einen Weg, den Reiter „Verbindungen“ zu öffnen und einen Typ auszuwählen) ergänzen:

```tsx
describe('meaning of a connection type', () => {
  const edgeType = { id: 'e1', name: 'Aufruf', fields: [], usage: 0 }
  const open = (over: Partial<TypeCatalogDialogProps> = {}) => {
    const props = baseProps({ edgeTypes: [edgeType], ...over })
    render(<TypeCatalogDialog {...props} />)
    return props
  }
  const selectEdgeType = async () => {
    await userEvent.click(screen.getByRole('tab', { name: 'Verbindungen' }))
    await userEvent.click(screen.getByText('Aufruf'))
  }

  it('shows the meaning block only for connection types', async () => {
    open({ elementTypes: [{ id: 't1', name: 'Service', fields: [], usage: 0 }] })
    await userEvent.click(screen.getByText('Service'))
    expect(screen.queryByText('Bedeutung')).toBeNull()
    await selectEdgeType()
    expect(screen.getByText('Bedeutung')).toBeTruthy()
  })

  it('applies a checked role at once and says that a type without a role is descriptive', async () => {
    const props = open()
    await selectEdgeType()
    expect(screen.getByText('Nur beschreibend: wird in keiner Analyse berücksichtigt.')).toBeTruthy()
    await userEvent.click(screen.getByRole('checkbox', { name: /Datenfluss/ }))
    expect(props.onUpdate).toHaveBeenLastCalledWith('edgeTypes', expect.objectContaining({ id: 'e1', roles: ['flow'] }))
  })

  it('locks sequence while dependency is checked and the other way round', async () => {
    open({ edgeTypes: [{ ...edgeType, roles: ['dependency'] }] })
    await selectEdgeType()
    expect(screen.getByRole('checkbox', { name: /Reihenfolge/ })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /Abhängigkeit/ })).toBeEnabled()
    expect(screen.getByText('Reihenfolge und Abhängigkeit schließen sich aus.')).toBeTruthy()
  })

  it('cannot be changed in the read-only mode', async () => {
    open({ readOnly: true })
    await selectEdgeType()
    expect(screen.getByRole('checkbox', { name: /Datenfluss/ })).toBeDisabled()
  })
})
```

`src/components/Sidebar.test.tsx` ergänzen (Aufbau der vorhandenen Verbindungs-Tests dort übernehmen):

```tsx
describe('meaning of a connection', () => {
  const edgeElement = (meaning: SidebarElement['meaning']): SidebarElement => ({
    id: 'e1',
    kind: 'edge',
    metadata: [{ key: 'name', value: '' }],
    meaning,
  })
  it.each([
    [{ state: 'untyped', roles: ['sequence'] }, 'Reihenfolge (ohne Typ)'],
    [{ state: 'known', roles: [] }, 'Nur beschreibend'],
    [{ state: 'known', roles: ['dependency', 'flow'] }, 'Abhängigkeit, Datenfluss'],
    [{ state: 'unknown', roles: [] }, 'Unbekannter Typ: zählt für keine Analyse'],
  ] as const)('shows the meaning %j as "%s"', (meaning, text) => {
    render(<Sidebar {...baseProps} element={edgeElement(meaning as SidebarElement['meaning'])} />)
    expect(screen.getByText('Bedeutung')).toBeTruthy()
    expect(screen.getByText(text)).toBeTruthy()
  })
})
```

(`baseProps` steht für die Hilfsprops der Datei; Namen aus den vorhandenen Verbindungs-Tests übernehmen.)

`src/components/AnalysisPanel.test.tsx` ergänzen (Hilfsfunktion der Datei für Panel-Props verwenden):

```tsx
it('shows how many connections feed which analysis when not all are sequence connections', () => {
  render(<AnalysisPanel {...panelProps({ edgeSummary: { sequence: 12, dependency: 3, none: 5 } })} />)
  expect(
    screen.getByText('Berücksichtigt: 12 Reihenfolge, 3 Abhängigkeit; 5 ohne Bedeutung für diese Analysen'),
  ).toBeTruthy()
})

it('shows no such line for a plain release project', () => {
  render(<AnalysisPanel {...panelProps({ edgeSummary: null })} />)
  expect(screen.queryByText(/Berücksichtigt:/)).toBeNull()
})
```

Run: `npx vitest run src/components/TypeCatalogDialog.test.tsx src/components/Sidebar.test.tsx src/components/AnalysisPanel.test.tsx`
Expected: FAIL.

- [ ] **Step 3: `edgeRoleLabels.ts` (neu)**

```ts
import type { MessageKey } from '../i18n/messages'
import type { EdgeRole } from '../model/types'

/** Catalog keys of the display names and of the arrow meaning of each role. */
export const EDGE_ROLE_NAME_KEYS: Record<EdgeRole, MessageKey> = {
  sequence: 'types.role.sequence',
  dependency: 'types.role.dependency',
  flow: 'types.role.flow',
}

export const EDGE_ROLE_HINT_KEYS: Record<EdgeRole, MessageKey> = {
  sequence: 'types.role.sequence.hint',
  dependency: 'types.role.dependency.hint',
  flow: 'types.role.flow.hint',
}
```

- [ ] **Step 4: `ArrowHeadIcon` in `icons.tsx`**

```tsx
import type { ArrowHead } from '../model/edgeRoles'

/** The arrow head of a connection meaning: filled triangle (default) or open "V" (dependency). Decorative. */
export function ArrowHeadIcon({ head }: { head: ArrowHead }) {
  return (
    <svg
      viewBox="0 0 24 12"
      width="24"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="1" y1="6" x2="15" y2="6" />
      {head === 'open' ? <polyline points="13,1 21,6 13,11" /> : <polygon points="13,1 22,6 13,11" fill="currentColor" />}
    </svg>
  )
}
```

(Der Import steht als `import type` oben in der Datei zu den anderen Importen; `icons.tsx` exportiert nur Komponenten.)

- [ ] **Step 5: Dialog-Block**

In `TypeCatalogDialog.tsx` Importe ergänzen: `EDGE_ROLES` (Wert, aus `../model/types`), `ArrowHeadIcon` (aus `./icons`), `EDGE_ROLE_NAME_KEYS`, `EDGE_ROLE_HINT_KEYS` (aus `./edgeRoleLabels`).

Im Detail-Formular **vor** `<h3>{t('types.fields')}</h3>` einfügen:

```tsx
            {side === 'edgeTypes' && (
              <fieldset className="types-dialog__roles">
                <legend>{t('types.roles')}</legend>
                {EDGE_ROLES.map((role) => {
                  const roles = shown.roles ?? []
                  const rival = role === 'sequence' ? 'dependency' : role === 'dependency' ? 'sequence' : undefined
                  return (
                    <label key={role} className="types-dialog__role">
                      <input
                        type="checkbox"
                        checked={roles.includes(role)}
                        disabled={rival !== undefined && roles.includes(rival)}
                        onChange={(event) =>
                          edit(
                            { ...shown, roles: event.target.checked ? [...roles, role] : roles.filter((r) => r !== role) },
                            true,
                          )
                        }
                      />
                      <ArrowHeadIcon head={role === 'dependency' ? 'open' : 'closed'} />
                      {t(EDGE_ROLE_NAME_KEYS[role])} – {t(EDGE_ROLE_HINT_KEYS[role])}
                    </label>
                  )
                })}
                <p className="types-dialog__hint">
                  {(shown.roles ?? []).length === 0 ? t('types.roles.none') : t('types.roles.exclusive')}
                </p>
              </fieldset>
            )}
```

(Der Hinweis „schließen sich aus“ steht, sobald mindestens eine Rolle gesetzt ist; das ist der Hinweistext der gesperrten Felder. Der Gesamt-`fieldset disabled={readOnly}` sperrt die Kästchen im Analysemodus.)

CSS in `components.css`:

```css
.types-dialog__roles {
  border: 1px solid var(--border, #d1d5db);
  border-radius: 6px;
  padding: 8px;
  margin: 8px 0;
}

.types-dialog__role {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}
```

(Falls `components.css` für Rahmen andere Variablen nutzt, dem Muster von `.sidebar__type-fields` folgen.)

- [ ] **Step 6: Sidebar-Zeile**

`props.ts`: `import type { EdgeRole } from '../model/types'` ergänzen und

```ts
/** What a connection means, shown read-only in the sidebar. */
export interface EdgeMeaning {
  /** `untyped`: no type, counts as sequence; `known`: the roles of its type (maybe none); `unknown`: type not in the catalog. */
  state: 'untyped' | 'known' | 'unknown'
  roles: EdgeRole[]
}
```

in `SidebarElement` nach `typeId?`:

```ts
  /** Edges only: what the connection means for the analyses. */
  meaning?: EdgeMeaning
```

`SidebarEdgeForm.tsx`: Importe `EDGE_ROLE_NAME_KEYS` aus `./edgeRoleLabels`. Nach dem Richtungsblock (`{onReverse && ( … )}`) einfügen:

```tsx
      {element.meaning && (
        <div className="sidebar__field">
          <span className="sidebar__label">{t('sidebar.field.meaning')}</span>
          <span className="sidebar__check-hint">
            {element.meaning.state === 'untyped'
              ? t('sidebar.meaning.untyped')
              : element.meaning.state === 'unknown'
                ? t('sidebar.meaning.unknown')
                : element.meaning.roles.length === 0
                  ? t('sidebar.meaning.none')
                  : element.meaning.roles.map((role) => t(EDGE_ROLE_NAME_KEYS[role])).join(', ')}
          </span>
        </div>
      )}
```

`App.tsx`: im `sidebarEdge`-Zweig (ca. Zeile 372–386) ergänzen; Import `getEdgeRoles` aus `./model/edgeRoles`, `resolveType` aus `./model/typing`:

```tsx
        meaning: (() => {
          const resolved = resolveType(sidebarEdge.metadata ?? [], catalog.edgeTypes)
          return {
            state: resolved.state === 'none' ? ('untyped' as const) : resolved.state === 'known' ? ('known' as const) : ('unknown' as const),
            roles: [...getEdgeRoles(sidebarEdge, catalog)],
          }
        })(),
```

und `catalog` in die Abhängigkeitsliste dieses `useMemo` aufnehmen.

- [ ] **Step 7: Panel-Zeile**

`props.ts`: in `AnalysisPanelProps` nach `counts`:

```ts
  /** Connections per meaning, shown as one line; null when every connection is a plain sequence connection. */
  edgeSummary: { sequence: number; dependency: number; none: number } | null
```

`AnalysisPanel.tsx`: nach der `<ul className="analysis-counts" …>…</ul>` (ca. Zeile 395–420) einfügen:

```tsx
        {edgeSummary && <p className="analysis-edges">{t('analysis.edges', edgeSummary)}</p>}
```

und `edgeSummary` in der Prop-Destrukturierung (ca. Zeile 325) ergänzen. CSS:

```css
.analysis-edges {
  margin: 4px 0 8px;
  font-size: 12px;
  opacity: 0.8;
}
```

`App.tsx`: `toPanelProps` bleibt rein ohne Katalog; die Zeile kommt in `App` dazu. Direkt vor `<AnalysisPanel {...panelProps}`: Berechnung per `useMemo` (bei den übrigen Memos):

```tsx
  const edgeSummary = useMemo(() => {
    const counts = countEdgeRoles({ nodes, edges, catalog })
    return counts.sequence === edges.length ? null : counts
  }, [nodes, edges, catalog])
```

und im JSX `edgeSummary={edgeSummary}` an `<AnalysisPanel …>` übergeben. `toPanelProps` hat in seinem `Omit<…>`-Typ ein Feld mehr in `AnalysisPanelProps`: `'edgeSummary'` in die Omit-Liste aufnehmen.

- [ ] **Step 8: Tests, Typecheck, Lint, Build**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 9: Checkpoint** – nicht committen.

---

### Task 6: Hilfe, Agent-Hilfe, Doku und Abschlussprüfung

**Files:**
- Modify: `src/i18n/de.ts`, `en.ts`, `fr.ts` (Hilfetexte), `src/components/AgentHelp.tsx`, `README.md`, `CLAUDE.md`
- Test: `src/i18n/catalog.test.ts`, `src/components/HelpDialog.test.tsx`, `src/components/AgentHelp.test.tsx` (nur laufen lassen, bei Bedarf anpassen)

**Interfaces:** Keine neuen Funktionen.

- [ ] **Step 1: Hilfetext ergänzen**

In den drei Katalogen den Wert von `help.types.body` um diesen Aufzählungspunkt **vor** dem Punkt zum Analysemodus bzw. am Ende ergänzen (vorhandenen Text lesen und den Punkt in dieselbe Aufzählung einfügen):

- de: `- Jeder Verbindungstyp hat eine Bedeutung für den Pfeil: „Reihenfolge“ (A kommt vor B), „Abhängigkeit“ (A hängt von B ab, offene Pfeilspitze) und „Datenfluss“ (Daten fließen von A nach B). Reihenfolge und Abhängigkeit schließen sich aus. Ohne Bedeutung ist ein Typ nur beschreibend. Eine Verbindung ohne Typ gilt als Reihenfolge, wie bisher.\n- Die Statusberechnung (wartet, blockiert, kritischer Pfad, Zyklen) nutzt nur Reihenfolge-Verbindungen. Die Hervorhebungen „Voraussetzungen“, „Betroffene“ und „Trans. Hülle“ nutzen Reihenfolge und Abhängigkeit. Im Analysemodus werden Verbindungen gedämpft, die keine dieser beiden Bedeutungen haben.`
- en: `- Every connection type gives its arrow a meaning: “Sequence” (A comes before B), “Dependency” (A depends on B, open arrow head) and “Data flow” (data flows from A to B). Sequence and dependency exclude each other. A type without a meaning is descriptive only. A connection without a type counts as sequence, as before.\n- The status calculation (waiting, blocked, critical path, cycles) only uses sequence connections. The highlights “Prerequisites”, “Affected” and “Trans. closure” use sequence and dependency. In analysis mode, connections with neither meaning are dimmed.`
- fr: `- Chaque type de liaison donne une signification à sa flèche : « Ordre » (A vient avant B), « Dépendance » (A dépend de B, pointe ouverte) et « Flux de données » (les données circulent de A vers B). Ordre et dépendance s’excluent mutuellement. Un type sans signification est purement descriptif. Une liaison sans type compte comme ordre, comme avant.\n- Le calcul de statut (en attente, bloqué, chemin critique, cycles) n’utilise que les liaisons d’ordre. Les mises en évidence « Prérequis », « Concernés » et « Fermeture trans. » utilisent ordre et dépendance. En mode analyse, les liaisons sans l’une de ces significations sont atténuées.`

Die Namen der Hervorhebungs-Buttons („Voraussetzungen“, „Betroffene“, „Trans. Hülle“ usw.) aus den vorhandenen Katalogen (`grep -n "highlight" src/i18n/de.ts`) übernehmen, wenn sie dort anders lauten.

- [ ] **Step 2: Agent-Hilfe**

`src/components/AgentHelp.tsx`: Die Form des Typs (`TYPE_SHAPE`, ca. Zeile 28) um `roles?:["sequence"|"dependency"|"flow"]` ergänzen; im Katalog-Beispiel (`CATALOG_EXAMPLE`) einen Verbindungstyp mit Rollen aufnehmen, z. B. `edgeTypes: [{ id: 'c1a…', name: 'Aufruf', color: '#2563eb', roles: ['dependency', 'flow'], fields: [] }]`. In den `agent.types.*`-Texten der drei Kataloge (`grep -n "agent.types" src/i18n/de.ts`) je einen kurzen Absatz zur Bedeutung ergänzen: Rollen, die Pfeilrichtung je Rolle, dass `sequence` und `dependency` sich ausschließen, dass ohne Typ `sequence` gilt und dass Status nur `sequence` nutzt, Hervorhebungen `sequence` und `dependency`. Das Dialog-Label „Bedeutung“ und die drei Kästchen-Beschriftungen aus den `types.role.*`-Schlüsseln beziehen (nicht neu tippen), wie die übrigen Beschriftungen dort. Die in der Agent-Hilfe genannte Schema-Version bleibt 5.

- [ ] **Step 3: README und CLAUDE.md**

`README.md`: im Abschnitt „Typen“ einen kurzen Absatz „Bedeutung von Verbindungstypen“ ergänzen (Rollen, Pfeilrichtung je Rolle, Standard ohne Typ, welche Analyse welche Rolle nutzt, offene Pfeilspitze bei Abhängigkeit, Dämpfung im Analysemodus) und `roles` im Beispiel des Katalogformats.

`CLAUDE.md`: Den Absatz „**Typen**“ unter „Domänen-Invarianten / Modell“ am Ende um diesen Satz ergänzen: `**Bedeutung von Verbindungstypen:** \`TypeDef.roles\` (nur \`edgeTypes\`; \`sequence\` = A kommt vor B, \`dependency\` = A hängt von B ab, \`flow\` = Daten A → B; \`sequence\` und \`dependency\` schließen sich aus; leer = nur beschreibend). Wirksame Rollen nur über \`model/edgeRoles.ts\` (\`getEdgeRoles\`: ohne Typ \`sequence\`, unbekannter Typ keine). Die Analysen lesen \`analysisContent(content, 'status' | 'highlight')\` (Status/Zyklen/kritischer Pfad nur \`sequence\`; Hervorhebungen \`sequence\` + \`dependency\` mit vertauschten Enden, Kanten-ID bleibt) – \`App\` ruft sie mit \`catalog\` im Inhalt auf, die Analysefunktionen selbst bleiben unverändert. Pfeilspitze offen bei \`dependency\` (\`arrowHeadFor\`), im Analysemodus werden Verbindungen ohne \`sequence\`/\`dependency\` gedämpft (\`hasAnalysisRole\`); Panel-Zeile \`edgeSummary\` nur wenn nicht alles \`sequence\`. Bei Änderungen \`svgExport.ts\`, Hilfe (\`help.types.*\`) und \`AgentHelp\` mitpflegen.` Außerdem den Satz im „Kanten“-Absatz zur Pfeilbedeutung („Pfeil A → B = A kommt vor B“) um `(für Verbindungen ohne Typ und mit der Bedeutung Reihenfolge; Typen können eine andere Bedeutung festlegen)` ergänzen.

- [ ] **Step 4: Automatische Prüfung**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: alle PASS (`catalog.test.ts` und `noHardcodedGerman.test.ts` in `src/i18n` bleiben grün).

- [ ] **Step 5: Browserprüfung (Dev-Server, `npm run dev`) in DE, EN und FR**

Checkliste:
1. Vorlage „IT-Services“ anwenden; im Dialog Reiter „Verbindungen“, Typ „Aufruf“: „Bedeutung“ zeigt Abhängigkeit und Datenfluss angekreuzt, „Reihenfolge“ ist gesperrt, Hinweis sichtbar; Reihenfolge und Abhängigkeit lassen sich nicht zugleich ankreuzen; ohne Haken steht „Nur beschreibend …“.
2. Zwei Objekte mit zwei gegenseitigen „Aufruf“-Verbindungen: **keine** Sanduhr, **kein** Zyklen-Button im Analysemodus; dieselben Verbindungen ohne Typ: Zyklen-Button erscheint.
3. Offene Pfeilspitze bei „Aufruf“, gefüllt bei untypisierten Verbindungen und bei „Datenfluss“; Spitze folgt der Linienfarbe, Auswahl (dunkelblau) und Hervorhebung (rot) färben sie um.
4. Analysemodus: „Datenfluss“-Verbindung und beschreibende Typen sind gedämpft, „Aufruf“ nicht; eine ausgewählte gedämpfte Verbindung ist nicht gedämpft.
5. Hervorhebung: ein Objekt A mit „Aufruf“ A → B: „← Voraussetzungen“ von A hebt B hervor, „→ Betroffene“ von B hebt A hervor.
6. Sidebar einer Verbindung: Zeile „Bedeutung“ zeigt die richtigen Texte (ohne Typ, mit Typ, beschreibend, unbekannter Typ nach Löschen des Typs).
7. Panel-Zeile „Berücksichtigt: …“ erscheint nur, wenn nicht alle Verbindungen Reihenfolge sind.
8. SVG-Export zeigt offene und gefüllte Spitzen; JSON-Export/Import und Katalog-Export/Import erhalten `roles`.
9. Toolbar bei **1024 px** in beiden Modi ohne Scrollen, mit Zyklen-Button, in DE, EN, FR (Toolbar wurde nicht geändert; trotzdem die Breite der beiden Datei-Zeilen messen).
10. Hilfe-Dialog und `#/agent-hilfe` enthalten die neuen Absätze in drei Sprachen.

- [ ] **Step 6: Abschluss** – Ergebnis zusammenfassen; **nicht committen**, solange der Nutzer es nicht verlangt.

---

## Self-Review (gegen den Spec)

- **Datenmodell** (`roles` nur bei Verbindungstypen, Werte, keine Doppelten, Ausschluss `sequence`/`dependency`, `tidyType`, Wirksame Rollen, unbekannter Typ): Tasks 1–2. **Auswertung** (Status nur `sequence`, Hervorhebung `sequence` + umgedrehtes `dependency`, Angriffspfade nicht enthalten): Tasks 2–3. **Format** (`roles` in beiden Schemas, Importer, Export, Version 5, keine Migration, Vorlagen): Task 1.
- **Oberfläche:** Dialog-Block mit Sperre und Hinweisen, Pfeilspitzen auf der Fläche und im SVG, Sidebar-Zeile, Dämpfung im Analysemodus, Panel-Zeile, Vorlagen mit Rollen, Texte, Hilfe, Agent-Hilfe: Tasks 4–6.
- **Tests des Spec:** Katalogregeln, Format/Schema, `edgeRoles`, Regression (Release-Projekt unverändert: `analysisContent` liefert denselben Inhalt), Neu (Abhängigkeit erzeugt weder „wartet“ noch Zyklus, richtungsrichtig in der Hervorhebung, Verbindung ohne Rolle erscheint nirgends), Verdrahtung (`App.test.tsx`), Darstellung, Komponenten, i18n: Tasks 1–5 und der automatische Lauf in Task 6.
- **Bewusst abgesetzt:** Angriffspfad-Analyse, Datenfluss-Spitze, Standardtyp für neue Verbindungen, Linienarten je Typ.
- **Stellen, an denen der Plan auf Code verweist, den ich nicht vollständig gelesen habe:** der Aufbau der bestehenden `App.test.tsx`-Zyklus-Tests (Hilfen zum Anlegen eines Projekts), die Hilfs-Props der `Sidebar`-, `AnalysisPanel`- und `TypeCatalogDialog`-Tests, die Signatur von `t(key, params)` bei Zahlen, die Namen der Hervorhebungs-Buttons in den Katalogen und die genaue Stelle der Zeile im `AnalysisPanel`. Jeder Schritt nennt dafür den `grep`-Befehl oder das Muster, dem zu folgen ist.
