# CLAUDE.md

Browser-only Abhängigkeitsgraph-Editor für das Release-Management (React 19 + TypeScript + Vite + @xyflow/react + zustand).
Anforderungen und Verhalten im Detail: [README.md](README.md) · Konzept: `docs/superpowers/specs/2026-10-10-release-management-design.md`.

## Befehle

```bash
npm run dev         # Dev-Server
npm test            # Vitest einmalig (jsdom); test:watch zum Entwickeln
npm run typecheck   # tsc -b
npm run lint        # oxlint
npm run build       # tsc -b && vite build -> dist/ (Unterpfad: npm run build -- --base=/release-management/)
```

Vor „fertig" immer: `npm test && npm run typecheck && npm run lint && npm run build`.

## Harte Randbedingungen

- **Kein Backend.** Alles läuft im Browser; Persistenz nur über `localStorage` und Datei-Export/-Import.
- Austauschformat ist **JSON**; Export == `localStorage`-Format == `GraphModel` (`src/model/types.ts`). Format ändern ⇒ `SCHEMA_VERSION` erhöhen, Migration in `parseModel`, README-Beispiel und `public/graph.schema.json` anpassen (`schema.test.ts` vergleicht Schema und Importer; `ajv` nur als devDependency für Tests).
- Neue Laufzeit-Abhängigkeiten nur nach Rücksprache. Node ≥ 22.12.

## Architektur (Abhängigkeiten nur in dieser Richtung)

`components` (nur Props und `useT`) · `flow`/`App` → `store` → `model` → `i18n`

- `src/model/` – **reine**, immutable Funktionen ohne React/DOM/Browser-API (Ausnahme: `crypto.randomUUID` als injizierbarer `IdGenerator`). Die gesamte Fachlogik liegt hier; neue Regeln zuerst hier mit Test.
- `src/store/` – zustand: Modell (`nodes`, `edges`, `projectName`) + UI-Zustand (Auswahl, `tool`, `mode`, …). Das Modell ist die einzige Quelle der Wahrheit; die Auswahl liegt getrennt davon.
- `src/i18n/` – **Kern, rein** (ohne React/DOM): Kataloge `de.ts` (Referenz) / `en.ts` / `fr.ts`, `createTranslate(locale)` (Platzhalter `{name}`, Plural über `_one`/`_other`), `locale.ts`, `messages.ts`; `react.ts` mit `useT`/`useLocale`/`useDocumentLanguage` – **die einzige Ausnahme** von der Richtung `→ i18n`, denn sie importiert `store/localeStore`; der i18n-Kern und das Model importieren sie nie. **Neue Texte immer in alle drei Kataloge** – `en`/`fr` sind `Catalog`-typisiert, `tsc` bricht bei fehlenden/überzähligen Schlüsseln; `catalog.test.ts` prüft Platzhalter, `noHardcodedGerman.test.ts` wacht über deutsche Texte im Code. Das Model importiert nur Typen und `createTranslate`, nie den Locale-Store.
- `src/store/localeStore.ts` – Sprache (`locale`, `setLocale`): UI-Zustand, persistiert unter `release-management.ui.v1` im Feld `locale` (neben `mode`), nie im Export, kein Undo-Schritt, Standard `de` (keine Browsersprach-Erkennung). `Root` setzt nur `<html lang>`.
- `src/storage/` – `localStorage` (immer `try/catch`), Datei-Download/-Upload.
- `src/flow/` – React-Flow-Anbindung: `mapping.ts` (Modell ↔ Flow-Knoten, Positionen relativ zur Gruppe, Eltern vor Kindern), `Canvas.tsx` (Events → Store-Aktionen).
- `src/Root.tsx` – Hash-Route (`route.ts`): `#/agent-hilfe` zeigt die statische `AgentHelp` (Hilfe für Automatisierungs-Agenten, kein Store-Zugriff); sonst die per `lazy` geladene `App`. Ändert sich Modell-Format oder Bedienung (Storage-Key, Maße, `aria-label`s), `AgentHelp` mitpflegen.
- `src/components/` – präsentational, Props-getrieben (`props.ts` ist der Vertrag), keine Fachlogik, kein Store-Zugriff (außer `useT`/`useLocale`). Button-Tooltips über `Tooltip`, Icons als Inline-SVG in `icons.tsx`.

## Domänen-Invarianten (nicht brechen)

