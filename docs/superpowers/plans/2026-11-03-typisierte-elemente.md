# Typisierte Elemente und Verbindungen – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Objekte und Verbindungen bekommen einen Typ aus einem projektspezifischen Katalog (Farbe, Icon, definierte Felder), pflegbar über ein Konfigurationsmenü.

**Architecture:** Der Katalog ist Teil von `GraphContent` (Undo, Export, `localStorage`, Schema-Version 5). Ein Element trägt den Metadateneintrag `type` mit der Typ-ID; Zugriff nur über `model/typing.ts`. Die Fachlogik liegt rein in `model/catalog.ts` und `model/typing.ts`, der Store bekommt Aktionen, die Oberfläche (Sidebar, Darstellung, Dialog) bleibt props-getrieben.

**Tech Stack:** React 19, TypeScript strict, zustand, @xyflow/react, Vitest (jsdom), ajv (nur Tests). Keine neuen Laufzeit-Abhängigkeiten.

Spec: `docs/superpowers/specs/2026-11-03-typisierte-elemente-design.md`

## Global Constraints

- **Nicht committen**, solange der Nutzer es nicht ausdrücklich verlangt (CLAUDE.md). Die Schritte „Checkpoint“ ersetzen den üblichen Commit-Schritt: nur Tests/Typecheck/Lint laufen lassen.
- Vor „fertig“ immer: `npm test && npm run typecheck && npm run lint && npm run build`.
- Keine neuen Laufzeit-Abhängigkeiten. Node ≥ 22.12.
- Abhängigkeitsrichtung: `components` (nur Props und `useT`) · `flow`/`App` → `store` → `model` → `i18n`. `model/` bleibt rein und immutabel (kein React/DOM).
- TypeScript strict, `erasableSyntaxOnly` (keine `enum`, Parameter-Properties, Namespaces). Kein Semikolon, einfache Anführungszeichen, 2 Leerzeichen. Bezeichner und Code-Kommentare **Englisch**, Kommentare nur für das *Warum*.
- **Neue Texte immer in alle drei Kataloge** `src/i18n/de.ts` (Referenz), `en.ts`, `fr.ts`; `tsc` bricht bei fehlenden Schlüsseln. Daten bleiben deutsch: die Werte `ja`/`nein` von Ja/Nein-Feldern sind Daten.
- Schema-Version 4 → **5**: Migration in `parseModel`, `public/graph.schema.json`, README-Beispiel, `schema.test.ts`.
- Reservierte Feldschlüssel (ohne Beachtung der Groß-/Kleinschreibung): `name`, `color`, `status`, `blockiert_grund`, `type`, `class`, `entity`, `version`, `optional`.
- Metadaten-Reihenfolge: `name`, `color`, `status`, `blockiert_grund`, `type`, `class`, `entity`, `version`, Typfelder (Katalogreihenfolge), freie Felder. Bei Verbindungen: `name`, `optional`, `type`, Typfelder, freie Felder.
- Jede Modelländerung läuft über `apply` (= ein Undo-Schritt); Katalogaktionen sind im Analysemodus ein stilles No-Op (`structureLocked`), der Typwechsel von Objekten und Typfelder-Eingaben nicht.
- Entscheidung gegenüber dem Spec: In `GraphContent` ist `catalog` **optional** (wie `projectName`; fehlend = leer), damit die vielen `{ nodes, edges }`-Literale in Tests und Analysen unverändert bleiben. `GraphModel` und der Store haben ihn immer. Der Spec wird in Task 3 entsprechend angepasst.
- Tests deterministisch: IDs über `counterIds()` aus `src/test/fixtures.ts`, keine festen ID-Texte erwarten.

## Dateiübersicht

| Datei | Aufgabe |
|---|---|
| `src/model/types.ts` (ändern) | Typen `Catalog`, `TypeDef`, `FieldDef`, `IconKey`, Konstanten `TYPE_KEY`, `EMPTY_CATALOG`; `SCHEMA_VERSION = 5`; `GraphContent.catalog?` |
| `src/model/catalog.ts` (neu) | Reine Katalogoperationen und Prüfregeln |
| `src/model/typing.ts` (neu) | `type`-Eintrag lesen/schreiben, Typfelder, Farbauflösung |
| `src/model/catalogParse.ts` (neu) | Katalog aus untrusted JSON lesen (für Projekt und Katalogdatei) |
| `src/model/catalogTemplates.ts` (neu) | Mitgelieferte Vorlagen, Katalogdatei lesen/schreiben |
| `src/model/objectFields.ts` (ändern) | `type` zählt als fester Eintrag vor `class` |
| `src/model/graph.ts` (ändern) | `setTypes`, `setEdgeType`, `setEdgeField` |
| `src/model/serialize.ts` (ändern) | Export/Import mit Katalog, Migration 1–4 → 5 |
| `src/model/filter.ts` (ändern) | `type` über Typnamen finden |
| `src/storage/localStorage.ts`, `src/store/persistence.ts` (ändern) | Katalog mitspeichern |
| `src/store/graphStore.ts` (ändern) | `catalog` im Zustand, Katalog- und Typaktionen |
| `src/components/SidebarTypeFields.tsx`, `SidebarBulkType.tsx`, `typedDraft.ts` (neu), `Sidebar.tsx`, `SidebarEdgeForm.tsx`, `props.ts` (ändern) | Sidebar |
| `src/components/TypeIcon.tsx` (neu), `BoxNode.tsx`, `components.css`, `src/flow/mapping.ts`, `src/flow/types.ts`, `src/flow/svgExport.ts` (ändern) | Darstellung |
| `src/components/TypeCatalogDialog.tsx` (neu), `Toolbar.tsx`, `icons.tsx`, `App.tsx` (ändern) | Konfigurationsmenü |
| `public/catalog.schema.json` (neu), `public/graph.schema.json` (ändern) | Schemas |
| `src/i18n/de.ts`, `en.ts`, `fr.ts`, `src/components/AgentHelpText.tsx`, README (ändern) | Texte und Doku |

---

### Task 1: Katalogtypen und `model/catalog.ts`

**Files:**
- Modify: `src/model/types.ts`
- Create: `src/model/catalog.ts`
- Test: `src/model/catalog.test.ts`

**Interfaces:**
- Produces (`types.ts`): `ICON_KEYS`, `IconKey`, `FIELD_KINDS`, `FieldKind`, `FieldDef`, `TypeDef`, `Catalog`, `EMPTY_CATALOG`, `TYPE_KEY`, `GraphContent.catalog?: Catalog`.
- Produces (`catalog.ts`): `RESERVED_FIELD_KEYS`, `CatalogSide`, `TypeProblem`, `TYPE_PROBLEM_KEYS`, `tidyType(def)`, `checkTypeDef(def, others)`, `findType(catalog, side, id)`, `uniqueName(types, base)`, `addType(catalog, side, name, newId)`, `replaceType(catalog, side, def)`, `removeType(catalog, side, id)`, `countUsage(content, side, id)`, `mergeCatalog(current, incoming, newId)`, `withFreshIds(catalog, newId)`.
- Consumes: `isValidColor` (`metadata.ts`). `countUsage` braucht `getTypeId` aus Task 2; bis dahin wird es in Task 2 Schritt 5 nachgezogen (siehe dort), Task 1 liefert `countUsage` deshalb **nicht**.

- [ ] **Step 1: Typen in `types.ts` ergänzen**

Hinter `export const SCHEMA_VERSION = 4` ändern und die Konstanten ergänzen:

```ts
export const SCHEMA_VERSION = 5

/** Version 4 had no type catalog; it is read as an empty catalog. */
export const VERSION_BEFORE_CATALOG = 4
```

`GraphContent` (nach `projectName`):

```ts
  /** Types of objects and connections; undefined = no types defined (same as the empty catalog). */
  catalog?: Catalog
```

`GraphModel` bleibt `extends GraphContent`, bekommt aber einen Pflicht-Katalog:

```ts
export interface GraphModel extends GraphContent {
  version: typeof SCHEMA_VERSION
  catalog: Catalog
}
```

Am Ende der Datei (vor den Layout-Konstanten ist egal) ergänzen:

```ts
/** Fixed icon set for types (drawn as inline SVG, see components/TypeIcon.tsx). */
export const ICON_KEYS = ['service', 'database', 'queue', 'user', 'cloud', 'external', 'process', 'storage'] as const
export type IconKey = (typeof ICON_KEYS)[number]

export const FIELD_KINDS = ['text', 'select', 'boolean'] as const
export type FieldKind = (typeof FIELD_KINDS)[number]

/** One field a type defines; its value is an ordinary metadata entry under `key`. */
export interface FieldDef {
  /** Metadata key; trimmed, unique within the type, never a reserved key. */
  key: string
  kind: FieldKind
  /** `select` only: at least one, no duplicates. */
  options?: string[]
  required?: boolean
  /** `boolean`: 'ja' | 'nein'; `select`: one of the options; `text`: any. Absent = empty. */
  default?: string
}

export interface TypeDef {
  /** UUID, generated once, never editable; elements refer to a type by it. */
  id: string
  /** Display name, unique within its list (trimmed, case-insensitive). */
  name: string
  /** `#rrggbb` default colour of elements of this type. */
  color?: string
  icon?: IconKey
  fields: FieldDef[]
}

export interface Catalog {
  /** Types of objects (`kind: 'node'`). */
  elementTypes: TypeDef[]
  /** Types of connections. */
  edgeTypes: TypeDef[]
}

export const EMPTY_CATALOG: Catalog = { elementTypes: [], edgeTypes: [] }

/** Metadata entry holding the id of the element's type. */
export const TYPE_KEY = 'type'
```

- [ ] **Step 2: Failing test schreiben** – `src/model/catalog.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { counterIds } from '../test/fixtures'
import {
  addType,
  checkTypeDef,
  findType,
  mergeCatalog,
  removeType,
  replaceType,
  tidyType,
  uniqueName,
  withFreshIds,
} from './catalog'
import { EMPTY_CATALOG } from './types'
import type { Catalog, TypeDef } from './types'

const def = (over: Partial<TypeDef> = {}): TypeDef => ({ id: 't1', name: 'Service', fields: [], ...over })
const catalogOf = (...types: TypeDef[]): Catalog => ({ ...EMPTY_CATALOG, elementTypes: types })

describe('checkTypeDef', () => {
  it('accepts a plain type', () => {
    expect(checkTypeDef(def(), [])).toEqual([])
  })

  it('rejects an empty name', () => {
    expect(checkTypeDef(def({ name: '  ' }), [])).toEqual(['name.empty'])
  })

  it('rejects a name another type already has, ignoring case and spaces, but not its own', () => {
    expect(checkTypeDef(def({ id: 't2', name: ' service ' }), [def()])).toEqual(['name.taken'])
    expect(checkTypeDef(def(), [def()])).toEqual([])
  })

  it('rejects an invalid colour', () => {
    expect(checkTypeDef(def({ color: 'red' }), [])).toEqual(['color.invalid'])
  })

  it('rejects empty, reserved and duplicate field keys', () => {
    const fields = [
      { key: ' ', kind: 'text' as const },
      { key: 'Status', kind: 'text' as const },
      { key: 'owner', kind: 'text' as const },
      { key: 'OWNER', kind: 'text' as const },
    ]
    expect(checkTypeDef(def({ fields }), [])).toEqual(['field.keyEmpty', 'field.keyReserved', 'field.keyDuplicate'])
  })

  it('needs options for a select, without duplicates, and a default among them', () => {
    const select = (options: string[] | undefined, standard?: string) =>
      def({ fields: [{ key: 'env', kind: 'select', options, default: standard }] })
    expect(checkTypeDef(select(undefined), [])).toEqual(['field.optionsEmpty'])
    expect(checkTypeDef(select(['prod', 'Prod']), [])).toEqual(['field.optionsDuplicate'])
    expect(checkTypeDef(select(['prod', 'test'], 'dev'), [])).toEqual(['field.defaultInvalid'])
    expect(checkTypeDef(select(['prod', 'test'], 'test'), [])).toEqual([])
  })

  it('allows only ja, nein or nothing as boolean default', () => {
    const flag = (standard: string) => def({ fields: [{ key: 'tls', kind: 'boolean', default: standard }] })
    expect(checkTypeDef(flag('ja'), [])).toEqual([])
    expect(checkTypeDef(flag('vielleicht'), [])).toEqual(['field.defaultInvalid'])
  })
})

describe('tidyType', () => {
  it('trims, lower-cases the colour, drops empty options, defaults and colours', () => {
    const tidy = tidyType(
      def({
        name: ' Service ',
        color: '#AABBCC',
        fields: [{ key: ' env ', kind: 'select', options: [' prod ', ''], default: ' ', required: false }],
      }),
    )
    expect(tidy).toEqual({
      id: 't1',
      name: 'Service',
      color: '#aabbcc',
      fields: [{ key: 'env', kind: 'select', options: ['prod'] }],
    })
    expect('color' in tidyType(def({ color: '' }))).toBe(false)
  })
})

describe('catalog operations', () => {
  it('adds a type with a fresh id and rejects a taken name', () => {
    const ids = counterIds()
    const added = addType(EMPTY_CATALOG, 'elementTypes', 'Service', ids)
    expect(added?.catalog.elementTypes).toHaveLength(1)
    expect(findType(added!.catalog, 'elementTypes', added!.id)?.name).toBe('Service')
    expect(addType(added!.catalog, 'elementTypes', 'service', ids)).toBeUndefined()
  })

  it('does not touch the other list', () => {
    const added = addType(EMPTY_CATALOG, 'edgeTypes', 'Datenfluss', counterIds())
    expect(added?.catalog.elementTypes).toBe(EMPTY_CATALOG.elementTypes)
  })

  it('suggests a unique name', () => {
    expect(uniqueName([], 'Neuer Typ')).toBe('Neuer Typ')
    expect(uniqueName([def({ name: 'Neuer Typ' }), def({ id: 'x', name: 'neuer typ 2' })], 'Neuer Typ')).toBe('Neuer Typ 3')
  })

  it('replaces a type by id, keeps the same catalog for invalid or unchanged input', () => {
    const catalog = catalogOf(def())
    const renamed = replaceType(catalog, 'elementTypes', def({ name: 'Dienst' }))
    expect(renamed.elementTypes[0].name).toBe('Dienst')
    expect(replaceType(catalog, 'elementTypes', def({ name: '' }))).toBe(catalog)
    expect(replaceType(catalog, 'elementTypes', def())).toBe(catalog)
    expect(replaceType(catalog, 'elementTypes', def({ id: 'unknown' }))).toBe(catalog)
  })

  it('removes a type by id', () => {
    const catalog = catalogOf(def(), def({ id: 't2', name: 'DB' }))
    expect(removeType(catalog, 'elementTypes', 't1').elementTypes.map((t) => t.id)).toEqual(['t2'])
    expect(removeType(catalog, 'elementTypes', 'unknown')).toBe(catalog)
  })

  it('merges by name: existing names are skipped, new types get fresh ids', () => {
    const merged = mergeCatalog(catalogOf(def()), catalogOf(def({ id: 'a', name: 'service' }), def({ id: 'b', name: 'Queue' })), counterIds())
    expect(merged.elementTypes.map((t) => t.name)).toEqual(['Service', 'Queue'])
    expect(merged.elementTypes[1].id).not.toBe('b')
  })

  it('gives every type a fresh id', () => {
    const fresh = withFreshIds(catalogOf(def()), counterIds())
    expect(fresh.elementTypes[0].id).not.toBe('t1')
    expect(fresh.elementTypes[0].name).toBe('Service')
  })
})
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/model/catalog.test.ts`
Expected: FAIL (`Failed to resolve import "./catalog"`).

- [ ] **Step 4: `src/model/catalog.ts` schreiben**

```ts
import type { MessageKey } from '../i18n/messages'
import { isValidColor } from './metadata'
import type { Catalog, FieldDef, IdGenerator, TypeDef } from './types'

/** Keys the app itself uses on elements and connections: a type field may not take them. */
export const RESERVED_FIELD_KEYS: readonly string[] = [
  'name',
  'color',
  'status',
  'blockiert_grund',
  'type',
  'class',
  'entity',
  'version',
  'optional',
]

export type CatalogSide = 'elementTypes' | 'edgeTypes'

export type TypeProblem =
  | 'name.empty'
  | 'name.taken'
  | 'color.invalid'
  | 'field.keyEmpty'
  | 'field.keyReserved'
  | 'field.keyDuplicate'
  | 'field.optionsEmpty'
  | 'field.optionsDuplicate'
  | 'field.defaultInvalid'

/** Catalog keys of the messages for the problems (used by the import and the type dialog). */
export const TYPE_PROBLEM_KEYS: Record<TypeProblem, MessageKey> = {
  'name.empty': 'catalog.problem.name.empty',
  'name.taken': 'catalog.problem.name.taken',
  'color.invalid': 'catalog.problem.color.invalid',
  'field.keyEmpty': 'catalog.problem.field.keyEmpty',
  'field.keyReserved': 'catalog.problem.field.keyReserved',
  'field.keyDuplicate': 'catalog.problem.field.keyDuplicate',
  'field.optionsEmpty': 'catalog.problem.field.optionsEmpty',
  'field.optionsDuplicate': 'catalog.problem.field.optionsDuplicate',
  'field.defaultInvalid': 'catalog.problem.field.defaultInvalid',
}

const norm = (text: string) => text.trim().toLowerCase()

function tidyField(field: FieldDef): FieldDef {
  const standard = field.default?.trim() ?? ''
  return {
    key: field.key.trim(),
    kind: field.kind,
    ...(field.kind === 'select' && { options: (field.options ?? []).map((o) => o.trim()).filter((o) => o !== '') }),
    ...(field.required && { required: true }),
    ...(standard !== '' && { default: standard }),
  }
}

/** The type in canonical form (fixed key order, trimmed texts, no empty optional parts). Does not validate. */
export function tidyType(def: TypeDef): TypeDef {
  return {
    id: def.id,
    name: def.name.trim(),
    ...(def.color !== undefined && def.color.trim() !== '' && { color: def.color.trim().toLowerCase() }),
    ...(def.icon !== undefined && { icon: def.icon }),
    fields: def.fields.map(tidyField),
  }
}

function checkField(field: FieldDef, problems: Set<TypeProblem>): void {
  if (field.kind === 'select') {
    const options = field.options ?? []
    if (options.length === 0) problems.add('field.optionsEmpty')
    else if (new Set(options.map(norm)).size !== options.length) problems.add('field.optionsDuplicate')
    if (field.default !== undefined && field.default !== '' && !options.includes(field.default)) {
      problems.add('field.defaultInvalid')
    }
  } else if (field.kind === 'boolean') {
    if (field.default !== undefined && !['', 'ja', 'nein'].includes(field.default)) problems.add('field.defaultInvalid')
  }
}

/** Problems of one type; `others` is its whole list (the type itself is skipped by id). Expects a tidy type. */
export function checkTypeDef(def: TypeDef, others: readonly TypeDef[]): TypeProblem[] {
  const problems = new Set<TypeProblem>()
  const name = norm(def.name)
  if (name === '') problems.add('name.empty')
  else if (others.some((other) => other.id !== def.id && norm(other.name) === name)) problems.add('name.taken')
  if (def.color !== undefined && !isValidColor(def.color)) problems.add('color.invalid')
  const seen = new Set<string>()
  for (const field of def.fields) {
    const key = norm(field.key)
    if (key === '') problems.add('field.keyEmpty')
    else if (RESERVED_FIELD_KEYS.includes(key)) problems.add('field.keyReserved')
    else if (seen.has(key)) problems.add('field.keyDuplicate')
    seen.add(key)
    checkField(field, problems)
  }
  return [...problems]
}

