# Release-Management – Abhängigkeitsgraph: Konzept

Stand: 2026-10-10 · Status: freigegeben (Variante B, inkl. Gruppen), erste Version umgesetzt und im Browser abgenommen

## 1. Ziel

Ein reines Browser-Werkzeug, mit dem man im Release-Management Abhängigkeiten zwischen
Projekten als Graph modelliert: Objekte (blaue Kästen) anlegen, per Linien verbinden, mit
Metadaten versehen und – neu – zu Gruppen (Sub-Graphen) zusammenfassen. Kein Backend.

## 2. Machbarkeit (Ergebnis der Vorstudie)

`npm` + Vite sind ausreichend. Vite ist nur Build-/Dev-Werkzeug; zur Laufzeit existieren nur
statische Dateien. Jede Anforderung ist mit Browser-Bordmitteln lösbar:

| Anforderung | Browser-Mittel |
|---|---|
| Kästen, Linien, Verschieben, Verbinden, Gruppen (Sub-Flows) | React Flow (`@xyflow/react`) auf SVG/DOM |
| UUID | `crypto.randomUUID()` |
| Sidebar mit Formular | React |
| Auto-Speichern / Laden | `localStorage` (JSON, ~5 MB Limit) |
| Export | `Blob` + `URL.createObjectURL` + `<a download>` |
| Import | `<input type="file">` + `file.text()` |
| Rückfrage „verwerfen?" | natives `<dialog>` |

Einschränkungen: „kein Server" heißt „kein Backend" – `dist/` braucht einen statischen Host
(oder `vite preview`). `file://`-Doppelklick funktioniert mit dem Standard-Build nicht
zuverlässig (ES-Module). `localStorage` gilt pro Browser/Origin und kann im Private-Modus
fehlen → jeder Zugriff in `try/catch`.

## 3. Entscheidungen

| Thema | Entscheidung | Begründung |
|---|---|---|
| Stack | Vite + React + TypeScript + React Flow | Drag, Verbinden, Zoom/Pan, Sub-Flows fertig vorhanden |
| State | zustand-Store (`src/store`) | Aktionen ohne React testbar; React Flow nutzt zustand ohnehin |
| Austauschformat | **JSON** (nicht XML) | identisch mit `localStorage`-Format; freie Feldnamen sind keine gültigen XML-Elementnamen; nativer Parser |
| Metadaten | geordnete Liste `{key, value}` statt Objekt | Reihenfolge bleibt erhalten, Duplikate prüfbar, keine `__proto__`-Probleme |
| Kanten | **gerichtet** (Pfeil Quelle → Ziel) | Abhängigkeiten haben eine Richtung; Annahme, leicht änderbar |
| Tests | Vitest (+ Testing Library für Komponenten) | Logik als reine Funktionen, UI nur dünn |

## 4. Fachliches Modell

```ts
GraphModel = { version: 1, nodes: ModelNode[], edges: ModelEdge[] }
ModelNode  = { id /*UUID*/, kind: 'node' | 'group', parentId?, position, size?, metadata: {key,value}[] }
ModelEdge  = { id, source, target }
```

Invarianten:

- `id` wird einmalig generiert und ist nie änderbar.
- `metadata[0]` ist immer der Eintrag `name` (nicht entfernbar, Wert darf leer sein).
- Schlüssel und Werte werden getrimmt; Einträge ohne Schlüssel werden verworfen; leere Werte sind erlaubt.
- Doppelte Feldnamen innerhalb eines Elements sind ein Validierungsfehler (Sidebar: Save blockiert; Import: Fehler).
- `parentId` verweist immer auf ein Element mit `kind: 'group'`; die Position ist relativ zur Gruppe. Keine Zyklen.
- Kanten dürfen weder Selbstschleifen noch Duplikate (gleiche Richtung) sein und nicht zwischen einer Gruppe und ihrem eigenen Mitglied verlaufen. Kanten dürfen an Gruppen enden (Gruppe ↔ Gruppe / Objekt).

## 5. Gruppen (neue Anforderung)

Eine Gruppe ist ein Element mit eigener UUID und eigenen Metadaten (Name + freie Felder), das
andere Elemente – auch weitere Gruppen – enthält; fachlich ein Sub-Graph.