**Sprache**
- Daten bleiben deutsch: Statuswerte (`offen | in Arbeit | blockiert | fertig`) und die Schlüssel `status`/`blockiert_grund`/`color`/`name` sind Daten, nicht Oberfläche; übersetzt werden nur Anzeigenamen (`STATUS_LABEL_KEYS` in `model/status.ts`). Der Parser erkennt nur die deutschen Werte; `SCHEMA_VERSION` unverändert.
- Meldungen im Store (Banner/Notices) sind `MessageRef`s (`{ key, params }`) und werden beim Rendern übersetzt, folgen also einem Sprachwechsel. Model-Funktionen mit Text (`parseModel`/`parseModelJson`, Markdown-Auswertung, `flow/mapping.ts`) bekommen `t: Translate` als Parameter (Standard `createTranslate('de')`).
- Standardnamen neuer Elemente (`node.defaultName`, `group.defaultName`) und die Namen des Startgraphen (`starter.*`) werden in der beim Anlegen aktiven Sprache **in die Daten geschrieben** und wechseln danach nicht mit.
- React-Flow-eigene Texte (Zoom-Buttons, Minimap, Tastaturhinweise) stammen aus `flow/ariaLabels.ts` (`ariaLabelConfig`), das Verbindungs-`ariaLabel` aus `toFlowEdges` (mit Elementnamen) – nicht aus den englischen Voreinstellungen der Bibliothek. Die statische Agent-Hilfe setzt ihren Tab-Titel selbst (`index.html` ist deutsch).
- Hilfe-Dialog: `HelpDialog` (Button „Hilfe“ in der Toolbar), Texte `help.<abschnitt>.title/body` in den Katalogen, geparst in `components/helpBody.ts`. Ändert sich die Bedienung, den Hilfetext in allen drei Sprachen mitpflegen.

**Modell**
- `id` (UUID) wird einmal erzeugt und ist nie editierbar.
- Metadaten sind eine **geordnete Liste von Paaren**; `metadata[0]` ist `name`. Immer über `normalizeMetadata` (trimmt, verwirft Einträge ohne Schlüssel, doppelte Schlüssel = Fehler, leere Werte erlaubt).
- `parentId` zeigt nur auf Gruppen, keine Zyklen; `position` ist relativ zum Elternelement, beim Umhängen bleibt die Bildschirmposition. Löschen einer Gruppe löst sie auf, der Inhalt bleibt. Eine Gruppe **wächst mit**, wenn ein Objekt/eine Gruppe hineingelegt wird (`growGroupsToFit`, `model/groupGrowth.ts`; nur beim Anlegen per Werkzeug `create` und beim Ablegen per Drag & Drop, nicht beim Verschieben innerhalb der Gruppe): nur so viel, dass `GROUP_PADDING` Abstand bleibt, nach links/oben unter Verschieben der Kinder (Bildschirmposition bleibt), und rekursiv in die Elterngruppen. Das passiert im selben `apply` (kein eigener Undo-Schritt).
- **Notiz**: `kind: 'note'` in `nodes` (kein eigenes Array), freie Haftnotiz ohne Verbindungen – `checkConnection` liefert `'note'`, `parseModel` weist Kanten zu Notizen ab, `buildEffectiveGraph` und `findByName` übergehen sie. Der Text steht im Eintrag `name` (mehrzeilig möglich), dazu nur `color` (Standard `NOTE_DEFAULT_COLOR`); weitere Metadaten bietet die Sidebar nicht an. Größe `NOTE_DEFAULT_SIZE`/`NOTE_MIN_SIZE` (Resizer wie bei Gruppen). Anlegen: Werkzeug `note` (`addNoteAt` → `placement.addNoteAtPoint`: exakt an der Klickposition, kein Ausweichen), danach **zurück zu `select`**. `NoteNode` kürzt per CSS-Zeilenbegrenzung (`--note-lines` aus der Höhe), Doppelklick-Editor ist ein `textarea` (Strg/Cmd+Enter übernimmt) über `NodeNameEditContext`. `svgExport.ts` zeichnet Notizen mit (`wrapNote`) – bei Änderungen am Aussehen mitpflegen.
- Kanten: gerichtet, keine Selbstschleife/Duplikat, nicht zwischen Gruppe und eigenem Mitglied. `reparent` fasst Kanten nicht an – vorher `wouldBreakHierarchy` prüfen. Optional `sourceHandle`/`targetHandle` (`top|right|bottom|left`; sonst `pickSides`) und `metadata` wie bei Elementen: der Eintrag `name` ist die Beschriftung (`renameEdge`, getrimmt, leer = Feld entfällt; `tidyEdgeMetadata`/`getEdgeName`). Schema-Version 3 (Version 2 liest `parseModel` unverändert, Version 1 migriert `label`) wird in `parseModel` zu `metadata.name` migriert. **Optionale Abhängigkeit** (soft dependency): Metadateneintrag `optional: ja` an der Kante (nach `name`; Auswertung/Schreiben nur über `model/softDependency.ts` bzw. `graph.setEdgeSoft`), gepunktet gezeichnet, Checkbox im `SidebarEdgeForm`; nur der kritische Pfad (`analyzeSelection`) ignoriert solche Kanten, „wartet“/Voraussetzungen/Zyklen zählen sie mit. Bestehende Verbindungen lassen sich per Ziehen der Enden an andere Konnektoren/Elemente hängen (`reconnectEdge`, Prüfung `checkReconnection`, im Analysemodus gesperrt).
- `projectName` gehört zu `GraphContent` (History, Persistenz, Export), nur `A-Z a-z 0-9 - _ .` (`isValidProjectName`); Export-Dateiname `<Name>_<JJJJ-MM-TT>_<HHmmss>.json`.
- `color` (`#rrggbb`) und `status` sind normale Metadateneinträge. Auswertung/Schreiben nur über `model/status.ts` (`getStatusInfo`, `getStatus`, `getBlockReason`, `withStatusEntry`, `withBlockReasonEntry`, `graph.setStatus`/`setBlockReason`) bzw. `getColor`, nie über `entry.key === …`. Reihenfolge: `name`, `color`, `status`, `blockiert_grund`, freie Felder.

