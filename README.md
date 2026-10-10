# Release-Management – Abhängigkeitsgraph

Browser-Werkzeug für das Release-Management: Abhängigkeiten zwischen Projekten als Graph
modellieren, erkennen und austauschen. Läuft komplett im Browser, **ohne Server/Backend**
(React + TypeScript + Vite + [React Flow](https://reactflow.dev)).

## Schnellstart

Voraussetzung: Node.js ≥ 22.12 und npm.

```bash
npm install
npm run dev        # Entwicklung mit Hot-Reload (http://localhost:5173)
npm test           # Unit-Tests (Vitest)
npm run typecheck  # TypeScript
npm run lint       # oxlint
npm run build      # Produktions-Build nach dist/ (statische Dateien)
npm run preview    # gebauten Stand lokal ansehen
```

`dist/` kann von jedem statischen Webserver ausgeliefert werden (GitHub Pages, nginx, …).

## Anforderungen

### Graph

1. Über eine **Toolbar** legt der Benutzer **Objekte** an und **verbindet** sie miteinander. Objekte erscheinen als **blaue Kästen**, Verbindungen als **blaue Linien** (mit Pfeil von Quelle zu Ziel). Dadurch entsteht ein Graph.
2. Jedes neue Objekt erhält initial eine **generierte UUID**.
3. Objekte können **Metadaten** haben, mindestens einen **Namen**.

### Metadaten bearbeiten

4. Per **Doppelklick** auf ein Objekt öffnet sich rechts im Browser eine **Sidebar**, in der die Metadaten bearbeitet werden.
5. Die **UUID** ist dort als **`disabled`**-Feld zu sehen (nicht editierbar).
6. **Weitere Felder** lassen sich einfach hinzufügen und eintragen. Der **Feldname** (Attribut des Metadatums) ist **frei wählbar**.
7. **Felder ohne Attributnamen werden ignoriert.** **Leere Werte sind erlaubt.** Feldnamen und Werte werden **getrimmt** (Leerzeichen am Rand entfallen).
8. Der Benutzer übernimmt die Metadaten per **„Save"**.

### Gruppen (Sub-Graphen)

9. Der Benutzer kann Objekte zu einer **Gruppe** zusammenfassen. Eine Gruppe hat – wie ein Objekt – eine UUID und **Metadaten** (Name + freie Felder, Bearbeitung per Doppelklick wie in 4.–8.). Fachlich entspricht eine Gruppe einem **Sub-Graphen**: Sie enthält Objekte und weitere Gruppen; Verbindungen sind innerhalb, außerhalb und zu Gruppen möglich.

### Konnektoren, Rückgängig, Abhängigkeitsgraph, Farbe

10. Jedes Objekt (und jede Gruppe) hat **vier Konnektoren** – oben, rechts, unten, links. Eine Verbindung kann an jedem Konnektor beginnen und enden; die gewählten Seiten werden mit der Kante gespeichert.
11. Änderungen lassen sich **rückgängig machen** (Strg/Cmd + Z, Button „Rückgängig") und **wiederholen** (Strg/Cmd + Umschalt + Z bzw. Strg + Y, Button „Wiederholen"). Ein Verschieben/Größe ändern zählt als ein Schritt; der Verlauf umfasst bis zu 100 Schritte pro Sitzung.
12. Aus den verbundenen Objekten wird **automatisch ein Abhängigkeitsgraph ermittelt**: Mit „Abhängigkeiten“ und einem markierten Objekt werden alle Verbindungen, die von der Auswahl aus (transitiv) erreichbar sind, **dick und rot** gezeichnet; die erreichten Objekte erhalten einen roten Rahmen. Die Auswertung läuft auf Objektebene (Gruppen-Semantik wie in 16.): eine Verbindung zu oder von einer **Gruppe** gilt für alle ihre Mitglieder, eine erreichte Gruppe erreicht also alle ihre Mitglieder; eine markierte Gruppe startet an allen Mitgliedern. Die Richtung ist wählbar: *→ Voraussetzungen* (wovon die Auswahl abhängt, in Pfeilrichtung), *← Betroffene* (was von der Auswahl abhängt, gegen die Pfeilrichtung), *↔ Beide* (gesamter verbundener Teilgraph). Die Hervorhebung folgt der Auswahl und schließt sich mit der Release-Analyse (22.) gegenseitig aus.
13. In der Sidebar ist die **UUID grau** dargestellt (gestrichelter Rand, Hinweis „nicht editierbar"), damit erkennbar ist, dass sie nicht änderbar ist.
14. Die Sidebar enthält ein Feld **`color`** mit **Farbwähler**. Die Farbe wird **Hintergrund- und Rahmenfarbe** des Objekts (bei Gruppen: Rahmen, Titel und leichte Tönung) und in der Minimap verwendet; die Schriftfarbe passt sich automatisch an. „Zurücksetzen" stellt das Standard-Blau wieder her.

### Beschriftung von Pfeilen

15. Auch **Pfeile (Verbindungen)** lassen sich beschriften. Ein **Doppelklick auf den Pfeil** öffnet dieselbe Sidebar wie bei Objekten; sie zeigt die UUID der Verbindung (nicht editierbar) und genau ein Feld **„Label"**, das anfangs leer ist. Das Label (getrimmt) erscheint mittig auf dem Pfeil; ein leeres Label entfernt die Beschriftung. Änderungen sind rückgängig machbar.

### Zyklen

16. **Bedeutung der Pfeile:** Ein Pfeil **A → B** heißt „**A hängt von B ab**" (B muss vor A released werden). Eine Verbindung zu oder von einer **Gruppe** gilt für **alle (auch verschachtelten) Mitglieder** der Gruppe: „X hängt von Gruppe G ab" heißt, X hängt von allen Objekten in G ab; „G hängt von Y ab" heißt, alle Objekte in G hängen von Y ab. Eine Gruppe ohne Objekte steht für sich selbst.
17. **Zyklen** (A hängt direkt oder über andere von sich selbst ab) verhindern eine gültige Release-Reihenfolge und werden **immer automatisch erkannt** (kein Modus): die beteiligten Verbindungen sind **violett, gestrichelt und dick** (3 px; die rote Abhängigkeits-Hervorhebung hat Vorrang vor der Farbe, die Strichelung bleibt), die beteiligten Objekte tragen ein **violettes Zyklus-Badge** („Teil eines Zyklus").
18. In der Toolbar (Bereich „Analyse") erscheint, solange Zyklen existieren, der Warn-Button **„⟳ n Zyklen"**. Ein Klick wählt nacheinander die Objekte des nächsten Zyklus aus und zeigt sie im Ausschnitt.

### Projektname

19. Das Projekt hat einen **Namen**, der in der Toolbar steht und anfangs immer **`Release-Management`** lautet. Ein **Doppelklick** (oder Enter bzw. F2 auf dem fokussierten Namen) öffnet ihn **inline** zum Bearbeiten; Enter oder Verlassen des Feldes übernimmt, Esc verwirft. **Erlaubt sind nur die Zeichen `A-Z a-z 0-9 - _ .`** (1 bis 100 Zeichen); andere Zeichen werden beim Tippen und Einfügen entfernt, mit Hinweis. Der Name wird mit dem Modell gespeichert, exportiert und importiert, erscheint im Browser-Tab und ist rückgängig machbar.

### Status, Blocker und kritischer Pfad

20. Jedes Objekt hat einen **Status** (`offen`, `in Arbeit`, `fertig`), gesetzt in der Sidebar über eine Auswahl (Metadatenfeld `status`; fehlt es oder ist der Wert unbekannt, gilt `offen`). Ein unbekannter importierter Wert bleibt erhalten und wird in der Sidebar als „… (unbekannt)“ angeboten. Gruppen haben keinen eigenen Status; die Sidebar zeigt für sie „Status aus Mitgliedern: n von m fertig“. Auf dem Objekt erscheint ein grünes Häkchen (fertig) bzw. ein amberfarbener Halbkreis (in Arbeit).
21. **Blockiert** ist ein Objekt, das (direkt oder über andere) von mindestens einem Objekt abhängt, das nicht `fertig` ist – unabhängig vom eigenen Status; auch ein „fertiges“ Objekt mit offener Voraussetzung ist blockiert (Inkonsistenz). Blockierte Objekte tragen eine **rote Flagge** oben links (Tooltip „Blockiert durch: …“ mit den direkten Voraussetzungen, höchstens fünf Namen), Gruppen mit blockiertem Mitglied eine Flagge im Titel. Objekte in einem Zyklus gelten als blockiert (sie werden nie bereit). **Jetzt umsetzbar** sind nicht fertige Objekte ohne nicht fertige Voraussetzung.
22. Der Toolbar-Button **„Release-Analyse“** (Bereich „Analyse“) blendet links über dem Graphen ein Panel ein, das der Auswahl folgt (ohne Auswahl: das gesamte Projekt): Zähler (fertig / in Arbeit / offen / blockiert / jetzt umsetzbar), der **kritische Pfad** und die **blockierenden Objekte**. Der kritische Pfad ist die längste Kette noch nicht fertiger Voraussetzungen ab der Auswahl (fertige Objekte zählen 0), aufgelistet in Release-Reihenfolge (zuerst zu erledigen zuerst) und im Graph **dick rot** gezeichnet (Objekte mit rotem Rahmen). Enthält der betrachtete Teilgraph einen Zyklus, ist er nicht berechenbar (Hinweis mit den beteiligten Objekten). Blocker erscheinen mit Status, „jetzt umsetzbar“ zuerst; ohne Auswahl getrennt nach „Jetzt umsetzbar“ und „Blockiert“. Ein Klick auf einen Eintrag zeigt das Objekt im Graph (zentriert und kurz hervorgehoben), die Auswahl bleibt unverändert. **„Als Markdown kopieren“** legt die Analyse in die Zwischenablage; Esc oder × schließen das Panel.

### Persistenz und Austausch

23. Das Modell des Graphen wird **bei jeder Änderung im `localStorage`** des Browsers gespeichert.
24. Beim **Neuladen** der Seite wird zuerst im `localStorage` nach einem Modell aus einer früheren Sitzung gesucht und – falls vorhanden – geladen. Andernfalls werden **initial zwei miteinander verbundene Objekte** angezeigt.
25. Über einen **Button der Toolbar** kann das Modell **exportiert** werden (Format: **JSON**, siehe unten). Der **Dateiname** lautet `<Projektname>_<JJJJ-MM-TT>_<HHmmss>.json` (lokale Zeit), z. B. `Release-Management_2026-10-09_141022.json`.
26. Der Benutzer kann ein Modell aus einer **JSON-Datei importieren**. **Vorher wird gefragt, ob die aktuellen Änderungen verworfen werden sollen.** Ungültige Dateien werden mit Fehlerliste abgelehnt; das aktuelle Modell bleibt dann unverändert.

### Rahmenbedingungen

27. Rein clientseitig (`npm` + `vite`), keine Server-Abhängigkeit zur Laufzeit.
28. Eingesetzte Technik: React Flow für die Graph-Darstellung und -Interaktion.

## Bedienung

| Aktion | So geht's |
|---|---|
| Objekt anlegen | Toolbar → **Objekt anlegen** (erscheint in der Mitte des sichtbaren Ausschnitts, an einer freien Stelle) |
| Verbinden | Einen der vier Konnektoren (kleine Kreise am Rand) auf einen Konnektor eines anderen Elements ziehen **oder** Toolbar → **Verbinden**, dann Quelle und Ziel anklicken (die einander zugewandten Seiten werden gewählt; Esc beendet) |
| Metadaten bearbeiten | Doppelklick auf Objekt/Gruppe → Sidebar → **Save** |
| Pfeil beschriften | Doppelklick auf den Pfeil → Feld **Label** → **Save** |
| Gruppieren | Elemente markieren (Strg/Cmd + Klick, oder Shift gedrückt halten und einen Rahmen aufziehen) → **Gruppieren** |
| Gruppe auflösen | Gruppe markieren → **Gruppe auflösen** (Inhalt bleibt erhalten) |
| In/aus Gruppe ziehen | Element auf eine Gruppe ziehen und loslassen bzw. aus ihr herausziehen. Ein Element, das mit einer Gruppe verbunden ist, kann nicht in genau diese Gruppe aufgenommen werden (es erscheint ein Hinweis). |
| Löschen | Markieren → **Löschen** oder Entf-Taste (bei Gruppen: nur die Gruppe, der Inhalt bleibt) |
| Rückgängig / Wiederholen | Strg/Cmd + Z bzw. Strg/Cmd + Umschalt + Z (oder Strg + Y), oder die Icon-Buttons ↶ ↷ der Toolbar |
| Hilfe zur Toolbar | Mit der Maus über einen Button fahren (oder per Tab fokussieren): Ein Tooltip erklärt die Funktion, nennt das Tastenkürzel und sagt bei deaktivierten Buttons, was fehlt |
| Zyklen finden | Toolbar → Warn-Button **⟳ n Zyklen** (nur sichtbar, wenn es Zyklen gibt): wählt den nächsten Zyklus aus und zeigt ihn; Zyklus-Verbindungen sind violett gestrichelt |
| Abhängigkeiten anzeigen | Objekt markieren → Toolbar → **Abhängigkeiten**, Richtung im Auswahlfeld wählen (*→ Voraussetzungen*, *← Betroffene*, *↔ Beide*) |
| Farbe ändern | Doppelklick → Sidebar → Feld **Farbe (color)** → **Save** |
| Status setzen | Doppelklick → Sidebar → Feld **Status** (offen / in Arbeit / fertig) → **Save** |
| Blocker erkennen | Rote Flagge am Objekt (Tooltip nennt die blockierenden Voraussetzungen); Gruppen: Flagge im Titel |
| Release-Analyse | Toolbar → **Release-Analyse** (Toggle): Panel links mit Zählern, kritischem Pfad und Blockern der Auswahl bzw. des Projekts; Eintrag anklicken zeigt das Objekt, **Als Markdown kopieren** exportiert den Bericht, Esc schließt |
| Projekt umbenennen | Doppelklick auf den Projektnamen in der Toolbar, Enter übernimmt, Esc bricht ab |
| Export / Import | Toolbar → **Export** / **Import** |

## Datenformat (JSON)

Der Export entspricht exakt dem im `localStorage` abgelegten Modell (Schlüssel `release-management.graph.v1`):

```json
{
  "version": 1,
  "projectName": "Release-Management",
  "nodes": [
    {
      "id": "0b1f6c3e-…",
      "kind": "group",
      "position": { "x": 40, "y": 40 },
      "size": { "width": 420, "height": 220 },
      "metadata": [
        { "key": "name", "value": "Plattform" },
        { "key": "color", "value": "#16a34a" },
        { "key": "owner", "value": "Team A" }
      ]
    },
    {
      "id": "7d2a91f0-…",
      "kind": "node",
      "parentId": "0b1f6c3e-…",
      "position": { "x": 24, "y": 56 },
      "metadata": [
        { "key": "name", "value": "Service A" },
        { "key": "status", "value": "in Arbeit" }
      ]
    }
  ],
  "edges": [
    { "id": "c4e8…", "source": "7d2a91f0-…", "target": "…", "sourceHandle": "right", "targetHandle": "left" }
  ]
}
```

- `projectName` (optional): Projektname, nur `A-Z a-z 0-9 - _ .`; fehlt er, gilt `Release-Management`.
- `kind`: `node` (blauer Kasten) oder `group` (Gruppe/Sub-Graph).
- `parentId` (optional) verweist auf eine Gruppe; `position` ist dann relativ zu dieser Gruppe.
- `metadata` ist eine geordnete Liste; der Eintrag `name` steht immer an erster Stelle.
- Kanten sind gerichtet: von `source` nach `target`; „`source` hängt von `target` ab"; bei Gruppen gilt die Kante für alle Mitglieder. `label` ist optional (Beschriftung). `sourceHandle`/`targetHandle` (`top`, `right`, `bottom`, `left`) sind optional; fehlen sie (ältere Dateien), werden die einander zugewandten Seiten gezeichnet.
- `color` ist ein optionaler Metadateneintrag der Form `#rrggbb`; andere Werte werden wie „keine Farbe" behandelt.

**Warum JSON statt XML?** Gleiches Format wie im `localStorage`, nativer Parser, und freie
Feldnamen (z. B. `Release-Datum`) wären als XML-Elementnamen ungültig.

## Projektstruktur

```
src/model/       reine Domänenlogik (Typen, Metadaten, Gruppen/Kanten, Validierung/Serialisierung)
src/storage/     localStorage und Datei-Download/-Upload
src/store/       zustand-Store (Modell + UI-Zustand)
src/flow/        Anbindung an React Flow (Canvas, Mapping)
src/components/  Toolbar, Sidebar, Knoten, Dialoge
docs/superpowers/specs/   Konzept und Entscheidungen
```

Das ausführliche Konzept steht in [docs/superpowers/specs/2026-10-10-release-management-design.md](docs/superpowers/specs/2026-10-10-release-management-design.md).
