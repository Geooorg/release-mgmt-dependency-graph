# Rahmen-Auswahl und Metadaten-Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Rahmen-Werkzeug (`box`) zur Mehrfachauswahl und ein Filter-Button, der Objekte/Gruppen mit `metadata[key] == value` in der Sidebar auflistet.

**Architecture:** Fachregel `findByMetadata` rein in `src/model/filter.ts`; `box` ist ein weiterer `Tool`-Wert, den `Canvas` auf React Flows `selectionOnDrag` abbildet. Der Filter ist lokaler UI-Zustand in `App` (wie `searchOpen`), Treffer werden per `useMemo` abgeleitet; `Sidebar` rendert bei offenem Filter eine Trefferliste.

**Tech Stack:** React 19, TypeScript strict, @xyflow/react, zustand, Vitest (jsdom).

Spec: `docs/superpowers/specs/2026-10-12-rahmenauswahl-und-filter-design.md`

## Global Constraints

- **Nicht committen oder pushen** (CLAUDE.md), daher gibt es hier keine Commit-Schritte.
- Keine neuen Laufzeit-Abhängigkeiten, kein Schema-/`SCHEMA_VERSION`-Wechsel.
- Neue Texte in **alle drei** Kataloge `src/i18n/{de,en,fr}.ts` (`en`/`fr` sind `Catalog`-typisiert); Bezeichner/Kommentare Englisch; kein Semikolon, einfache Anführungszeichen, 2 Leerzeichen; Kommentare nur für das Warum.
- `components/` ohne Store-Zugriff (nur Props und `useT`); `model/` rein.
- Verifikation am Ende: `npm test && npm run typecheck && npm run lint && npm run build`, dazu Browser-Prüfung (DE/EN/FR, 1024 px, Analysemodus mit Filter).

## Dateiübersicht

- Create: `src/model/filter.ts`, `src/model/filter.test.ts`, `src/components/FilterBar.tsx`, `src/components/FilterBar.test.tsx`, `src/components/SidebarFilterResults.tsx`, `src/components/SidebarFilterResults.test.tsx`
- Modify: `src/model/workMode.ts`, `src/components/{props.ts,Toolbar.tsx,ToolHint.tsx,Sidebar.tsx,icons.tsx,components.css,AgentHelpText.tsx,helpBody.ts?}`, `src/flow/Canvas.tsx`, `src/App.tsx`, `src/i18n/{de,en,fr}.ts`, Tests (`Toolbar.test.tsx`, `ToolHint.test.tsx`, `Sidebar.test.tsx`, `App.test.tsx`, `graphStore.test.ts`), `README.md`, `CLAUDE.md`

---

### Task 1: Fachregel `findByMetadata`

**Files:** Create `src/model/filter.ts`, `src/model/filter.test.ts`

**Interfaces:**
- Produces: `findByMetadata(nodes: readonly ModelNode[], key: string, value: string): FilterHit[]` mit `interface FilterHit { id: string; key: string; value: string }` (`key`/`value` = der gefundene gespeicherte Eintrag, für die Anzeige).

- [ ] **Step 1: Failing test** (`filter.test.ts`; Knoten über das Testmuster aus `search.test.ts` bauen – dort nachsehen, wie `ModelNode`s erzeugt werden)

```ts
import { describe, expect, it } from 'vitest'
import { findByMetadata } from './filter'
import type { ModelNode } from './types'

const node = (id: string, metadata: [string, string][], kind: ModelNode['kind'] = 'node'): ModelNode =>
  ({ id, kind, position: { x: 0, y: 0 }, metadata: metadata.map(([key, value]) => ({ key, value })) }) as ModelNode

describe('findByMetadata', () => {
  const nodes = [
    node('a', [['name', 'A'], ['team', 'Backend']]),
    node('b', [['name', 'B'], ['team', 'Backend Core']]),
    node('g', [['name', 'G'], ['Team', ' backend ']], 'group'),
    node('n', [['name', 'N'], ['team', 'Backend']], 'note'),
  ]

  it('matches key and value completely, ignoring case and surrounding spaces', () => {
    expect(findByMetadata(nodes, ' TEAM ', 'backend').map((h) => h.id)).toEqual(['a', 'g'])
  })
  it('does not match substrings', () => {
    expect(findByMetadata(nodes, 'team', 'back')).toEqual([])
  })
  it('skips notes and keeps model order', () => {
    expect(findByMetadata(nodes, 'team', 'Backend').map((h) => h.id)).toEqual(['a', 'g'])
  })
  it('finds nothing for an empty key, but an empty value matches empty entries', () => {
    expect(findByMetadata(nodes, '  ', 'x')).toEqual([])
    expect(findByMetadata([node('e', [['name', 'E'], ['tag', '']])], 'tag', '')).toEqual([
      { id: 'e', key: 'tag', value: '' },
    ])
  })
  it('reports the stored entry', () => {
    expect(findByMetadata(nodes, 'team', 'backend')[1]).toEqual({ id: 'g', key: 'Team', value: ' backend ' })
  })
})
```

