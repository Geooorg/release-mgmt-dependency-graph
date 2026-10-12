# Rahmen-Auswahl und Metadaten-Filter – Design

Stand: 2026-10-12 · Status: vom Nutzer freigegeben, noch nicht implementiert.

Zwei unabhängige, kleine Erweiterungen der Toolbar: ein Werkzeug zum Auswählen per Rahmen und ein Filter, der alle Objekte/Gruppen mit `metadata[key] == value` in der Sidebar auflistet.

## 1. Rahmen-Werkzeug (`box`)

### Verhalten
- `Tool` (`model/workMode.ts`) erhält den Wert `box` (`select | create | connect | note | box`). Er ist wie alle Werkzeuge außer `select` nur im Editiermodus möglich; Wechsel in den Analysemodus oder Import setzt auf `select` (bestehende Regel, `box` muss dort mit abgedeckt sein).
- Toolbar: fünfter Eintrag in `TOOLS` (`toolbar.tool.box.label/name/title`), eigenes Icon `BoxSelectIcon` in `icons.tsx`, Kürzel **R** (Tooltip, Registrierung in `TOOL_KEYS` in `App`).
- `Canvas`: bei `tool === 'box'` `selectionOnDrag` und `panOnDrag={[1, 2]}` (Ziehen auf leerer Fläche zeichnet den Rahmen statt zu verschieben; mittlere/rechte Maustaste verschiebt weiter). `selectionMode={SelectionMode.Full}`: nur vollständig umschlossene Elemente werden gewählt.
- Gewählt werden Objekte, Gruppen und Notizen (alle Knoten), keine Verbindungen. Die Auswahl **ersetzt** die bisherige. Die Mehrfachauswahl-Sidebar (Farbe/Status) greift wie bei jeder Mehrfachauswahl.
- Nach dem Loslassen (`onSelectionEnd`) setzt `Canvas` das Werkzeug zurück auf `select` (wie bei der Notiz). Esc beendet das Werkzeug ebenfalls (bestehende Esc-Logik).
- `ToolHint` zeigt einen Hinweistext für `box`. Das Canvas-Cursor-Verhalten bleibt Standard (Fadenkreuz optional per CSS-Klasse, nicht Pflicht).

### Nicht-Ziele
- Kein Rahmen im Analysemodus, kein Teilüberdeckungs-Modus, keine Shift-Erweiterung der Auswahl.

## 2. Metadaten-Filter

### Regel (`model/filter.ts`, rein, test-first)
`findByMetadata(nodes: readonly ModelNode[], key: string, value: string): string[]`
- IDs der Objekte und Gruppen in Modellreihenfolge; Notizen werden übergangen (Verbindungen nicht Teil des Umfangs).
- Treffer: Es gibt einen Metadateneintrag, dessen Schlüssel **und** Wert nach `trim` und ohne Groß-/Kleinschreibung vollständig gleich `key`/`value` sind (kein Teilstring).
- Leerer (nach `trim`) Schlüssel ⇒ keine Treffer. Leerer Wert ⇒ Einträge mit leerem Wert.
- Verglichen werden gespeicherte Einträge. Ein fehlender `status` zählt nicht als „offen“; der abgeleitete Gruppenstatus wird nicht gefunden.
- Zusätzlich liefert das Modul eine Normalisierung analog `normalizeQuery`, damit Suche und Filter dieselbe Konvention nutzen.