export function findType(catalog: Catalog, side: CatalogSide, id: string): TypeDef | undefined {
  return catalog[side].find((type) => type.id === id)
}

/** `base`, or `base 2`, `base 3` … – the first name no type has yet. */
export function uniqueName(types: readonly TypeDef[], base: string): string {
  const taken = new Set(types.map((type) => norm(type.name)))
  if (!taken.has(norm(base))) return base
  let n = 2
  while (taken.has(norm(`${base} ${n}`))) n += 1
  return `${base} ${n}`
}

/** Appends an empty type. Empty or taken name -> undefined. */
export function addType(
  catalog: Catalog,
  side: CatalogSide,
  name: string,
  newId: IdGenerator,
): { catalog: Catalog; id: string } | undefined {
  const type = tidyType({ id: newId(), name, fields: [] })
  if (checkTypeDef(type, catalog[side]).length > 0) return undefined
  return { catalog: { ...catalog, [side]: [...catalog[side], type] }, id: type.id }
}

/** Replaces the type with the same id by its tidy form. Unknown id, problems or no change -> the same catalog. */
export function replaceType(catalog: Catalog, side: CatalogSide, def: TypeDef): Catalog {
  const list = catalog[side]
  const index = list.findIndex((type) => type.id === def.id)
  if (index === -1) return catalog
  const tidy = tidyType(def)
  if (checkTypeDef(tidy, list).length > 0) return catalog
  if (JSON.stringify(tidy) === JSON.stringify(list[index])) return catalog
  return { ...catalog, [side]: list.map((type, i) => (i === index ? tidy : type)) }
}

/** Removes the type; elements that refer to it keep their `type` entry (they show it as unknown). */
export function removeType(catalog: Catalog, side: CatalogSide, id: string): Catalog {
  if (!catalog[side].some((type) => type.id === id)) return catalog
  return { ...catalog, [side]: catalog[side].filter((type) => type.id !== id) }
}

/** Copies of the types with new ids (a template or file must not bring foreign ids into the project). */
export function withFreshIds(catalog: Catalog, newId: IdGenerator): Catalog {
  const fresh = (types: readonly TypeDef[]) => types.map((type) => ({ ...tidyType(type), id: newId() }))
  return { elementTypes: fresh(catalog.elementTypes), edgeTypes: fresh(catalog.edgeTypes) }
}

/** `current` plus the types of `incoming` whose name `current` does not have yet (new ids). */
export function mergeCatalog(current: Catalog, incoming: Catalog, newId: IdGenerator): Catalog {
  const merge = (own: readonly TypeDef[], other: readonly TypeDef[]) => {
    const names = new Set(own.map((type) => norm(type.name)))
    const added = other.filter((type) => !names.has(norm(type.name))).map((type) => ({ ...tidyType(type), id: newId() }))
    return added.length === 0 ? [...own] : [...own, ...added]
  }
  return {
    elementTypes: merge(current.elementTypes, incoming.elementTypes),
    edgeTypes: merge(current.edgeTypes, incoming.edgeTypes),
  }
}
```

`MessageKey` für die Problemtexte existiert erst nach Schritt 5; bis dahin schlägt nur `tsc` fehl, nicht Vitest.

- [ ] **Step 5: Problemtexte in alle drei Kataloge eintragen** (am Ende des jeweiligen Objekts)

| Schlüssel | de | en | fr |
|---|---|---|---|
| `catalog.problem.name.empty` | `Der Name darf nicht leer sein.` | `The name must not be empty.` | `Le nom ne doit pas être vide.` |
| `catalog.problem.name.taken` | `Dieser Name wird schon verwendet.` | `This name is already in use.` | `Ce nom est déjà utilisé.` |
| `catalog.problem.color.invalid` | `Die Farbe muss die Form #rrggbb haben.` | `The colour must look like #rrggbb.` | `La couleur doit avoir la forme #rrggbb.` |
| `catalog.problem.field.keyEmpty` | `Ein Feld hat keinen Schlüssel.` | `A field has no key.` | `Un champ n’a pas de clé.` |
| `catalog.problem.field.keyReserved` | `Ein Feldschlüssel ist reserviert (name, color, status, blockiert_grund, type, class, entity, version, optional).` | `A field key is reserved (name, color, status, blockiert_grund, type, class, entity, version, optional).` | `Une clé de champ est réservée (name, color, status, blockiert_grund, type, class, entity, version, optional).` |
| `catalog.problem.field.keyDuplicate` | `Ein Feldschlüssel kommt doppelt vor.` | `A field key occurs twice.` | `Une clé de champ apparaît deux fois.` |
| `catalog.problem.field.optionsEmpty` | `Eine Auswahl braucht mindestens eine Option.` | `A choice needs at least one option.` | `Un choix a besoin d’au moins une option.` |
| `catalog.problem.field.optionsDuplicate` | `Eine Option kommt doppelt vor.` | `An option occurs twice.` | `Une option apparaît deux fois.` |
| `catalog.problem.field.defaultInvalid` | `Der Standardwert passt nicht zur Feldart.` | `The default value does not fit the field kind.` | `La valeur par défaut ne correspond pas au type de champ.` |

- [ ] **Step 6: Tests und Typecheck**

Run: `npx vitest run src/model/catalog.test.ts && npm run typecheck`
Expected: alle Tests PASS, `tsc` ohne Fehler.

Hinweis: `SCHEMA_VERSION = 5` lässt andere Tests rot werden (`schema.test.ts`, `serialize.test.ts`, …). Das ist bis Task 3 erwartet; jetzt nur `catalog.test.ts` und `typecheck` prüfen. `npm run typecheck` kann wegen `GraphModel.catalog` (Pflicht) in `serialize.ts` und `localStorage.ts` fehlschlagen: dann in Task 3 beheben und hier nur `catalog.test.ts` als Kriterium nehmen.

- [ ] **Step 7: Checkpoint** – nicht committen, nur Stand notieren.

---

### Task 2: `model/typing.ts` und Reihenfolge in `objectFields.ts`

**Files:**
- Create: `src/model/typing.ts`
- Modify: `src/model/objectFields.ts` (`insertionIndex`)
- Modify: `src/model/catalog.ts` (`countUsage` ergänzen)
- Test: `src/model/typing.test.ts`, `src/model/objectFields.test.ts`, `src/model/catalog.test.ts`

**Interfaces:**
- Produces: `getTypeId(entries): string | undefined`, `ResolvedType` (`{ state: 'none' } | { state: 'known'; def: TypeDef } | { state: 'unknown'; id: string }`), `resolveType(entries, types)`, `withTypeEntry(entries, typeId | undefined)`, `withTypeDefaults(entries, def)`, `withFieldValue(entries, key, value)`, `resolveColor(entries, types)`, `missingRequired(entries, def): string[]`, `countUsage(content, side, id)` (in `catalog.ts`).
- Consumes: `getColor` (`metadata.ts`), `isStatusKey`/`isBlockReasonKey` (`status.ts`), `isOptionalKey` (`softDependency.ts`), `CLASS_KEY`/`ENTITY_KEY`/`VERSION_KEY` (`objectFields.ts`), `TYPE_KEY`, `TypeDef` (`types.ts`).

- [ ] **Step 1: Failing test** – `src/model/typing.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import {
  getTypeId,
  missingRequired,
  resolveColor,
  resolveType,
  withFieldValue,
  withTypeDefaults,
  withTypeEntry,
} from './typing'
import type { MetadataEntry, TypeDef } from './types'

const e = (key: string, value: string): MetadataEntry => ({ key, value })
const service: TypeDef = {
  id: 't1',
  name: 'Service',
  color: '#10b981',
  fields: [
    { key: 'owner', kind: 'text', required: true },
    { key: 'env', kind: 'select', options: ['prod', 'test'], default: 'test' },
  ],
}
const objectEntries = [e('name', 'A'), e('status', 'offen'), e('class', 'x'), e('entity', ''), e('version', ''), e('frei', '1')]

describe('getTypeId / resolveType', () => {
  it('reads the id, treats blank as none', () => {
    expect(getTypeId([e('name', 'A'), e('type', ' t1 ')])).toBe('t1')
    expect(getTypeId([e('name', 'A'), e('type', ' ')])).toBeUndefined()
    expect(getTypeId([e('name', 'A')])).toBeUndefined()
  })

  it('tells none, known and unknown apart', () => {
    expect(resolveType([e('name', 'A')], [service])).toEqual({ state: 'none' })
    expect(resolveType([e('name', 'A'), e('type', 't1')], [service])).toEqual({ state: 'known', def: service })
    expect(resolveType([e('name', 'A'), e('type', 'gone')], [service])).toEqual({ state: 'unknown', id: 'gone' })
  })
})

describe('withTypeEntry', () => {
  it('puts type behind status and in front of class', () => {
    expect(withTypeEntry(objectEntries, 't1').map((x) => x.key)).toEqual(
      ['name', 'status', 'type', 'class', 'entity', 'version', 'frei'],
    )
  })

  it('puts type behind name and optional on a connection', () => {
    expect(withTypeEntry([e('name', ''), e('optional', 'ja')], 't1').map((x) => x.key)).toEqual(['name', 'optional', 'type'])
  })

  it('replaces in place and removes with undefined', () => {
    const typed = withTypeEntry(objectEntries, 't1')
    expect(withTypeEntry(typed, 't2')).toContainEqual(e('type', 't2'))
    expect(withTypeEntry(typed, undefined)).toEqual(objectEntries)
  })
})

describe('withTypeDefaults / withFieldValue', () => {
  it('adds missing fields with their default behind the version, keeps existing values', () => {
    const entries = withTypeDefaults([...withTypeEntry(objectEntries, 't1').slice(0, 6), e('owner', 'Anna')], service)
    expect(entries.map((x) => x.key)).toEqual(['name', 'status', 'type', 'class', 'entity', 'version', 'owner', 'env'])
    expect(entries.find((x) => x.key === 'owner')?.value).toBe('Anna')
    expect(entries.find((x) => x.key === 'env')?.value).toBe('test')
  })

  it('writes a field value in place or at the end of the fixed entries', () => {
    expect(withFieldValue(objectEntries, 'owner', 'Anna').map((x) => x.key)).toEqual(
      ['name', 'status', 'class', 'entity', 'version', 'owner', 'frei'],
    )
    expect(withFieldValue([e('name', 'A'), e('owner', 'x')], 'owner', 'y')).toEqual([e('name', 'A'), e('owner', 'y')])
  })
})

describe('resolveColor', () => {
  it('prefers the element colour, then the type colour', () => {
    expect(resolveColor([e('name', 'A'), e('color', '#FF0000'), e('type', 't1')], [service])).toBe('#ff0000')
    expect(resolveColor([e('name', 'A'), e('type', 't1')], [service])).toBe('#10b981')
    expect(resolveColor([e('name', 'A'), e('type', 'gone')], [service])).toBeUndefined()
  })
})

describe('missingRequired', () => {
  it('lists required fields whose value is empty or absent', () => {
    expect(missingRequired([e('name', 'A')], service)).toEqual(['owner'])
    expect(missingRequired([e('name', 'A'), e('owner', ' ')], service)).toEqual(['owner'])
    expect(missingRequired([e('name', 'A'), e('owner', 'Anna')], service)).toEqual([])
  })
})
```

Dazu in `src/model/objectFields.test.ts` ergänzen (am Ende der Datei, im vorhandenen `describe` oder als neues):

```ts
describe('type entry in front of the object fields', () => {
  it('inserts class behind a type entry', () => {
    const entries = [{ key: 'name', value: 'A' }, { key: 'type', value: 't1' }]
    expect(withClassEntry(entries, 'x').map((e) => e.key)).toEqual(['name', 'type', 'class'])
  })
})
```

(`withClassEntry` ist in dieser Testdatei vermutlich schon importiert; sonst Import ergänzen.)

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx vitest run src/model/typing.test.ts src/model/objectFields.test.ts`
Expected: FAIL (`./typing` nicht gefunden; Test in `objectFields.test.ts` liefert `['name', 'class', 'type']`).

- [ ] **Step 3: `objectFields.ts` anpassen** – in `insertionIndex` den Typ als festen Eintrag zählen

```ts
import { COLOR_KEY, NAME_KEY, TYPE_KEY } from './types'
```

und in `isFixed`:

```ts
  const isFixed = (key: string) =>
    key === NAME_KEY || key === COLOR_KEY || key === TYPE_KEY || isStatusKey(key) || isBlockReasonKey(key) || earlier.includes(key)
```

Den Doc-Kommentar der Konstanten ergänzen: `the canonical order is name, color, status, blockiert_grund, type, class, entity, version, free fields.`

- [ ] **Step 4: `src/model/typing.ts` schreiben**

```ts
import { getColor } from './metadata'
import { CLASS_KEY, ENTITY_KEY, VERSION_KEY } from './objectFields'
import { isOptionalKey } from './softDependency'
import { isBlockReasonKey, isStatusKey } from './status'
import { COLOR_KEY, NAME_KEY, TYPE_KEY } from './types'
import type { MetadataEntry, TypeDef } from './types'

/**
 * An element's type is the metadata entry `type` holding a type id. Like `status` and `class` it is an
 * ordinary entry; read and write it only here. Order: name, color, status, blockiert_grund, optional,
 * type, class, entity, version, type fields, free fields.
 */
export type ResolvedType =
  | { state: 'none' }
  | { state: 'known'; def: TypeDef }
  | { state: 'unknown'; id: string }

const OBJECT_TAIL: readonly string[] = [CLASS_KEY, ENTITY_KEY, VERSION_KEY]

function isLeadingKey(key: string): boolean {
  return (
    key === NAME_KEY ||
    key === COLOR_KEY ||
    key === TYPE_KEY ||
    OBJECT_TAIL.includes(key) ||
    isStatusKey(key) ||
    isBlockReasonKey(key) ||
    isOptionalKey(key)
  )
}

/** Length of the run of fixed entries at the start; type fields go right behind it. */
function leadingEnd(entries: readonly MetadataEntry[]): number {
  let at = 0
  while (at < entries.length && isLeadingKey(entries[at].key)) at += 1
  return at
}

/** The (trimmed) type id, or undefined when there is no entry or it is blank. */
export function getTypeId(entries: readonly MetadataEntry[]): string | undefined {
  const value = entries.find((entry) => entry.key === TYPE_KEY)?.value.trim()
  return value === undefined || value === '' ? undefined : value
}

export function resolveType(entries: readonly MetadataEntry[], types: readonly TypeDef[]): ResolvedType {
  const id = getTypeId(entries)
  if (id === undefined) return { state: 'none' }
  const def = types.find((type) => type.id === id)
  return def === undefined ? { state: 'unknown', id } : { state: 'known', def }
}

/**
 * The entries with `type` set (in place, or in front of class/entity/version); `undefined` removes it.
 * Values of type fields stay either way. Not normalized.
 */
export function withTypeEntry(entries: readonly MetadataEntry[], typeId: string | undefined): MetadataEntry[] {
  if (typeId === undefined) return entries.filter((entry) => entry.key !== TYPE_KEY)
  if (entries.some((entry) => entry.key === TYPE_KEY)) {
    return entries.map((entry) => (entry.key === TYPE_KEY ? { key: TYPE_KEY, value: typeId } : entry))
  }
  const run = leadingEnd(entries)
  const firstTail = entries.findIndex((entry, i) => i < run && OBJECT_TAIL.includes(entry.key))
  const at = firstTail === -1 ? run : firstTail
  return [...entries.slice(0, at), { key: TYPE_KEY, value: typeId }, ...entries.slice(at)]
}

/** The entries plus every field of `def` that is missing, with its default (empty without one). Existing values stay. */
export function withTypeDefaults(entries: readonly MetadataEntry[], def: TypeDef): MetadataEntry[] {
  const missing = def.fields
    .filter((field) => !entries.some((entry) => entry.key === field.key))
    .map((field) => ({ key: field.key, value: field.default ?? '' }))
  if (missing.length === 0) return [...entries]
  const at = leadingEnd(entries)
  return [...entries.slice(0, at), ...missing, ...entries.slice(at)]
}

/** The entries with the field `key` set (in place, or behind the fixed entries). Not normalized. */
export function withFieldValue(entries: readonly MetadataEntry[], key: string, value: string): MetadataEntry[] {
  if (entries.some((entry) => entry.key === key)) {
    return entries.map((entry) => (entry.key === key ? { key, value } : entry))
  }
  const at = leadingEnd(entries)
  return [...entries.slice(0, at), { key, value }, ...entries.slice(at)]
}

/** Own colour, else the colour of a known type, else undefined (the caller falls back to its default). */
export function resolveColor(entries: readonly MetadataEntry[], types: readonly TypeDef[]): string | undefined {
  const own = getColor(entries)
  if (own !== undefined) return own
  const resolved = resolveType(entries, types)
  return resolved.state === 'known' ? resolved.def.color?.toLowerCase() : undefined
}

/** Keys of required fields of `def` whose value is missing or blank. */
export function missingRequired(entries: readonly MetadataEntry[], def: TypeDef): string[] {
  return def.fields
    .filter((field) => field.required)
    .filter((field) => (entries.find((entry) => entry.key === field.key)?.value.trim() ?? '') === '')
    .map((field) => field.key)
}
```

- [ ] **Step 5: `countUsage` in `catalog.ts` ergänzen** (Import `getTypeId` aus `./typing`, `GraphContent` aus `./types`)

```ts
/** How many elements refer to the type: objects for `elementTypes`, connections for `edgeTypes`. */
export function countUsage(content: GraphContent, side: CatalogSide, id: string): number {
  if (side === 'elementTypes') {
    return content.nodes.filter((node) => node.kind === 'node' && getTypeId(node.metadata) === id).length
  }
  return content.edges.filter((edge) => getTypeId(edge.metadata ?? []) === id).length
}
```

Test in `catalog.test.ts` ergänzen:

```ts
import { countUsage } from './catalog'
import { box } from '../test/fixtures'