**Status und Analyse**
- Vier Werte: `offen | in Arbeit | blockiert | fertig`. Schlüssel ohne Groß-/Kleinschreibung, fehlend/leer/unbekannt = `offen`; ein unbekannter Wert bleibt erhalten und ist sichtbar („?“, „Zu klären“). Gruppen leiten ihren Status aus den Mitgliedern ab.
- `blockiert` ist **manuell** (rote Flagge), „wartet“ (Sanduhr) ist **berechnet** (nicht fertig mit direkter nicht fertiger Voraussetzung) – nie vermischen. `blockiert_grund` gilt nur bei `blockiert` (jeder andere Status entfernt ihn im selben Schritt).
- **Fertig ist endgültig:** hinter `fertig` rechnet `releaseAnalysis` nicht weiter (kein „wartet“, kein kritischer Pfad, keine Analyse-Zyklen; leere Gruppen sind durchlässig); fertige Objekte tragen nie Flagge/Sanduhr.
- Pfeil `A -> B` = „A hängt von B ab“ (B zuerst). Kanten zu/von Gruppen gelten für alle (verschachtelten) Mitglieder. `buildEffectiveGraph` (`effectiveGraph.ts`) löst das auf und ist die **Basis aller Abhängigkeitsauswertungen** (`cycles.ts`, `releaseAnalysis.ts`, `findDependencies`) – keine eigene Gruppenauflösung daneben.
- Zyklen, Blockiert/kritischer Pfad (`analyzeProject`/`analyzeSelection`) sind **abgeleitet** (`useMemo`), nie gespeichert, kein Schema-Feld.