- [ ] **Step 2:** `npx vitest run src/model/filter.test.ts` → FAIL (Modul fehlt).
- [ ] **Step 3: Implementation**

```ts
import { normalizeQuery } from './search'
import type { ModelNode } from './types'

export interface FilterHit {
  id: string
  /** The stored entry that matched, as written (shown in the result list). */
  key: string
  value: string
}

/**
 * Objects and groups (not notes) that have a metadata entry whose key and value both equal the given
 * ones completely — trimmed, case-insensitive, no substring match — in model order. An empty key finds nothing.
 */
export function findByMetadata(nodes: readonly ModelNode[], key: string, value: string): FilterHit[] {
  const wantedKey = normalizeQuery(key)
  if (wantedKey === '') return []
  const wantedValue = normalizeQuery(value)
  const hits: FilterHit[] = []
  for (const node of nodes) {
    if (node.kind === 'note') continue
    const entry = node.metadata.find(
      (e) => normalizeQuery(e.key) === wantedKey && normalizeQuery(e.value) === wantedValue,
    )
    if (entry) hits.push({ id: node.id, key: entry.key, value: entry.value })
  }
  return hits
}
```

- [ ] **Step 4:** Test erneut → PASS.

---

### Task 2: Werkzeug `box`

**Files:** Modify `src/model/workMode.ts`, `src/flow/Canvas.tsx`, `src/components/{Toolbar.tsx,ToolHint.tsx,icons.tsx}`, `src/App.tsx` (`TOOL_KEYS`), `src/i18n/{de,en,fr}.ts`, Tests `graphStore.test.ts`, `Toolbar.test.tsx`, `ToolHint.test.tsx`, `App.test.tsx`

**Interfaces:** Produces `Tool` mit `'box'`; Icon `BoxSelectIcon({ size?: number })`; i18n-Keys `toolbar.tool.box.label|name|title`, `toolHint.box`.

- [ ] **Step 1: Tests schreiben** (jeweils an bestehenden Mustern der Dateien orientieren):
  - `graphStore.test.ts`: `setTool('box')` im Editiermodus ⇒ `tool === 'box'`; `setMode('analyze')` und `importText` setzen zurück auf `select`; im Analysemodus bleibt `setTool('box')` wirkungslos.
  - `Toolbar.test.tsx`: Button mit Name „Rahmen-Auswahl“ (de) im Editiermodus, `aria-pressed` bei `tool="box"`, Klick ruft `onToolChange('box')`.
  - `ToolHint.test.tsx`: `tool="box"` zeigt den Text `toolHint.box`.
  - `App.test.tsx`: Taste `r` setzt Werkzeug `box`.
- [ ] **Step 2:** `npx vitest run` der vier Dateien → FAIL.
- [ ] **Step 3: Implementieren**
  - `workMode.ts`: `export type Tool = 'select' | 'create' | 'note' | 'connect' | 'box'`; Doc-Kommentar um `box` ergänzen („drag a frame on free space to select what it encloses, then back to `select`“). Prüfen, ob `setTool`/Reset im Store (`graphStore.ts:480`, `:617`, `:639`) schon generisch sind – ja, keine Änderung nötig.
  - `icons.tsx`: `BoxSelectIcon` (gestricheltes Rechteck + kleiner Cursor):
    ```tsx
    export function BoxSelectIcon({ size }: { size?: number }) {
      return (
        <Icon size={size}>
          <rect x="3" y="3" width="14" height="14" rx="1.5" strokeDasharray="3 2.5" />
          <path d="m13 13 7 3-3 1-1 3z" />
        </Icon>
      )
    }
    ```
  - `Toolbar.tsx`: Eintrag in `TOOLS` ergänzen (nach `note`): `{ value: 'box', labelKey: 'toolbar.tool.box.label', nameKey: 'toolbar.tool.box.name', titleKey: 'toolbar.tool.box.title', icon: <BoxSelectIcon size={ICON_SIZE} />, shortcut: 'R' }` und Import.
  - `App.tsx`: `TOOL_KEYS` um `r: 'box'` erweitern (bestehende Definition ansehen).
  - `ToolHint.tsx`: `if (tool === 'box') return t('toolHint.box')`.
  - `Canvas.tsx`: `SelectionMode` importieren; am `<ReactFlow>`:
    ```tsx
    selectionOnDrag={tool === 'box'}
    selectionMode={SelectionMode.Full}
    panOnDrag={tool === 'box' ? [1, 2] : true}
    onSelectionEnd={() => {
      if (graphStore.getState().tool === 'box') graphStore.getState().setTool('select')
    }}
    ```
    und `flow--create` bleibt unverändert.
  - Kataloge (de als Referenz): `'toolbar.tool.box.label': 'Rahmen'`, `'toolbar.tool.box.name': 'Rahmen-Auswahl'`, `'toolbar.tool.box.title': 'Mehrere Elemente auswählen: Auf der freien Fläche einen Rahmen aufziehen – alles, was er ganz umschließt, wird ausgewählt.'`, `'toolHint.box': 'Auf freier Fläche einen Rahmen aufziehen …'`; en: `Frame` / `Frame selection` / … ; fr: `Cadre` / `Sélection par cadre` / …