it('counts the objects and connections that use a type', () => {
  const typed = { ...box('a', 0, 0), metadata: [{ key: 'name', value: 'A' }, { key: 'type', value: 't1' }] }
  const content = {
    nodes: [typed, box('b', 100, 0)],
    edges: [{ id: 'e', source: 'a', target: 'b', metadata: [{ key: 'name', value: '' }, { key: 'type', value: 'e1' }] }],
  }
  expect(countUsage(content, 'elementTypes', 't1')).toBe(1)
  expect(countUsage(content, 'edgeTypes', 'e1')).toBe(1)
  expect(countUsage(content, 'elementTypes', 'other')).toBe(0)
})
```

(`box(id, x, y, parentId?)` aus `src/test/fixtures.ts`, wie in `schema.test.ts` verwendet.)

- [ ] **Step 6: Tests laufen lassen**

Run: `npx vitest run src/model/typing.test.ts src/model/objectFields.test.ts src/model/catalog.test.ts`
Expected: PASS.

- [ ] **Step 7: Checkpoint** – nicht committen.

---

### Task 3: Schema 5 – Katalog lesen, schreiben, migrieren

**Files:**
- Create: `src/model/catalogParse.ts`
- Modify: `src/model/serialize.ts`, `src/storage/localStorage.ts`, `src/store/persistence.ts`, `src/model/types.ts` (Konstante nur falls noch fehlend), `public/graph.schema.json`, `README.md`, `docs/superpowers/specs/2026-11-03-typisierte-elemente-design.md`
- Test: `src/model/serialize.test.ts`, `src/model/schema.test.ts`, `src/storage/localStorage.test.ts`, `src/store/persistence.test.ts`

**Interfaces:**
- Produces: `parseCatalog(raw, required, report, t): Catalog` (`catalogParse.ts`); `toModel` liefert `catalog` (leer als Standard); `serializeModel` schreibt `catalog` nach `projectName`; `loadStoredContent` liefert `catalog`.
- Consumes: `checkTypeDef`, `tidyType`, `TYPE_PROBLEM_KEYS` (`catalog.ts`), `ICON_KEYS`, `FIELD_KINDS`, `EMPTY_CATALOG`, `VERSION_BEFORE_CATALOG`.

- [ ] **Step 1: Failing tests** – in `src/model/serialize.test.ts` ergänzen (Importe `parseModel`, `serializeModel`, `toModel` sind dort vorhanden; sonst ergänzen)

```ts
describe('catalog (schema version 5)', () => {
  const entry = (key: string, value: string) => ({ key, value })
  const source = (over: Record<string, unknown> = {}) => ({
    version: 5,
    catalog: { elementTypes: [], edgeTypes: [] },
    nodes: [{ id: 'a', kind: 'node', position: { x: 0, y: 0 }, metadata: [entry('name', 'A')] }],
    edges: [],
    ...over,
  })
  const typed = {
    elementTypes: [
      {
        id: 't1',
        name: 'Service',
        color: '#10B981',
        icon: 'service',
        fields: [{ key: 'env', kind: 'select', options: ['prod', 'test'], default: 'test', required: true }],
      },
    ],
    edgeTypes: [{ id: 'e1', name: 'Datenfluss', fields: [] }],
  }

  it('keeps a catalog through export and import', () => {
    const parsed = parseModel(source({ catalog: typed }))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.model.catalog.elementTypes[0].color).toBe('#10b981')
    const again = parseModel(JSON.parse(serializeModel(parsed.model)))
    expect(again).toEqual(parsed)
  })

  it('writes the catalog after the project name and before the nodes', () => {
    const text = serializeModel(toModel({ nodes: [], edges: [], projectName: 'P', catalog: typed }))
    expect(Object.keys(JSON.parse(text))).toEqual(['version', 'projectName', 'catalog', 'nodes', 'edges'])
  })

  it('reads older versions with an empty catalog', () => {
    for (const version of [1, 2, 3, 4]) {
      const parsed = parseModel({ version, nodes: [], edges: [] })
      expect(parsed.ok).toBe(true)
      if (parsed.ok) expect(parsed.model.catalog).toEqual({ elementTypes: [], edgeTypes: [] })
    }
  })

  it('requires the catalog in version 5', () => {
    const { catalog: _omit, ...withoutCatalog } = source()
    const parsed = parseModel(withoutCatalog)
    expect(parsed.ok).toBe(false)
  })

  it('rejects a broken catalog with a message per problem', () => {
    const broken = {
      elementTypes: [
        { id: 't1', name: 'A', fields: [{ key: 'status', kind: 'text' }] },
        { id: 't1', name: 'a', fields: [] },
        { id: 't3', fields: [] },
      ],
      edgeTypes: [],
    }
    const parsed = parseModel(source({ catalog: broken }))
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.errors.length).toBeGreaterThanOrEqual(3)
  })

  it('accepts an element that refers to an unknown type', () => {
    const node = { id: 'a', kind: 'node', position: { x: 0, y: 0 }, metadata: [entry('name', 'A'), entry('type', 'gone')] }
    expect(parseModel(source({ nodes: [node] })).ok).toBe(true)
  })
})
```

In `src/storage/localStorage.test.ts` einen Test ergänzen (Aufbau analog zu vorhandenen Tests dort; Storage-Stub aus der Datei verwenden):

```ts
it('loads the catalog of the stored project', () => {
  const storage = memoryStorage()   // use the helper this test file already uses
  const catalog = { elementTypes: [{ id: 't1', name: 'Service', fields: [] }], edgeTypes: [] }
  expect(saveContent({ nodes: [], edges: [], catalog }, storage)).toBe(true)
  const loaded = loadStoredContent(storage)
  expect(loaded.status === 'loaded' && loaded.content.catalog).toEqual(catalog)
})
```

(`memoryStorage` steht für die in dieser Datei vorhandene Storage-Attrappe; vor dem Schreiben mit `grep -n "Storage" src/storage/localStorage.test.ts` den Namen prüfen und einsetzen.)

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx vitest run src/model/serialize.test.ts src/storage/localStorage.test.ts`
Expected: FAIL (u. a. `parsed.model.catalog` undefined, `version` 4 abgelehnt/erwartet).

- [ ] **Step 3: Meldungen für den Import in alle drei Kataloge**

| Schlüssel | de | en | fr |
|---|---|---|---|
| `parse.catalog.missing` | `Der Katalog (catalog) fehlt.` | `The catalog is missing.` | `Le catalogue (catalog) est manquant.` |
| `parse.catalog.notObject` | `Der Katalog muss ein Objekt mit elementTypes und edgeTypes sein.` | `The catalog must be an object with elementTypes and edgeTypes.` | `Le catalogue doit être un objet avec elementTypes et edgeTypes.` |
| `parse.catalog.notList` | `{side} im Katalog muss eine Liste sein.` | `{side} in the catalog must be a list.` | `{side} dans le catalogue doit être une liste.` |
| `parse.catalog.malformed` | `{where}: falsch aufgebaut (erwartet: id, name, fields mit key und kind).` | `{where}: malformed (expected id, name, fields with key and kind).` | `{where} : mal formé (attendu : id, name, fields avec key et kind).` |
| `parse.catalog.idTaken` | `{where}: Die ID {id} kommt mehrfach im Katalog vor.` | `{where}: the id {id} occurs more than once in the catalog.` | `{where} : l’identifiant {id} apparaît plusieurs fois dans le catalogue.` |
| `parse.catalog.problem` | `{where}: {reason}` | `{where}: {reason}` | `{where} : {reason}` |

- [ ] **Step 4: `src/model/catalogParse.ts` schreiben**

```ts
import type { Translate } from '../i18n/translate'
import { TYPE_PROBLEM_KEYS, checkTypeDef, tidyType } from './catalog'
import type { CatalogSide } from './catalog'
import { EMPTY_CATALOG, FIELD_KINDS, ICON_KEYS } from './types'
import type { Catalog, FieldDef, IconKey, TypeDef } from './types'

type Report = (message: string) => void

const SIDES: readonly CatalogSide[] = ['elementTypes', 'edgeTypes']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function parseField(value: unknown): FieldDef | undefined {
  if (!isRecord(value) || typeof value.key !== 'string') return undefined
  if (!(FIELD_KINDS as readonly unknown[]).includes(value.kind)) return undefined
  const options = value.options
  if (options !== undefined && !(Array.isArray(options) && options.every((o) => typeof o === 'string'))) return undefined
  if (value.required !== undefined && typeof value.required !== 'boolean') return undefined
  if (value.default !== undefined && typeof value.default !== 'string') return undefined
  return {
    key: value.key,
    kind: value.kind as FieldDef['kind'],
    ...(options !== undefined && { options: options as string[] }),
    ...(value.required !== undefined && { required: value.required }),
    ...(value.default !== undefined && { default: value.default }),
  }
}

function parseTypeDef(value: unknown): TypeDef | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id === '' || typeof value.name !== 'string') {
    return undefined
  }
  if (value.color !== undefined && typeof value.color !== 'string') return undefined
  if (value.icon !== undefined && !(ICON_KEYS as readonly unknown[]).includes(value.icon)) return undefined
  if (!Array.isArray(value.fields)) return undefined
  const fields = value.fields.map(parseField)
  if (fields.some((field) => field === undefined)) return undefined
  return tidyType({
    id: value.id,
    name: value.name,
    ...(value.color !== undefined && { color: value.color }),
    ...(value.icon !== undefined && { icon: value.icon as IconKey }),
    fields: fields as FieldDef[],
  })
}

/**
 * Reads an untrusted catalog and reports every problem. `required`: a missing catalog is an error
 * (schema version 5); otherwise it counts as empty. A type that refers to nothing is never checked here.
 */
export function parseCatalog(raw: unknown, required: boolean, report: Report, t: Translate): Catalog {
  if (raw === undefined) {
    if (required) report(t('parse.catalog.missing'))
    return EMPTY_CATALOG
  }
  if (!isRecord(raw)) {
    report(t('parse.catalog.notObject'))
    return EMPTY_CATALOG
  }
  const result: Record<CatalogSide, TypeDef[]> = { elementTypes: [], edgeTypes: [] }
  const seenIds = new Set<string>()
  for (const side of SIDES) {
    const list = raw[side]
    if (list === undefined) continue
    if (!Array.isArray(list)) {
      report(t('parse.catalog.notList', { side }))
      continue
    }
    list.forEach((value, index) => {
      const where = `${side}[${index + 1}]`
      const def = parseTypeDef(value)
      if (def === undefined) {
        report(t('parse.catalog.malformed', { where }))
        return
      }
      if (seenIds.has(def.id)) report(t('parse.catalog.idTaken', { where, id: JSON.stringify(def.id) }))
      seenIds.add(def.id)
      result[side].push(def)
    })
    for (const [index, def] of result[side].entries()) {
      for (const problem of checkTypeDef(def, result[side])) {
        report(t('parse.catalog.problem', { where: `${side}[${index + 1}]`, reason: t(TYPE_PROBLEM_KEYS[problem]) }))
      }
    }
  }
  return result
}
```

Hinweis zum Index in der Meldung: `result[side]` enthält nur gültig aufgebaute Typen, `index` zeigt dann auf deren Position in dieser gefilterten Liste. Das ist bei Importfehlern ausreichend (der Typname steht nicht in der Meldung); wer den Originalindex braucht, merkt sich ihn in `parseTypeDef`-Aufruf. Hier bewusst nicht nötig.

- [ ] **Step 5: `serialize.ts` anpassen**

Importe:

```ts
import { parseCatalog } from './catalogParse'
import { EMPTY_CATALOG, VERSION_BEFORE_CATALOG } from './types'
import type { Catalog, FieldDef, TypeDef } from './types'
```

(`EMPTY_CATALOG`/`VERSION_BEFORE_CATALOG` zur vorhandenen Import-Liste aus `./types` hinzufügen, Typen zur vorhandenen `import type`-Liste.)

`toModel`:

```ts
export function toModel(content: GraphContent): GraphModel {
  return {
    version: SCHEMA_VERSION,
    ...(content.projectName !== undefined && { projectName: content.projectName }),
    catalog: content.catalog ?? EMPTY_CATALOG,
    nodes: sortParentsFirst(content.nodes),
    edges: content.edges,
  }
}
```

`serializeModel` – `canonical` bekommt den Katalog nach `projectName`; Kommentar „version, nodes, edges“ → „version, projectName, catalog, nodes, edges“:

```ts
  const canonical = {
    version: model.version,
    ...(model.projectName !== undefined && { projectName: model.projectName }),
    catalog: canonicalCatalog(model.catalog),
    nodes: model.nodes.map(canonicalNode),
    edges: model.edges.map(canonicalEdge),
  }
```

neue Helfer neben `canonicalEdge`:

```ts
function canonicalCatalog(catalog: Catalog): Catalog {
  return { elementTypes: catalog.elementTypes.map(canonicalType), edgeTypes: catalog.edgeTypes.map(canonicalType) }
}

/** Fixed key order inside a type and its fields; optional parts only when set. */
function canonicalType(type: TypeDef): TypeDef {
  return {
    id: type.id,
    name: type.name,
    ...(type.color !== undefined && { color: type.color }),
    ...(type.icon !== undefined && { icon: type.icon }),
    fields: type.fields.map(canonicalField),
  }
}

function canonicalField(field: FieldDef): FieldDef {
  return {
    key: field.key,
    kind: field.kind,
    ...(field.options !== undefined && { options: [...field.options] }),
    ...(field.required && { required: true }),
    ...(field.default !== undefined && { default: field.default }),
  }
}
```

`parseModel`: nach `checkVersion(...)` und der `projectName`-Prüfung

```ts
  const catalog = parseCatalog(input.catalog, input.version === SCHEMA_VERSION, report, t)
```

und im Ergebnis `catalog,` nach dem `projectName`-Spread einfügen:

```ts
    model: {
      version: SCHEMA_VERSION,
      ...(projectName !== undefined && { projectName }),
      catalog,
      nodes: sortParentsFirst(nodes),
      edges,
    },
```

`checkVersion`: `const readable = [SCHEMA_VERSION, VERSION_BEFORE_CATALOG, VERSION_BEFORE_OBJECT_FIELDS, PREVIOUS_SCHEMA_VERSION, LEGACY_SCHEMA_VERSION]`.

Den Doc-Kommentar von `parseModel` ergänzen: `top-level object with version === 5, or an older one: 4 (without a catalog) …` und die Katalogregel.

- [ ] **Step 6: Speicherpfade**

`src/storage/localStorage.ts` (Zeile ~37):

```ts
      const { nodes, edges, projectName, catalog } = result.model
      return { status: 'loaded', content: { nodes, edges, projectName, catalog } }
```

`src/store/persistence.ts`: Vergleich um den Katalog erweitern und mitspeichern:

```ts
    const { nodes, edges, projectName, catalog } = store.getState()
    if (save({ nodes, edges, projectName, catalog })) {
```

```ts
    if (
      state.nodes === previous.nodes &&
      state.edges === previous.edges &&
      state.projectName === previous.projectName &&
      state.catalog === previous.catalog
    ) {
      return
    }
```

(`state.catalog` existiert erst nach Task 4; `tsc` meldet bis dahin einen Fehler an dieser Stelle. Persistenz-Änderung deshalb erst in Task 4 Schritt 4 umsetzen und hier nur `localStorage.ts` ändern.)

- [ ] **Step 7: Schema `public/graph.schema.json`**

`"required": ["version", "nodes", "edges"]` → `["version", "catalog", "nodes", "edges"]`; `version.const` → `5`; unter `properties` (neben `projectName`) ergänzen:

```json
    "catalog": {
      "type": "object",
      "additionalProperties": false,
      "required": ["elementTypes", "edgeTypes"],
      "properties": {
        "elementTypes": { "type": "array", "items": { "$ref": "#/$defs/typeDef" } },
        "edgeTypes": { "type": "array", "items": { "$ref": "#/$defs/typeDef" } }
      }
    },
```

unter `$defs`:

```json
    "typeDef": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "name", "fields"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "name": { "type": "string", "minLength": 1 },
        "color": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$" },
        "icon": { "enum": ["service", "database", "queue", "user", "cloud", "external", "process", "storage"] },
        "fields": { "type": "array", "items": { "$ref": "#/$defs/fieldDef" } }
      }
    },
    "fieldDef": {
      "type": "object",
      "additionalProperties": false,
      "required": ["key", "kind"],
      "properties": {
        "key": { "type": "string", "minLength": 1 },
        "kind": { "enum": ["text", "select", "boolean"] },
        "options": { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 1 } },
        "required": { "type": "boolean" },
        "default": { "type": "string" }
      }
    },
```

Im `description` am Satzende ergänzen: `Dateien der Version 4 (ohne catalog) importiert die App weiterhin mit leerem Katalog. Ein Element verweist über den Metadateneintrag type (Typ-ID) auf einen Typ des Katalogs; ein unbekannter Verweis ist erlaubt. Nicht ausdrückbar: eindeutige Typ-IDs und -Namen, reservierte oder doppelte Feldschlüssel, Auswahl-Standard unter den Optionen.`

- [ ] **Step 8: README und Spec**

README: mit `grep -n '"version": 4' README.md` die Beispielstelle suchen, auf `5` setzen, `"catalog": { "elementTypes": [], "edgeTypes": [] },` nach `projectName`/`version` einfügen und einen kurzen Abschnitt „Typen“ (Katalog, Eintrag `type`) ergänzen (Inhalt: siehe Spec, Abschnitt Datenmodell).

Spec: im Abschnitt „Datenmodell“ den Satz `GraphContent erhält catalog: Catalog.` ersetzen durch `GraphContent erhält catalog?: Catalog (optional wie projectName; fehlend = leer). GraphModel und der Store halten ihn immer.`

- [ ] **Step 9: Bestehende Tests nachziehen**

Run: `npm test`
Expected: Fehlschläge nur dort, wo `version: 4`/`SCHEMA_VERSION` oder die exakte Exportform erwartet wird (`serialize.test.ts`, `schema.test.ts`, `localStorage.test.ts`, `fingerprint.test.ts`). Jede Erwartung auf Version 5 und den `catalog`-Schlüssel anpassen; in `schema.test.ts` ist `base()` Version 4 – das bleibt als Migrationsprobe, ein zusätzlicher Test mit Version 5 und Katalog prüft das Schema:

```ts
it('accepts an export with a catalog', () => {
  const catalog = {
    elementTypes: [{ id: 't1', name: 'Service', color: '#10b981', icon: 'service', fields: [{ key: 'env', kind: 'select', options: ['prod'] }] }],
    edgeTypes: [],
  }
  const text = serializeModel(toModel({ nodes: [box('a', 0, 0)], edges: [], catalog }))
  expect(validate(JSON.parse(text))).toBe(true)
})
```

Run: `npm test && npm run typecheck`
Expected: PASS (bis auf `persistence`/Store-bezogene Typfehler, die Task 4 behebt – dann `typecheck` erst nach Task 4 verlangen).

- [ ] **Step 10: Checkpoint** – nicht committen.

---

### Task 4: Store – Katalog und Typaktionen

**Files:**
- Modify: `src/model/graph.ts`, `src/store/graphStore.ts`, `src/store/persistence.ts`
- Test: `src/model/graph.test.ts`, `src/store/graphStore.test.ts`, `src/store/persistence.test.ts`

**Interfaces:**
- Produces (`graph.ts`): `setTypes(content, ids, typeId | undefined)`, `setEdgeType(content, edgeId, typeId | undefined)`, `setEdgeField(content, edgeId, key, value)`.
- Produces (Store): Zustand `catalog: Catalog`; Aktionen `addType(side, name?) => string | undefined`, `updateType(side, def)`, `removeType(side, id)`, `applyCatalog(next)`, `setSelectionType(typeId | undefined)`, `setEdgeType(edgeId, typeId | undefined)`, `setEdgeField(edgeId, key, value)`.
- Consumes: Task 1–2.

- [ ] **Step 1: Failing tests** – `src/model/graph.test.ts` ergänzen

