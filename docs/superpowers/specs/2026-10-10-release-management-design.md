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
- Doppelte Feldnamen innerhalb eines Elements sind ein Validierungsfehler (Sidebar: wird nicht ins Modell übernommen; Import: Fehler).
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
- Gruppen sind verschiebbar (Mitglieder folgen), in der Größe änderbar und per Klick (Sidebar) bearbeitbar.

## 6. Interaktionen

| Aktion | Verhalten |
|---|---|
| Werkzeug „Objekt anlegen" | Klick auf eine freie Stelle der Fläche: neues Objekt, Mittelpunkt an der Klickposition (nächstgelegene freie Stelle, damit nichts überlappt; in einer Gruppe als Mitglied, siehe 6e), Name „Neues Objekt" |
| Verbinden | (a) Griff am rechten Rand eines Elements auf den linken Rand eines anderen ziehen; (b) Werkzeug „Verbinden": erst Quelle, dann Ziel anklicken |
| Klick auf Element | Sidebar rechts (folgt der Auswahl) mit UUID (disabled), Name, freien Feldern; Änderungen gelten sofort |
| Entf-Taste / „Löschen" | markierte Elemente und Kanten löschen (Gruppen: auflösen) |
| Export | lädt `<Projektname>_<YYYY-MM-DD>_<HHmmss>.json` herunter (lokale Zeit) |
| Import | Dialog „Projekt ersetzen?“ (siehe 6d) → Dateiauswahl → Validierung → Ersetzen; bei Fehler bleibt das Modell unverändert und die Fehler werden aufgelistet |

## 6a. Erweiterungen (zweite Iteration)