- [ ] **Step 4:** Tests → PASS; `npm run typecheck`.

---

### Task 3: Filter-Leiste und Toolbar-Button

**Files:** Create `src/components/FilterBar.tsx`, `FilterBar.test.tsx`; Modify `props.ts`, `Toolbar.tsx`, `Toolbar.test.tsx`, `icons.tsx`, `components.css`, `src/i18n/{de,en,fr}.ts`

**Interfaces:**
- Produces: `FilterBarProps { keyText: string; valueText: string; count: number; onKeyChange(v: string): void; onValueChange(v: string): void; onClose(): void }`; `ToolbarProps.filterOpen: boolean`, `ToolbarProps.onToggleFilter: () => void`; `FilterIcon`; i18n-Keys `toolbar.section.filter`, `toolbar.filter`, `toolbar.filter.title`, `filter.label`, `filter.key`, `filter.value`, `filter.keyPlaceholder`, `filter.valuePlaceholder`, `filter.count_one|_other` (`{count} Treffer` / `1 Treffer`), `filter.none`, `filter.close`.

- [ ] **Step 1: Tests** – `FilterBar.test.tsx`: rendert zwei Felder (Labels `filter.key`/`filter.value`), Tippen ruft `onKeyChange`/`onValueChange`, Esc im Feld ruft `onClose` (und der Event erreicht `window` nicht), `count` 0 mit Schlüssel ⇒ „Keine Treffer“. `Toolbar.test.tsx`: Button „Filtern“ steht **vor** dem Such-Button (DOM-Reihenfolge), `aria-pressed={filterOpen}`, Klick ⇒ `onToggleFilter`, in beiden Modi vorhanden.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementieren**
  - `FilterIcon` (Trichter): `<path d="M3 5h18l-7 8v6l-4-2v-4z" />`.
  - `FilterBar` nach Vorbild `SearchBar` (Fokus auf Schlüsselfeld beim Mounten, `onKeyDown` mit `event.stopPropagation()` und Esc ⇒ `onClose`), Container `className="filter-bar" role="search"` mit `aria-label={t('filter.label')}`; Status `role="status"` zeigt `t.plural('filter.count', count)` bzw. `t('filter.none')` (nur wenn Schlüssel nicht leer – dafür bekommt die Leiste `keyText` und prüft `keyText.trim() !== ''`).
  - CSS in `components.css`: `.filter-bar` wie `.search-bar` (gleiche Position; beide schließen sich gegenseitig, daher kein Überlapp), Eingabefelder `.filter-bar__input` mit fester Breite ~140 px.
  - `Toolbar.tsx`: vor `<Section label={t('toolbar.section.search')}>` neue `Section label={t('toolbar.section.filter')}` mit `Tooltip` + Button `className="ui-button ui-button--tool"`, `aria-label={t('toolbar.filter')}`, `aria-pressed={filterOpen}`, `onClick={onToggleFilter}`, `<FilterIcon />`. Props aufnehmen.
  - Kataloge: de `toolbar.filter: 'Filtern'`, `toolbar.filter.title: 'Objekte nach einem Metadatenfeld filtern (Schlüssel = Wert) und in der Seitenleiste auflisten'`, `filter.label: 'Nach Metadaten filtern'`, `filter.key: 'Schlüssel'`, `filter.value: 'Wert'`, `filter.close: 'Filter schließen'`, `filter.count_one: '{count} Treffer'`, `filter.count_other: '{count} Treffer'`, `filter.none: 'Keine Treffer'`; en/fr analog (`Filter`/`Filtrer`, „match“/„résultat(s)“; Plural-Muster aus vorhandenen `_one`/`_other`-Einträgen übernehmen).