```ts
import { setEdgeField, setEdgeType, setTypes } from './graph'
import type { Catalog } from './types'

describe('types on elements', () => {
  const catalog: Catalog = {
    elementTypes: [{ id: 't1', name: 'Service', fields: [{ key: 'owner', kind: 'text', default: 'n/a' }] }],
    edgeTypes: [{ id: 'e1', name: 'Datenfluss', fields: [{ key: 'port', kind: 'text' }] }],
  }
  const content = () => ({
    nodes: [box('a', 0, 0), group('g', 0, 100, 300, 200)],
    edges: [{ id: 'x', source: 'a', target: 'g' }],
    catalog,
  })

  it('sets the type of objects and adds the missing fields with their defaults', () => {
    const next = setTypes(content(), ['a'], 't1')
    const keys = next.nodes[0].metadata.map((e) => e.key)
    expect(keys).toEqual(['name', 'status', 'type', 'class', 'entity', 'version', 'owner'].filter((k) => keys.includes(k)))
    expect(next.nodes[0].metadata).toContainEqual({ key: 'type', value: 't1' })
    expect(next.nodes[0].metadata).toContainEqual({ key: 'owner', value: 'n/a' })
  })

  it('skips groups, unknown types and no-ops', () => {
    const start = content()
    expect(setTypes(start, ['g'], 't1')).toBe(start)
    expect(setTypes(start, ['a'], 'unknown')).toBe(start)
    const typed = setTypes(start, ['a'], 't1')
    expect(setTypes(typed, ['a'], 't1')).toBe(typed)
  })

  it('removing the type keeps the field values as free fields', () => {
    const removed = setTypes(setTypes(content(), ['a'], 't1'), ['a'], undefined)
    expect(removed.nodes[0].metadata.some((e) => e.key === 'type')).toBe(false)
    expect(removed.nodes[0].metadata).toContainEqual({ key: 'owner', value: 'n/a' })
  })

  it('types a connection and edits its field', () => {
    const typed = setEdgeType(content(), 'x', 'e1')
    expect(typed.edges[0].metadata).toEqual([
      { key: 'name', value: '' },
      { key: 'type', value: 'e1' },
      { key: 'port', value: '' },
    ])
    const edited = setEdgeField(typed, 'x', 'port', '443')
    expect(edited.edges[0].metadata?.find((e) => e.key === 'port')?.value).toBe('443')
    expect(setEdgeField(edited, 'x', 'port', '443')).toBe(edited)
  })
})
```

(`box`, `group` aus `../test/fixtures` – in `graph.test.ts` vermutlich schon importiert; sonst ergänzen. Das `keys`-Filter im ersten Test ist bewusst tolerant, weil `box()` die Basis-Metadaten des Fixtures bestimmt; die zwei `toContainEqual`-Zeilen sind die eigentliche Prüfung.)

`src/store/graphStore.test.ts` ergänzen (Aufbau wie bestehende Tests: `createGraphStore(content, counterIds())`):

```ts
describe('type catalog', () => {
  const start = () => createGraphStore({ nodes: [box('a', 0, 0)], edges: [] }, counterIds())

  it('adds, updates and removes a type as undo steps', () => {
    const store = start()
    const id = store.getState().addType('elementTypes', 'Service')!
    expect(store.getState().catalog.elementTypes.map((t) => t.name)).toEqual(['Service'])
    store.getState().updateType('elementTypes', { id, name: 'Dienst', fields: [] })
    expect(store.getState().catalog.elementTypes[0].name).toBe('Dienst')
    store.getState().removeType('elementTypes', id)
    expect(store.getState().catalog.elementTypes).toHaveLength(0)
    store.getState().undo()
    expect(store.getState().catalog.elementTypes).toHaveLength(1)
  })

  it('refuses an invalid type', () => {
    const store = start()
    store.getState().addType('elementTypes', 'Service')
    expect(store.getState().addType('elementTypes', 'service')).toBeUndefined()
  })

  it('is locked in analysis mode, but typing objects is not', () => {
    const store = start()
    const id = store.getState().addType('elementTypes', 'Service')!
    store.getState().setMode('analyze')
    expect(store.getState().addType('elementTypes', 'Other')).toBeUndefined()
    store.getState().removeType('elementTypes', id)
    expect(store.getState().catalog.elementTypes).toHaveLength(1)
    store.getState().applyNodeSelection([{ id: 'a', selected: true }])
    store.getState().setSelectionType(id)
    expect(store.getState().nodes[0].metadata).toContainEqual({ key: 'type', value: id })
  })

  it('replaces the catalog as one undo step and keeps the elements', () => {
    const store = start()
    store.getState().applyCatalog({ elementTypes: [{ id: 'x', name: 'DB', fields: [] }], edgeTypes: [] })
    expect(store.getState().catalog.elementTypes[0].name).toBe('DB')
    store.getState().undo()
    expect(store.getState().catalog.elementTypes).toHaveLength(0)
  })

  it('takes over the catalog of an imported file', () => {
    const store = start()
    const text = JSON.stringify({
      version: 5,
      catalog: { elementTypes: [{ id: 't', name: 'Queue', fields: [] }], edgeTypes: [] },
      nodes: [],
      edges: [],
    })
    expect(store.getState().importText(text)).toBe(true)
    expect(store.getState().catalog.elementTypes[0].name).toBe('Queue')
  })
})
```

(`setMode` und `undo` heißen im Store vermutlich so; mit `grep -n "setMode\|undo:" src/store/graphStore.ts` prüfen und ggf. die tatsächlichen Namen einsetzen. `box` aus `../test/fixtures`.)

Persistenz-Test in `persistence.test.ts` ergänzen:

```ts
it('saves when only the catalog changes', async () => {
  vi.useFakeTimers()
  const save = vi.fn(() => true)
  const store = createGraphStore({ nodes: [], edges: [] }, counterIds())
  connectPersistence(store, { save, debounceMs: 10 })
  store.getState().addType('elementTypes', 'Service')
  await vi.advanceTimersByTimeAsync(20)
  expect(save).toHaveBeenCalledTimes(1)
  vi.useRealTimers()
})
```

(Passe an Stil und Imports der vorhandenen Tests in der Datei an.)

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx vitest run src/model/graph.test.ts src/store`
Expected: FAIL (`setTypes` nicht exportiert, `addType` nicht vorhanden).

- [ ] **Step 3: `graph.ts` ergänzen** (Importe: `withFieldValue`, `withTypeDefaults`, `withTypeEntry` aus `./typing`)

```ts
/**
 * Sets (or with `undefined` removes) the type of the listed objects. Only a known type can be chosen;
 * missing fields of the type are added with their defaults, existing values stay (also those of the
 * old type, as free fields). Groups, notes, unknown ids and unknown types are skipped; nothing to
 * change -> the content itself.
 */
export function setTypes(content: GraphContent, ids: readonly string[], typeId: string | undefined): GraphContent {
  const def = typeId === undefined ? undefined : content.catalog?.elementTypes.find((type) => type.id === typeId)
  if (typeId !== undefined && def === undefined) return content
  const targets = new Set(ids)
  let changed = false
  const nodes = content.nodes.map((node) => {
    if (!targets.has(node.id) || node.kind !== 'node') return node
    const typed = withTypeEntry(node.metadata, typeId)
    const metadata = normalizeMetadata(def === undefined ? typed : withTypeDefaults(typed, def))
    if (JSON.stringify(metadata) === JSON.stringify(node.metadata)) return node
    changed = true
    return { ...node, metadata }
  })
  return changed ? { ...content, nodes } : content
}

function withEdgeMetadata(
  content: GraphContent,
  edgeId: string,
  write: (entries: readonly MetadataEntry[]) => MetadataEntry[],
): GraphContent {
  const edge = content.edges.find((e) => e.id === edgeId)
  if (edge === undefined) return content
  const metadata = tidyEdgeMetadata(write(edge.metadata ?? []))
  const same =
    metadata === undefined
      ? edge.metadata === undefined
      : metadata.length === edge.metadata?.length &&
        metadata.every((entry, i) => entry.key === edge.metadata?.[i].key && entry.value === edge.metadata[i].value)
  if (same) return content
  const { metadata: _old, ...rest } = edge
  const updated: ModelEdge = metadata === undefined ? rest : { ...rest, metadata }
  return { ...content, edges: content.edges.map((e) => (e.id === edgeId ? updated : e)) }
}

/** Like `setTypes`, for one connection (its type list is `catalog.edgeTypes`). */
export function setEdgeType(content: GraphContent, edgeId: string, typeId: string | undefined): GraphContent {
  const def = typeId === undefined ? undefined : content.catalog?.edgeTypes.find((type) => type.id === typeId)
  if (typeId !== undefined && def === undefined) return content
  return withEdgeMetadata(content, edgeId, (entries) => {
    const named = normalizeMetadata(entries)
    const typed = withTypeEntry(named, typeId)
    return def === undefined ? typed : withTypeDefaults(typed, def)
  })
}

/** Sets the value of a type field on a connection (in place, or behind the fixed entries). */
export function setEdgeField(content: GraphContent, edgeId: string, key: string, value: string): GraphContent {
  return withEdgeMetadata(content, edgeId, (entries) => withFieldValue(normalizeMetadata(entries), key, value))
}
```

`setEdgeSoft` darf unverändert bleiben (Refactoring auf `withEdgeMetadata` ist nicht Teil der Aufgabe).

- [ ] **Step 4: Store (`graphStore.ts`)**

Importe: `import { addType as addCatalogType, removeType as removeCatalogType, replaceType, uniqueName, type CatalogSide } from '../model/catalog'`, `import { EMPTY_CATALOG, type Catalog, type TypeDef } from '../model/types'` (Katalogtypen zur bestehenden `import type {…} from '../model/types'`-Liste), `Texte`: `currentT()('types.defaultName')`.

`GraphState` (neben `projectName`):

```ts
  /** Types of objects and connections; part of the project (undo, export). */
  catalog: Catalog
```

und die Aktionen (neben `setSelectionVersion`):

```ts
  /** Adds an empty type (default name unless given); returns its id, or undefined if refused (analysis mode, taken name). */
  addType: (side: CatalogSide, name?: string) => string | undefined
  /** Replaces the type with the same id; invalid input is ignored. */
  updateType: (side: CatalogSide, type: TypeDef) => void
  /** Removes a type; elements keep their (now unknown) type entry. */
  removeType: (side: CatalogSide, id: string) => void
  /** Replaces the whole catalog (template or file); one undo step. */
  applyCatalog: (next: Catalog) => void
  /** Sets (or with undefined removes) the type of all selected objects; one undo step, also in analysis mode. */
  setSelectionType: (typeId: string | undefined) => void
  /** Sets (or removes) the type of a connection; also in analysis mode. */
  setEdgeType: (edgeId: string, typeId: string | undefined) => void
  /** Sets the value of a type field of a connection; also in analysis mode. */
  setEdgeField: (edgeId: string, key: string, value: string) => void
```

In `createGraphStore`:

- `content()` bekommt `catalog: get().catalog`.
- `apply`: `const changed = renamed || next.nodes !== current.nodes || next.edges !== current.edges || next.catalog !== current.catalog`; im `set({...})` zusätzlich `catalog: next.catalog ?? current.catalog ?? EMPTY_CATALOG,`. Wichtig: `next.catalog` aus `graph.*`-Funktionen bleibt erhalten, weil sie `...content` spreaden.
- `restore`: `catalog: result.content.catalog ?? EMPTY_CATALOG,`
- Initialzustand (Rückgabeobjekt): `catalog: initial.catalog ?? EMPTY_CATALOG,`
- `replaceContent`: `catalog: next.catalog ?? EMPTY_CATALOG,`; `importText` übergibt `catalog: result.model.catalog`.
- Aktionen (neben `setSelectionVersion`):

```ts
      addType: (side, name) => {
        if (structureLocked()) return undefined
        const catalog = get().catalog
        const added = addCatalogType(catalog, side, name ?? uniqueName(catalog[side], currentT()('types.defaultName')), newId)
        if (added === undefined) return undefined
        apply({ ...content(), catalog: added.catalog })
        return added.id
      },
      updateType: (side, type) => {
        if (structureLocked()) return
        apply({ ...content(), catalog: replaceType(get().catalog, side, type) })
      },
      removeType: (side, id) => {
        if (structureLocked()) return
        apply({ ...content(), catalog: removeCatalogType(get().catalog, side, id) })
      },
      applyCatalog: (next) => {
        if (structureLocked()) return
        apply({ ...content(), catalog: next })
      },
      setSelectionType: (typeId) => apply(graph.setTypes(content(), get().selectedNodeIds, typeId)),
      setEdgeType: (edgeId, typeId) => apply(graph.setEdgeType(content(), edgeId, typeId)),
      setEdgeField: (edgeId, key, value) => apply(graph.setEdgeField(content(), edgeId, key, value)),
