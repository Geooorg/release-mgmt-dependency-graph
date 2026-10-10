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

`components` (nur Props) · `flow`/`App` → `store` → `model`

- `src/model/` – **reine**, immutable Funktionen ohne React/DOM/Browser-API (Ausnahme: `crypto.randomUUID` als injizierbarer `IdGenerator`). Die gesamte Fachlogik liegt hier; neue Regeln zuerst hier mit Test.
- `src/store/` – zustand: Modell (`nodes`, `edges`, `projectName`) + UI-Zustand (Auswahl, `tool`, `mode`, …). Das Modell ist die einzige Quelle der Wahrheit; die Auswahl liegt getrennt davon.
- `src/storage/` – `localStorage` (immer `try/catch`), Datei-Download/-Upload.
- `src/flow/` – React-Flow-Anbindung: `mapping.ts` (Modell ↔ Flow-Knoten, Positionen relativ zur Gruppe, Eltern vor Kindern), `Canvas.tsx` (Events → Store-Aktionen).
- `src/Root.tsx` – Hash-Route (`route.ts`): `#/agent-hilfe` zeigt die statische `AgentHelp` (Hilfe für Automatisierungs-Agenten, kein Store-Zugriff); sonst die per `lazy` geladene `App`. Ändert sich Modell-Format oder Bedienung (Storage-Key, Maße, `aria-label`s), `AgentHelp` mitpflegen.
- `src/components/` – präsentational, Props-getrieben (`props.ts` ist der Vertrag), keine Fachlogik, kein Store-Zugriff. Button-Tooltips über `Tooltip`, Icons als Inline-SVG in `icons.tsx`.

## Domänen-Invarianten (nicht brechen)