- [ ] **Step 4:** Tests → PASS. `catalog.test.ts` und `npm run typecheck` müssen grün bleiben.

---

### Task 4: Trefferliste in der Sidebar und App-Verdrahtung

**Files:** Create `src/components/SidebarFilterResults.tsx`, `SidebarFilterResults.test.tsx`; Modify `props.ts`, `Sidebar.tsx`, `Sidebar.test.tsx`, `src/App.tsx`, `App.test.tsx`, `components.css`, Kataloge

**Interfaces:**
- Consumes: `findByMetadata`/`FilterHit` (Task 1), `FilterBarProps`/`ToolbarProps` (Task 3).
- Produces: `FilterResult { id: string; name: string; color?: string; key: string; value: string }`; `SidebarFilterResultsProps { results: FilterResult[]; selectedIds: readonly string[]; hasQuery: boolean; onPick(id: string): void; onClose(): void }`; `SidebarProps.filter?: { results: FilterResult[]; selectedIds: readonly string[]; hasQuery: boolean; onPick(id: string): void; onClose(): void }` (vorhanden ⇒ Filter offen). Keys `filter.results.title`, `filter.results.hint` (Hinweis ohne Eingabe), `filter.results.none`, `filter.results.pick` (Aria für Zeile: „{name} auswählen“).

- [ ] **Step 1: Tests**
  - `SidebarFilterResults.test.tsx`: zeigt je Treffer Name und `key = value`; Klick auf eine Zeile ruft `onPick(id)`; ausgewählte Zeile hat `aria-current="true"`; `results=[]` mit `hasQuery` ⇒ „Keine Treffer“, ohne `hasQuery` ⇒ Hinweis; Schließen-Button ruft `onClose`.
  - `Sidebar.test.tsx`: mit `filter`-Prop wird die Liste statt Formular/Mehrfachauswahl gerendert, auch bei `element=null` und `selectionCount=0`; mit `hidden` und `filter` bleibt `hidden` unverändert (Steuerung durch App).
  - `App.test.tsx`: Filter-Button öffnet die Leiste; Eingabe `team`/`Backend` listet passende Elemente in der Sidebar; Klick auf Treffer wählt ihn aus (Store `selectedNodeIds`); Esc/Schließen blendet die Liste aus; im Analysemodus ist die Sidebar bei offenem Filter nicht `hidden`, nach Schließen wieder `hidden`; Öffnen des Filters schließt die Suche und umgekehrt.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementieren**
  - `SidebarFilterResults.tsx`: `<div className="sidebar__form">` mit Header (Titel `filter.results.title` + Schließen-Button `common.close`), Zähler (`t.plural('filter.count', results.length)` wenn `hasQuery`), `<ul className="filter-results">` mit je `<li><button type="button" className="filter-results__item" aria-current={selected || undefined} aria-label={t('filter.results.pick', { name })} onClick={() => onPick(id)}>` — Farbpunkt `<span className="filter-results__dot" style={{ background: color ?? 'var(--accent)' }} />` (Variablenname in `theme.css` prüfen), Name, `<span className="filter-results__entry">{key} = {value}</span>`.
  - `Sidebar.tsx`: am Anfang von `Sidebar`: `if (filter) return <aside className="sidebar" aria-label={t('sidebar.label')} hidden={hidden}><SidebarFilterResults {...filter} /></aside>`. Wichtig: Das Formular darf dabei **nicht aus dem Baum fallen, wenn es einen ungültigen Entwurf hat** – es wird beim Öffnen des Filters ohnehin ersetzt; `onInvalidChange(false)` feuert über das bestehende Unmount-Verhalten (vor der Umsetzung `useSidebarEffects.ts` lesen und prüfen, dass `sidebarInvalid` dann zurückgesetzt wird; falls nicht, Filter-Öffnen im Store über die vorhandene Rückfrage laufen lassen bzw. Öffnen blockieren, solange `sidebarInvalid` gilt).
  - `App.tsx`:
    ```tsx
    const [filterOpen, setFilterOpen] = useState(false)
    const [filterKey, setFilterKey] = useState('')
    const [filterValue, setFilterValue] = useState('')
    const filterHits = useMemo(
      () => (filterOpen ? findByMetadata(nodes, filterKey, filterValue) : []),
      [filterOpen, nodes, filterKey, filterValue],
    )
    const filterProp = useMemo(() => (filterOpen ? { results: filterHits.map(...), selectedIds: selectedNodeIds, hasQuery: filterKey.trim() !== '', onPick: (id) => graphStore.getState().focusNodes([id]), onClose: closeFilter } : undefined), [...])
    ```
    - `results` bildet `FilterHit` auf `{ id, name: displayName(node), color: getColor(node.metadata), key, value }` ab (vorhandene Helfer `displayName`/`getColor` in `App.tsx` nutzen).
    - `toggleFilter`: schließt die Suche (`setSearchOpen(false)` + `lastSearch` zurücksetzen) wenn der Filter öffnet; `toggleSearch` schließt den Filter, wenn die Suche öffnet. Der Filtertext bleibt beim Schließen erhalten (Merkhilfe), die Trefferliste nicht.
    - Esc-Kette im `onKeyDown`: Filter wird vom Feld selbst geschlossen (Tasten im Feld erreichen `window` nicht); zusätzlich im globalen Esc: erst Werkzeug, dann **Filter schließen**, dann Panel, dann Sidebar – dafür Esc-Zweig über eine Ref auf `filterOpen` (analog zu `lastSearch`) oder, einfacher, die Filterleiste fängt Esc selbst und der globale Zweig bleibt unverändert (Entscheidung: nur die Leiste schließt per Esc).
    - `<Sidebar hidden={analyzing && !filterOpen} filter={filterProp} …/>`; `<FilterBar … />` neben `SearchBar` im `<main className="canvas">`; Toolbar-Props `filterOpen`/`onToggleFilter`.
    - Auswahl aus der Liste ist Selektion, keine Strukturaktion: im Analysemodus erlaubt (`focusNodes` ist nicht gesperrt).
  - Kataloge ergänzen (de/en/fr).