```

- `sameContent` (unten in der Datei): zusätzlich `a.catalog !== b.catalog` → `return false`:

```ts
  if (a.edges !== b.edges || a.projectName !== b.projectName || a.catalog !== b.catalog || a.nodes.length !== b.nodes.length) {
```

(Sonst würde eine reine Katalogänderung in einer Geste als „unverändert“ verworfen.)

- Katalogtext `types.defaultName` wird in Task 7 in die Kataloge eingetragen; für diesen Task vorab in alle drei eintragen: de `Neuer Typ`, en `New type`, fr `Nouveau type`.

`persistence.ts`: die in Task 3 Schritt 6 zurückgestellte Änderung jetzt umsetzen (`catalog` vergleichen und speichern).

- [ ] **Step 5: Tests laufen lassen**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Checkpoint** – nicht committen.

---

### Task 5: Sidebar – Typ und Typfelder (Objekte, Verbindungen, Mehrfachauswahl)

**Files:**
- Create: `src/components/SidebarTypeFields.tsx`, `src/components/SidebarBulkType.tsx`, `src/components/typedDraft.ts`
- Modify: `src/components/props.ts`, `src/components/Sidebar.tsx`, `src/components/SidebarEdgeForm.tsx`, `src/components/components.css`, `src/App.tsx`
- Test: `src/components/typedDraft.test.ts`, `src/components/Sidebar.test.tsx`

**Interfaces:**
- Produces (`props.ts`):

```ts
export interface TypeChoice { id: string; name: string }
export interface TypeFieldView { key: string; kind: FieldKind; options: string[]; required: boolean; default: string }
/** What the sidebar needs to know about the catalog of the element kind it shows. */
export interface SidebarTyping {
  choices: TypeChoice[]
  /** Fields of a type in catalog order; undefined = the id is not in the catalog. */
  fieldsOf: (typeId: string) => TypeFieldView[] | undefined
}
export interface BulkType { choices: TypeChoice[]; typeId: string; mixed: boolean; onChange: (typeId: string | undefined) => void }
```

`SidebarProps` bekommt: `typing?: SidebarTyping`, `bulkType?: BulkType`, `onEdgeTypeChange?: (typeId: string | undefined) => void`, `onEdgeFieldChange?: (key: string, value: string) => void`.
- Produces (`typedDraft.ts`): `splitTyped(entries, typing)`, `joinTyped(typeId, values, typing)`, `switchType(...)` (siehe unten).
- Consumes: `missingRequired` ist hier nicht nötig (die Anzeige prüft selbst).

- [ ] **Step 1: Failing test** – `src/components/typedDraft.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { switchType } from './typedDraft'
import type { SidebarTyping } from './props'

const e = (key: string, value: string) => ({ key, value })
const typing: SidebarTyping = {
  choices: [],
  fieldsOf: (id) =>
    id === 't1'
      ? [{ key: 'owner', kind: 'text', options: [], required: false, default: '' }]
      : id === 't2'
        ? [{ key: 'env', kind: 'select', options: ['prod'], required: false, default: 'prod' }]
        : undefined,
}

describe('switchType', () => {
  it('moves values of the old type to free rows and fills the new fields from defaults', () => {
    const next = switchType({ typeId: 't1', typed: { owner: 'Anna' }, rows: [] }, 't2', typing)
    expect(next.typeId).toBe('t2')
    expect(next.typed).toEqual({ env: 'prod' })
    expect(next.rows).toEqual([e('owner', 'Anna')])
  })

  it('adopts a free row with the same key as the value of the new field', () => {
    const next = switchType({ typeId: '', typed: {}, rows: [e('owner', 'Bernd'), e('x', '1')] }, 't1', typing)
    expect(next.typed).toEqual({ owner: 'Bernd' })
    expect(next.rows).toEqual([e('x', '1')])
  })

  it('removing the type turns every typed value into a free row', () => {
    const next = switchType({ typeId: 't1', typed: { owner: 'Anna' }, rows: [] }, '', typing)
    expect(next).toEqual({ typeId: '', typed: {}, rows: [e('owner', 'Anna')] })
  })
})
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx vitest run src/components/typedDraft.test.ts`
Expected: FAIL (Modul fehlt).

- [ ] **Step 3: `props.ts` ergänzen** (die Typen oben; `FieldKind` aus `../model/types` importieren) und in `SidebarProps` die vier optionalen Felder, jeweils mit Kommentar:

```ts
  /** Objects/groups/notes and connections: the types to choose from and their fields; absent = typing is not offered. */
  typing?: SidebarTyping
  /** With several objects selected: the shared type control; absent when the selection has no object. */
  bulkType?: BulkType
  /** Edges only: the type was chosen (applied at once, one undo step). */
  onEdgeTypeChange?: (typeId: string | undefined) => void
  /** Edges only: a type field was edited; `onEditStart`/`onEditEnd` bracket the typing like for other fields. */
  onEdgeFieldChange?: (key: string, value: string) => void
```

- [ ] **Step 4: `src/components/typedDraft.ts`**

```ts
import type { MetadataEntry } from '../model/types'
import type { SidebarTyping } from './props'

/** The part of a sidebar draft that belongs to the element's type. */
export interface TypedPart {
  /** Type id, '' = none. */
  typeId: string
  /** Values of the fields of the type, by key. */
  typed: Record<string, string>
  /** Free rows (all other entries) – only the keys and values matter here. */
  rows: MetadataEntry[]
}

/** The draft after choosing `nextId`: old values become free rows, matching free rows become field values, the rest gets defaults. */
export function switchType(part: TypedPart, nextId: string, typing: SidebarTyping): TypedPart {
  const nextFields = nextId === '' ? [] : (typing.fieldsOf(nextId) ?? [])
  const nextKeys = new Set(nextFields.map((field) => field.key))
  const leftOver = Object.entries(part.typed)
    .filter(([key]) => !nextKeys.has(key))
    .map(([key, value]) => ({ key, value }))
  const adopted = new Map(part.rows.filter((row) => nextKeys.has(row.key)).map((row) => [row.key, row.value]))
  const rows = [...part.rows.filter((row) => !nextKeys.has(row.key)), ...leftOver]
  const typed: Record<string, string> = {}
  for (const field of nextFields) {
    typed[field.key] = part.typed[field.key] ?? adopted.get(field.key) ?? field.default
  }
  return { typeId: nextId, typed, rows }
}
```

- [ ] **Step 5: Test laufen lassen**

Run: `npx vitest run src/components/typedDraft.test.ts`
Expected: PASS.

- [ ] **Step 6: Kataloge für die Sidebar** (alle drei Dateien)

| Schlüssel | de | en | fr |
|---|---|---|---|
| `sidebar.type.label` | `Typ` | `Type` | `Type` |
| `sidebar.type.none` | `– ohne Typ –` | `– no type –` | `– sans type –` |
| `sidebar.type.unknown` | `? {value} (nicht im Katalog)` | `? {value} (not in the catalog)` | `? {value} (absent du catalogue)` |
| `sidebar.type.fields` | `Felder des Typs` | `Fields of the type` | `Champs du type` |
| `sidebar.type.missing` | `Pflichtfeld ist leer` | `Required field is empty` | `Champ obligatoire vide` |
| `sidebar.type.yes` | `Ja` | `Yes` | `Oui` |
| `sidebar.type.no` | `Nein` | `No` | `Non` |
| `sidebar.type.unset` | `– nicht gesetzt –` | `– not set –` | `– non défini –` |
| `sidebar.bulkType` | `Typ der markierten Objekte` | `Type of the selected objects` | `Type des objets sélectionnés` |
| `sidebar.bulkType.mixed` | `verschieden` | `mixed` | `différents` |

- [ ] **Step 7: `SidebarTypeFields.tsx`** (gemeinsam für Objekte und Verbindungen, controlled)

```tsx
import { useId } from 'react'
import { useT } from '../i18n/react'
import type { SidebarTyping } from './props'
import { useEditGesture } from './useSidebarEffects'
import './components.css'

interface SidebarTypeFieldsProps {
  typing: SidebarTyping
  /** Current type id, '' = none. */
  typeId: string
  /** Values of the type fields by key. */
  values: Record<string, string>
  onTypeChange: (typeId: string) => void
  onValueChange: (key: string, value: string) => void
  onEditStart: () => void
  onEditEnd: () => void
}

/** Type chooser plus the fields the type defines; the owner decides where the values live. */
export function SidebarTypeFields({
  typing,
  typeId,
  values,
  onTypeChange,
  onValueChange,
  onEditStart,
  onEditEnd,
}: SidebarTypeFieldsProps) {
  const t = useT()
  const id = useId()
  const gesture = useEditGesture(onEditStart, onEditEnd)
  const fields = typeId === '' ? [] : typing.fieldsOf(typeId)
  const unknown = typeId !== '' && fields === undefined

  return (
    <div className="sidebar__type">
      <div className="sidebar__field">
        <label className="sidebar__label" htmlFor={`${id}-type`}>
          {t('sidebar.type.label')}
        </label>
        <select
          id={`${id}-type`}
          className="ui-input"
          value={typeId}
          onChange={(event) => onTypeChange(event.target.value)}
        >
          <option value="">{t('sidebar.type.none')}</option>
          {typing.choices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.name}
            </option>
          ))}
          {unknown && <option value={typeId}>{t('sidebar.type.unknown', { value: typeId })}</option>}
        </select>
      </div>

      {fields !== undefined && fields.length > 0 && (
        <fieldset className="sidebar__type-fields">
          <legend className="sidebar__label">{t('sidebar.type.fields')}</legend>
          {fields.map((field) => {
            const value = values[field.key] ?? ''
            const empty = value.trim() === ''
            const fieldId = `${id}-f-${field.key}`
            return (
              <div className="sidebar__field" key={field.key}>
                <label className="sidebar__label" htmlFor={fieldId}>
                  {field.key}
                  {field.required && ' *'}
                </label>
                {field.kind === 'text' ? (
                  <input
                    id={fieldId}
                    className="ui-input"
                    value={value}
                    onChange={(event) => {
                      gesture.start()
                      onValueChange(field.key, event.target.value)
                    }}
                    onBlur={gesture.end}
                  />
                ) : (
                  <select
                    id={fieldId}
                    className="ui-input"
                    value={value}
                    onChange={(event) => {
                      gesture.end()
                      onValueChange(field.key, event.target.value)
                    }}
                  >
                    <option value="">{t('sidebar.type.unset')}</option>
                    {(field.kind === 'boolean' ? ['ja', 'nein'] : field.options).map((option) => (
                      <option key={option} value={option}>
                        {field.kind === 'boolean' ? t(option === 'ja' ? 'sidebar.type.yes' : 'sidebar.type.no') : option}
                      </option>
                    ))}
                    {value !== '' && !(field.kind === 'boolean' ? ['ja', 'nein'] : field.options).includes(value) && (
                      <option value={value}>{value}</option>
                    )}
                  </select>
                )}
                {field.required && empty && <span className="sidebar__warn">{t('sidebar.type.missing')}</span>}
              </div>
            )
          })}
        </fieldset>
      )}
    </div>
  )
}
```

(`useEditGesture` hat – wie in `SidebarBulkFields.tsx` benutzt – die Methoden `start()` und `end()`. Ein Wechsel per `<select>` ist ein eigener Schritt: `gesture.end()` davor schließt eine laufende Texteingabe ab, die Änderung selbst klammert der Aufrufer in `Sidebar.tsx` über `edit(…, true)`.)

CSS in `components.css` ergänzen:

```css
.sidebar__type-fields {
  border: 1px solid var(--border, #d1d5db);
  border-radius: 6px;
  padding: 8px;
  margin: 0 0 12px;
}

.sidebar__warn {
  color: #b45309;
  font-size: 12px;
}
```

(Falls die Datei andere Variablennamen für Randfarben nutzt, vor dem Einfügen mit `grep -n "border" src/components/components.css | head` den üblichen Wert übernehmen.)

- [ ] **Step 8: `Sidebar.tsx` – Typ in den Entwurf aufnehmen**

1. Importe: `import { TYPE_KEY } from '../model/types'` (zur vorhandenen `./types`-Importzeile), `import { SidebarTypeFields } from './SidebarTypeFields'`, `import { switchType } from './typedDraft'`, `import type { SidebarTyping } from './props'` (zu `SidebarElement, SidebarProps`).

2. `Draft` um zwei Felder erweitern:

```ts
  /** Id of the object's type ('' = none); unused for groups and notes. */
  typeId: string
  /** Values of the fields of that type by key. */
  typed: Record<string, string>
```

3. `toDraft(entries, isObject, typing?)` – die Typinformation herauslösen, bevor die freien Zeilen entstehen:

```ts
function toDraft(entries: readonly MetadataEntry[], isObject: boolean, typing?: SidebarTyping): Draft {
  // …bestehender Code unverändert bis vor `return`…
  const typeIndex = isObject ? entries.findIndex((entry) => entry.key === TYPE_KEY) : -1
  const typeId = typeIndex >= 0 ? entries[typeIndex].value.trim() : ''
  const fieldKeys = new Set((typeId === '' ? [] : (typing?.fieldsOf(typeId) ?? [])).map((field) => field.key))
  const typed: Record<string, string> = {}
  entries.forEach((entry, index) => {
    if (fieldKeys.has(entry.key) && index !== nameIndex && index !== typeIndex) typed[entry.key] ??= entry.value
  })
```

Im `return` ergänzen: `typeId, typed,` und in der `rows`-Filterbedingung `&& index !== typeIndex && !(fieldKeys.has(entries[index].key) && typed[entries[index].key] === entries[index].value)` – genauer: Zeilen, deren Schlüssel ein Typfeld ist, werden aus den freien Zeilen entfernt (der erste Treffer je Schlüssel steht in `typed`):

```ts
    rows: toRows(
      entries.filter(
        (entry, index) =>
          index !== nameIndex &&
          index !== colorIndex &&
          index !== statusIndex &&
          index !== reasonIndex &&
          index !== classIndex &&
          index !== entityIndex &&
          index !== versionIndex &&
          index !== typeIndex &&
          !fieldKeys.has(entry.key),
      ),
    ),
```

Bei doppeltem Schlüssel (Typfeld und freie Zeile gleichen Namens) bleibt nur der erste Eintrag als Feld, weitere Einträge desselben Schlüssels verschwinden damit aus den Zeilen. Das ist ein Datenverlust bei fremden Dateien, der sonst schon als „doppelter Schlüssel“ beim Import abgelehnt wird (`findDuplicateKeys`) – es gibt ihn im Modell also nicht.

4. `toEntries(draft, isObject, typing?)` – `type` vor `class`, Typfelder hinter `version`:

```ts
    ...(isObject && draft.typeId !== '' ? [{ key: TYPE_KEY, value: draft.typeId }] : []),
    ...(isObject
      ? [
          { key: CLASS_KEY, value: draft.objectClass },
          { key: ENTITY_KEY, value: draft.entity },
          { key: VERSION_KEY, value: draft.version },
        ]
      : []),
    ...(isObject && draft.typeId !== ''
      ? (typing?.fieldsOf(draft.typeId) ?? []).map((field) => ({ key: field.key, value: draft.typed[field.key] ?? '' }))
      : []),
    ...draft.rows.map(({ key, value }) => ({ key, value })),
```

5. `entriesOf(draft, isObject, typing?)`: beide inneren Aufrufe von `toDraft`/`toEntries` bekommen `typing` durchgereicht. Alle Aufrufstellen im Formular (`useState`-Initialisierer, Neuladen bei Änderung von außen, `shown`) ebenfalls: `SidebarForm` erhält `typing` aus den Props (`typing` aus der Destrukturierung) und übergibt es überall mit.

6. Typwechsel und Feldwert im Formular:

```tsx
  function chooseType(typeId: string) {
    if (typing === undefined) return
    const part = switchType({ typeId: draft.typeId, typed: draft.typed, rows: draft.rows.map(({ key, value }) => ({ key, value })) }, typeId, typing)
    edit({ ...draft, typeId: part.typeId, typed: part.typed, rows: toRows(part.rows) }, true)
  }
```

(`edit(next, true)` = diskreter Schritt, wie `chooseStatus`.)

7. Rendern: direkt **über** `<SidebarDetails …>` (für Objekte):

```tsx
      {isObject && typing !== undefined && (
        <SidebarTypeFields
          typing={typing}
          typeId={draft.typeId}
          values={draft.typed}
          onTypeChange={chooseType}
          onValueChange={(key, value) => edit({ ...draft, typed: { ...draft.typed, [key]: value } })}
          onEditStart={onEditStart}
          onEditEnd={onEditEnd}
        />
      )}
```

Der Typ für Gruppen und Notizen wird nicht angeboten (Bedingung `isObject`).

8. `Sidebar.test.tsx` ergänzen (Aufbau wie bestehende Tests dort, `render(<Sidebar … />)`):

```tsx
it('offers the types of the catalog and shows the fields of the chosen type', async () => {
  const typing: SidebarTyping = {
    choices: [{ id: 't1', name: 'Service' }],
    fieldsOf: (id) => (id === 't1' ? [{ key: 'owner', kind: 'text', options: [], required: true, default: '' }] : undefined),
  }
  const onChange = vi.fn()
  render(<Sidebar {...baseProps} typing={typing} onChange={onChange} />)   // baseProps: the helper of this test file
  await userEvent.selectOptions(screen.getByLabelText('Typ'), 'Service')
  expect(onChange).toHaveBeenLastCalledWith(
    expect.arrayContaining([{ key: 'type', value: 't1' }, { key: 'owner', value: '' }]),
  )
  expect(screen.getByText('Pflichtfeld ist leer')).toBeTruthy()
})

it('keeps an unknown type visible', () => {
  const typing: SidebarTyping = { choices: [], fieldsOf: () => undefined }
  render(<Sidebar {...propsWithMetadata([{ key: 'name', value: 'A' }, { key: 'type', value: 'gone' }])} typing={typing} />)
  expect(screen.getByRole('option', { name: '? gone (nicht im Katalog)' })).toBeTruthy()
})
```

(`baseProps`/`propsWithMetadata` stehen hier für die Hilfsfunktionen, mit denen `Sidebar.test.tsx` seine Props baut; vor dem Schreiben `sed -n 1,60p src/components/Sidebar.test.tsx` lesen, die Namen und die Sprache der Tests (`de`) übernehmen. `userEvent` und `vi` wie in der Datei importiert.)

- [ ] **Step 9: Verbindungen (`SidebarEdgeForm.tsx`)**

`SidebarEdgeForm.tsx` zuerst lesen (147 Zeilen). Dann: Props `typing`, `onEdgeTypeChange`, `onEdgeFieldChange` aus `SidebarProps` durchreichen (in `Sidebar.tsx` an der Stelle, wo `SidebarEdgeForm` gerendert wird). Im Formular unterhalb des Soft-Häkchens:

```tsx
      {typing !== undefined && onEdgeTypeChange && onEdgeFieldChange && (
        <SidebarTypeFields
          typing={typing}
          typeId={getTypeId(element.metadata) ?? ''}
          values={Object.fromEntries(element.metadata.map((entry) => [entry.key, entry.value]))}
          onTypeChange={(id) => onEdgeTypeChange(id === '' ? undefined : id)}
          onValueChange={onEdgeFieldChange}
          onEditStart={onEditStart}
          onEditEnd={onEditEnd}
        />
      )}
```

(`getTypeId` aus `../model/typing` – eine Ausnahme von „Komponenten haben keine Fachlogik“ wäre das nicht, es liest nur einen Eintrag; wer das vermeiden will, übergibt `typeId` im `SidebarElement` als neues optionales Feld `typeId?: string`. Entscheide dich für das Feld `typeId` am `SidebarElement` und fülle es in `App.tsx`; so bleibt die Komponente frei von Modell-Imports.)

Anpassung dafür: in `props.ts` `SidebarElement` um `typeId?: string` ergänzen (`/** Edges only: id of the connection's type ('' or absent = none). */`), und im Formular `typeId={element.typeId ?? ''}` benutzen statt `getTypeId`.

- [ ] **Step 10: `SidebarBulkType.tsx`**

```tsx
import { useId } from 'react'
import { useT } from '../i18n/react'
import type { BulkType } from './props'
import './components.css'

/** One type for every selected object. */
export function SidebarBulkType({ choices, typeId, mixed, onChange }: BulkType) {
  const t = useT()
  const id = useId()
  return (
    <div className="sidebar__field">
      <label className="sidebar__label" htmlFor={id}>
        {t('sidebar.bulkType')}
      </label>
      <select
        id={id}
        className="ui-input"
        value={mixed ? '__mixed' : typeId}
        onChange={(event) => onChange(event.target.value === '' ? undefined : event.target.value)}
      >
        {mixed && (
          <option value="__mixed" disabled>
            {t('sidebar.bulkType.mixed')}
          </option>
        )}
        <option value="">{t('sidebar.type.none')}</option>
        {choices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.name}
          </option>
        ))}
      </select>
    </div>
  )
}
```

In `Sidebar.tsx` an der Stelle, wo bei Mehrfachauswahl `SidebarBulkColor`/`SidebarBulkStatus` gerendert werden (mit `grep -n "SidebarBulkStatus" src/components/Sidebar.tsx` finden), unter dem Statusfeld ergänzen: `{bulkType && <SidebarBulkType {...bulkType} />}`. Die Typ-Auswahl gilt auch im Analysemodus (kein Strukturaktion), also kein Sperren in der Komponente.

- [ ] **Step 11: `App.tsx` verdrahten**

Die Stellen finden: `grep -n "bulkFields\|setSelectionClass\|sidebarEdge\|onSoftChange" src/App.tsx`.

Bausteine (oberhalb der Sidebar-Props, per `useMemo` abhängig von `catalog`):

```tsx
  const catalog = useGraphStore((s) => s.catalog)

  const typingFor = (side: 'elementTypes' | 'edgeTypes'): SidebarTyping => ({
    choices: catalog[side].map((type) => ({ id: type.id, name: type.name })),
    fieldsOf: (typeId) => {
      const type = catalog[side].find((candidate) => candidate.id === typeId)
      return type?.fields.map((field) => ({
        key: field.key,
        kind: field.kind,
        options: field.options ?? [],
        required: field.required === true,
        default: field.default ?? '',
      }))
    },
  })
```

(`useGraphStore` steht für den Selektor-Hook, den `App.tsx` für `nodes`/`edges` schon benutzt; Name und Schreibweise dort übernehmen.)

- Dem Sidebar-Element für Objekte `typing={typingFor('elementTypes')}`, für eine Verbindung `typing={typingFor('edgeTypes')}` mitgeben (je nachdem, ob `sidebarEdge` gesetzt ist), dazu `onEdgeTypeChange={(id) => graphStore.getState().setEdgeType(sidebarEdge.id, id)}` und `onEdgeFieldChange={(key, value) => graphStore.getState().setEdgeField(sidebarEdge.id, key, value)}`.
- `SidebarElement.typeId` für Verbindungen: `getTypeId(sidebarEdge.metadata ?? []) ?? ''` (Import aus `./model/typing` – `App` darf das).
- `bulkType`: neben `bulkFields`, nach demselben Muster (`shared`-Hilfsfunktion, die dort für `class` benutzt wird):

```tsx
    bulkType: objectIds.length > 0 ? {
      choices: catalog.elementTypes.map((type) => ({ id: type.id, name: type.name })),
      ...sharedValue(objectIds.map((id) => getTypeId(nodeById.get(id)!.metadata) ?? '')),
      onChange: (typeId) => graphStore.getState().setSelectionType(typeId),
    } : undefined,
```

wobei `sharedValue(values: string[]): { typeId: string; mixed: boolean }` ein kleiner lokaler Helfer ist: `const first = values[0]; return values.every((v) => v === first) ? { typeId: first, mixed: false } : { typeId: '', mixed: true }`. (`objectIds` = die markierten Elemente mit `kind === 'node'`, wie bei `bulkFields` gebildet; die dortige Variable wiederverwenden.)

- [ ] **Step 12: Tests, Typecheck, Lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 13: Checkpoint** – nicht committen.

---

### Task 6: Darstellung (Knoten, Kanten, SVG) und Filter

**Files:**
- Create: `src/components/TypeIcon.tsx`
- Modify: `src/flow/types.ts`, `src/flow/mapping.ts`, `src/components/BoxNode.tsx`, `src/components/components.css`, `src/flow/svgExport.ts`, `src/model/filter.ts`, `src/App.tsx` (Katalog in `toFlowNodes`/`toFlowEdges`/`findByMetadata` reichen)
- Test: `src/flow/mapping.test.ts`, `src/flow/svgExport.test.ts`, `src/model/filter.test.ts`, `src/components/nodes.test.tsx`

**Interfaces:**
- Produces: `FlowNodeData.typeName?: string`, `FlowNodeData.typeUnknown?: boolean`, `FlowNodeData.icon?: IconKey`; `FlowUiState.catalog?: Catalog`; `toFlowEdges(…)` färbt Kanten mit Typfarbe; `findByMetadata(nodes, key, value, types?)`; `TypeIcon({ icon })`.
- Consumes: `resolveColor`, `resolveType` (Task 2).

- [ ] **Step 1: Failing tests**

`src/model/filter.test.ts` ergänzen:

```ts
it('finds objects by the name of their type, not by its id', () => {
  const types = [{ id: 't1', name: 'Service', fields: [] }]
  const typed = { ...box('a', 0, 0), metadata: [{ key: 'name', value: 'A' }, { key: 'type', value: 't1' }] }
  const hits = findByMetadata([typed, box('b', 100, 0)], 'type', ' service ', types)
  expect(hits.map((hit) => hit.id)).toEqual(['a'])
  expect(findByMetadata([typed], 'type', 't1', types)).toEqual([])
})
```

`src/flow/mapping.test.ts` ergänzen (die bestehenden Tests zeigen, wie `toFlowNodes`/`toFlowEdges` aufgerufen werden und welche `FlowUiState` sie bauen – dieselbe Hilfsfunktion `ui()` o. Ä. verwenden):

```ts
it('colours a typed object with the type colour and shows the type name and icon', () => {
  const catalog = { elementTypes: [{ id: 't1', name: 'Service', color: '#10b981', icon: 'service' as const, fields: [] }], edgeTypes: [] }
  const typed = { ...box('a', 0, 0), metadata: [{ key: 'name', value: 'A' }, { key: 'type', value: 't1' }] }
  const [flow] = toFlowNodes([typed], { ...emptyUi(), catalog })
  expect(flow.data.color).toBe('#10b981')
  expect(flow.data.typeName).toBe('Service')
  expect(flow.data.icon).toBe('service')
})