### UI
- Toolbar: neuer Button „Filter“ (`FilterIcon`, `aria-pressed={filterOpen}`, Tooltip) in einer **eigenen `Section` direkt vor der Suche**, in beiden Modi. Textschlüssel `toolbar.filter`, `toolbar.filter.title`, `toolbar.section.filter`.
- `FilterBar` (neue Komponente neben `SearchBar`, über dem Canvas): zwei Felder Schlüssel/Wert, Live-Auswertung, Trefferzähler (Plural `_one`/`_other`), „Keine Treffer“-Zustand, Schließen-Button. Esc schließt; Tasten in den Feldern erreichen die Canvas-Kürzel nicht (`stopPropagation` wie `SearchBar`). Suche und Filter schließen sich gegenseitig: Öffnen des einen schließt den anderen (beide nutzen dieselbe Position über dem Canvas); die Suchregel selbst ändert sich nicht.
- Zustand (`filterOpen`, `filterKey`, `filterValue`) ist lokaler UI-Zustand in `App` wie `searchOpen`: kein Undo-Schritt, kein Export, keine Persistenz. Treffer werden per `useMemo` aus `nodes` + Eingaben abgeleitet, nie gespeichert.
- Sidebar: Solange der Filter offen ist, rendert `Sidebar` statt Formular/Hinweis die neue `SidebarFilterResults`:
  - Zeile je Treffer: Farbpunkt (`getColor`), Name, `Schlüssel = Wert` (der gefundene Eintrag).
  - Klick ⇒ `requestSelection` + `focusNodes` (Auswahl und Sprung); die Liste bleibt sichtbar, die Zeile des ausgewählten Treffers ist markiert (`aria-current`).
  - Kopfzeile mit „n Treffer“; ohne Treffer bzw. ohne Eingabe ein Hinweistext.
  - Zum Bearbeiten wird der Filter geschlossen; dann zeigt die Sidebar das Formular des ausgewählten Elements.
  - Ein offener ungültiger Sidebar-Entwurf (`sidebarInvalid`) wird beim Öffnen des Filters nicht angetastet; die bestehende Rückfrage bei Auswahlwechsel (`requestSelection`) bleibt maßgeblich.
- **Analysemodus:** Die Sidebar ist normalerweise `hidden` (gemountet, nie ausgehängt). Bei offenem Filter wird sie eingeblendet: `hidden={analyzing && !filterOpen}`; sie zeigt dort ausschließlich die Trefferliste. Nach dem Schließen ist sie wieder versteckt. Unter 720 px erscheint sie wie sonst als Overlay. Auswahl über die Liste (kein Strukturaktion) ist im Analysemodus erlaubt.

### Props-Vertrag (`components/props.ts`)
- `ToolbarProps`: `filterOpen`, `onToggleFilter`.
- `FilterBarProps`: `keyText`, `valueText`, `count`, `onKeyChange`, `onValueChange`, `onClose`.
- `SidebarProps`: `filterResults: { id, name, color?, key, value }[] | null` (`null` = Filter zu) und `selectedIds`, `onPickResult(id)`.

## 3. Tests und Pflege

- `model/filter.test.ts` (Groß-/Kleinschreibung, trim, kein Teilstring, Notizen/leere Eingaben, Reihenfolge, Gruppen).
- Store: `setTool('box')` und Rücksetzen bei Moduswechsel/Import.
- Komponenten: `Toolbar` (Rahmen- und Filter-Button, Tooltip/Kürzel, `aria-pressed`), `FilterBar`, `SidebarFilterResults` (Klick, Markierung, leere Zustände), `Sidebar` (Liste statt Formular, Sichtbarkeit im Analysemodus), `App` (Kürzel R).
- Alle neuen Texte in `de`, `en`, `fr` (`Catalog`-Typisierung, `catalog.test.ts`, `noHardcodedGerman.test.ts`).
- Mitpflegen: Hilfetext (alle drei Sprachen), `AgentHelp`/`AgentHelpText` (neue `aria-label`s), `README.md`, `CLAUDE.md` (Werkzeug `box`, Filter-Abschnitt).
- Vor „fertig“: `npm test && npm run typecheck && npm run lint && npm run build`; zusätzlich im Browser prüfen (DE/EN/FR, Toolbar bei 1024 px in beiden Modi, Analysemodus mit offenem Filter, Overlay < 720 px, Rahmenwahl mit Gruppen/Notizen).
- Datenformat unverändert: keine `SCHEMA_VERSION`-Änderung, keine neue Abhängigkeit.