- [ ] **Step 4:** Tests → PASS.

---

### Task 5: Hilfe, Doku, Gesamtprüfung

**Files:** Modify `src/i18n/{de,en,fr}.ts` (Hilfeabschnitte `help.*`), `src/components/AgentHelpText.tsx` (+ Test), `README.md`, `CLAUDE.md`

- [ ] **Step 1:** Hilfetext in allen drei Sprachen: neuer Abschnitt `help.filter.title/body` (Filter: Schlüssel/Wert, vollständig, ohne Groß-/Kleinschreibung, Liste in der Seitenleiste) und Ergänzung im Abschnitt zum Auswählen um „Rahmen (R)“. Format der Abschnitte aus `helpBody.ts`/`helpBody.test.ts` übernehmen (Tests prüfen Struktur und Platzhalter).
- [ ] **Step 2:** `AgentHelpText.tsx`: neue `aria-label`s nennen („Rahmen-Auswahl“, „Filtern“, „Nach Metadaten filtern“, Felder „Schlüssel“/„Wert“) – Test `AgentHelp.test.tsx` anpassen.
- [ ] **Step 3:** `README.md` (Bedienung: Rahmen-Werkzeug, Filter) und `CLAUDE.md` (Invarianten: Werkzeug `box` + Rückkehr zu `select`; Filter als UI-Zustand in `App`, Sidebar-Sichtbarkeit `hidden={analyzing && !filterOpen}`, Suche/Filter schließen sich gegenseitig, Regel in `model/filter.ts`).
- [ ] **Step 4:** `npm test && npm run typecheck && npm run lint && npm run build` → alles grün.
- [ ] **Step 5: Browser-Prüfung** (`preview_start`, Dev-Server): Rahmen ziehen (auch über Gruppen/Notizen, Rückkehr zu `select`, Mehrfachauswahl-Sidebar); Filter mit `status`/`in Arbeit` und einem freien Feld, Klick auf Treffer, Schließen; Analysemodus mit offenem Filter (Sidebar sichtbar/danach versteckt); Toolbar bei 1024 px in beiden Modi ohne Scrollen (auch mit Zyklen-Button), in DE/EN/FR; Overlay < 720 px.

---

## Self-Review

- **Spec-Abdeckung:** Rahmen (Task 2), Regel (Task 1), Button vor Suche + Leiste (Task 3), Sidebar-Liste, Analysemodus-Sichtbarkeit, Such/Filter-Exklusivität (Task 4), Tests/Doku/Browser (Task 5). Props-Vertrag der Spec ist in Task 3/4 konkretisiert (Sidebar bekommt ein optionales `filter`-Objekt statt mehrerer loser Props).
- **Offene Prüfpunkte bei der Umsetzung (keine Platzhalter, sondern vorab zu lesende Stellen):** Ungültiger Sidebar-Entwurf beim Öffnen des Filters (`useSidebarEffects.ts`), CSS-Variablennamen in `theme.css`, bestehendes `TOOL_KEYS` und `displayName` in `App.tsx`.
