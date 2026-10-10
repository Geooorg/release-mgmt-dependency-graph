# CLAUDE.md

Browser-only Abhängigkeitsgraph-Editor für das Release-Management (React 19 + TypeScript + Vite + @xyflow/react + zustand).
Anforderungen: [README.md](README.md) · Konzept/Entscheidungen: `docs/superpowers/specs/2026-10-10-release-management-design.md`.

## Befehle

```bash
npm run dev         # Dev-Server (Vite)
npm test            # Vitest einmalig (jsdom); npm run test:watch zum Entwickeln
npm run typecheck   # tsc -b
npm run lint        # oxlint
npm run build       # tsc -b && vite build -> dist/
```

Vor „fertig" immer: `npm test && npm run typecheck && npm run lint && npm run build`.

## Harte Randbedingungen

- **Kein Backend, keine Server-Abhängigkeit zur Laufzeit.** Alles läuft im Browser; Persistenz nur über `localStorage` und Datei-Export/-Import.
- Austauschformat ist **JSON** (kein XML). Export == `localStorage`-Format == `GraphModel` aus `src/model/types.ts`. Format ändern ⇒ `SCHEMA_VERSION` erhöhen, Migration in `parseModel` ergänzen, README-Beispiel anpassen.
- Neue Laufzeit-Abhängigkeiten nur nach Rücksprache.
- Node ≥ 22.12 (Vite 8 / Vitest 5).

## Architektur (Abhängigkeiten nur in dieser Richtung)

`components` (nur Props) · `flow`/`App` → `store` → `model`

- `src/model/` – **reine** Funktionen, immutable, ohne React/DOM (Ausnahme: `crypto.randomUUID` als injizierbarer `IdGenerator`). Hier liegt die gesamte Fachlogik (Gruppieren, Auflösen, Reparent, Kanten-Regeln, Metadaten-Normalisierung, Validierung). Neue Regeln zuerst hier mit Test.
- `src/store/` – zustand-Store: Modell (`nodes`, `edges`) + UI-Zustand (Auswahl, geöffnete Sidebar, Verbinden-Modus). Das Modell ist die einzige Quelle der Wahrheit. Auswahl liegt **getrennt** vom Modell, damit Klicken kein Speichern auslöst.
- `src/storage/` – `localStorage` (immer `try/catch`) und Datei-Download/-Upload.
- `src/flow/` – Anbindung an React Flow: Mapping Modell ↔ Flow-Knoten (`mapping.ts`: `parentId`, Positionen relativ zur Gruppe, Eltern vor Kindern) und `Canvas.tsx` (übersetzt React-Flow-Events in Store-Aktionen).
- `src/components/` – (Tooltips für Buttons über `Tooltip`, Icons in `icons.tsx` als Inline-SVG) präsentational, Props-getrieben (`props.ts` ist der Vertrag), keine Fachlogik, kein Store-Zugriff.

## Domänen-Invarianten (nicht brechen)