- **Gruppieren**: Auswahl (≥ 1 Element, alle mit gleichem Elternelement) → neue Gruppe mit passendem Rahmen; Mitglieder bleiben optisch an ihrer Stelle.
- **Auflösen**: Mitglieder wandern eine Ebene hoch, Position bleibt; Gruppe und ihre Kanten entfallen.
- **Löschen einer Gruppe** wirkt wie Auflösen (Inhalt geht nie versehentlich verloren).
- **Rein-/Rausziehen**: Beim Loslassen eines gezogenen Elements entscheidet dessen Mittelpunkt, welche (tiefste) Gruppe es aufnimmt; Zielgruppe wird beim Ziehen hervorgehoben.
- Ein Element, zwischen dem und einer Gruppe (oder deren Vorfahren) eine Kante besteht, wird nicht in diese Gruppe aufgenommen – sonst entstünde eine verbotene Kante Gruppe ↔ eigenes Mitglied. Der Nutzer bekommt einen Hinweis, die Gruppe wird beim Ziehen dann auch nicht als Ziel hervorgehoben.
- Gruppen sind verschiebbar (Mitglieder folgen), in der Größe änderbar und per Doppelklick bearbeitbar.

## 6. Interaktionen

| Aktion | Verhalten |
|---|---|
| Toolbar „Objekt anlegen" | neues Objekt in der Mitte des sichtbaren Ausschnitts (nächstgelegene freie Stelle, damit nichts überlappt), Name „Neues Objekt" |
| Verbinden | (a) Griff am rechten Rand eines Elements auf den linken Rand eines anderen ziehen; (b) Toolbar „Verbinden": erst Quelle, dann Ziel anklicken |
| Doppelklick auf Element | Sidebar rechts mit UUID (disabled), Name, freien Feldern; „Save" übernimmt |
| Entf-Taste / „Löschen" | markierte Elemente und Kanten löschen (Gruppen: auflösen) |
| Export | lädt `release-management-YYYY-MM-DD.json` herunter |
| Import | Rückfrage „Aktuelle Änderungen verwerfen?" → Dateiauswahl → Validierung → Ersetzen; bei Fehler bleibt das Modell unverändert und die Fehler werden aufgelistet |

## 6a. Erweiterungen (zweite Iteration)