it('marks an unknown type and keeps the default colour', () => {
  const typed = { ...box('a', 0, 0), metadata: [{ key: 'name', value: 'A' }, { key: 'type', value: 'gone' }] }
  const [flow] = toFlowNodes([typed], emptyUi())
  expect(flow.data.typeUnknown).toBe(true)
  expect(flow.data.color).toBeUndefined()
})

it('draws a typed connection in the colour of its type', () => {
  const catalog = { elementTypes: [], edgeTypes: [{ id: 'e1', name: 'Datenfluss', color: '#f59e0b', fields: [] }] }
  const edge = { id: 'x', source: 'a', target: 'b', metadata: [{ key: 'name', value: '' }, { key: 'type', value: 'e1' }] }
  const [flow] = toFlowEdges([edge], emptyUi(), [box('a', 0, 0), box('b', 100, 0)], catalog)
  expect(JSON.stringify(flow.style)).toContain('#f59e0b')
})
```

(`emptyUi()` steht für den in dieser Testdatei vorhandenen Aufbau eines `FlowUiState`; mit `grep -n "selectedIds" src/flow/mapping.test.ts | head -3` den Namen prüfen. Die Signatur von `toFlowEdges` vor dem Schreiben mit `grep -n "export function toFlowEdges" -A 12 src/flow/mapping.ts` ansehen und den Katalog als letzten optionalen Parameter ergänzen, wie in Schritt 4 beschrieben; Test dann an die tatsächliche Signatur anpassen.)

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx vitest run src/model/filter.test.ts src/flow/mapping.test.ts`
Expected: FAIL.

- [ ] **Step 3: Filter (`filter.ts`)**

```ts
import { resolveType } from './typing'
import { TYPE_KEY } from './types'
import type { ModelNode, TypeDef } from './types'
```

Signatur und Vergleich:

```ts
export function findByMetadata(
  nodes: readonly ModelNode[],
  key: string,
  value: string,
  types: readonly TypeDef[] = [],
): FilterHit[] {
  const wantedKey = normalizeQuery(key)
  if (wantedKey === '') return []
  const wantedValue = normalizeQuery(value)
  const hits: FilterHit[] = []
  for (const node of nodes) {
    if (node.kind === 'note') continue
    const entry = node.metadata.find((e) => normalizeQuery(e.key) === wantedKey && normalizeQuery(shownValue(node, e)) === wantedValue)
    if (entry) hits.push({ id: node.id, key: entry.key, value: shownValue(node, entry) })
  }
  return hits

  function shownValue(node: ModelNode, e: { key: string; value: string }): string {
    if (e.key !== TYPE_KEY) return e.value
    const resolved = resolveType(node.metadata, types)
    return resolved.state === 'known' ? resolved.def.name : e.value
  }
}
```

Doc-Kommentar ergänzen: `The entry \`type\` is compared by the name of its type (a known type), so the filter shows what the user sees.`

In `App.tsx` den Aufruf `findByMetadata(nodes, filter.key, filter.value)` um `catalog.elementTypes` ergänzen (Stelle: `grep -n findByMetadata src/App.tsx`).

- [ ] **Step 4: `flow/types.ts` und `mapping.ts`**

`FlowNodeData` ergänzen:

```ts
  /** Name of the object's type (a known one); undefined = no type or an unknown one. */
  typeName?: string
  /** The object refers to a type that is not in the catalog. */
  typeUnknown?: boolean
  /** Icon of the object's type. */
  icon?: IconKey
```

(`import type { IconKey } from '../model/types'`.)

`FlowUiState` ergänzen: `/** Types of the project; undefined = none. */ catalog?: Catalog`.

In `toFlowNodes` den Farbaufruf ersetzen:

```ts
    const resolved = node.kind === 'node' ? resolveType(node.metadata, ui.catalog?.elementTypes ?? []) : ({ state: 'none' } as const)
    const color =
      (node.kind === 'node' ? resolveColor(node.metadata, ui.catalog?.elementTypes ?? []) : getColor(node.metadata)) ??
      (node.kind === 'note' ? NOTE_DEFAULT_COLOR : undefined)
```

und in `data` (neben `color`):

```ts
        ...(resolved.state === 'known' && { typeName: resolved.def.name, icon: resolved.def.icon }),
        ...(resolved.state === 'unknown' && { typeUnknown: true, typeName: undefined }),
```

(Importe: `resolveColor`, `resolveType` aus `../model/typing`; `Catalog` aus `../model/types`.)

`toFlowEdges`: neuen letzten optionalen Parameter `catalog?: Catalog` ergänzen und an der Stelle, die den normalen (nicht ausgewählten, nicht hervorgehobenen, nicht zyklischen) Strichfarbwert `EDGE_COLOR` wählt, `edgeTypeColor(edge, catalog) ?? EDGE_COLOR` verwenden. Hilfsfunktion:

```ts
/** Colour of a known edge type; undefined = default blue. Selection, dependency and cycle colours win over it. */
function edgeTypeColor(edge: ModelEdge, catalog: Catalog | undefined): string | undefined {
  const resolved = resolveType(edge.metadata ?? [], catalog?.edgeTypes ?? [])
  return resolved.state === 'known' ? resolved.def.color?.toLowerCase() : undefined
}
```

Die Pfeilspitze (`markerEnd`) folgt der Linienfarbe, wie es der vorhandene Code für `EDGE_COLOR` tut (an der Stelle suchen, an der `EDGE_COLOR` verwendet wird, und beide Verwendungen – Linie und Marker – ersetzen).

In `App.tsx` den Katalog in die `FlowUiState` (`catalog`) und als letztes Argument an `toFlowEdges` geben (Stelle: `grep -n "toFlowNodes\|toFlowEdges" src/flow/Canvas.tsx src/App.tsx`; falls der Aufruf in `Canvas.tsx` steht, bekommt `Canvas` `catalog` als Prop und `props`-Vertrag der `Canvas`-Komponente wird entsprechend erweitert).

- [ ] **Step 5: `TypeIcon.tsx`, `BoxNode.tsx`, CSS**

```tsx
import type { IconKey } from '../model/types'

const PATHS: Record<IconKey, string> = {
  service: 'M4 4h16v6H4zM4 14h16v6H4zM7 7h.01M7 17h.01',
  database: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
  queue: 'M3 7h4v10H3zM10 7h4v10h-4zM17 7h4v10h-4z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-7 8-7s8 3 8 7',
  cloud: 'M7 18a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.5A3.5 3.5 0 0 1 17 18z',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  process: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3',
  storage: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
}

/** Small outline icon of a type; decorative (the type name is shown as text next to it). */
export function TypeIcon({ icon }: { icon: IconKey }) {
  return (
    <svg className="type-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[icon]} />
    </svg>
  )
}
```

`BoxNode.tsx`: vor `<NodeName …>` ergänzen und das Label in einen Zeilenblock legen:

```tsx
      {(data.icon || data.typeName || data.typeUnknown) && (
        <span className="box-node__type" title={data.typeName ?? data.typeId}>
          {data.icon && <TypeIcon icon={data.icon} />}
          {data.typeName ?? (data.typeUnknown ? '?' : '')}
        </span>
      )}
```

Dafür bekommt `FlowNodeData` kein `typeId`; entferne `?? data.typeId` und nutze `title={data.typeName}`. `import { TypeIcon } from './TypeIcon'`.

CSS:

```css
.box-node__type {
  position: absolute;
  left: 6px;
  bottom: 2px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  max-width: calc(100% - 12px);
  font-size: 10px;
  line-height: 1;
  opacity: 0.85;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
}
```

(Position/Abstand nach dem Anschauen im Browser anpassen: der Knoten ist 160 × 56 px, der Name steht mittig.)

`nodes.test.tsx` ergänzen: ein `BoxNode` mit `data.typeName = 'Service'` und `icon = 'service'` rendert den Text „Service“.

- [ ] **Step 6: SVG-Export (`svgExport.ts`)**

Stellen finden: `grep -n "getColor\|DEFAULT_COLOR\|EDGE_COLOR\|stroke" src/flow/svgExport.ts`. Änderungen:

- Wo die Füllfarbe eines Objekts mit `getColor(node.metadata)` bestimmt wird: `resolveColor(node.metadata, content.catalog?.elementTypes ?? [])` verwenden (für Objekte; Gruppen und Notizen behalten `getColor`).
- Wo die Linienfarbe einer Verbindung gewählt wird: die Typfarbe (`edgeTypeColor`-Logik, als gemeinsame kleine Funktion `edgeTypeColor` aus `mapping.ts` exportieren und hier importieren) vor der Standardfarbe.
- Unter dem Namen im Objekt den Typnamen als zweiten, kleineren Text zeichnen (`font-size` 10, Position wie in `.box-node__type`), nur bei bekanntem Typ.

Test in `svgExport.test.ts` (Aufbau wie die vorhandenen Tests dort):

```ts
it('draws a typed object in the type colour with the type name', () => {
  const catalog = { elementTypes: [{ id: 't1', name: 'Service', color: '#10b981', fields: [] }], edgeTypes: [] }
  const typed = { ...box('a', 0, 0), metadata: [{ key: 'name', value: 'A' }, { key: 'type', value: 't1' }] }
  const svg = buildSvg({ nodes: [typed], edges: [], catalog })   // call exactly like the other tests of this file
  expect(svg).toContain('#10b981')
  expect(svg).toContain('Service')
})
```

- [ ] **Step 7: Tests, Typecheck, Lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 8: Checkpoint** – nicht committen.

---

### Task 7: Konfigurationsmenü `TypeCatalogDialog`

**Files:**
- Create: `src/components/TypeCatalogDialog.tsx`, `src/components/TypeCatalogDialog.test.tsx`
- Modify: `src/components/props.ts`, `src/components/icons.tsx`, `src/components/Toolbar.tsx`, `src/components/components.css`, `src/App.tsx`, `src/i18n/de.ts`, `en.ts`, `fr.ts`

**Interfaces:**
- Produces (`props.ts`):

```ts
export interface TypeDialogType extends TypeDef { usage: number }

export interface TypeCatalogDialogProps {
  open: boolean
  /** Analysis mode: everything is shown, nothing can be changed. */
  readOnly: boolean
  elementTypes: TypeDialogType[]
  edgeTypes: TypeDialogType[]
  onAdd: (side: CatalogSide) => string | undefined
  /** Gets a tidy-able draft; the owner ignores invalid ones (the dialog checks first and shows the problems). */
  onUpdate: (side: CatalogSide, type: TypeDef) => void
  onRemove: (side: CatalogSide, id: string) => void
  /** Templates, import and export of the catalog; the owner implements them (Task 8). */
  templates: { id: string; label: string }[]
  onTemplate: (templateId: string, mode: 'merge' | 'replace') => void
  onImportCatalog: () => void
  onExportCatalog: () => void
  /** Error message of the last failed catalog import, shown in the dialog. */
  importError: string | null
  onClose: () => void
}
```

`ToolbarProps` bekommt `onTypes: () => void` (öffnet den Dialog).
- Consumes: `checkTypeDef`, `tidyType`, `TYPE_PROBLEM_KEYS` aus `model/catalog` – ein Verstoß gegen „Komponenten ohne Fachlogik“ wäre das nicht, aber `components` importiert sonst nichts aus `model`. Deshalb prüft der **Besitzer** (App) und übergibt `problemsOf`: ergänze in `TypeCatalogDialogProps` `problemsOf: (side: CatalogSide, type: TypeDef) => string[]` (liefert **übersetzte** Texte). `CatalogSide` ist ein reiner Typ-Import und erlaubt.

- [ ] **Step 1: Kataloge** (alle drei Dateien). Die Schlüssel `types.defaultName` gibt es schon (Task 4).

| Schlüssel | de | en | fr |
|---|---|---|---|
| `types.title` | `Typen` | `Types` | `Types` |
| `types.open` | `Typen verwalten` | `Manage types` | `Gérer les types` |
| `types.tab.elements` | `Elemente` | `Elements` | `Éléments` |
| `types.tab.edges` | `Verbindungen` | `Connections` | `Liaisons` |
| `types.new` | `Neuer Typ` | `New type` | `Nouveau type` |
| `types.empty` | `Noch keine Typen. Lege einen an oder wähle eine Vorlage.` | `No types yet. Add one or pick a template.` | `Aucun type pour l’instant. Ajoutez-en un ou choisissez un modèle.` |
| `types.usage` | `{count} in Verwendung` | `{count} in use` | `{count} utilisé(s)` |
| `types.name` | `Name` | `Name` | `Nom` |
| `types.color` | `Farbe` | `Colour` | `Couleur` |
| `types.color.reset` | `Keine Farbe` | `No colour` | `Sans couleur` |
| `types.icon` | `Symbol` | `Icon` | `Icône` |
| `types.icon.none` | `Kein Symbol` | `No icon` | `Sans icône` |
| `types.icon.service` | `Dienst` | `Service` | `Service` |
| `types.icon.database` | `Datenbank` | `Database` | `Base de données` |
| `types.icon.queue` | `Warteschlange` | `Queue` | `File d’attente` |
| `types.icon.user` | `Benutzer` | `User` | `Utilisateur` |
| `types.icon.cloud` | `Cloud` | `Cloud` | `Cloud` |
| `types.icon.external` | `Extern` | `External` | `Externe` |
| `types.icon.process` | `Prozess` | `Process` | `Processus` |
| `types.icon.storage` | `Speicher` | `Storage` | `Stockage` |
| `types.fields` | `Felder` | `Fields` | `Champs` |
| `types.field.add` | `Feld hinzufügen` | `Add field` | `Ajouter un champ` |
| `types.field.key` | `Schlüssel` | `Key` | `Clé` |
| `types.field.kind` | `Art` | `Kind` | `Type de champ` |
| `types.kind.text` | `Text` | `Text` | `Texte` |
| `types.kind.select` | `Auswahl` | `Choice` | `Choix` |
| `types.kind.boolean` | `Ja/Nein` | `Yes/No` | `Oui/Non` |
| `types.field.options` | `Optionen (durch Komma getrennt)` | `Options (comma separated)` | `Options (séparées par des virgules)` |
| `types.field.required` | `Pflicht` | `Required` | `Obligatoire` |
| `types.field.default` | `Standard` | `Default` | `Par défaut` |
| `types.field.remove` | `Feld entfernen` | `Remove field` | `Supprimer le champ` |
| `types.renameHint` | `Werte, die bereits unter dem alten Schlüssel stehen, bleiben als freie Felder erhalten.` | `Values already stored under the old key stay as free fields.` | `Les valeurs déjà enregistrées sous l’ancienne clé restent comme champs libres.` |
| `types.delete` | `Typ löschen` | `Delete type` | `Supprimer le type` |
| `types.delete.title` | `Typ löschen?` | `Delete type?` | `Supprimer le type ?` |
| `types.delete.message` | `{count} Element(e) verwenden diesen Typ. Sie behalten den Eintrag und zeigen ihn als unbekannt an.` | `{count} element(s) use this type. They keep the entry and show it as unknown.` | `{count} élément(s) utilisent ce type. Ils conservent l’entrée et l’affichent comme inconnue.` |
| `types.readOnly` | `Im Analysemodus nur lesbar.` | `Read-only in analysis mode.` | `Lecture seule en mode analyse.` |
| `types.template` | `Vorlage` | `Template` | `Modèle` |
| `types.template.choose` | `– Vorlage wählen –` | `– choose a template –` | `– choisir un modèle –` |
| `types.import` | `Katalog importieren` | `Import catalog` | `Importer le catalogue` |
| `types.export` | `Katalog exportieren` | `Export catalog` | `Exporter le catalogue` |
| `types.merge.title` | `Vorhandenen Katalog verändern?` | `Change the existing catalog?` | `Modifier le catalogue existant ?` |
| `types.merge.message` | `Das Projekt hat schon Typen. „Ergänzen“ fügt nur Typen mit neuem Namen hinzu, „Ersetzen“ ersetzt den ganzen Katalog (Elemente behalten ihre Verweise, auch unbekannte).` | `The project already has types. “Merge” only adds types with new names, “Replace” replaces the whole catalog (elements keep their references, also unknown ones).` | `Le projet a déjà des types. « Compléter » n’ajoute que les types dont le nom est nouveau, « Remplacer » remplace tout le catalogue (les éléments gardent leurs références, même inconnues).` |
| `types.merge.merge` | `Ergänzen` | `Merge` | `Compléter` |
| `types.merge.replace` | `Ersetzen` | `Replace` | `Remplacer` |
| `types.importFailed` | `Der Katalog konnte nicht gelesen werden:` | `The catalog could not be read:` | `Le catalogue n’a pas pu être lu :` |

- [ ] **Step 2: Failing test** – `src/components/TypeCatalogDialog.test.tsx`

Zuerst `sed -n 1,50p src/components/ExportDialog.test.tsx` lesen und den dort verwendeten Aufbau (Render-Hilfen, wie ein natives `<dialog>` in jsdom geöffnet wird, `userEvent`) übernehmen. Danach:

```tsx
const baseProps = (over: Partial<TypeCatalogDialogProps> = {}): TypeCatalogDialogProps => ({
  open: true,
  readOnly: false,
  elementTypes: [{ id: 't1', name: 'Service', fields: [], usage: 2 }],
  edgeTypes: [],
  onAdd: vi.fn(() => 'new'),
  onUpdate: vi.fn(),
  onRemove: vi.fn(),
  problemsOf: () => [],
  templates: [{ id: 'it', label: 'IT-Services' }],
  onTemplate: vi.fn(),
  onImportCatalog: vi.fn(),
  onExportCatalog: vi.fn(),
  importError: null,
  onClose: vi.fn(),
  ...over,
})

it('lists the types with their usage and adds a new one', async () => {
  const props = baseProps()
  render(<TypeCatalogDialog {...props} />)
  expect(screen.getByText('Service')).toBeTruthy()
  expect(screen.getByText('2 in Verwendung')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Neuer Typ' }))
  expect(props.onAdd).toHaveBeenCalledWith('elementTypes')
})

it('applies a valid rename at once', async () => {
  const props = baseProps()
  render(<TypeCatalogDialog {...props} />)
  await userEvent.click(screen.getByText('Service'))
  const name = screen.getByLabelText('Name')
  await userEvent.clear(name)
  await userEvent.type(name, 'Dienst')
  expect(props.onUpdate).toHaveBeenLastCalledWith('elementTypes', expect.objectContaining({ id: 't1', name: 'Dienst' }))
})

it('does not apply a draft with problems and shows them', async () => {
  const props = baseProps({ problemsOf: (_side, type) => (type.name === '' ? ['Der Name darf nicht leer sein.'] : []) })
  render(<TypeCatalogDialog {...props} />)
  await userEvent.click(screen.getByText('Service'))
  await userEvent.clear(screen.getByLabelText('Name'))
  expect(screen.getByText('Der Name darf nicht leer sein.')).toBeTruthy()
  expect(props.onUpdate).not.toHaveBeenCalledWith('elementTypes', expect.objectContaining({ name: '' }))
})

it('asks before deleting a type that is in use', async () => {
  const props = baseProps()
  render(<TypeCatalogDialog {...props} />)
  await userEvent.click(screen.getByText('Service'))
  await userEvent.click(screen.getByRole('button', { name: 'Typ löschen' }))
  expect(props.onRemove).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Typ löschen', hidden: false }))   // the confirm button of the ConfirmDialog
})

it('is read-only in analysis mode', () => {
  render(<TypeCatalogDialog {...baseProps({ readOnly: true })} />)
  expect(screen.getByText('Im Analysemodus nur lesbar.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Neuer Typ' }).hasAttribute('disabled')).toBe(true)
})
```