- `id` (UUID) wird einmal erzeugt, ist nie editierbar (Sidebar: `disabled`).
- `metadata[0]` ist immer `name`. Schlüssel und Werte werden getrimmt, Einträge ohne Schlüssel verworfen, leere Werte erlaubt, doppelte Schlüssel sind ein Fehler. Immer über `normalizeMetadata` gehen.
- Metadaten sind eine **geordnete Liste von Paaren**, kein Objekt.
- `parentId` zeigt nur auf `kind: 'group'`, keine Zyklen; `position` ist relativ zum Elternelement. Beim Umhängen bleibt die Bildschirmposition erhalten.
- Kanten sind gerichtet, ohne Selbstschleife/Duplikat und nicht zwischen Gruppe und eigenem Mitglied. `reparent` fasst Kanten nicht an – vorher `wouldBreakHierarchy` prüfen (macht der Store beim Drag & Drop).
- Löschen einer Gruppe löst sie auf – Inhalt wird nie implizit mitgelöscht.
- Pfeil-Semantik: `A -> B` heißt „A hängt von B ab" (B wird vor A released). Eine Kante zu/von einer Gruppe gilt für **alle (verschachtelten) Mitglieder**; eine Gruppe ohne Objekte steht für sich selbst. `src/model/effectiveGraph.ts` (`buildEffectiveGraph`) löst die Kanten auf Objektebene auf und ist die **Basis aller Abhängigkeitsauswertungen** (Zyklen in `cycles.ts`, Blocker/kritischer Pfad in `releaseAnalysis.ts`, `findDependencies`) – keine eigene Gruppenauflösung daneben bauen.
- Zyklen (`findCycles`) sind abgeleiteter Zustand: immer aktiv, per `useMemo` aus `nodes`/`edges` berechnet, nie im Modell/Store gespeichert, kein Schema-Feld. Der Fokus-Request (`focusNodes`/`focusRequest`) ist UI-Zustand ohne Undo-Schritt.
- `status` ist (wie `color`) ein normaler Metadateneintrag mit den Werten `offen | in Arbeit | fertig`, nur für Objekte (Gruppen leiten ihn aus den Mitgliedern ab); nur `getStatus` (`model/status.ts`) liefert gültige Werte (fehlend/unbekannt = `offen`). Die Sidebar rendert ihn als Auswahl direkt nach `name`/`color`, einen unbekannten importierten Wert behält sie als „(unbekannt)“-Option. Blockiert/kritischer Pfad (`analyzeProject`/`analyzeSelection`) sind abgeleitet (`useMemo`), nie gespeichert; Panel-Sichtbarkeit (`analysisPanelVisible`), Hervorhebung (`highlight`) und `revealedId` sind UI-Zustand ohne Undo-Schritt; es gilt genau eine Hervorhebung (`critical | outgoing | incoming | both | off`), nur im Analysemodus.
- Jede Modelländerung im Store läuft über `apply` (legt den Undo-Schritt an). Mehrteilige Gesten (Drag, Resize) mit `beginGesture`/`endGesture` klammern. UI-Zustand (Auswahl, Sidebar, Modi) wird nicht aufgezeichnet.
- Kanten haben optional `sourceHandle`/`targetHandle` (`top|right|bottom|left`); fehlen sie, zeichnet `toFlowEdges` die zugewandten Seiten (`pickSides`). Die Knoten haben 4 `source`-Handles, der Canvas läuft im Loose-Modus.
- Kanten können ein `label` tragen (`updateEdgeLabel`, getrimmt, leer = Schlüssel entfernen). Die Sidebar zeigt für Kanten (`kind: 'edge'`) nur UUID + Label; im Store sind `sidebarId` (Element) und `sidebarEdgeId` (Kante) exklusiv.
- Der Projektname (`projectName`) ist Teil von `GraphContent` (Store, History, Persistenz, Export) und darf nur `A-Z a-z 0-9 - _ .` enthalten (`isValidProjectName`); er ist Bestandteil des Export-Dateinamens `<Name>_<JJJJ-MM-TT>_<HHmmss>.json`.
- `status` ist ein normaler Metadateneintrag (`offen | in Arbeit | fertig`); der **Schlüssel** wird getrimmt und **ohne Groß-/Kleinschreibung** erkannt (erster passender Eintrag gilt), die Sidebar schreibt ihn kanonisch als `status`. Ausgewertet wird er **nur** über `getStatusInfo`/`getStatus` (`model/status.ts`), nie über `entry.key === 'status'`. Fehlend/leer = `offen`; ein unbekannter Wert zählt als `offen`, bleibt erhalten und muss sichtbar sein (Marke „?“, „Zu klären“). *Blockiert* = nicht fertig und wartet; *fertig und wartet* ist ein **Widerspruch** (`inconsistentIds`, Warndreieck), nie „blockiert“.
- Ungespeicherte Sidebar-Änderungen gehen nie still verloren: Formulare melden `dirty` (`onDirtyChange`), Schließen/Wechseln läuft über `closeSidebar`/`openSidebar`/`openEdgeSidebar` im Store (`pendingSidebarChange` → `ConfirmDialog` in `App`). Neue Wege, die Sidebar zu schließen oder zu wechseln, müssen diese Aktionen nutzen.
- `color` ist ein normaler Metadateneintrag (`#rrggbb`, direkt nach `name`); nur `getColor` liefert gültige Werte. Die Sidebar rendert ihn als Farbwähler, nicht als freie Zeile.
- **Arbeitsmodus** (`mode: 'build' | 'analyze'`, Typen in `model/workMode.ts`) ist reiner UI-Zustand (nicht in der History, nicht in `GraphContent`/Export), pro Browser unter `release-management.ui.v1` gemerkt (`storage/uiPreferences.ts`; ungültig/fehlend ⇒ `build`). Im Analysemodus sind die Strukturaktionen im **Store** gesperrt (stilles No-Op: `addNodeAt`, `connect`, Verbinden-Modus, `groupSelection`, `ungroupSelection`, `deleteSelection`, Umhängen in `finishDrag`/`updateDropTarget`); Verschieben, Sidebar-Bearbeitung, Undo/Redo, Export/Import bleiben erlaubt. Neue Strukturaktionen im Store müssen die Sperre (`structureLocked`) beachten; der Canvas blendet zusätzlich Konnektoren aus (`nodesConnectable={false}`, Klasse `flow--locked`).
- **Import-Warnung**: `contentFingerprint` (`model/fingerprint.ts`, FNV-1a über das kanonische Export-JSON) vergleicht den aktuellen Stand mit `exportedFingerprint` im Store (gesetzt von `markExported()` nach Export und von `importText`; persistiert unter `release-management.lastExport.v1`). Der `ImportDialog` fragt vor jedem Import; `pickTextFile` muss synchron im Klick-Handler starten (Nutzer-Geste, kein `await` davor).

## Konventionen

- Sprache: UI-Texte, Doku und Fehlermeldungen **Deutsch**; Bezeichner und Code-Kommentare **Englisch**. Der Sidebar-Button heißt wörtlich „Save".
- TypeScript strict, `erasableSyntaxOnly` (keine `enum`, keine Parameter-Properties, keine Namespaces). Kein Semikolon, einfache Anführungszeichen, 2 Leerzeichen.
- Kommentare nur für das *Warum*. Funktionen klein halten; React-Komponenten exportieren keine Nicht-Komponenten (react-refresh) – z. B. `nodeTypes` liegt in `nodeTypes.ts`.
- Tests liegen neben dem Code (`*.test.ts[x]`), Vitest mit globalem jsdom. Tests deterministisch halten: IDs über `IdGenerator` injizieren. Fachlogik wird test-first entwickelt.
- Keine `localStorage`-/Browser-API-Aufrufe in `src/model`.

## Arbeitsweise

- Nicht committen oder pushen, solange nicht ausdrücklich verlangt. `.claude/settings.local.json` ist git-ignoriert.
- Abnahme von UI-Änderungen im Browser (Dev-Server) prüfen, nicht nur per Test: Anlegen, Verbinden, Doppelklick-Sidebar, Gruppieren, Reload (Persistenz), Export, Import mit Rückfrage.