**Modell**
- `id` (UUID) wird einmal erzeugt und ist nie editierbar.
- Metadaten sind eine **geordnete Liste von Paaren**; `metadata[0]` ist `name`. Immer über `normalizeMetadata` (trimmt, verwirft Einträge ohne Schlüssel, doppelte Schlüssel = Fehler, leere Werte erlaubt).
- `parentId` zeigt nur auf Gruppen, keine Zyklen; `position` ist relativ zum Elternelement, beim Umhängen bleibt die Bildschirmposition. Löschen einer Gruppe löst sie auf, der Inhalt bleibt. Eine Gruppe **wächst mit**, wenn ein Objekt/eine Gruppe hineingelegt wird (`growGroupsToFit`, `model/groupGrowth.ts`; nur beim Anlegen per Werkzeug `create` und beim Ablegen per Drag & Drop, nicht beim Verschieben innerhalb der Gruppe): nur so viel, dass `GROUP_PADDING` Abstand bleibt, nach links/oben unter Verschieben der Kinder (Bildschirmposition bleibt), und rekursiv in die Elterngruppen. Das passiert im selben `apply` (kein eigener Undo-Schritt).
- Kanten: gerichtet, keine Selbstschleife/Duplikat, nicht zwischen Gruppe und eigenem Mitglied. `reparent` fasst Kanten nicht an – vorher `wouldBreakHierarchy` prüfen. Optional `sourceHandle`/`targetHandle` (`top|right|bottom|left`; sonst `pickSides`) und `metadata` wie bei Elementen: der Eintrag `name` ist die Beschriftung (`renameEdge`, getrimmt, leer = Feld entfällt; `tidyEdgeMetadata`/`getEdgeName`). Schema-Version 2; Version 1 (`label`) wird in `parseModel` zu `metadata.name` migriert. Bestehende Verbindungen lassen sich per Ziehen der Enden an andere Konnektoren/Elemente hängen (`reconnectEdge`, Prüfung `checkReconnection`, im Analysemodus gesperrt).
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
- **Layout**: Die Sidebar bleibt im Analysemodus **gemountet, aber `hidden`** (nie aushängen: Auswahl und Entwurf bleiben erhalten). Unter 720 px liegen Sidebar/Panel als Overlay; die Toolbar muss bei 1024 px in beiden Modi ohne Scrollen passen, auch mit dem Zyklen-Button (dafür ab 1099 px: Modus-Icons ausgeblendet, 32-px-Buttons, kleinere Abstände und Button-Polster, Projektname auf 64 px gekürzt; nach jedem neuen Toolbar-Element im Browser mit Zyklen nachmessen).
- **Name inline**: Doppelklick auf den Namen eines Objekts/einer Gruppe (`NodeName`) editiert ihn direkt (Enter/Blur übernimmt, Esc verwirft; ein Undo-Schritt über `renameElement`). Nur mit Werkzeug `select`; die Komponenten kennen den Store nicht und bekommen `onRename` über `NodeNameEditContext` aus `Canvas`. Das Eingabefeld braucht `nodrag nopan` und stoppt Tastenereignisse.
- **Farbe mehrerer Elemente**: Bei Mehrfachauswahl zeigt die Sidebar zusätzlich zum Hinweis ein Farbfeld für alle markierten Objekte und Gruppen (`SidebarBulkColor`, Verbindungen haben keine Farbe). `setSelectionColor` → `graph.setColor` (ein Undo-Schritt, die Picker-Eingaben sind über `onEditStart`/`onEditEnd` geklammert); „verschieden“, wenn die Farben abweichen; Zurücksetzen entfernt den Eintrag bei allen.
- **Verbindung auf einen Knoten ziehen**: Lässt man eine gezogene Verbindung irgendwo auf dem Körper eines Objekts/einer Gruppe los (nicht nur auf einem Konnektor), verbindet `onConnectEnd` in `Canvas` dorthin (`flow/dropTarget.ts` findet das oberste Element unter dem Zeiger, nicht den Ausgangsknoten; `connectToNode` im Store nutzt den gezogenen Quell-Konnektor und `pickSides` für die Zielseite, gesperrt im Analysemodus). Ein Treffer auf einen Konnektor läuft weiter über `onConnect`.
- **Suche**: Toolbar-Lupe „Suchen“ (beide Modi) öffnet `SearchBar` über dem Canvas. Regel in `model/search.ts`: `name` beginnt mit dem Text (`startsWith`, ohne Groß-/Kleinschreibung, Text getrimmt), Treffer in Modellreihenfolge, Objekte und Gruppen. Enter springt zum ersten Treffer (`focusNodes`), jedes weitere Enter bei unverändertem Text zum nächsten, nach dem letzten wieder zum ersten (`nextHit`); der Merker (`lastSearch` in `App`) wird beim Öffnen/Schließen zurückgesetzt. Reiner UI-Zustand, kein Undo-Schritt. Esc schließt das Feld; Tasten im Feld erreichen die Canvas-Kürzel nicht.
- **Kopieren/Einfügen** (Editieren-Modus, Toolbar „Zwischenablage“, Strg/Cmd + C/V): `copySelection` legt `clipboard` (UI-Zustand, `model/clipboard.ts`) an – die markierten Objekte/Gruppen **samt Inhalt der Gruppen, nie Verbindungen**; `paste` (gesperrt im Analysemodus, ein Undo-Schritt) erzeugt Kopien mit **neuen UUIDs** (`IdGenerator`), um `PASTE_STEP` je Wiederholung versetzt, wieder in der ursprünglichen Gruppe (die mitwächst), sonst oben auf der alten Position, und wählt die neuen obersten Kopien aus. Die Browser-Kürzel bleiben in Textfeldern und ohne Auswahl/Zwischenablage unangetastet.
- **JSON als Text**: Toolbar „JSON anzeigen“ (`JsonExportDialog`: schreibgeschütztes Textfeld mit exakt dem Export-JSON, Kopieren = `markExported`) und „JSON einfügen“ (`JsonImportDialog`: validiert in `App` vorab mit `parseModelJson`, Fehler stehen **im Dialog**, weil er den Banner verdeckt; dann `importText`). Beide laufen auch im Analysemodus. Labels/`aria-label`s sind Teil der `AgentHelp` – mit pflegen.
- **Import-Warnung**: `contentFingerprint` vs. `exportedFingerprint` (`markExported()` nach Export/Import, persistiert unter `release-management.lastExport.v1`). `pickTextFile` muss synchron im Klick-Handler starten (kein `await` davor).

## Konventionen

- UI-Texte, Doku, Fehlermeldungen **Deutsch**; Bezeichner und Code-Kommentare **Englisch**.
- TypeScript strict, `erasableSyntaxOnly` (keine `enum`, Parameter-Properties, Namespaces). Kein Semikolon, einfache Anführungszeichen, 2 Leerzeichen.
- Kommentare nur für das *Warum*. Komponenten-Dateien exportieren nur Komponenten (react-refresh), z. B. `nodeTypes` in `nodeTypes.ts`.
- Tests neben dem Code (`*.test.ts[x]`), deterministisch (IDs über `IdGenerator`); Fachlogik test-first.

## Arbeitsweise

- Nicht committen oder pushen, solange nicht ausdrücklich verlangt.
- UI-Änderungen zusätzlich im Browser (Dev-Server) prüfen: Anlegen (auch in Gruppen), Verbinden, Sidebar (Live-Übernahme, Undo pro Feld), Gruppieren, Reload, Export, Import mit Rückfrage.