**Store und UI-Zustand**
- Jede Modelländerung läuft über `apply` (= Undo-Schritt); mehrteilige Gesten mit `beginGesture`/`endGesture` klammern. UI-Zustand (Auswahl, Sidebar, `mode`, `tool`, `highlight`, `analysisPanelVisible`, `revealedId`, Fokus-Request) wird nicht aufgezeichnet und nicht exportiert.
- **Modus** `build | analyze` (`model/workMode.ts`, UI-Label „Editieren | Analysieren“), pro Browser unter `release-management.ui.v1` gemerkt. Im Analysemodus sperrt der **Store** Strukturaktionen als stilles No-Op (`structureLocked`: `addNodeAt`, `connect`, Verbinden, Gruppieren/Auflösen, Löschen, Umhängen); Verschieben, Sidebar, Status im Panel, Undo/Redo-Kürzel, Export/Import bleiben. Neue Strukturaktionen müssen die Sperre beachten. Die Undo/Redo-Buttons erscheinen nur im Editiermodus.
- **Werkzeug** `select | create | connect`: mehr als `select` nur im Editiermodus; Wechsel in den Analysemodus/Import ⇒ `select`; mit `connect` ist die Auswahl eingefroren. Esc beendet zuerst das Werkzeug; Kürzel V/N/C in `App`.
- Genau eine Hervorhebung (`critical | outgoing | incoming | both | off`), nur im Analysemodus.
- **Sidebar folgt der Auswahl** (`sidebarTarget` in `model/sidebarTarget.ts`; Objekt und Kante exklusiv, mehrere ⇒ nur Hinweis). Sie übernimmt jede gültige Änderung sofort (`updateMetadata`/`renameEdge` mit normalisiertem Stand, kein Save-Button); der Entwurf wird nur bei Änderungen von außen (Undo/Redo, Import) neu geladen. Eine Feldbearbeitung ist **ein** Undo-Schritt (`onEditStart`/`onEditEnd`). Ungültige Entwürfe (doppelte Feldnamen) werden nicht übernommen (`sidebarInvalid`); nur dann fragt `ConfirmDialog` beim Schließen/Wechseln. Auswahl daher immer über die Store-Aktionen ändern (`requestSelection`, `openSidebar`, `closeSidebar`).
- **Datei-Bereich der Toolbar** ist zweizeilig: oben Export / Import / JSON einfügen (ohne Trenner), darunter rechtsbündig Sprachwahl und ganz rechts der Hilfe-Button (mit Abstand dazwischen) (`<select>` mit Eigenbezeichnungen), in beiden Modi sichtbar; die zweite Zeile hat eine feste Breite (Sprachwahl 112 px) und ist schmaler als die erste, verbreitert sie also nicht (kein Null-Breiten-Trick; bei Änderungen an der zweiten Zeile die Breite nachmessen).
- **Editierzeile** (zweite Toolbar-Zeile im Editiermodus, `.toolbar__main` > `.toolbar__edit`): Gruppieren/Auflösen | Kopieren/Einfügen | Rückgängig/Wiederholen, jede Gruppe in einem eigenen Rahmen mit runden Ecken wie die Segment-Umschalter (blauer Rand, dünne Teiler zwischen den Buttons, 16 px Abstand zwischen den Rahmen, keine Separatoren); **Löschen steht rechts von „Einfügen“** im selben Rahmen (`.toolbar__cluster`). Separator gibt es nur noch vor dem Zyklen-Button. Die Hauptspalte wächst auf die freie Breite; die Zeile darf sie dank `contain: inline-size` nicht verbreitern (sonst bricht die 1024-px-Regel).
- **Layout**: Die Sidebar bleibt im Analysemodus **gemountet, aber `hidden`** (nie aushängen: Auswahl und Entwurf bleiben erhalten). Unter 720 px liegen Sidebar/Panel als Overlay; die Toolbar muss bei 1024 px in beiden Modi ohne Scrollen passen, auch mit dem Zyklen-Button (dafür ab 1099 px: Modus-Icons ausgeblendet, 32-px-Buttons, kleinere Abstände und Button-Polster, Projektname auf 64 px gekürzt; nach jedem neuen Toolbar-Element im Browser mit Zyklen nachmessen).
- **Name inline**: Doppelklick auf den Namen eines Objekts/einer Gruppe (`NodeName`) editiert ihn direkt (Enter/Blur übernimmt, Esc verwirft; ein Undo-Schritt über `renameElement`). Nur mit Werkzeug `select`; die Komponenten kennen den Store nicht und bekommen `onRename` über `NodeNameEditContext` aus `Canvas`. Das Eingabefeld braucht `nodrag nopan` und stoppt Tastenereignisse.
- **Farbe mehrerer Elemente**: Bei Mehrfachauswahl zeigt die Sidebar zusätzlich zum Hinweis ein Farbfeld für alle markierten Objekte und Gruppen (`SidebarBulkColor`, Verbindungen haben keine Farbe). `setSelectionColor` → `graph.setColor` (ein Undo-Schritt, die Picker-Eingaben sind über `onEditStart`/`onEditEnd` geklammert); „verschieden“, wenn die Farben abweichen; Zurücksetzen entfernt den Eintrag bei allen.
- **Status mehrerer Objekte**: Bei Mehrfachauswahl zeigt die Sidebar unter dem Farbfeld ein Statusfeld nur für die markierten **Objekte** (`SidebarBulkStatus`, Gruppen zählen nicht; ohne Objekt entfällt es). `setSelectionStatus` → `graph.setStatuses` (je Objekt `setStatus`, ein Undo-Schritt, auch im Analysemodus erlaubt wie der Status im Panel); „verschieden", wenn die Status abweichen, ein gemeinsamer unbekannter Wert bleibt als Option sichtbar.
- **Verbindung auf einen Knoten ziehen**: Lässt man eine gezogene Verbindung irgendwo auf dem Körper eines Objekts/einer Gruppe los (nicht nur auf einem Konnektor), verbindet `onConnectEnd` in `Canvas` dorthin (`flow/dropTarget.ts` findet das oberste Element unter dem Zeiger, nicht den Ausgangsknoten; `connectToNode` im Store nutzt den gezogenen Quell-Konnektor und `pickSides` für die Zielseite, gesperrt im Analysemodus). Ein Treffer auf einen Konnektor läuft weiter über `onConnect`.
- **Suche**: Toolbar-Lupe „Suchen“ (beide Modi) öffnet `SearchBar` über dem Canvas. Regel in `model/search.ts`: `name` beginnt mit dem Text (`startsWith`, ohne Groß-/Kleinschreibung, Text getrimmt), Treffer in Modellreihenfolge, Objekte und Gruppen. Enter springt zum ersten Treffer (`focusNodes`), jedes weitere Enter bei unverändertem Text zum nächsten, nach dem letzten wieder zum ersten (`nextHit`); der Merker (`lastSearch` in `App`) wird beim Öffnen/Schließen zurückgesetzt. Reiner UI-Zustand, kein Undo-Schritt. Esc schließt das Feld; Tasten im Feld erreichen die Canvas-Kürzel nicht.
- **Kopieren/Einfügen** (Editieren-Modus, Toolbar „Zwischenablage“, Strg/Cmd + C/V): `copySelection` legt `clipboard` (UI-Zustand, `model/clipboard.ts`) an – die markierten Objekte/Gruppen **samt Inhalt der Gruppen, nie Verbindungen**; `paste` (gesperrt im Analysemodus, ein Undo-Schritt) erzeugt Kopien mit **neuen UUIDs** (`IdGenerator`), um `PASTE_STEP` je Wiederholung versetzt, wieder in der ursprünglichen Gruppe (die mitwächst), sonst oben auf der alten Position, und wählt die neuen obersten Kopien aus. Die Browser-Kürzel bleiben in Textfeldern und ohne Auswahl/Zwischenablage unangetastet.
- **Export**: Der Toolbar-Button „Export“ öffnet `ExportDialog` (Auswahl `json-file | svg | json-clipboard`, `ExportFormat` in `props.ts`; `App.runExport` führt aus). JSON-Datei und -Zwischenablage rufen `markExported`, das SVG nicht (nicht importierbar). Das SVG baut die reine Funktion `buildSvg` in `flow/svgExport.ts` (liegt in `flow/`, weil sie `getBezierPath` aus `@xyflow/react` nutzt, damit die Kurven mit der Fläche übereinstimmen; Textbreite geschätzt, kein DOM) – ändert sich das Aussehen der Knoten/Marken (`components.css`, `StatusMarks`), `svgExport.ts` mitpflegen. Dateiname über `exportFileName(date, name, 'json' | 'svg')`.
- **JSON einfügen**: Toolbar „JSON einfügen“ (`JsonImportDialog`: validiert in `App` vorab mit `parseModelJson`, Fehler stehen **im Dialog**, weil er den Banner verdeckt; dann `importText`). Läuft auch im Analysemodus. Labels/`aria-label`s sind Teil der `AgentHelp` – mit pflegen.
- **Import-Warnung**: `contentFingerprint` vs. `exportedFingerprint` (`markExported()` nach Export/Import, persistiert unter `release-management.lastExport.v1`). `pickTextFile` muss synchron im Klick-Handler starten (kein `await` davor).

## Konventionen

- UI-Texte stehen in den Katalogen (`de` ist die Referenz; Doku und `de`-Fehlermeldungen Deutsch); Bezeichner und Code-Kommentare **Englisch**.
- TypeScript strict, `erasableSyntaxOnly` (keine `enum`, Parameter-Properties, Namespaces). Kein Semikolon, einfache Anführungszeichen, 2 Leerzeichen.
- Kommentare nur für das *Warum*. Komponenten-Dateien exportieren nur Komponenten (react-refresh), z. B. `nodeTypes` in `nodeTypes.ts`.
- Tests neben dem Code (`*.test.ts[x]`), deterministisch (IDs über `IdGenerator`); Fachlogik test-first.

## Arbeitsweise

- Nicht committen oder pushen, solange nicht ausdrücklich verlangt.
- UI-Änderungen zusätzlich im Browser (Dev-Server) prüfen, auch in **EN und FR** (Beschriftungen länger, Toolbar bei 1024 px): Anlegen (auch in Gruppen), Verbinden, Sidebar (Live-Übernahme, Undo pro Feld), Gruppieren, Reload, Export, Import mit Rückfrage.