- **Vier Konnektoren** je Element. Die Kanten speichern optional `sourceHandle`/`targetHandle`. Technisch: je Seite ein `source`-Handle und `ConnectionMode.Loose`, damit jeder Konnektor Anfang oder Ende sein kann. Ohne gespeicherte Seiten (ältere Dateien, Toolbar-„Verbinden") gilt `pickSides`: die einander zugewandten Seiten nach dominanter Achse. Das Schema bleibt `version: 1`, weil die Felder optional sind.
- **Undo/Redo**: Snapshot-Verlauf (`model/history.ts`, max. 100) im Store. Jede Modelländerung über `apply` legt den Vorzustand ab; Drag und Resize werden über `beginGesture`/`endGesture` zu einem Schritt gebündelt (leere Gesten verfallen). Auswahl, Sidebar und Modi werden nicht aufgezeichnet; nach Undo/Redo werden UI-Verweise auf verschwundene Elemente bereinigt. Auch ein Import ist rückgängig machbar.
- **Abhängigkeitsgraph** (`model/dependency.ts`): Breitensuche ab der Auswahl (bei Gruppen inkl. aller Mitglieder) entlang der Kanten, richtungsabhängig, zyklensicher. Die Hervorhebung ist reiner UI-Zustand (heute `highlight`, siehe 6d) und folgt der Auswahl. Annahme: „Abhängigkeitsgraph" = alles, was von der Auswahl aus über Pfeile (transitiv) erreichbar ist; die Richtung ist wählbar, die Semantik der Pfeile ist inzwischen festgelegt („hängt ab von", siehe 6b).
- **Farbe**: Metadatenfeld `color` (`#rrggbb`) mit Farbwähler; wird gerendert als Hintergrund und Rahmen (Gruppen: Rahmen, Titel, 8 % Tönung). Schriftfarbe per Helligkeit (`getContrastColor`). Ungültige Werte zählen als „nicht gesetzt".
- **Kanten-Label**: `ModelEdge.label` (optional, getrimmt, leer = entfernt). Klick auf eine Kante zeigt dieselbe Sidebar (Ziel `edge`, exklusiv zu Objekten, siehe 6c) mit UUID und nur einem Feld „Label"; live übernommen über `updateEdgeLabel` (ein Undo-Schritt pro Feldbearbeitung). Gezeichnet als React-Flow-Label in der Kantenfarbe.
- **Toolbar**: in Bereiche gegliedert (ursprünglich Erstellen · Verlauf · Gruppen · Analyse · Datei; seit 6d nach Arbeitsmodi geordnet). Rückgängig, Wiederholen, Gruppieren und Gruppe auflösen sind Icon-Buttons (Inline-SVG, keine neue Abhängigkeit, Name per `aria-label`). Alle Buttons haben einen Tooltip (`Tooltip.tsx`: Hover mit 250 ms Verzögerung und Tastaturfokus, Portal mit `position: fixed`, damit die scrollbare Toolbar ihn nicht abschneidet) mit Erklärung, ggf. Tastenkürzel und – bei deaktivierten Buttons – dem Grund.
- **Projektname**: Teil des Modells (`GraphContent.projectName`, optional im JSON, Standard „Release-Management"), also auch in `localStorage`, Export/Import und im Undo-Verlauf. Erlaubt `A-Z a-z 0-9 - _ .`, 1–100 Zeichen (`model/projectName.ts`) – so ist er immer ein gültiger Dateinamenbestandteil. Inline-Editor in der Toolbar (`ProjectTitle`): unerlaubte Zeichen werden beim Tippen/Einfügen entfernt und gemeldet; Enter/Blur übernimmt, Esc verwirft. Der Import lehnt ungültige Namen ab.
- **UUID-Feld** in der Sidebar: grau, gestrichelt, mit Hinweis „nicht editierbar".

## 6b. Zyklenerkennung (dritte Iteration)

- **Semantik** (vom Nutzer festgelegt): Ein Pfeil `A -> B` bedeutet „A hängt von B ab" (B wird vor A released). Eine Kante zu/von einer Gruppe gilt für alle (verschachtelten) Mitglieder: „X hängt von Gruppe G ab" = X hängt von allen Objekten in G ab; „G hängt von Y ab" = alle Objekte in G hängen von Y ab.
- **Effektiver Abhängigkeitsgraph** (`model/effectiveGraph.ts`, `buildEffectiveGraph`): löst die explizite Kantenliste auf Objektebene (`kind: 'node'`) auf. `leaves(id)` ist das Objekt selbst bzw. bei einer Gruppe alle Objekte beliebiger Tiefe; eine Gruppe ohne Objekte steht für sich selbst (sonst ginge ihre Kante verloren). Jede Kante `s -> t` erzeugt die Paare `(u, v)`, `u ∈ leaves(s)`, `v ∈ leaves(t)`, `u ≠ v`; je Paar bleiben die erzeugenden Kanten-IDs erhalten (`edgeIdsOf`). Das Ergebnis (`vertices`, `successors`, `edgeIdsOf`) ist deterministisch (Reihenfolge der Knoten) und die gemeinsame Grundlage aller künftigen Abhängigkeitsauswertungen (Blocker/kritischer Pfad, Umstellung von `findDependencies`).
- **Zyklen** (`model/cycles.ts`, `findCycles`): starke Zusammenhangskomponenten mit ≥ 2 Knoten des effektiven Graphen (iterativer Tarjan, kein Rekursions-Stack-Overflow). Ergebnis: `cycles` (je Zyklus die Element-IDs in Knotenreihenfolge, Zyklen nach erstem Element), `nodeIds` (alle beteiligten Elemente) und `edgeIds` (jede explizite Kante, die mindestens ein Paar innerhalb einer Komponente erzeugt). Gruppen mit Mitgliedern sind keine Knoten und erhalten kein Badge; nur eine leere Gruppe, die selbst im Zyklus liegt, wird markiert. Nicht im Zyklus liegende Kanten werden nicht markiert.
- **Darstellung** (immer aktiv, kein Modus – ein Zyklus ist ein Planungsfehler): Kanten violett `#9333ea` (ausgewählt `#6b21a8`), gestrichelt (`6 4`), 3 px, gleichfarbiger Pfeil. Die rote Abhängigkeits-Hervorhebung hat Vorrang vor der Farbe, die Strichelung bleibt. Betroffene Objekte/Gruppen tragen ein violettes Badge (`CycleBadge`, `title`/`aria-label` „Teil eines Zyklus") über `FlowNodeData.isInCycle`. Die Berechnung ist abgeleitet (`useMemo` in `App` aus `nodes`/`edges`), nicht Teil des Modells und nicht persistiert; das Schema (`version: 1`) ändert sich nicht.
- **Navigation**: Toolbar-Bereich „Analyse" zeigt nur bei vorhandenen Zyklen den Warn-Button „⟳ n Zyklen" (Tooltip erklärt die Folgen). Klick = nächster Zyklus (Zähler in `App`, Rundlauf): der Store-Aktion `focusNodes` setzt die Auswahl und einen Fokus-Request (`focusRequest`, reiner UI-Zustand, nicht im Undo-Verlauf); `Canvas` zeigt sie per `getViewportForBounds`/`setViewport` (nicht `fitView`: bei kontrollierten Knoten bleibt es in der Queue hängen).

## 6c. Status, Blocker und kritischer Pfad (vierte Iteration)

- **Status** (`model/status.ts`): normaler Metadateneintrag `status` mit den Werten `offen | in Arbeit | fertig` (wie `color`). Ausgewertet wird er ausschließlich über `getStatusInfo` (`{ status, raw, known }`) bzw. `getStatus`: der **Schlüssel** wird getrimmt und ohne Groß-/Kleinschreibung erkannt (`Status`, ` STATUS `; bei mehreren passenden Einträgen gilt der erste), der **Wert** ebenfalls getrimmt/case-insensitive. Fehlender Eintrag und leerer Wert = `offen` (`raw: undefined`); ein anderer Wert zählt als `offen`, ist aber `known: false` und behält seinen Rohtext. Begründung: Ein Tippfehler im Schlüssel oder Wert darf den Status nicht stillschweigend auf „offen“ kippen und Flaggen erzeugen, die niemand erklären kann. Schema bleibt `version: 1`. Nur Objekte haben einen Status; Gruppen leiten ihren Zustand aus den Mitgliedern ab (Sidebar: „Status aus Mitgliedern: n von m fertig“, read-only). Die Sidebar zeigt für Objekte eine Auswahl statt einer freien Zeile (sie erkennt den Schlüssel ebenfalls case-insensitive, auch eine als „Status“ getippte freie Zeile; beim Save wird er kanonisch als `status` geschrieben); die Reihenfolge beim Speichern ist `name`, `color`, `status`, freie Felder. Ein unbekannter importierter Wert bleibt erhalten und wird als zusätzliche Option „<wert> (unbekannt)“ angeboten; er wird nicht stillschweigend verändert. Bei Gruppen ist `status` eine gewöhnliche freie Zeile.
- **Basis** aller Auswertungen ist `buildEffectiveGraph` (6b); „Nachfolger“ = Voraussetzungen. `findDependencies` läuft jetzt ebenfalls darüber: eine erreichte Gruppe erreicht ihre Mitglieder, hervorgehoben werden die expliziten Kanten, die durchlaufene Paare erzeugen; zusätzlich wird eine Gruppe als erreicht gemeldet, wenn eine durchlaufene Kante an ihr endet (außer sie umgibt einen Startpunkt). `EffectiveGraph` bietet dafür `leavesOf(id)`.
- **Definitionen** (`model/releaseAnalysis.ts`, rein, deterministisch – Tie-Break immer nach Knotenreihenfolge – und iterativ, getestet mit 5000er-Kette):
  - *Offen* = Objekt mit Status ≠ `fertig`. Eine Gruppe ohne Objekte ist Eckpunkt des Graphen (ihre Kanten gehen nicht verloren), hat aber keine eigene Arbeit: nie offen, nie Blocker, nicht gezählt – für Abhängigkeiten also transparent.
  - *Wartet* = von einem offenen Eckpunkt über ≥ 1 Schritt erreichbar (Rückwärts-Suche ab allen offenen Eckpunkten), unabhängig vom eigenen Status. Ein offenes Objekt in einem Zyklus wartet (es erreicht sich selbst; es kann nie bereit werden). Die Definition wird je nach eigenem Status aufgeteilt:
    - *Blockiert* (`blockedIds`) = wartet **und** ist nicht fertig. Gruppen mit einem blockierten Mitglied (beliebige Tiefe) stehen ebenfalls in `blockedIds` und erhalten `blockedMembers`.
    - *Widersprüchlich* (`inconsistentIds`, Gruppen über `inconsistentMembers`) = wartet **und** ist `fertig`. Entscheidung: Ein „fertiges“ Objekt mit offener Voraussetzung ist kein Blocker (es blockiert niemanden zusätzlich und ist nicht „zu tun“), sondern eine Dateninkonsistenz, die der Nutzer klären muss; es bekam früher dieselbe rote Flagge, tauchte aber in keiner Liste auf und verwirrte („alles fertig, warum Flaggen?“). `counts.blocked` zählt nur nicht fertige Objekte, `counts.inconsistent` die Widersprüche; Invariante `open + inProgress === ready + blocked` (gilt auch mit Zyklen, getestet).
  - `blockingDirect` je blockiertem **oder widersprüchlichem** Objekt: direkte Voraussetzungen, die offen oder selbst wartend sind (Tooltips „Blockiert durch: …“ bzw. „Fertig, aber Voraussetzung nicht fertig: …“, höchstens fünf Namen, dann „…“). Bewusst direkt, nicht „die nächsten offenen“: O(Kanten) statt quadratisch, und die Zwischenstufen stehen ohnehin selbst in der Liste.
  - *Unbekannter Status*: `unknownStatusIds` (Objekt → Rohtext) und `counts.unknownStatus`; solche Objekte zählen als `offen`. Zusätzlich liefert `statusInfoById` je Objekt `{ status, raw, known }` (für die Marken am Kasten).
  - *Jetzt umsetzbar* (`readyIds`) = offen und nicht blockiert.
  - *Kritischer Pfad* = längste Kette ab der Auswahl entlang der Voraussetzungen; Gewicht 1 je offenem, 0 je fertigem Objekt (`length` = Anzahl offener Objekte darauf). Berechnet per Kahn-Reihenfolge (Voraussetzungen zuerst) und DP über die Kettentiefe. Ergebnis in Release-Reihenfolge (zuerst zu erledigen zuerst, das Auswahl-Objekt zuletzt) mit den erzeugenden expliziten Kanten (`edgeIdsOf`). Startpunkt: bei mehreren Kandidaten gleicher Länge der erste in Knotenreihenfolge; Starts, die von einem anderen Start aus erreichbar sind, scheiden aus (deren Kette ist dort schon enthalten). Ist nichts offen, ist der Pfad leer (`length: 0`).
  - *Auswahl*: Gruppen starten an allen Mitgliedern; ohne (bekannte) Auswahl gilt das gesamte Projekt (Startpunkte = alle Eckpunkte; `blockers` = alle offenen Objekte).
  - *Blocker der Auswahl*: alle offenen transitiven Voraussetzungen ohne die Auswahl selbst, je `{ id, status, ready, distance }` (kürzeste Schrittzahl); Sortierung: jetzt umsetzbare zuerst, dann nach Kettentiefe (Release-Reihenfolge), dann Knotenreihenfolge. Die Liste enthält nur nicht fertige Objekte.
  - *Zu klären* (`SelectionAnalysis.inconsistent` mit `waitingFor`, `unknownStatus`): Projekt-Scope alle, Auswahl-Scope die betroffenen Objekte unter der Auswahl und ihren transitiven Voraussetzungen (inkl. der Auswahl selbst).
  - *Zyklen*: Liegt ein Zyklus (`findCycles`) im erreichbaren Teilgraphen, ist die längste Kette nicht definiert: `criticalPath: null` und `cycleIds`; die Blocker-Liste wird trotzdem geliefert. Zyklen außerhalb des erreichbaren Teils stören nicht.
- **Darstellung**: Rote Flagge (`BlockedFlag`, Inline-SVG `FlagIcon`) oben links am blockierten Objekt, bei Gruppen im Titel; an derselben Stelle das **amberfarbene Warndreieck** (`InconsistentMark`, `WarningIcon`) für Widersprüche (ein Objekt hat nie beides; eine Gruppe kann beides tragen). Status-Marke unten rechts zeigt **jeden** Zustand: grünes Häkchen = fertig, amberfarbener Halbkreis = in Arbeit, grauer leerer Kreis = offen (Titel „Status: offen“ bzw. „… (nicht gesetzt)“ ohne Eintrag), amberfarbenes „?“ = unbekannter Wert (Titel „Status „x“ unbekannt – zählt als offen“); Gruppen ohne Marke. Begründung: Ein unsichtbarer Zustand („offen“/kein Status) ließ den Nutzer rätseln, warum benachbarte Objekte Flaggen tragen – so kollidiert außerdem nichts mit dem Zyklus-Badge oben rechts. Daten über `FlowNodeData` (`status`, `statusRaw`, `statusKnown`, `blockedTitle`, `inconsistentTitle`), abgeleitet per `useMemo` in `App` (`analyzeProject`), nicht im Modell gespeichert.
- **Analyse-Panel** (`AnalysisPanel`, präsentational): Abschnitt **„Zu klären“** (nur wenn nicht leer, direkt unter den Zählern) mit „Fertig trotz offener Voraussetzung (n)“ (Einträge „C – wartet auf D (offen)“) und „Unbekannter Status (n)“; dazu der Zähler-Chip „n zu klären“ (Summe, gleicher Scope wie die Liste). Einträge öffnen wie alle anderen `revealNode`. Sichtbarkeit: Toolbar-Schalter „Panel“ im Analysemodus, Zustand `analysisPanelVisible` im Store (UI-Zustand, nicht in der History, nicht persistiert; die frühere gegenseitige Ausschließung mit dem Abhängigkeits-Modus und `analysisOpen`/`dependencyMode` entfielen mit 6d). Das Panel lag zunächst als Karte über dem Canvas; seit 6e steht es als Karte in der Spalte rechts (siehe dort). Esc beendet zuerst das aktive Werkzeug, dann blendet es im Analysemodus das Panel aus, danach hebt es die Auswahl auf. Solange die Hervorhebung „Kritischer Pfad“ gewählt ist (Analysemodus), zeichnet der Canvas die Kanten des kritischen Pfads dick rot (`#dc2626`) und dessen Objekte mit rotem Rahmen (gleiche Darstellung wie die Abhängigkeits-Hervorhebung; Zyklus-Strichelung bleibt).
- **Klick auf einen Eintrag**: `revealNode(id)` – zentriert den Knoten (derselbe `getViewportForBounds`/`setViewport`-Weg wie beim Zyklus-Fokus) und lässt ihn kurz aufleuchten; die **Auswahl bleibt unverändert**. Begründung: Ein Auswählen würde den Kontext des Panels (es folgt der Auswahl) unter dem Nutzer wegziehen und bräuchte eine „Zurück“-Funktion mit eigenem Zustand; so lassen sich die Einträge der Reihe nach durchklicken. Der Flash (`revealedId`) ist UI-Zustand und wird vom Canvas nach 1,6 s gelöscht. Fokussieren (Panel-Eintrag wie Zyklus-Button) zentriert in der Canvas-Fläche (seit 6e überdeckt das Panel den Canvas nicht mehr; die frühere Sonderbehandlung `coveredLeftWidth` in `flow/viewport.ts` entfiel samt Tests). Die Größe wird dabei live am DOM gemessen, nicht aus dem gespeicherten Store-Wert, weil die Sidebar der Auswahl folgt und die Fläche im selben Zug verschmälern kann.
- **Markdown-Export** (`formatAnalysisMarkdown`, rein): Überschrift mit Projektname und Auswahl, Zähler (plus „zu klären“, falls > 0), Abschnitt „Zu klären“ (nach den Zählern, nur wenn nicht leer), kritischer Pfad als nummerierte Liste mit Status, Blocker („jetzt umsetzbar“ gekennzeichnet; ohne Auswahl getrennte Abschnitte). `App` schreibt ihn per `navigator.clipboard.writeText` (try/catch) in die Zwischenablage und meldet das Ergebnis über das Banner.
- **Sidebar folgt der Auswahl, Änderungen gelten sofort** (Store-UI-Zustand, nicht in der History; löst die frühere Lösung „Doppelklick + Save + Dirty-Rückfrage“ ab). Entscheidungen:
  - *Ableitung statt Doppelpflege*: `sidebarId`/`sidebarEdgeId` gibt es nicht mehr. Was die Sidebar zeigt, leitet `sidebarTarget(selectedNodeIds, selectedEdgeIds)` (`model/sidebarTarget.ts`, rein) ab: genau ein Element ⇒ `node`, genau eine Kante ⇒ `edge`, mehrere (Objekte und Kanten zusammengezählt) ⇒ `multiple` (nur Hinweis „n Elemente markiert – zum Bearbeiten genau eines auswählen.“), leer ⇒ `none` (zu). Die Exklusivität Objekt/Kante ergibt sich daraus. `openSidebar`/`openEdgeSidebar` (Doppelklick, bleibt als „wirkt wie Klick“) wählen genau dieses Element; `closeSidebar` (×, Esc) leert die Auswahl. Esc beendet zuerst den Verbinden-Modus, blendet dann das Analyse-Panel aus und hebt zuletzt die Auswahl auf. Nach Undo/Redo, Löschen, Gruppieren/Auflösen und Import bleibt die Sidebar konsistent, weil `pruneUi` bzw. die jeweilige Aktion die Auswahl bereinigt.
  - *Werkzeug „Verbinden“* (früher Verbinden-Modus, seit 6e `tool === 'connect'`): Klicks dienen dort der Wahl von Quelle und Ziel und dürfen die Sidebar weder öffnen noch wechseln. Umgesetzt, indem der Store die **Auswahl** mit diesem Werkzeug einfriert (`applyNodeSelection`/`applyEdgeSelection`/`openSidebar`/`openEdgeSidebar` tun dann nichts; × funktioniert). Das ist einfacher und widerspruchsfrei gegenüber einem eigenen „Sidebar-Haltezustand“, denn die Sidebar entspricht so immer der Auswahl.
  - *Live-Übernahme*: Jede gültige Änderung geht über `onChange` sofort an `updateMetadata`/`updateEdgeLabel` (normalisiert über `normalizeMetadata`); es gibt weder „Save“ noch „Ungespeicherte Änderungen“/„Gespeichert“. Der **Entwurf bleibt während des Tippens führend**: Das Formular merkt sich den zuletzt selbst übernommenen normalisierten Stand (`applied`) und lädt den Entwurf nur neu, wenn die Metadaten von außen davon abweichen (Undo/Redo, Import); das Echo der eigenen Übernahme ist gleich `applied` und wird übergangen. So verschwinden Leerzeichen am Rand oder neue Zeilen mit leerem Feldnamen nicht, und der Cursor springt nicht. Anzeige von Farbe/Status liest aus dem normalisierten Entwurf, damit z. B. eine frei getippte Zeile „Status“ im Statusfeld erscheint.
  - *Ungültig*: Doppelte Feldnamen werden sofort am Formular gemeldet (`role="alert"`); das Modell behält dann den letzten gültigen Stand. Das Formular meldet das per Prop-Callback `onInvalidChange` (und `false` beim Schließen/Wechsel) in `sidebarInvalid`.
  - *Rückfrage nur bei ungültigem Entwurf*: Jede Auswahländerung, die das Ziel der Sidebar ändern würde (Klick, Rahmen, `focusNodes`, `openSidebar`, `closeSidebar`), läuft über `requestSelection` im Store. Ist `sidebarInvalid` gesetzt, wird nichts geändert, sondern `pendingSidebarChange` (`{ nodeIds, edgeIds, focus }` = die gewünschte Auswahl) gesetzt; `App` zeigt die `ConfirmDialog` („Ungültige Änderungen an „<Name>“ verwerfen? (doppelter Feldname)“, *Verwerfen* / *Abbrechen*). Ein Klick besteht aus mehreren React-Flow-Ereignissen (alte abwählen, neue wählen): solange eine Änderung gehalten wird, erweitern weitere Ereignisse diese statt der aktuellen Auswahl. Bei gültigem Entwurf gibt es keine Rückfrage. Nicht abgefangen (wie zuvor): Strukturaktionen, die die Auswahl selbst setzen (Objekt anlegen, Gruppieren, Löschen, Undo, Import).
  - *Undo-Bündelung pro Feld*: Das Formular klammert eine Feldbearbeitung mit `onEditStart` (bei jeder Änderung, idempotent) und `onEditEnd` (Verlassen des Feldes, Unmount des Formulars) um `beginGesture`/`endGesture`; ein Feld, vom Fokus bis zum Verlassen (Farbwähler analog), ist ein Undo-Schritt, eine Geste ohne Änderung verfällt. Zeile entfernen, Status wählen und Farbe zurücksetzen sind diskrete Schritte (beenden vorher eine offene Geste); eine neue Zeile mit leerem Feldnamen ändert das Modell nicht und erzeugt keinen Schritt. Wechsel des Elements, Schließen und Undo/Redo beenden eine offene Geste (Unmount bzw. `restore`). Strg/Cmd + Z im Eingabefeld bleibt das native Feld-Undo (die App-Kürzel ignorieren Eingabefelder).
  - *Kein Fokusraub*: Die Sidebar fokussiert beim Öffnen nichts (das Label-Feld der Kante hat kein `autoFocus` mehr), damit Klick/Drag und Tastenkürzel wie Entf auf dem Canvas weiterwirken. Öffnet die Sidebar zusammen mit einer Fokus-Anfrage (Zyklus-Button), misst der Canvas die Fläche live, weil sich der Ausschnitt durch die Sidebar verengt haben kann.
  - Ein Import hat seinen eigenen Dialog (6d) und setzt den Zustand zurück.
- **Toolbar**: Richtungen heißen „→ Voraussetzungen“ (outgoing), „← Betroffene“ (incoming), „↔ Beide“.

## 6d. Toolbar-Modi und Import-Warnung (fünfte Iteration)

**Arbeitsmodi.** Das Aufbauen des Graphen und die Release-Analyse sind verschiedene Tätigkeiten mit verschiedenen Werkzeugen; die Toolbar trennt sie durch einen Segment-Umschalter „Aufbauen | Analysieren“ (zwei Buttons mit `aria-pressed` in einer `role="group"`), rechts vom Projektnamen.

- **Zustand**: `mode: 'build' | 'analyze'` im Store (`model/workMode.ts` liefert Typen und `parseWorkMode`). Reiner UI-Zustand: nicht in der History, kein Undo-Schritt, nicht in `GraphContent`/Export. Der zuletzt gewählte Modus wird pro Browser unter `release-management.ui.v1` (JSON-Objekt `{ "mode": … }`, `storage/uiPreferences.ts`, immer `try/catch`) gemerkt; fehlt der Eintrag, ist er unlesbar oder ungültig, gilt `build`. `appStore.ts` lädt ihn beim Start (4. Parameter von `createGraphStore`) und schreibt bei Änderung zurück.
- **Layout** (links → rechts): Projektname · Umschalter · modusspezifische Bereiche · Verlauf (beide Modi) · Zyklen-Hinweis (beide Modi, nur bei Zyklen) · Datei (beide Modi, ganz rechts). Im Aufbau: Erstellen, Gruppen. In der Analyse: ein Bereich „Analyse“ mit dem Auswahlfeld „Hervorhebung“ und dem Schalter „Panel“. Der Datei-Bereich ist `position: sticky; right: 0` mit weißem Hintergrund (negativer Außenabstand gleicht das Toolbar-Padding aus), damit Export/Import und der Umschalter (links, dort beginnt der Scroll) auch bei der horizontal scrollenden Toolbar erreichbar bleiben.
- **Hervorhebung** ersetzt „Abhängigkeiten“-Button, Richtungs-Select und die gegenseitige Ausschließung von Panel und `dependencyMode`: `highlight: 'critical' | 'outgoing' | 'incoming' | 'both' | 'off'` (Standard `critical`) und `analysisPanelVisible` (Standard `true`; ein Wechsel in den Analysemodus blendet das Panel wieder ein, damit der Modus nie „leer“ erscheint). Kritischer Pfad und Abhängigkeits-Hervorhebung nutzen weiter dieselben Darstellungsfelder (`isDependency`, dick rot); es gilt immer genau eine Hervorhebung. Der kritische Pfad wird auch bei ausgeblendetem Panel berechnet (`App`: `analyzeSelection` läuft, sobald Panel oder kritischer Pfad gebraucht werden). Im Aufbaumodus gibt es keine Hervorhebung (Zyklen bleiben immer sichtbar). Die Richtungs-Hervorhebung ohne Auswahl zeigt den Hinweis „Objekt markieren …“; der kritische Pfad braucht keine Auswahl (ohne Auswahl: ganzes Projekt).
- **Strukturschutz** (Analysemodus): Der Store sperrt `addNodeAt`, `connect`, `setTool` (außer auf `select`), `pickForConnect`, `groupSelection`, `ungroupSelection`, `deleteSelection`, `updateDropTarget` und das Umhängen in `finishDrag` defensiv (stilles No-Op, getestet) – die Sperre sitzt im Store statt nur in den Buttons, damit weder Tastenkürzel (Entf) noch React-Flow-Events sie umgehen. Der Canvas setzt zusätzlich `nodesConnectable={false}` und blendet die Konnektoren aus (`opacity: 0` statt `display: none`, damit React Flow die Handle-Positionen der Kanten weiter messen kann); `deleteKeyCode` ist ohnehin `null`. Der Wechsel in den Analysemodus beendet den Verbinden-Modus. **Erlaubt bleiben** Verschieben und Größe ändern (die Gruppenzugehörigkeit ändert sich nicht, kein Drop-Ziel), die Sidebar-Bearbeitung (Status, Metadaten, Kanten-Label, Farbe), Projektumbenennung, Rückgängig/Wiederholen, Export und Import. Begründung: Der Release-Manager pflegt im Analysemodus den Status, soll dabei aber nicht versehentlich die Struktur ändern. Rückgängig/Wiederholen bleibt bewusst in beiden Modi, damit eine Änderung nicht an den Moduswechsel gebunden ist.

**Import mit klarer Warnung vor Datenverlust.** Die frühere Rückfrage „Aktuelle Änderungen verwerfen?“ sagte nicht, *was* verloren geht, und bot keinen Ausweg.

- **Export-Fingerabdruck** (`model/fingerprint.ts`, `contentFingerprint`): 64-Bit-FNV-1a (16 Hex-Ziffern) über `serializeModel(toModel(content))`, also über dasselbe kanonische JSON wie die Export-Datei (unabhängig von Objektidentität und von der Speicherreihenfolge Eltern/Kinder). Er ist keine Kryptografie, sondern macht eine zufällige Übereinstimmung nach einer Änderung hinreichend unwahrscheinlich. Der Store hält `exportedFingerprint` (UI-Zustand); `markExported()` setzt ihn nach dem Export, `importText` nach einem erfolgreichen Import. `appStore.ts` persistiert ihn unter `release-management.lastExport.v1` und lädt ihn beim Start. „Ungesicherte Änderungen“ = Fingerabdruck des aktuellen Inhalts ≠ gespeicherter (oder keiner gespeichert); er wird nur beim Öffnen des Dialogs berechnet, nicht bei jeder Änderung. Weil verglichen wird (kein Dirty-Flag), zählt „Änderung und wieder rückgängig“ als gesichert. Das Projekt ist bewusst auch dann „nicht exportiert“, wenn es nur den unveränderten Starterstand enthält und nie exportiert wurde.
- **Dialog** (`ImportDialog`, präsentational, natives `<dialog>` wie `ConfirmDialog`; der gemeinsame Teil – `open`-Synchronisation, jsdom-Fallback – liegt in `useNativeDialog`): Titel „Projekt ersetzen?“; Text „Der Import ersetzt das aktuelle Projekt „<Name>“ (n Objekte, n Gruppen, n Verbindungen)“ (mit Singular); bei ungesicherten Änderungen eine hervorgehobene Warnung (`role="alert"`), sonst „Der aktuelle Stand wurde bereits exportiert.“; Hinweis, dass der Import in dieser Sitzung mit „Rückgängig“ zurückgenommen werden kann (stimmt: Import ist ein Undo-Schritt; der Verlauf überlebt kein Neuladen). Buttons: „Abbrechen“ (Esc ruft ebenfalls ab), „Ohne Export importieren“ (Gefahr-Stil bei ungesicherten Änderungen, sonst normal), „Exportieren und importieren“ (primär bei ungesicherten Änderungen, sonst sekundär). Fokus beim Öffnen: auf der jeweils ungefährlichen Hauptaktion (bei ungesicherten Änderungen der Export), damit ein versehentliches Enter nichts verliert.
- **Ablauf „Exportieren und importieren“**: derselbe Export wie der Toolbar-Button (gleicher Dateiname, danach `markExported`), dann *im selben Klick-Handler* und ohne `await` davor `pickTextFile()`, weil ein Datei-Dialog eine Nutzer-Geste braucht. Bricht der Nutzer die Dateiauswahl ab, bleibt das Projekt unverändert (der Export ist trotzdem passiert). Eine ungültige Datei zeigt wie bisher die Fehlerliste, das Modell bleibt unverändert und der Fingerabdruck unberührt.

**Nebenbefund.** `analyzeSelection` lieferte für ein leeres Projekt einen kritischen Pfad mit einem undefinierten Eintrag und ließ die App bei sichtbarem Panel abstürzen; jetzt ist der Pfad leer (Test ergänzt). Seit der Modus gemerkt wird, kann das Panel direkt beim Start sichtbar sein.

## 6e. Werkzeuge, Karten-Layout und Status im Panel (sechste Iteration)

Entscheidungen des Nutzers: Anlegen und Verbinden schließen sich gegenseitig aus; im Analysemodus steht die Analyse rechts und die Sidebar ist aus.

- **Werkzeuge**: `tool: 'select' | 'create' | 'connect'` (`model/workMode.ts`, Standard `select`) ersetzt `connectMode` im Store. Reiner UI-Zustand (nicht in der History, nicht persistiert). `setTool` setzt `connectSourceId` zurück (Quelle gilt nur für `connect`: „kein Quelle gewählt“ = `connectSourceId === null`, die Zwischenzustände `pickSource`/`pickTarget` und der Typ `ConnectMode` entfielen). Im Analysemodus ist nur `select` möglich (`setTool` ist sonst ein No-Op); der Wechsel in den Analysemodus und ein Import setzen auf `select` zurück. Esc geht in `App` vor allen anderen Stufen zurück auf `select`. Kürzel V / N / C in `App` (nicht in Eingabefeldern/Dialogen, nicht mit Strg/Cmd/Alt, nur im Aufbaumodus). Die Toolbar zeigt drei Buttons in einem Segment-Umschalter (`role="group"`, `aria-pressed`, Icon + Kurztext „Auswählen“, „Objekt“, „Verbinden“; der zugängliche Name steht im `aria-label`, z. B. „Objekt anlegen“, damit er auch bei ausgeblendetem Text bleibt). Der frühere Button „Objekt anlegen“ (Objekt in der Mitte) entfiel. Die Anweisung des aktiven Werkzeugs („Quelle anklicken …“) steht als schwebender Hinweis (`ToolHint`, `role="status"`) oben im Canvas statt in der Toolbar, damit sie die Toolbar nicht verbreitert.
- **Objekt per Klick anlegen**: Reine Logik in `model/placement.ts`: `placeNewNode(nodes, center)` bestimmt die tiefste Gruppe am Klickpunkt (`graph.findGroupAtPoint`, aus `findDropTargetGroup` herausgelöst) und die freie Stelle (`findFreePosition` mit neuem `scope`: Vorfahren-Gruppen zählen nicht als Hindernis, die Fläche der Gruppe unter ihrem Titel ist die Grenze, damit das Objekt nicht aus der Gruppe geschoben wird; ist die Gruppe voll, wird die Wunschposition in sie hineingeklemmt). `addNodeAtPoint(content, center, newId)` legt das Objekt oben an und hängt es mit `reparent` um (Bildschirmposition bleibt, Position wird relativ). `addNodeAt(center)` im Store ruft das auf und wählt das Objekt **über `requestSelection`** aus, sodass ein ungültiger Sidebar-Entwurf auch hier erst nach Rückfrage verworfen wird (die frühere Fassung verwarf ihn still). Der Canvas übersetzt nur Events: `screenToFlowPosition(clientX, clientY)`, und nur bei `tool === 'create'`. Der Körper einer **Gruppe** ist ein Knoten und fängt den Klick ab: dort (nicht auf dem Titel) gilt er als freie Stelle in der Gruppe, der Titel wählt sie weiter aus. Cursor Fadenkreuz über `.flow--create`.
- **Layout**: Arbeitsbereich grau (`--gray-100`), Canvas, Sidebar und Analyse-Panel sind Karten (1 px `--gray-300`, Radius 10 px, leichter Schatten, 12 px Abstand). Im Analysemodus steht das Panel als Spalte rechts (`--sidebar-width`, 340 px) und überdeckt den Canvas nicht mehr. Die Sidebar wird dort **nicht ausgehängt, sondern nur mit `hidden` ausgeblendet** (`SidebarProps.hidden`): So bleiben Auswahl und ein ungültiger Entwurf erhalten, und ein stilles Verwerfen durch das Aushängen ist ausgeschlossen. Unter 720 px liegen beide Karten als Overlay (absolut, unter der Toolbar) über dem Canvas.
- **Status im Panel**: Block „Auswahl: <Name>“ oben im Panel bei genau einem ausgewählten Objekt/einer Gruppe (`AnalysisSelected` in `props.ts`, in `App` aus `sidebarTarget` abgeleitet). Objekt: Auswahlfeld wie in der Sidebar (unbekannter Wert als „… (unbekannt)“, bleibt erhalten) über `setStatus(id, status)` → `graph.setStatus` → `status.withStatusEntry` (erster Status-Eintrag wird an Ort und Stelle ersetzt und kanonisch als `status` geschrieben, sonst direkt nach `name`/`color` eingefügt, dann `normalizeMetadata`); ein Undo-Schritt je Änderung, kein Schritt bei unverändertem Wert; funktioniert im Analysemodus (kein Strukturschutz). Gruppe: nur „Status aus Mitgliedern: n von m fertig“. Die Sidebar-Form übernimmt die Änderung über den bestehenden „kam von außen“-Abgleich.
- **Breite** (Messung bei 1024 px, Dev-Server): Vorher 1176 px Inhalt im Aufbaumodus. Jetzt zeigt der Werkzeug-Umschalter unter 1340 px nur Icons (Tooltips nennen Name und Kürzel), unter 1100 px zusätzlich kürzerer Zyklen-Button, Projektname höchstens 120 px und kleineres Toolbar-Padding. Ergebnis: kein seitliches Scrollen in beiden Modi, auch nicht mit Zyklen-Button.
- **Modus-Icons**: Aufbauen = Graph (drei Kreise, verbunden), Analysieren = Zauberstab mit Funkeln („KI“), Inline-SVG, `currentColor`, `aria-hidden`.
- **Auswahl bleibt sichtbar**: Öffnet die Auswahl die Sidebar (bzw. verengt das Analyse-Panel die Fläche) und rutscht das ausgewählte Objekt dadurch aus dem sichtbaren Bereich – etwa ein gerade nahe dem rechten Rand angelegtes –, schiebt der Canvas die Ansicht gerade so weit, dass es mit 24 px Abstand wieder sichtbar ist (`flow/reveal.ts`, Zoom bleibt). Ist es schon sichtbar, bleibt die Ansicht ruhig; während des Ziehens wird nicht verschoben, ein expliziter Fokus (Zyklen, Panel-Eintrag) hat Vorrang.

## 7. Persistenz

- Schlüssel `release-management.graph.v1` im `localStorage` (Modell). Daneben, getrennt vom Modell und nicht im Export: `release-management.ui.v1` (zuletzt gewählter Arbeitsmodus) und `release-management.lastExport.v1` (Export-Fingerabdruck, siehe 6d).
- Gespeichert wird bei jeder Modelländerung (gebündelt/debounced ~150 ms, zusätzlich beim Verlassen der Seite). Reine Auswahl-/UI-Zustände lösen kein Speichern aus.
- Start: gespeichertes Modell laden und validieren; fehlt es → Default (zwei verbundene Objekte „Projekt A" → „Projekt B"); ist es ungültig → Default plus Hinweis, die defekte Rohfassung bleibt unter `…v1.corrupt` erhalten.

## 8. Architektur

```
src/model/       reine Domänenlogik (types, metadata, graph, serialize, defaultModel) – kein React
src/storage/     localStorage-Zugriff (try/catch) und Datei-Download/-Upload
src/store/       zustand-Store: Modell + UI-Zustand (Auswahl, Werkzeug, Modus), Persistenz-Anbindung
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
2. „Beim Laden der Seite importieren" wird als „Import jederzeit über die Toolbar, auch direkt nach dem Laden" umgesetzt; der Dialog „Projekt ersetzen?“ erscheint immer vor der Dateiauswahl.
3. Die Sidebar übernimmt Änderungen sofort; es gibt keinen Speichern-Button (früher „Save", durch die Live-Übernahme ersetzt, siehe 6c).
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