Der vierte Test hängt davon ab, wie `ConfirmDialog` seinen Bestätigungsknopf beschriftet (`confirmLabel`); passe die letzte Zeile an das an, was die Komponente rendert (Label `Typ löschen` als `confirmLabel`, danach Erwartung `expect(props.onRemove).toHaveBeenCalledWith('elementTypes', 't1')`).

- [ ] **Step 3: Fehlschlag prüfen**

Run: `npx vitest run src/components/TypeCatalogDialog.test.tsx`
Expected: FAIL (Modul fehlt).

- [ ] **Step 4: `TypeCatalogDialog.tsx`**

Aufbau wie `ExportDialog.tsx` (`useNativeDialog`, Schließen-Knopf, Esc). Vor dem Schreiben `cat src/components/ExportDialog.tsx src/components/useNativeDialog.ts` lesen und dessen Rahmen übernehmen. Kern:

```tsx
import { useState } from 'react'
import { useT } from '../i18n/react'
import { ICON_KEYS } from '../model/types'
import type { FieldDef, FieldKind, TypeDef } from '../model/types'
import type { CatalogSide } from '../model/catalog'
import { ConfirmDialog } from './ConfirmDialog'
import type { TypeCatalogDialogProps, TypeDialogType } from './props'
import { useNativeDialog } from './useNativeDialog'
import './components.css'

const KINDS: FieldKind[] = ['text', 'select', 'boolean']

export function TypeCatalogDialog(props: TypeCatalogDialogProps) {
  const t = useT()
  const { open, readOnly, onClose } = props
  const dialogRef = useNativeDialog(open, onClose)   // use the exact signature of the hook as ExportDialog does
  const [side, setSide] = useState<CatalogSide>('elementTypes')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TypeDef | null>(null)
  const [pendingDelete, setPendingDelete] = useState<TypeDialogType | null>(null)
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null)

  const types = side === 'elementTypes' ? props.elementTypes : props.edgeTypes
  const selected = types.find((type) => type.id === selectedId)
  const shown = draft !== null && draft.id === selectedId ? draft : selected
  const problems = shown === undefined ? [] : props.problemsOf(side, shown)

  function select(type: TypeDialogType) {
    setSelectedId(type.id)
    setDraft(null)
  }

  /** Every edit changes the draft; it goes to the owner only while it has no problems. */
  function edit(next: TypeDef) {
    setDraft(next)
    if (props.problemsOf(side, next).length === 0) props.onUpdate(side, next)
  }

  function addType() {
    const id = props.onAdd(side)
    if (id !== undefined) {
      setSelectedId(id)
      setDraft(null)
    }
  }

  function patchField(index: number, patch: Partial<FieldDef>) {
    if (shown === undefined) return
    edit({ ...shown, fields: shown.fields.map((field, i) => (i === index ? { ...field, ...patch } : field)) })
  }

  return (
    <dialog ref={dialogRef} className="types-dialog" aria-labelledby="types-title" onClose={onClose}>
      <div className="types-dialog__header">
        <h2 id="types-title">{t('types.title')}</h2>
        <button type="button" className="ui-button ui-button--icon" aria-label={t('common.close')} onClick={onClose}>×</button>
      </div>
      {readOnly && <p className="types-dialog__readonly">{t('types.readOnly')}</p>}

      <div role="tablist" className="types-dialog__tabs">
        {(['elementTypes', 'edgeTypes'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={side === s}
            className="ui-button ui-button--secondary"
            onClick={() => {
              setSide(s)
              setSelectedId(null)
              setDraft(null)
            }}
          >
            {t(s === 'elementTypes' ? 'types.tab.elements' : 'types.tab.edges')}
          </button>
        ))}
      </div>

      <div className="types-dialog__body">
        <ul className="types-dialog__list">
          {types.map((type) => (
            <li key={type.id}>
              <button type="button" aria-pressed={type.id === selectedId} onClick={() => select(type)}>
                <span className="types-dialog__swatch" style={{ background: type.color ?? 'transparent' }} />
                {type.name}
                <small>{t('types.usage', { count: type.usage })}</small>
              </button>
            </li>
          ))}
          {types.length === 0 && <li className="types-dialog__empty">{t('types.empty')}</li>}
          <li>
            <button type="button" className="ui-button ui-button--secondary" disabled={readOnly} onClick={addType}>
              {t('types.new')}
            </button>
          </li>
        </ul>

        {shown !== undefined && (
          <fieldset className="types-dialog__details" disabled={readOnly}>
            <label>
              {t('types.name')}
              <input className="ui-input" value={shown.name} onChange={(event) => edit({ ...shown, name: event.target.value })} />
            </label>
            <label>
              {t('types.color')}
              <input
                type="color"
                value={shown.color ?? '#2563eb'}
                onChange={(event) => edit({ ...shown, color: event.target.value })}
              />
              <button type="button" className="ui-button ui-button--secondary" disabled={shown.color === undefined} onClick={() => edit({ ...shown, color: undefined })}>
                {t('types.color.reset')}
              </button>
            </label>
            <label>
              {t('types.icon')}
              <select className="ui-input" value={shown.icon ?? ''} onChange={(event) => edit({ ...shown, icon: (event.target.value || undefined) as TypeDef['icon'] })}>
                <option value="">{t('types.icon.none')}</option>
                {ICON_KEYS.map((icon) => (
                  <option key={icon} value={icon}>{t(`types.icon.${icon}`)}</option>
                ))}
              </select>
            </label>

            <h3>{t('types.fields')}</h3>
            <p className="types-dialog__hint">{t('types.renameHint')}</p>
            {shown.fields.map((field, index) => (
              <div className="types-dialog__field" key={index}>
                <input aria-label={t('types.field.key')} className="ui-input" value={field.key} onChange={(event) => patchField(index, { key: event.target.value })} />
                <select aria-label={t('types.field.kind')} className="ui-input" value={field.kind} onChange={(event) => patchField(index, { kind: event.target.value as FieldKind })}>
                  {KINDS.map((kind) => (
                    <option key={kind} value={kind}>{t(`types.kind.${kind}`)}</option>
                  ))}
                </select>
                {field.kind === 'select' && (
                  <input
                    aria-label={t('types.field.options')}
                    placeholder={t('types.field.options')}
                    className="ui-input"
                    value={(field.options ?? []).join(', ')}
                    onChange={(event) => patchField(index, { options: event.target.value.split(',') })}
                  />
                )}
                <input aria-label={t('types.field.default')} placeholder={t('types.field.default')} className="ui-input" value={field.default ?? ''} onChange={(event) => patchField(index, { default: event.target.value })} />
                <label>
                  <input type="checkbox" checked={field.required === true} onChange={(event) => patchField(index, { required: event.target.checked })} />
                  {t('types.field.required')}
                </label>
                <button type="button" className="ui-button ui-button--icon" aria-label={t('types.field.remove')} onClick={() => edit({ ...shown, fields: shown.fields.filter((_, i) => i !== index) })}>×</button>
              </div>
            ))}
            <button type="button" className="ui-button ui-button--secondary" onClick={() => edit({ ...shown, fields: [...shown.fields, { key: '', kind: 'text' }] })}>
              {t('types.field.add')}
            </button>

            {problems.length > 0 && (
              <ul className="types-dialog__problems" role="alert">
                {problems.map((problem) => (<li key={problem}>{problem}</li>))}
              </ul>
            )}
            <button type="button" className="ui-button ui-button--secondary" onClick={() => selected && setPendingDelete(selected)}>
              {t('types.delete')}
            </button>
          </fieldset>
        )}
      </div>

      <div className="types-dialog__footer">
        <select aria-label={t('types.template')} className="ui-input" value="" disabled={readOnly} onChange={(event) => event.target.value && handleTemplate(event.target.value)}>
          <option value="">{t('types.template.choose')}</option>
          {props.templates.map((template) => (<option key={template.id} value={template.id}>{template.label}</option>))}
        </select>
        <button type="button" className="ui-button ui-button--secondary" disabled={readOnly} onClick={props.onImportCatalog}>{t('types.import')}</button>
        <button type="button" className="ui-button ui-button--secondary" onClick={props.onExportCatalog}>{t('types.export')}</button>
        {props.importError && <p role="alert" className="types-dialog__problems">{t('types.importFailed')} {props.importError}</p>}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('types.delete.title')}
        message={t('types.delete.message', { count: pendingDelete?.usage ?? 0 })}
        confirmLabel={t('types.delete')}
        onConfirm={() => {
          if (pendingDelete) props.onRemove(side, pendingDelete.id)
          setPendingDelete(null)
          setSelectedId(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
      <ConfirmDialog
        open={pendingTemplate !== null}
        title={t('types.merge.title')}
        message={t('types.merge.message')}
        confirmLabel={t('types.merge.merge')}
        cancelLabel={t('types.merge.replace')}
        onConfirm={() => finishTemplate('merge')}
        onCancel={() => finishTemplate('replace')}
      />
    </dialog>
  )

  function handleTemplate(templateId: string) {
    if (props.elementTypes.length + props.edgeTypes.length === 0) props.onTemplate(templateId, 'replace')
    else setPendingTemplate(templateId)
  }

  function finishTemplate(mode: 'merge' | 'replace') {
    if (pendingTemplate !== null) props.onTemplate(pendingTemplate, mode)
    setPendingTemplate(null)
  }
}
```

Hinweise zum Zusammenspiel, bitte beim Umsetzen beachten:
- `ConfirmDialog` bietet nur „Bestätigen/Abbrechen“; die Vorlagen-Rückfrage nutzt „Abbrechen“ hier als „Ersetzen“. Ist das für `ConfirmDialog` ungeeignet (Esc würde ersetzen!), stattdessen zwei eigene Buttons in einem kleinen Inline-Bereich der Fußzeile anzeigen: `pendingTemplate !== null` → Text `types.merge.message` plus Buttons „Ergänzen“, „Ersetzen“ und „Abbrechen“ (`common.cancel` – existiert vermutlich; sonst `grep -n "cancel" src/i18n/de.ts` prüfen). Diese Variante ist die gewünschte; `ConfirmDialog` nur für das Löschen verwenden.
- Feldoptionen: `options` werden beim Tippen am Komma gesplittet; `tidyType` im Besitzer trimmt und entfernt leere Einträge.
- Wegen `onUpdate` nur bei fehlerfreiem Entwurf bleibt der Entwurf (`draft`) lokal, bis die Auswahl wechselt oder der Store den neuen Stand liefert. Wechselt der Store den Typ unter dem Entwurf weg (Undo), zeigt `shown` wieder `selected` (wenn `draft.id !== selectedId`) – zusätzlich `setDraft(null)`, sobald `selected` sich ändert (z. B. per `useEffect([selected])`), damit ein Undo den Entwurf nicht überdeckt.

CSS (`components.css`): `.types-dialog` (Breite `min(900px, 96vw)`, `max-height: 90vh`, Innen-`overflow: auto`), `.types-dialog__body` als Grid `240px 1fr`, `.types-dialog__swatch` 12×12 px Kreis, `.types-dialog__problems` in Fehlerfarbe, `.types-dialog__field` als Flex-Zeile mit Umbruch. Unter 720 px: `grid-template-columns: 1fr`.

- [ ] **Step 5: Toolbar-Button**

`icons.tsx`: `export function TypesIcon()` (Inline-SVG im Stil der übrigen Icons; z. B. zwei Kästchen mit Verbindungslinie: `<rect x="3" y="4" width="8" height="6" rx="1"/><rect x="13" y="14" width="8" height="6" rx="1"/><path d="M7 10v4h6"/>`).

`Toolbar.tsx`: Button direkt **links neben „Hilfe“** (zweite Zeile des Datei-Bereichs, siehe CLAUDE.md „Datei-Bereich“), `Tooltip`, `aria-label={t('types.open')}`, `onClick={onTypes}`; `ToolbarProps.onTypes` ergänzen. **Die zweite Zeile hat feste Breite**: Breite nach dem Einfügen im Browser nachmessen (CLAUDE.md); kann der Button nicht ohne Verbreiterung passen, die Sprachwahl nicht verkleinern, sondern den Button in die erste Zeile (hinter „JSON einfügen“) legen und dort messen.

`Toolbar.test.tsx`: ergänzen, dass ein Klick auf „Typen verwalten“ `onTypes` aufruft; vorhandene `baseProps` der Testdatei bekommen `onTypes: vi.fn()`.

- [ ] **Step 6: `App.tsx` verdrahten**

```tsx
  const [typesOpen, setTypesOpen] = useState(false)
  const [catalogImportError, setCatalogImportError] = useState<string | null>(null)
```

Dialog rendern, Props bauen:

```tsx
      <TypeCatalogDialog
        open={typesOpen}
        readOnly={mode === 'analyze'}
        elementTypes={catalog.elementTypes.map((type) => ({ ...type, usage: countUsage({ nodes, edges }, 'elementTypes', type.id) }))}
        edgeTypes={catalog.edgeTypes.map((type) => ({ ...type, usage: countUsage({ nodes, edges }, 'edgeTypes', type.id) }))}
        onAdd={(side) => graphStore.getState().addType(side)}
        onUpdate={(side, type) => graphStore.getState().updateType(side, type)}
        onRemove={(side, id) => graphStore.getState().removeType(side, id)}
        problemsOf={(side, type) =>
          checkTypeDef(tidyType(type), catalog[side]).map((problem) => t(TYPE_PROBLEM_KEYS[problem]))
        }
        templates={[]}
        onTemplate={() => {}}
        onImportCatalog={() => {}}
        onExportCatalog={() => {}}
        importError={catalogImportError}
        onClose={() => setTypesOpen(false)}
      />
```

Die drei leeren Platzhalter-Props (`templates`, `onTemplate`, `onImportCatalog`, `onExportCatalog`) werden in Task 8 belegt. Wichtig: Dieser Task ist nur dann abgeschlossen, wenn Task 8 sie ersetzt; die leeren Funktionen stehen hier ausschließlich, damit der Dialog bis dahin kompiliert und getestet werden kann. `Toolbar` bekommt `onTypes={() => setTypesOpen(true)}`. Die `t`-Funktion in `App.tsx` ist die vorhandene (`useT()`); die Doppelt-Importe `checkTypeDef`/`tidyType`/`TYPE_PROBLEM_KEYS`/`countUsage` kommen aus `./model/catalog`.

- [ ] **Step 7: Tests, Typecheck, Lint, Build**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 8: Browserprüfung (Dev-Server, `npm run dev`)**

Typ anlegen, umbenennen (Undo pro Feld), Feld mit Auswahl/Ja-Nein/Pflicht anlegen, Typ einem Objekt zuweisen, Typ löschen (Rückfrage mit Anzahl, Element zeigt „? …“), Analysemodus (Dialog nur lesbar), Reload. Toolbar bei **1024 px** in beiden Modi ohne Scrollen, in **DE, EN, FR**.

- [ ] **Step 9: Checkpoint** – nicht committen.

---

### Task 8: Vorlagen sowie Import und Export des Katalogs

**Files:**
- Create: `src/model/catalogTemplates.ts`, `src/model/catalogTemplates.test.ts`, `public/catalog.schema.json`
- Modify: `src/App.tsx`, `src/i18n/de.ts`, `en.ts`, `fr.ts`
- Test: `src/model/catalogTemplates.test.ts`, `src/model/catalogSchema.test.ts`

**Interfaces:**
- Produces (`catalogTemplates.ts`): `CATALOG_FILE_VERSION = 1`, `TemplateId = 'it-services' | 'dataflow'`, `TEMPLATE_IDS`, `templateCatalog(id)`, `serializeCatalog(catalog): string`, `parseCatalogText(text, t): { ok: true; catalog: Catalog } | { ok: false; errors: string[] }`, `catalogFileName(date)`.
- Consumes: `parseCatalog` (Task 3), `withFreshIds`, `mergeCatalog` (Task 1), `applyCatalog` (Task 4).

Dateiformat der Katalogdatei:

```json
{ "catalogVersion": 1, "catalog": { "elementTypes": [], "edgeTypes": [] } }
```

- [ ] **Step 1: Failing test** – `src/model/catalogTemplates.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { checkTypeDef } from './catalog'
import { TEMPLATE_IDS, parseCatalogText, serializeCatalog, templateCatalog } from './catalogTemplates'
import { createTranslate } from '../i18n/translate'

const t = createTranslate('de')

describe('templates', () => {
  it.each(TEMPLATE_IDS)('template %s is valid and has unique ids', (id) => {
    const catalog = templateCatalog(id)
    for (const side of ['elementTypes', 'edgeTypes'] as const) {
      for (const type of catalog[side]) expect(checkTypeDef(type, catalog[side])).toEqual([])
    }
    const ids = [...catalog.elementTypes, ...catalog.edgeTypes].map((type) => type.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(catalog.elementTypes.length).toBeGreaterThan(0)
  })
})

describe('catalog file', () => {
  it('survives a roundtrip', () => {
    const catalog = templateCatalog('it-services')
    const parsed = parseCatalogText(serializeCatalog(catalog), t)
    expect(parsed).toEqual({ ok: true, catalog })
  })

  it('rejects invalid JSON, a wrong version and a broken catalog', () => {
    expect(parseCatalogText('{', t).ok).toBe(false)
    expect(parseCatalogText(JSON.stringify({ catalogVersion: 2, catalog: {} }), t).ok).toBe(false)
    const broken = { catalogVersion: 1, catalog: { elementTypes: [{ id: 'a', name: '', fields: [] }], edgeTypes: [] } }
    expect(parseCatalogText(JSON.stringify(broken), t).ok).toBe(false)
  })
})
```

`src/model/catalogSchema.test.ts`:

```ts
import Ajv2020 from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import schema from '../../public/catalog.schema.json'
import { TEMPLATE_IDS, serializeCatalog, templateCatalog } from './catalogTemplates'

const validate = new Ajv2020({ allErrors: true }).compile(schema)

describe('catalog.schema.json', () => {
  it.each(TEMPLATE_IDS)('accepts the exported template %s', (id) => {
    expect(validate(JSON.parse(serializeCatalog(templateCatalog(id))))).toBe(true)
  })

  it('rejects a file without a catalog', () => {
    expect(validate({ catalogVersion: 1 })).toBe(false)
  })
})
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx vitest run src/model/catalogTemplates.test.ts src/model/catalogSchema.test.ts`
Expected: FAIL.

- [ ] **Step 3: `src/model/catalogTemplates.ts`**

Vorlagen sind Daten mit festen IDs (beim Anwenden werden sie über `withFreshIds` neu vergeben); Namen und Feldschlüssel der Vorlagen sind Daten und bleiben in jeder Oberflächensprache gleich (deutsch, wie `status`).

