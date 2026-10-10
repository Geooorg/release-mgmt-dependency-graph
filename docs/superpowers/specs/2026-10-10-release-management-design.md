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
| Export | lädt `<Projektname>_<YYYY-MM-DD>_<HHmmss>.json` herunter (lokale Zeit) |
| Import | Rückfrage „Aktuelle Änderungen verwerfen?" → Dateiauswahl → Validierung → Ersetzen; bei Fehler bleibt das Modell unverändert und die Fehler werden aufgelistet |

## 6a. Erweiterungen (zweite Iteration)

- **Vier Konnektoren** je Element. Die Kanten speichern optional `sourceHandle`/`targetHandle`. Technisch: je Seite ein `source`-Handle und `ConnectionMode.Loose`, damit jeder Konnektor Anfang oder Ende sein kann. Ohne gespeicherte Seiten (ältere Dateien, Toolbar-„Verbinden") gilt `pickSides`: die einander zugewandten Seiten nach dominanter Achse. Das Schema bleibt `version: 1`, weil die Felder optional sind.
- **Undo/Redo**: Snapshot-Verlauf (`model/history.ts`, max. 100) im Store. Jede Modelländerung über `apply` legt den Vorzustand ab; Drag und Resize werden über `beginGesture`/`endGesture` zu einem Schritt gebündelt (leere Gesten verfallen). Auswahl, Sidebar und Modi werden nicht aufgezeichnet; nach Undo/Redo werden UI-Verweise auf verschwundene Elemente bereinigt. Auch ein Import ist rückgängig machbar.
- **Abhängigkeitsgraph** (`model/dependency.ts`): Breitensuche ab der Auswahl (bei Gruppen inkl. aller Mitglieder) entlang der Kanten, richtungsabhängig, zyklensicher. Die Hervorhebung ist reiner UI-Zustand (`dependencyMode`) und folgt der Auswahl. Annahme: „Abhängigkeitsgraph" = alles, was von der Auswahl aus über Pfeile (transitiv) erreichbar ist; die Richtung ist wählbar, die Semantik der Pfeile ist inzwischen festgelegt („hängt ab von", siehe 6b).
- **Farbe**: Metadatenfeld `color` (`#rrggbb`) mit Farbwähler; wird gerendert als Hintergrund und Rahmen (Gruppen: Rahmen, Titel, 8 % Tönung). Schriftfarbe per Helligkeit (`getContrastColor`). Ungültige Werte zählen als „nicht gesetzt".
- **Kanten-Label**: `ModelEdge.label` (optional, getrimmt, leer = entfernt). Doppelklick auf eine Kante öffnet dieselbe Sidebar (`sidebarEdgeId` im Store, exklusiv zu `sidebarId`) mit UUID und nur einem Feld „Label"; gespeichert über `updateEdgeLabel` (undo-fähig). Gezeichnet als React-Flow-Label in der Kantenfarbe.
- **Toolbar**: in Bereiche gegliedert (Erstellen · Verlauf · Gruppen · Analyse · Datei). Rückgängig, Wiederholen, Gruppieren und Gruppe auflösen sind Icon-Buttons (Inline-SVG, keine neue Abhängigkeit, Name per `aria-label`). Alle Buttons haben einen Tooltip (`Tooltip.tsx`: Hover mit 250 ms Verzögerung und Tastaturfokus, Portal mit `position: fixed`, damit die scrollbare Toolbar ihn nicht abschneidet) mit Erklärung, ggf. Tastenkürzel und – bei deaktivierten Buttons – dem Grund.
- **Projektname**: Teil des Modells (`GraphContent.projectName`, optional im JSON, Standard „Release-Management"), also auch in `localStorage`, Export/Import und im Undo-Verlauf. Erlaubt `A-Z a-z 0-9 - _ .`, 1–100 Zeichen (`model/projectName.ts`) – so ist er immer ein gültiger Dateinamenbestandteil. Inline-Editor in der Toolbar (`ProjectTitle`): unerlaubte Zeichen werden beim Tippen/Einfügen entfernt und gemeldet; Enter/Blur übernimmt, Esc verwirft. Der Import lehnt ungültige Namen ab.
- **UUID-Feld** in der Sidebar: grau, gestrichelt, mit Hinweis „nicht editierbar".

## 6b. Zyklenerkennung (dritte Iteration)

- **Semantik** (vom Nutzer festgelegt): Ein Pfeil `A -> B` bedeutet „A hängt von B ab" (B wird vor A released). Eine Kante zu/von einer Gruppe gilt für alle (verschachtelten) Mitglieder: „X hängt von Gruppe G ab" = X hängt von allen Objekten in G ab; „G hängt von Y ab" = alle Objekte in G hängen von Y ab.
- **Effektiver Abhängigkeitsgraph** (`model/effectiveGraph.ts`, `buildEffectiveGraph`): löst die explizite Kantenliste auf Objektebene (`kind: 'node'`) auf. `leaves(id)` ist das Objekt selbst bzw. bei einer Gruppe alle Objekte beliebiger Tiefe; eine Gruppe ohne Objekte steht für sich selbst (sonst ginge ihre Kante verloren). Jede Kante `s -> t` erzeugt die Paare `(u, v)`, `u ∈ leaves(s)`, `v ∈ leaves(t)`, `u ≠ v`; je Paar bleiben die erzeugenden Kanten-IDs erhalten (`edgeIdsOf`). Das Ergebnis (`vertices`, `successors`, `edgeIdsOf`) ist deterministisch (Reihenfolge der Knoten) und die gemeinsame Grundlage aller künftigen Abhängigkeitsauswertungen (Blocker/kritischer Pfad, Umstellung von `findDependencies`).
- **Zyklen** (`model/cycles.ts`, `findCycles`): starke Zusammenhangskomponenten mit ≥ 2 Knoten des effektiven Graphen (iterativer Tarjan, kein Rekursions-Stack-Overflow). Ergebnis: `cycles` (je Zyklus die Element-IDs in Knotenreihenfolge, Zyklen nach erstem Element), `nodeIds` (alle beteiligten Elemente) und `edgeIds` (jede explizite Kante, die mindestens ein Paar innerhalb einer Komponente erzeugt). Gruppen mit Mitgliedern sind keine Knoten und erhalten kein Badge; nur eine leere Gruppe, die selbst im Zyklus liegt, wird markiert. Nicht im Zyklus liegende Kanten werden nicht markiert.
- **Darstellung** (immer aktiv, kein Modus – ein Zyklus ist ein Planungsfehler): Kanten violett `#9333ea` (ausgewählt `#6b21a8`), gestrichelt (`6 4`), 3 px, gleichfarbiger Pfeil. Die rote Abhängigkeits-Hervorhebung hat Vorrang vor der Farbe, die Strichelung bleibt. Betroffene Objekte/Gruppen tragen ein violettes Badge (`CycleBadge`, `title`/`aria-label` „Teil eines Zyklus") über `FlowNodeData.isInCycle`. Die Berechnung ist abgeleitet (`useMemo` in `App` aus `nodes`/`edges`), nicht Teil des Modells und nicht persistiert; das Schema (`version: 1`) ändert sich nicht.
- **Navigation**: Toolbar-Bereich „Analyse" zeigt nur bei vorhandenen Zyklen den Warn-Button „⟳ n Zyklen" (Tooltip erklärt die Folgen). Klick = nächster Zyklus (Zähler in `App`, Rundlauf): der Store-Aktion `focusNodes` setzt die Auswahl und einen Fokus-Request (`focusRequest`, reiner UI-Zustand, nicht im Undo-Verlauf); `Canvas` zeigt sie per `getViewportForBounds`/`setViewport` (nicht `fitView`: bei kontrollierten Knoten bleibt es in der Queue hängen).

## 6c. Status, Blocker und kritischer Pfad (vierte Iteration)

- **Status** (`model/status.ts`): normaler Metadateneintrag `status` mit den Werten `offen | in Arbeit | fertig` (wie `color`; nur `getStatus` liefert gültige Werte, trimmt und ignoriert Groß-/Kleinschreibung, fehlend/unbekannt = `offen`). Schema bleibt `version: 1`. Nur Objekte haben einen Status; Gruppen leiten ihren Zustand aus den Mitgliedern ab (Sidebar: „Status aus Mitgliedern: n von m fertig“, read-only). Die Sidebar zeigt für Objekte eine Auswahl statt einer freien Zeile; die Reihenfolge beim Speichern ist `name`, `color`, `status`, freie Felder. Ein unbekannter importierter Wert bleibt erhalten und wird als zusätzliche Option „<wert> (unbekannt)“ angeboten; er wird nicht stillschweigend verändert. Bei Gruppen ist `status` eine gewöhnliche freie Zeile.
- **Basis** aller Auswertungen ist `buildEffectiveGraph` (6b); „Nachfolger“ = Voraussetzungen. `findDependencies` läuft jetzt ebenfalls darüber: eine erreichte Gruppe erreicht ihre Mitglieder, hervorgehoben werden die expliziten Kanten, die durchlaufene Paare erzeugen; zusätzlich wird eine Gruppe als erreicht gemeldet, wenn eine durchlaufene Kante an ihr endet (außer sie umgibt einen Startpunkt). `EffectiveGraph` bietet dafür `leavesOf(id)`.
- **Definitionen** (`model/releaseAnalysis.ts`, rein, deterministisch – Tie-Break immer nach Knotenreihenfolge – und iterativ, getestet mit 5000er-Kette):
  - *Offen* = Objekt mit Status ≠ `fertig`. Eine Gruppe ohne Objekte ist Eckpunkt des Graphen (ihre Kanten gehen nicht verloren), hat aber keine eigene Arbeit: nie offen, nie Blocker, nicht gezählt – für Abhängigkeiten also transparent.
  - *Blockiert* = von einem offenen Eckpunkt über ≥ 1 Schritt erreichbar (Rückwärts-Suche ab allen offenen Eckpunkten), unabhängig vom eigenen Status. Daher ist auch ein „fertiges“ Objekt mit offener Voraussetzung blockiert (Inkonsistenz), und ein offenes Objekt in einem Zyklus ist blockiert (es erreicht sich selbst; es kann nie bereit werden). Gruppen mit einem blockierten Mitglied (beliebige Tiefe) stehen ebenfalls in `blockedIds` und erhalten `blockedMembers`.
  - `blockingDirect` je blockiertem Objekt: direkte Voraussetzungen, die offen oder selbst blockiert sind (Tooltip „Blockiert durch: …“, höchstens fünf Namen, dann „…“).
  - *Jetzt umsetzbar* (`readyIds`) = offen und nicht blockiert.
  - *Kritischer Pfad* = längste Kette ab der Auswahl entlang der Voraussetzungen; Gewicht 1 je offenem, 0 je fertigem Objekt (`length` = Anzahl offener Objekte darauf). Berechnet per Kahn-Reihenfolge (Voraussetzungen zuerst) und DP über die Kettentiefe. Ergebnis in Release-Reihenfolge (zuerst zu erledigen zuerst, das Auswahl-Objekt zuletzt) mit den erzeugenden expliziten Kanten (`edgeIdsOf`). Startpunkt: bei mehreren Kandidaten gleicher Länge der erste in Knotenreihenfolge; Starts, die von einem anderen Start aus erreichbar sind, scheiden aus (deren Kette ist dort schon enthalten). Ist nichts offen, ist der Pfad leer (`length: 0`).
  - *Auswahl*: Gruppen starten an allen Mitgliedern; ohne (bekannte) Auswahl gilt das gesamte Projekt (Startpunkte = alle Eckpunkte; `blockers` = alle offenen Objekte).
  - *Blocker der Auswahl*: alle offenen transitiven Voraussetzungen ohne die Auswahl selbst, je `{ id, status, ready, distance }` (kürzeste Schrittzahl); Sortierung: jetzt umsetzbare zuerst, dann nach Kettentiefe (Release-Reihenfolge), dann Knotenreihenfolge.
  - *Zyklen*: Liegt ein Zyklus (`findCycles`) im erreichbaren Teilgraphen, ist die längste Kette nicht definiert: `criticalPath: null` und `cycleIds`; die Blocker-Liste wird trotzdem geliefert. Zyklen außerhalb des erreichbaren Teils stören nicht.
- **Darstellung**: Rote Flagge (`BlockedFlag`, Inline-SVG `FlagIcon`) oben links am Objekt, bei Gruppen im Titel; Status-Kennzeichen unten rechts (grünes Häkchen = fertig, amberfarbener Halbkreis = in Arbeit, offen ohne Zeichen) – so kollidiert nichts mit dem Zyklus-Badge oben rechts. Daten über `FlowNodeData` (`status`, `blockedTitle`), abgeleitet per `useMemo` in `App` (`analyzeProject`), nicht im Modell gespeichert.
- **Analyse-Panel** (`AnalysisPanel`, präsentational): Toggle „Release-Analyse“ im Toolbar-Bereich „Analyse“, Zustand `analysisOpen` im Store (UI-Zustand, nicht in der History, nicht persistiert). Panel und Abhängigkeits-Modus schließen sich gegenseitig aus (jeweils im Store: Öffnen setzt `dependencyMode` auf `off`, Einschalten des Modus schließt das Panel). Das Panel liegt als absolut positionierte Karte (320 px, scrollbar) im Canvas-Bereich und kann damit die Toolbar nie verdecken; auf schmalen Fenstern wird es schmaler bzw. lässt unten Platz für die Zoom-Steuerung, ab 720 px rücken die Zoom-Steuerelemente rechts neben das Panel. Esc schließt zuerst den Verbinden-Modus, dann das Panel; die Sidebar bleibt offen. Solange das Panel offen ist, zeichnet der Canvas die Kanten des kritischen Pfads dick rot (`#dc2626`) und dessen Objekte mit rotem Rahmen (gleiche Darstellung wie die Abhängigkeits-Hervorhebung; Zyklus-Strichelung bleibt).
- **Klick auf einen Eintrag**: `revealNode(id)` – zentriert den Knoten (derselbe `getViewportForBounds`/`setViewport`-Weg wie beim Zyklus-Fokus) und lässt ihn kurz aufleuchten; die **Auswahl bleibt unverändert**. Begründung: Ein Auswählen würde den Kontext des Panels (es folgt der Auswahl) unter dem Nutzer wegziehen und bräuchte eine „Zurück“-Funktion mit eigenem Zustand; so lassen sich die Einträge der Reihe nach durchklicken. Der Flash (`revealedId`) ist UI-Zustand und wird vom Canvas nach 1,6 s gelöscht.
- **Markdown-Export** (`formatAnalysisMarkdown`, rein): Überschrift mit Projektname und Auswahl, Zähler, kritischer Pfad als nummerierte Liste mit Status, Blocker („jetzt umsetzbar“ gekennzeichnet; ohne Auswahl getrennte Abschnitte). `App` schreibt ihn per `navigator.clipboard.writeText` (try/catch) in die Zwischenablage und meldet das Ergebnis über das Banner.
- **Toolbar**: Richtungen heißen „→ Voraussetzungen“ (outgoing), „← Betroffene“ (incoming), „↔ Beide“.

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

1. Kanten sind gerichtet; ein Pfeil `A -> B` bedeutet „A hängt von B ab" (B muss vor A released werden). Kanten zu/von Gruppen gelten für alle verschachtelten Mitglieder (siehe 6b).
2. „Beim Laden der Seite importieren" wird als „Import jederzeit über die Toolbar, auch direkt nach dem Laden" umgesetzt; die Rückfrage erscheint immer vor der Dateiauswahl.
3. Der Speichern-Button der Sidebar heißt wörtlich „Save".
4. Zyklen im Graph sind erlaubt (kein Speichern-Verbot), werden aber immer erkannt und markiert (violett gestrichelt, Badge, Toolbar-Warnung; siehe 6b).
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

- Blocker/kritischer Pfad (siehe 6c) und Zyklen (6b) sind umgesetzt; denkbar: Dauern/Aufwände je Objekt als Gewicht des kritischen Pfads, Release-Termine, mehrere gleichlange kritische Pfade anzeigen
- Auto-Layout, Einklappen von Gruppen, Kantenbeschriftungen
- Zusätzlicher XML-Export, falls eine bestehende Toolchain ihn braucht
- Einzel-HTML-Build (`vite-plugin-singlefile`) für Verteilung ohne Webserver