- **Vier Konnektoren** je Element. Die Kanten speichern optional `sourceHandle`/`targetHandle`. Technisch: je Seite ein `source`-Handle und `ConnectionMode.Loose`, damit jeder Konnektor Anfang oder Ende sein kann. Ohne gespeicherte Seiten (ältere Dateien, Toolbar-„Verbinden") gilt `pickSides`: die einander zugewandten Seiten nach dominanter Achse. Das Schema bleibt `version: 1`, weil die Felder optional sind.
- **Undo/Redo**: Snapshot-Verlauf (`model/history.ts`, max. 100) im Store. Jede Modelländerung über `apply` legt den Vorzustand ab; Drag und Resize werden über `beginGesture`/`endGesture` zu einem Schritt gebündelt (leere Gesten verfallen). Auswahl, Sidebar und Modi werden nicht aufgezeichnet; nach Undo/Redo werden UI-Verweise auf verschwundene Elemente bereinigt. Auch ein Import ist rückgängig machbar.
- **Abhängigkeitsgraph** (`model/dependency.ts`): Breitensuche ab der Auswahl (bei Gruppen inkl. aller Mitglieder) entlang der Kanten, richtungsabhängig, zyklensicher. Die Hervorhebung ist reiner UI-Zustand (`dependencyMode`) und folgt der Auswahl. Annahme: „Abhängigkeitsgraph" = alles, was von der Auswahl aus über Pfeile (transitiv) erreichbar ist; die Richtung ist wählbar, die Semantik („hängt ab von" vs. „liefert an") bleibt dem Nutzer überlassen.
- **Farbe**: Metadatenfeld `color` (`#rrggbb`) mit Farbwähler; wird gerendert als Hintergrund und Rahmen (Gruppen: Rahmen, Titel, 8 % Tönung). Schriftfarbe per Helligkeit (`getContrastColor`). Ungültige Werte zählen als „nicht gesetzt".
- **Kanten-Label**: `ModelEdge.label` (optional, getrimmt, leer = entfernt). Doppelklick auf eine Kante öffnet dieselbe Sidebar (`sidebarEdgeId` im Store, exklusiv zu `sidebarId`) mit UUID und nur einem Feld „Label"; gespeichert über `updateEdgeLabel` (undo-fähig). Gezeichnet als React-Flow-Label in der Kantenfarbe.
- **UUID-Feld** in der Sidebar: grau, gestrichelt, mit Hinweis „nicht editierbar".

## 7. Persistenz

- Schlüssel `release-management.graph.v1` im `localStorage`.
- Gespeichert wird bei jeder Modelländerung (gebündelt/debounced ~150 ms, zusätzlich beim Verlassen der Seite). Reine Auswahl-/UI-Zustände lösen kein Speichern aus.
- Start: gespeichertes Modell laden und validieren; fehlt es → Default (zwei verbundene Objekte „Projekt A" → „Projekt B"); ist es ungültig → Default plus Hinweis, die defekte Rohfassung bleibt unter `…v1.corrupt` erhalten.

## 8. Architektur

```
src/model/       reine Domänenlogik (types, metadata, graph, serialize, defaultModel) – kein React
src/storage/     localStorage-Zugriff (try/catch) und Datei-Download/-Upload
src/store/       zustand-Store: Modell + UI-Zustand (Auswahl, Sidebar, Verbinden-Modus), Persistenz-Anbindung
src/flow/        Anbindung an React Flow: Mapping Modell ↔ Flow-Knoten, Canvas (Events → Store-Aktionen), Flow-Typen
src/components/  Toolbar, Sidebar, BoxNode, GroupNode, ConfirmDialog, Banner (rein präsentational, Props-getrieben)
src/App.tsx      Layout und Verdrahtung
```

Abhängigkeitsrichtung: `flow`/`App` → `store` → `model`; `components` kennen nur ihre Props. `model` kennt weder React noch den Browser
(außer `crypto.randomUUID` als überschreibbarem Default).

Das Modell im Store ist die einzige Quelle der Wahrheit; React Flow bekommt daraus abgeleitete Knoten
und meldet Änderungen (Position, Größe, Auswahl) als Store-Aktionen zurück. Auswahl liegt getrennt
vom Modell, damit Klicken kein Speichern auslöst.

## 9. Annahmen (bitte bei Bedarf korrigieren)

1. Kanten sind gerichtet; Richtung bedeutet nur „Quelle → Ziel" (Semantik, z. B. „hängt ab von", legt der Nutzer fest).
2. „Beim Laden der Seite importieren" wird als „Import jederzeit über die Toolbar, auch direkt nach dem Laden" umgesetzt; die Rückfrage erscheint immer vor der Dateiauswahl.
3. Der Speichern-Button der Sidebar heißt wörtlich „Save".
4. Zyklen im Graph sind erlaubt und werden (noch) nicht markiert.
5. Kein Auto-Layout; der Undo-Verlauf wird nicht gespeichert (nur für die laufende Sitzung).

## 10. Teststrategie

- Domänenlogik (`src/model`): vollständige Unit-Tests, ID-Generator injiziert.
- Komponenten: Sidebar-Formularlogik, Toolbar-Zustände, Dialog/Banner.
- Store: Aktionen und Persistenz (mit jsdom-`localStorage`).
- Manuelle Abnahme im Browser anhand der Anforderungen der README.

## 11. Umsetzungsreihenfolge

1. Gerüst (Vite, Abhängigkeiten, Konfiguration) und Vertrags-Typen
2. Parallel: Domänenlogik mit Tests · präsentationale Komponenten mit Tests
3. Store, Storage/Datei-IO, Flow-Mapping, App-Verdrahtung
4. Verifikation: Tests, Typecheck, Lint, Build, Abnahme im Browser

## 12. Offene Punkte / Ideen für später

- Zyklen im Graph erkennen und markieren
- Auto-Layout, Einklappen von Gruppen, Kantenbeschriftungen
- Zusätzlicher XML-Export, falls eine bestehende Toolchain ihn braucht
- Einzel-HTML-Build (`vite-plugin-singlefile`) für Verteilung ohne Webserver