```ts
import { createTranslate, type Translate } from '../i18n/translate'
import { parseCatalog } from './catalogParse'
import type { Catalog, TypeDef } from './types'

export const CATALOG_FILE_VERSION = 1

export const TEMPLATE_IDS = ['it-services', 'dataflow'] as const
export type TemplateId = (typeof TEMPLATE_IDS)[number]

const environment = { key: 'umgebung', kind: 'select', options: ['prod', 'test', 'dev'], default: 'prod' } as const

const TEMPLATES: Record<TemplateId, Catalog> = {
  'it-services': {
    elementTypes: [
      { id: 'svc', name: 'Service', color: '#2563eb', icon: 'service', fields: [{ key: 'owner', kind: 'text', required: true }, environment, { key: 'kritisch', kind: 'boolean', default: 'nein' }] },
      { id: 'db', name: 'Datenbank', color: '#7c3aed', icon: 'database', fields: [{ key: 'owner', kind: 'text', required: true }, environment, { key: 'schutzklasse', kind: 'select', options: ['öffentlich', 'intern', 'vertraulich', 'streng vertraulich'], default: 'intern' }] },
      { id: 'queue', name: 'Queue', color: '#d97706', icon: 'queue', fields: [{ key: 'owner', kind: 'text' }, environment] },
      { id: 'ext', name: 'Externes System', color: '#6b7280', icon: 'external', fields: [{ key: 'betreiber', kind: 'text' }] },
    ],
    edgeTypes: [
      { id: 'call', name: 'Aufruf', color: '#2563eb', fields: [{ key: 'protokoll', kind: 'text' }, { key: 'port', kind: 'text' }, { key: 'asynchron', kind: 'boolean', default: 'nein' }] },
    ],
  },
  dataflow: {
    elementTypes: [
      { id: 'proc', name: 'Prozess', color: '#2563eb', icon: 'process', fields: [] },
      { id: 'store', name: 'Datenspeicher', color: '#7c3aed', icon: 'storage', fields: [{ key: 'schutzklasse', kind: 'select', options: ['öffentlich', 'intern', 'vertraulich', 'streng vertraulich'], default: 'intern' }] },
      { id: 'actor', name: 'Externe Entität', color: '#6b7280', icon: 'user', fields: [{ key: 'vertrauenswürdig', kind: 'boolean', default: 'nein' }] },
    ],
    edgeTypes: [
      { id: 'flow', name: 'Datenfluss', color: '#dc2626', fields: [{ key: 'daten', kind: 'text' }, { key: 'protokoll', kind: 'text' }, { key: 'authentifiziert', kind: 'boolean', default: 'nein' }, { key: 'verschlüsselt', kind: 'boolean', default: 'nein' }] },
    ],
  },
}

/** A template as a catalog with fixed ids; apply it through `withFreshIds` or `mergeCatalog`. */
export function templateCatalog(id: TemplateId): Catalog {
  return TEMPLATES[id]
}

/** The catalog as a standalone file (pretty-printed, trailing newline). */
export function serializeCatalog(catalog: Catalog): string {
  const strip = (types: readonly TypeDef[]) => types.map((type) => ({ ...type, fields: type.fields.map((field) => ({ ...field })) }))
  return `${JSON.stringify({ catalogVersion: CATALOG_FILE_VERSION, catalog: { elementTypes: strip(catalog.elementTypes), edgeTypes: strip(catalog.edgeTypes) } }, null, 2)}\n`
}

export type CatalogParseResult = { ok: true; catalog: Catalog } | { ok: false; errors: string[] }

/** Reads a catalog file; the errors are written in the language of `t`. */
export function parseCatalogText(text: string, t: Translate = createTranslate('de')): CatalogParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    return { ok: false, errors: [t('parse.json', { reason: error instanceof Error ? error.message : String(error) })] }
  }
  if (typeof parsed !== 'object' || parsed === null || (parsed as { catalogVersion?: unknown }).catalogVersion !== CATALOG_FILE_VERSION) {
    return { ok: false, errors: [t('parse.catalogFile.version', { expected: CATALOG_FILE_VERSION })] }
  }
  const errors: string[] = []
  const catalog = parseCatalog((parsed as { catalog?: unknown }).catalog, true, (message) => errors.push(message), t)
  return errors.length > 0 ? { ok: false, errors } : { ok: true, catalog }
}

/** `Katalog_<YYYY-MM-DD>_<HHmmss>.json` in local time. */
export function catalogFileName(date: Date = new Date()): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, '0')
  return `Katalog_${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.json`
}
```

Die Vorlagen enthalten Umlaute in Daten (`öffentlich`, `vertrauenswürdig`); `noHardcodedGerman.test.ts` wacht über deutsche Texte im Code: Falls er diese Datei bemängelt, `src/model/catalogTemplates.ts` dort in die Ausnahmeliste für Datenkonstanten aufnehmen (wie die Statuswerte in `model/status.ts`), nicht die Daten ändern.

Meldung ergänzen (alle drei Kataloge): `parse.catalogFile.version` – de `Keine Katalogdatei (erwartet: catalogVersion {expected}).`, en `Not a catalog file (expected catalogVersion {expected}).`, fr `Pas un fichier de catalogue (attendu : catalogVersion {expected}).`; Vorlagenbezeichnungen: `types.template.it-services` – de `IT-Services`, en `IT services`, fr `Services informatiques`; `types.template.dataflow` – de `Datenfluss-Diagramm`, en `Data flow diagram`, fr `Diagramme de flux de données`.

- [ ] **Step 4: `public/catalog.schema.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Typkatalog der Release-Management-App",
  "description": "Eigenständige Katalogdatei (Export/Import im Typen-Dialog). Der Inhalt von catalog entspricht dem Feld catalog im Projektformat (graph.schema.json). Nicht ausdrückbar und erst beim Import geprüft: eindeutige Typ-IDs und -Namen, reservierte oder doppelte Feldschlüssel, Auswahl-Standard unter den Optionen.",
  "type": "object",
  "additionalProperties": false,
  "required": ["catalogVersion", "catalog"],
  "properties": {
    "catalogVersion": { "const": 1 },
    "catalog": {
      "type": "object",
      "additionalProperties": false,
      "required": ["elementTypes", "edgeTypes"],
      "properties": {
        "elementTypes": { "type": "array", "items": { "$ref": "#/$defs/typeDef" } },
        "edgeTypes": { "type": "array", "items": { "$ref": "#/$defs/typeDef" } }
      }
    }
  },
  "$defs": {
    "typeDef": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "name", "fields"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "name": { "type": "string", "minLength": 1 },
        "color": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$" },
        "icon": { "enum": ["service", "database", "queue", "user", "cloud", "external", "process", "storage"] },
        "fields": { "type": "array", "items": { "$ref": "#/$defs/fieldDef" } }
      }
    },
    "fieldDef": {
      "type": "object",
      "additionalProperties": false,
      "required": ["key", "kind"],
      "properties": {
        "key": { "type": "string", "minLength": 1 },
        "kind": { "enum": ["text", "select", "boolean"] },
        "options": { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 1 } },
        "required": { "type": "boolean" },
        "default": { "type": "string" }
      }
    }
  }
}
```

- [ ] **Step 5: `App.tsx` – Platzhalter aus Task 7 ersetzen**

Importe: `catalogFileName`, `parseCatalogText`, `serializeCatalog`, `templateCatalog`, `TEMPLATE_IDS` aus `./model/catalogTemplates`; `mergeCatalog`, `withFreshIds` aus `./model/catalog`; `downloadTextFile`, `pickTextFile` aus dem Storage-Modul (wie der vorhandene JSON-Import sie verwendet; Pfad per `grep -n "pickTextFile" src/App.tsx` prüfen).

```tsx
  const applyCatalogFrom = (incoming: Catalog, mode: 'merge' | 'replace') => {
    const store = graphStore.getState()
    store.applyCatalog(
      mode === 'merge' ? mergeCatalog(store.catalog, incoming, newId) : withFreshIds(incoming, newId),
    )
  }
```

(`newId` ist `defaultIdGenerator` aus `./model/graph`, wie `App` ihn sonst nutzt; den vorhandenen Bezeichner übernehmen.)

Props des Dialogs:

```tsx
        templates={TEMPLATE_IDS.map((id) => ({ id, label: t(`types.template.${id}`) }))}
        onTemplate={(id, mode) => applyCatalogFrom(templateCatalog(id as TemplateId), mode)}
        onExportCatalog={() => downloadTextFile(catalogFileName(), serializeCatalog(catalog))}
        onImportCatalog={() => {
          // pickTextFile has to start synchronously in the click handler (browser rule)
          void pickTextFile().then((text) => {
            if (text === null) return
            const result = parseCatalogText(text, t)
            if (!result.ok) return setCatalogImportError(result.errors.join('\n'))
            setCatalogImportError(null)
            applyCatalogFrom(result.catalog, 'replace')
          })
        }}
```

Der Datei-Import eines Katalogs ersetzt den Katalog (ein Undo-Schritt). Soll er wie die Vorlage fragen, ob ergänzt wird, ist das ein späterer Wunsch und nicht Teil dieser Stufe.

- [ ] **Step 6: Tests, Typecheck, Lint, Build**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 7: Checkpoint** – nicht committen.

---

### Task 9: Hilfe, Agent-Hilfe, Doku und Abschlussprüfung

**Files:**
- Modify: `src/i18n/de.ts`, `en.ts`, `fr.ts` (Hilfeabschnitt), `src/components/HelpDialog.tsx` bzw. `helpBody.ts` (Abschnitt registrieren), `src/components/AgentHelpText.tsx`, `README.md`, `CLAUDE.md`
- Test: `src/i18n/catalog.test.ts`, `src/components/HelpDialog.test.tsx`, `src/components/AgentHelp.test.tsx`, `src/i18n/noHardcodedGerman.test.ts` (laufen lassen)

**Interfaces:** Keine neuen Funktionen; Texte und Doku.

- [ ] **Step 1: Hilfeabschnitt registrieren**

Mit `grep -rn "help.filter" src --include='*.ts' --include='*.tsx' | grep -v i18n/` die Stelle finden, an der Abschnitte aufgezählt werden, und `types` direkt hinter `filter` einfügen (dasselbe Muster, `help.types.title`/`help.types.body`).

Texte (alle drei Kataloge):

- `help.types.title` – de `Typen`, en `Types`, fr `Types`.
- `help.types.body` –
  - de: `Mit dem Button „Typen verwalten“ legst du pro Projekt fest, welche Typen es für Objekte und Verbindungen gibt: Name, Farbe, Symbol und eigene Felder (Text, Auswahl, Ja/Nein, optional als Pflichtfeld).\n- In der Sidebar wählst du den Typ eines Objekts oder einer Verbindung; seine Felder erscheinen darunter. Bei mehreren markierten Objekten setzt das Typfeld den Typ für alle.\n- Die Typfarbe färbt das Element, eine eigene Farbe hat Vorrang. Fehlende Pflichtfelder werden nur markiert, nie erzwungen.\n- Wird ein Typ gelöscht, behalten Elemente den Eintrag und zeigen ihn mit „?“ an.\n- Der Katalog gehört zum Projekt (Export, Import, Rückgängig). Vorlagen („IT-Services“, „Datenfluss-Diagramm“) kopieren Typen in den Katalog; der Katalog lässt sich auch als eigene Datei ex- und importieren.\n- Im Analysemodus ist der Katalog nur lesbar; der Typ von Objekten bleibt änderbar.`
  - en: `With the “Manage types” button you define per project which types exist for objects and connections: name, colour, icon and custom fields (text, choice, yes/no, optionally required).\n- In the sidebar you pick the type of an object or connection; its fields appear below. With several objects selected the type field sets the type for all of them.\n- The type colour tints the element; an own colour takes precedence. Missing required fields are only marked, never enforced.\n- If a type is deleted, elements keep the entry and show it with “?”.\n- The catalog belongs to the project (export, import, undo). Templates (“IT services”, “Data flow diagram”) copy types into the catalog; the catalog can also be exported and imported as a separate file.\n- In analysis mode the catalog is read-only; the type of objects can still be changed.`
  - fr: `Avec le bouton « Gérer les types », vous définissez par projet les types d’objets et de liaisons : nom, couleur, icône et champs propres (texte, choix, oui/non, éventuellement obligatoires).\n- Dans la barre latérale, vous choisissez le type d’un objet ou d’une liaison ; ses champs apparaissent en dessous. Avec plusieurs objets sélectionnés, le champ de type s’applique à tous.\n- La couleur du type teinte l’élément ; une couleur propre a la priorité. Les champs obligatoires manquants sont seulement signalés, jamais imposés.\n- Si un type est supprimé, les éléments gardent l’entrée et l’affichent avec « ? ».\n- Le catalogue appartient au projet (export, import, annulation). Les modèles (« Services informatiques », « Diagramme de flux de données ») copient des types dans le catalogue ; le catalogue peut aussi être exporté et importé comme fichier séparé.\n- En mode analyse, le catalogue est en lecture seule ; le type des objets reste modifiable.`

`HelpDialog.test.tsx` / `helpBody.test.ts` erwarten vermutlich eine feste Abschnittsanzahl oder -reihenfolge: anpassen.

- [ ] **Step 2: `AgentHelpText.tsx` pflegen**

Datei lesen (`sed -n 1,80p src/components/AgentHelpText.tsx`) und ergänzen: neues Format (Version 5, `catalog`-Schema mit Beispiel), Eintrag `type` (Typ-ID), Reihenfolge der Metadaten, Button-Beschriftung/`aria-label` „Typen verwalten“, Dialogtitel „Typen“, Katalog-Import/-Export-Beschriftungen, Verweis auf `catalog.schema.json`. `AgentHelp.test.tsx` anpassen, falls er Textstellen prüft.

- [ ] **Step 3: README und CLAUDE.md**

README: Abschnitt „Typen“ vervollständigen (Katalog, Eintrag `type`, Dialog, Vorlagen, Katalogdatei, Schema-Datei `public/catalog.schema.json`).

CLAUDE.md (Domänen-Invarianten, Abschnitt „Modell“) um einen Punkt ergänzen:

```
- **Typen** (Schema-Version 5): `GraphContent.catalog?` (`elementTypes`, `edgeTypes`; `TypeDef` mit `id` UUID, `name`, `color?`, `icon?`, `fields`), optional in `GraphContent`, im `GraphModel` und im Store immer gesetzt. Ein Objekt oder eine Verbindung trägt den Metadateneintrag `type` mit der **Typ-ID** (Gruppen/Notizen haben keinen Typ); Auswertung/Schreiben nur über `model/typing.ts` (`getTypeId`, `resolveType`, `withTypeEntry`, `withTypeDefaults`, `withFieldValue`, `resolveColor`), Katalogregeln und -operationen nur über `model/catalog.ts`. Reihenfolge: name, color, status, blockiert_grund, **type**, class, entity, version, Typfelder, freie Felder (Verbindungen: name, optional, type, Typfelder). Typfelder sind weiche Vorgaben (`missingRequired` warnt, blockiert nie); ein unbekannter Typ bleibt erhalten und wird mit „?“ gezeigt. Reservierte Feldschlüssel: `RESERVED_FIELD_KEYS`. Farbe: eigener `color` > Typfarbe > Standard. Katalogaktionen (`addType`/`updateType`/`removeType`/`applyCatalog`) sind im Analysemodus gesperrt (`structureLocked`), `setSelectionType`/`setEdgeType`/`setEdgeField` nicht. Katalogdatei: `catalogVersion: 1` (`model/catalogTemplates.ts`, `public/catalog.schema.json`); Vorlagen werden mit neuen IDs in das Projekt kopiert. Dialog `TypeCatalogDialog` (Toolbar „Typen verwalten“); bei Änderungen an Aussehen von Knoten/Kanten `svgExport.ts` mitpflegen.
```

- [ ] **Step 4: Gesamtprüfung**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: alle PASS.

- [ ] **Step 5: Browserprüfung (Dev-Server)** in **DE, EN und FR**

Checkliste:
1. Vorlage „IT-Services“ wählen; Objekte anlegen (auch in Gruppen) und Typ zuweisen; Farbe, Symbol und Typname erscheinen.
2. Pflichtfeld leer → Warnung in der Sidebar; Feldwerte tippen → Undo pro Feld.
3. Verbindung anlegen, Typ „Aufruf“ zuweisen, Felder bearbeiten, Linienfarbe.
4. Mehrfachauswahl: Typ für alle setzen (auch im Analysemodus).
5. Typ löschen (Rückfrage mit Anzahl) → Elemente zeigen „? …“; Undo stellt wieder her.
6. Filter: Schlüssel `type`, Wert = Typname findet die Objekte.
7. Export/Import (JSON-Datei und -Zwischenablage) mit Katalog; Import älterer Dateien (Version 4) liefert leeren Katalog; Reload behält alles; Import-Warnung bei ungespeicherten Änderungen unverändert.
8. SVG-Export zeigt Typfarbe und Typname.
9. Katalog exportieren/importieren, Vorlage ergänzen und ersetzen.
10. Toolbar bei **1024 px** in beiden Modi ohne Scrollen, mit Zyklen-Button; Dialog unter 720 px einspaltig.

- [ ] **Step 6: Abschluss** – Ergebnis zusammenfassen; **nicht committen**, solange der Nutzer es nicht verlangt.

---

## Self-Review (gegen den Spec)

- **Datenmodell** (Katalog, `TypeDef`, `FieldDef`, Zuordnung `type`, Regeln, Migration): Tasks 1–3. Reservierte Schlüssel, Reihenfolge, Typwechsel ohne Datenverlust, Farbpriorität, Löschen/unbekannter Typ, Umbenennen ohne Datenmigration: Tasks 1, 2, 4, 5, 7.
- **Oberfläche** (Dialog mit zwei Reitern, Vorlagen mit Ergänzen/Ersetzen, Katalog-Import/-Export, Sidebar-Feld und Typfelder, Bulk-Typwechsel, Darstellung, Filter, SVG, Texte, Hilfe): Tasks 5–9.
- **Sperren und Undo** (Katalogaktionen im Analysemodus gesperrt, Typwechsel erlaubt, ein Undo-Schritt): Task 4 mit Tests.
- **Teststrategie** des Spec ist über die Tests der Tasks 1–8 abgedeckt; Komponententests für Dialog und Sidebar in Tasks 5 und 7; i18n-Tests laufen in Task 9.
- **Bekannte Abweichung vom Spec:** `GraphContent.catalog` ist optional (siehe Global Constraints), der Spec wird in Task 3 Schritt 8 angepasst.
- **Offen gelassen, weil im Spec ausgeschlossen:** Gruppentypen, Tags, Icon-Upload, Vererbung, Linienstil pro Verbindungstyp, Feld-Umbenennungsmigration, Ablösung von `class`/`entity`/`version`.
- **Bewusst zu prüfen beim Umsetzen** (Stellen, an denen der Plan auf den vorhandenen Code verweist, den ich nicht vollständig gelesen habe): Aufbau von `SidebarEdgeForm.tsx`, die Stelle in `mapping.ts`, an der die Kantenfarbe gewählt wird, die Aufrufstelle von `toFlowNodes`/`toFlowEdges` (`Canvas.tsx` oder `App.tsx`), Struktur von `svgExport.ts`, `useNativeDialog`/`ExportDialog` als Vorlage für den Dialograhmen und die Namen der Test-Hilfen in den bestehenden Testdateien. Jeder dieser Schritte nennt den `grep`/`sed`-Befehl, mit dem die Stelle zu finden ist.
