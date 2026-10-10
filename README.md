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

1. Über eine **Toolbar** legt der Benutzer (im Modus *Aufbauen*, siehe 29.–32.) **Objekte** an und **verbindet** sie miteinander. Objekte erscheinen als **blaue Kästen**, Verbindungen als **blaue Linien** (mit Pfeil von Quelle zu Ziel). Dadurch entsteht ein Graph.
2. Jedes neue Objekt erhält initial eine **generierte UUID**.
3. Objekte können **Metadaten** haben, mindestens einen **Namen**.

### Metadaten bearbeiten

4. Ein **einfacher Klick** auf ein Objekt wählt es aus; rechts im Browser zeigt die **Sidebar**, die der Auswahl folgt, seine Metadaten zum Bearbeiten (ein Doppelklick wirkt wie ein Klick, ist aber nicht nötig). Klick auf ein anderes Element ⇒ die Sidebar zeigt sofort dieses. Sind **mehrere** Elemente markiert (Rahmen, Strg/Cmd + Klick), steht dort nur der Hinweis „n Elemente markiert – zum Bearbeiten genau eines auswählen.“. Bei leerer Auswahl (Klick ins Leere, Esc) ist die Sidebar geschlossen; **×** schließt sie und hebt die Auswahl auf. Mit dem Werkzeug *Verbinden* (siehe 32.) dienen Klicks der Wahl von Quelle und Ziel: Die Sidebar öffnet oder wechselt dann nicht.
5. Die **UUID** ist dort als **`disabled`**-Feld zu sehen (nicht editierbar).
6. **Weitere Felder** lassen sich einfach hinzufügen und eintragen. Der **Feldname** (Attribut des Metadatums) ist **frei wählbar**.
7. **Felder ohne Attributnamen werden ignoriert.** **Leere Werte sind erlaubt.** Feldnamen und Werte werden **getrimmt** (Leerzeichen am Rand entfallen).
8. **Es gibt kein „Save“.** Jede Änderung in der Sidebar (Name, Farbe, Status, freie Felder hinzufügen/ändern/entfernen, Verbindungs-Label) wird **sofort** ins Modell übernommen und ist im Graph sichtbar (und damit gespeichert, siehe 23.). Übernommen wird der normalisierte Stand (getrimmt, Zeilen ohne Feldnamen entfallen); das Formular behält dabei, was getippt wurde (z. B. ein Leerzeichen am Ende, eine neue Zeile mit noch leerem Feldnamen) und lädt sich nur neu, wenn sich das Modell von außen ändert (Rückgängig/Wiederholen, Import). **Doppelte Feldnamen** sind ein Fehler: Er wird am Feld angezeigt, solange er besteht, bleibt das Modell auf dem letzten gültigen Stand. Nur in diesem Fall werden Änderungen **nie stillschweigend verworfen**: Wechselt die Auswahl oder wird die Sidebar (×) geschlossen, fragt ein Dialog „Ungültige Änderungen an „<Name>“ verwerfen? (doppelter Feldname)“ (*Verwerfen* / *Abbrechen*; bei *Abbrechen* bleibt alles unverändert). Bei gültigem Formular gibt es keine Rückfrage.

### Gruppen (Sub-Graphen)

9. Der Benutzer kann Objekte zu einer **Gruppe** zusammenfassen. Eine Gruppe hat – wie ein Objekt – eine UUID und **Metadaten** (Name + freie Felder, Bearbeitung per Klick wie in 4.–8.). Fachlich entspricht eine Gruppe einem **Sub-Graphen**: Sie enthält Objekte und weitere Gruppen; Verbindungen sind innerhalb, außerhalb und zu Gruppen möglich.

### Konnektoren, Rückgängig, Abhängigkeitsgraph, Farbe

10. Jedes Objekt (und jede Gruppe) hat **vier Konnektoren** – oben, rechts, unten, links. Eine Verbindung kann an jedem Konnektor beginnen und enden; die gewählten Seiten werden mit der Kante gespeichert.
11. Änderungen lassen sich **rückgängig machen** (Strg/Cmd + Z, Button „Rückgängig") und **wiederholen** (Strg/Cmd + Umschalt + Z bzw. Strg + Y, Button „Wiederholen"). Ein Verschieben/Größe ändern zählt als ein Schritt, ebenso **eine Bearbeitung eines Sidebar-Feldes** (vom Hineinklicken bis zum Verlassen des Feldes, auch der Farbwähler); Zeile entfernen, Status wählen und Farbe zurücksetzen sind je ein Schritt. In einem Eingabefeld gilt Strg/Cmd + Z das Feld-Undo des Browsers; der Verlauf umfasst bis zu 100 Schritte pro Sitzung.
12. Aus den verbundenen Objekten wird **automatisch ein Abhängigkeitsgraph ermittelt**: Im Modus *Analysieren* werden mit der **Hervorhebung** „→ Voraussetzungen“, „← Betroffene“ oder „↔ Beide“ und einem markierten Objekt alle Verbindungen, die von der Auswahl aus (transitiv) erreichbar sind, **dick und rot** gezeichnet; die erreichten Objekte erhalten einen roten Rahmen. Die Auswertung läuft auf Objektebene (Gruppen-Semantik wie in 16.): eine Verbindung zu oder von einer **Gruppe** gilt für alle ihre Mitglieder, eine erreichte Gruppe erreicht also alle ihre Mitglieder; eine markierte Gruppe startet an allen Mitgliedern. Die Richtung ist wählbar: *→ Voraussetzungen* (wovon die Auswahl abhängt, in Pfeilrichtung), *← Betroffene* (was von der Auswahl abhängt, gegen die Pfeilrichtung), *↔ Beide* (gesamter verbundener Teilgraph). Die Hervorhebung folgt der Auswahl; es gilt immer genau eine Hervorhebung (kritischer Pfad, eine Richtung oder keine, siehe 30.), unabhängig davon, ob das Panel der Release-Analyse (22.) eingeblendet ist.
13. In der Sidebar ist die **UUID grau** dargestellt (gestrichelter Rand, Hinweis „nicht editierbar"), damit erkennbar ist, dass sie nicht änderbar ist.
14. Die Sidebar enthält ein Feld **`color`** mit **Farbwähler**. Die Farbe wird **Hintergrund- und Rahmenfarbe** des Objekts (bei Gruppen: Rahmen, Titel und leichte Tönung) und in der Minimap verwendet; die Schriftfarbe passt sich automatisch an. „Zurücksetzen" stellt das Standard-Blau wieder her.

### Beschriftung von Pfeilen

15. Auch **Pfeile (Verbindungen)** lassen sich beschriften. Ein **Klick auf den Pfeil** zeigt in derselben Sidebar wie bei Objekten (sie folgt der Auswahl); sie zeigt die UUID der Verbindung (nicht editierbar) und genau ein Feld **„Label"**, das anfangs leer ist. Das Label (getrimmt) erscheint mittig auf dem Pfeil, schon während des Tippens; ein leeres Label entfernt die Beschriftung. Änderungen sind rückgängig machbar.

### Zyklen

16. **Bedeutung der Pfeile:** Ein Pfeil **A → B** heißt „**A hängt von B ab**" (B muss vor A released werden). Eine Verbindung zu oder von einer **Gruppe** gilt für **alle (auch verschachtelten) Mitglieder** der Gruppe: „X hängt von Gruppe G ab" heißt, X hängt von allen Objekten in G ab; „G hängt von Y ab" heißt, alle Objekte in G hängen von Y ab. Eine Gruppe ohne Objekte steht für sich selbst.
17. **Zyklen** (A hängt direkt oder über andere von sich selbst ab) verhindern eine gültige Release-Reihenfolge und werden **immer automatisch erkannt** (kein Modus): die beteiligten Verbindungen sind **violett, gestrichelt und dick** (3 px; die rote Abhängigkeits-Hervorhebung hat Vorrang vor der Farbe, die Strichelung bleibt), die beteiligten Objekte tragen ein **violettes Zyklus-Badge** („Teil eines Zyklus").
18. In der Toolbar erscheint (in beiden Modi), solange Zyklen existieren, der Warn-Button **„⟳ n Zyklen"**. Ein Klick wählt nacheinander die Objekte des nächsten Zyklus aus und zeigt sie im Ausschnitt.

### Projektname

19. Das Projekt hat einen **Namen**, der in der Toolbar steht und anfangs immer **`Release-Management`** lautet. Ein **Doppelklick** (oder Enter bzw. F2 auf dem fokussierten Namen) öffnet ihn **inline** zum Bearbeiten; Enter oder Verlassen des Feldes übernimmt, Esc verwirft. **Erlaubt sind nur die Zeichen `A-Z a-z 0-9 - _ .`** (1 bis 100 Zeichen); andere Zeichen werden beim Tippen und Einfügen entfernt, mit Hinweis. Der Name wird mit dem Modell gespeichert, exportiert und importiert, erscheint im Browser-Tab und ist rückgängig machbar.

### Status, Blocker und kritischer Pfad

20. Jedes Objekt hat einen **Status** (`offen`, `in Arbeit`, `fertig`), gesetzt in der Sidebar über eine Auswahl (Metadatenfeld `status`). Der Schlüssel wird **getrimmt und ohne Groß-/Kleinschreibung** erkannt (`Status` und ` STATUS ` gelten; bei der nächsten Bearbeitung wird er kanonisch als `status` geschrieben); bei mehreren passenden Einträgen gilt der erste. Fehlt der Eintrag oder ist der Wert leer, gilt `offen`. Ein **unbekannter Wert** (z. B. `erledigt`) zählt ebenfalls als `offen`, bleibt aber erhalten, wird in der Sidebar als „… (unbekannt)“ angeboten und ist nie unsichtbar: am Objekt steht ein amberfarbenes „?“, in der Release-Analyse steht er unter „Zu klären“. Gruppen haben keinen eigenen Status; die Sidebar zeigt für sie „Status aus Mitgliedern: n von m fertig“. Unten rechts am Objekt zeigt eine **Status-Marke** jeden Zustand: grünes Häkchen (fertig), amberfarbener Halbkreis (in Arbeit), **grauer leerer Kreis (offen**; Tooltip „Status: offen“ bzw. „Status: offen (nicht gesetzt)“, wenn es keinen Eintrag gibt) und amberfarbenes **„?“** (Tooltip „Status „erledigt“ unbekannt – zählt als offen“). Gruppen tragen keine Marke.
21. **Blockiert** ist ein **nicht fertiges** Objekt (`offen`, `in Arbeit`, unbekannter Wert), das (direkt oder über andere) von mindestens einem nicht fertigen Objekt abhängt. Blockierte Objekte tragen eine **rote Flagge** oben links (Tooltip „Blockiert durch: …“ mit den direkten Voraussetzungen, höchstens fünf Namen), Gruppen mit blockiertem Mitglied eine Flagge im Titel. Objekte in einem Zyklus gelten als blockiert (sie werden nie bereit). **Jetzt umsetzbar** sind nicht fertige Objekte ohne nicht fertige Voraussetzung. Ein **fertiges** Objekt mit nicht fertiger Voraussetzung ist ein **Widerspruch** (nicht „blockiert“): Es trägt statt der Flagge ein **amberfarbenes Warndreieck** oben links (Tooltip „Fertig, aber Voraussetzung nicht fertig: …“, höchstens fünf Namen), Gruppen mit einem solchen Mitglied ein Dreieck im Titel (zusätzlich zur Flagge, falls auch ein Mitglied blockiert ist). Beispiel: Bei A → B, A → C, C → D mit A offen, B ohne Status, C fertig, D ohne Status ist A blockiert (Flagge) und C widersprüchlich (Dreieck, wartet auf D).
22. Im Modus *Analysieren* ist rechts neben dem Graphen, als eingerahmte Karte in der Spalte der Sidebar (die dort ausgeblendet ist, siehe 33.), das **Panel der Release-Analyse** sichtbar (die Toolbar-Schaltfläche **„Panel“** blendet es aus und ein), das der Auswahl folgt (ohne Auswahl: das gesamte Projekt): Zähler (fertig / in Arbeit / offen / blockiert / jetzt umsetzbar sowie „n zu klären“, nur wenn > 0), der Abschnitt **„Zu klären“**, der **kritische Pfad** und die **blockierenden Objekte**. „Zu klären“ (nur wenn nicht leer) enthält „Fertig trotz offener Voraussetzung“ (Einträge „C – wartet auf D (offen)“) und „Unbekannter Status“ (Einträge „X – „erledigt“ (zählt als offen)“); betrachtet werden die Auswahl und ihre Voraussetzungen bzw. das ganze Projekt. Der kritische Pfad ist die längste Kette noch nicht fertiger Voraussetzungen ab der Auswahl (fertige Objekte zählen 0), aufgelistet in Release-Reihenfolge (zuerst zu erledigen zuerst) und – solange die Hervorhebung „Kritischer Pfad“ (Standard) gewählt ist – im Graph **dick rot** gezeichnet (Objekte mit rotem Rahmen). Enthält der betrachtete Teilgraph einen Zyklus, ist er nicht berechenbar (Hinweis mit den beteiligten Objekten). Blocker erscheinen mit Status, „jetzt umsetzbar“ zuerst; ohne Auswahl getrennt nach „Jetzt umsetzbar“ und „Blockiert“. Ein Klick auf einen Eintrag (auch in „Zu klären“) zeigt das Objekt im Graph (zentriert und kurz hervorgehoben), die Auswahl bleibt unverändert. **„Als Markdown kopieren“** legt die Analyse (inkl. „Zu klären“) in die Zwischenablage; Esc oder × blenden das Panel aus (Esc beendet zuerst ein aktives Werkzeug; danach blendet es das Panel aus, ein weiterer Esc hebt die Auswahl auf). Ist genau ein Objekt ausgewählt, zeigt das Panel oben den Block **„Auswahl: <Name>“** mit einem **Status-Auswahlfeld** (offen / in Arbeit / fertig; ein unbekannter Wert steht als „<Wert> (unbekannt)“ zur Wahl und wird nicht stillschweigend geändert); die Änderung gilt sofort und ist je Änderung ein Undo-Schritt. Bei einer ausgewählten Gruppe steht dort nur „Status aus Mitgliedern: n von m fertig“ (nur Anzeige). Andere Metadaten werden im Analysemodus nicht bearbeitet (dafür zurück in *Aufbauen*).

### Persistenz und Austausch

23. Das Modell des Graphen wird **bei jeder Änderung im `localStorage`** des Browsers gespeichert.
24. Beim **Neuladen** der Seite wird zuerst im `localStorage` nach einem Modell aus einer früheren Sitzung gesucht und – falls vorhanden – geladen. Andernfalls werden **initial zwei miteinander verbundene Objekte** angezeigt.
25. Über einen **Button der Toolbar** kann das Modell **exportiert** werden (Format: **JSON**, siehe unten). Der **Dateiname** lautet `<Projektname>_<JJJJ-MM-TT>_<HHmmss>.json` (lokale Zeit), z. B. `Release-Management_2026-10-09_141022.json`.
26. Der Benutzer kann ein Modell aus einer **JSON-Datei importieren**. **Vorher warnt ein Dialog „Projekt ersetzen?“ vor Datenverlust:** Er nennt das Projekt, das ersetzt wird (Name, Anzahl Objekte, Gruppen und Verbindungen), und warnt hervorgehoben, wenn es **Änderungen gibt, die noch nicht exportiert wurden** (Vergleich des aktuellen Stands mit dem Stand beim letzten Export bzw. Import in diesem Browser; ohne bisherigen Export gilt der Stand als nicht exportiert). Sonst steht dort „Der aktuelle Stand wurde bereits exportiert.“ Außerdem weist er darauf hin, dass sich der Import in der laufenden Sitzung mit „Rückgängig“ zurücknehmen lässt (der Verlauf überlebt kein Neuladen). Angeboten werden **„Exportieren und importieren“** (lädt zuerst die Export-Datei herunter, dann folgt die Dateiauswahl; bei ungesicherten Änderungen die primäre Aktion), **„Ohne Export importieren“** und **„Abbrechen“** (auch Esc). Ungültige Dateien werden mit Fehlerliste abgelehnt; das aktuelle Modell bleibt dann unverändert. Bricht der Benutzer die Dateiauswahl ab, bleibt das Projekt unverändert (ein bereits erfolgter Export bleibt bestehen).

### Rahmenbedingungen

27. Rein clientseitig (`npm` + `vite`), keine Server-Abhängigkeit zur Laufzeit.
28. Eingesetzte Technik: React Flow für die Graph-Darstellung und -Interaktion.

### Arbeitsmodi

29. Die Toolbar hat einen **Modus-Umschalter „Aufbauen | Analysieren“** (direkt rechts vom Projektnamen). Die Modi tragen ein Icon (Graph bzw. Zauberstab). Der zuletzt gewählte Modus wird **pro Browser gemerkt** (`localStorage`-Schlüssel `release-management.ui.v1`; fehlt er oder ist er ungültig, gilt *Aufbauen*); er ist nicht Teil des Projekts und wird nicht exportiert, und ein Wechsel ist kein Undo-Schritt. Die Bereiche **Verlauf** (Rückgängig/Wiederholen), der **Zyklen-Hinweis** und **Datei** (Export/Import, ganz rechts, bei schmalen Fenstern am rechten Rand fixiert) stehen in beiden Modi zur Verfügung.
30. **Aufbauen**: Bereiche *Erstellen* (Werkzeug-Umschalter *Auswählen | Objekt | Verbinden*, siehe 32.) und *Gruppen* (Gruppieren, Gruppe auflösen, Löschen). Es gibt keine Analyse-Hervorhebung (nur die Zyklen, die immer sichtbar sind) und kein Analyse-Panel. **Analysieren**: Das Panel der Release-Analyse (22.) ist sichtbar, und die Toolbar zeigt das Auswahlfeld **„Hervorhebung“** – *Kritischer Pfad* (Standard), *→ Voraussetzungen*, *← Betroffene*, *↔ Beide* oder *Keine* – sowie den Schalter **„Panel“**. Die Hervorhebung zeichnet Verbindungen dick rot und Objekte mit rotem Rahmen (12., 22.).
31. **Strukturschutz im Analysemodus**: Es lassen sich keine Objekte anlegen, keine Verbindungen ziehen (die Konnektoren sind ausgeblendet; ein aktives Werkzeug endet beim Wechsel, es gilt wieder *Auswählen*), nichts löschen (auch nicht mit der Entf-Taste), nicht gruppieren oder auflösen und beim Ziehen nicht in oder aus Gruppen umhängen (Verschieben ist erlaubt, die Gruppenzugehörigkeit bleibt unverändert, es gibt keine Drop-Ziel-Hervorhebung). Die **Sidebar-Bearbeitung bleibt in beiden Modi möglich** (Status, Metadaten, Verbindungs-Label), ebenso Rückgängig/Wiederholen sowie Export/Import. Der Store sperrt die Strukturaktionen zusätzlich selbst, sodass auch Tastenkürzel nichts umgehen.

### Werkzeuge und Layout

32. **Werkzeuge** (Modus *Aufbauen*, Segment-Umschalter in der Toolbar, genau eines aktiv, jeweils Icon + kurzer Text, Tooltip mit Tastenkürzel): **Auswählen** (**V**, Standard; Klick wählt, die Sidebar folgt der Auswahl, Konnektoren lassen sich ziehen), **Objekt anlegen** (**N**; Klick auf eine freie Stelle der Fläche legt dort ein Objekt an: der Mittelpunkt liegt an der Klickposition, bei Überlappung rückt es an die nächste freie Stelle; liegt die Stelle in einer Gruppe, wird das Objekt Mitglied der tiefsten Gruppe dort und bleibt innerhalb von ihr; ein Klick in den Körper einer Gruppe zählt als freie Stelle in ihr, ein Klick auf ihren Titel wählt sie; das neue Objekt wird ausgewählt, die Sidebar zeigt es zum Benennen; das Werkzeug bleibt aktiv, Klick auf ein bestehendes Objekt oder eine Verbindung wählt nur aus; Cursor: Fadenkreuz) und **Verbinden** (**C**; erst Quelle, dann Ziel anklicken). Die Kürzel gelten nicht in Eingabefeldern, nicht mit Strg/Cmd und nicht im Modus *Analysieren*. **Esc** beendet das aktive Werkzeug (zurück zu *Auswählen*), bevor es die übrigen Esc-Stufen gibt. Ein Hinweis auf der Fläche sagt, was das Werkzeug als Nächstes erwartet. Das Werkzeug wird nicht gespeichert und gehört nicht zum Projekt.
33. **Karten-Layout**: Unter der Toolbar liegt ein leicht grauer Arbeitsbereich; Graph, Sidebar und Analyse-Panel sind je eine eingerahmte Karte (dünner Rand, abgerundet, dezenter Schatten). Im Modus *Analysieren* steht das Analyse-Panel in der Spalte der Sidebar; die **Sidebar ist dort ausgeblendet** (die Auswahl bleibt erhalten, zurück in *Aufbauen* zeigt die Sidebar sie wieder; ein ungültiger Entwurf geht beim Wechsel nicht verloren). In Fenstern unter 720 px liegen Sidebar und Panel als Karte über dem Graphen (die Toolbar bleibt frei).
34. **Breite**: Die Toolbar passt bei 1024 px Fensterbreite in beiden Modi ohne seitliches Scrollen; dafür zeigt der Werkzeug-Umschalter unter 1340 px nur die Icons (die Namen bleiben als Tooltip und für Screenreader), unter 1100 px kürzt auch der Zyklen-Button auf die Zahl und der Projektname auf höchstens 120 px.

## Bedienung

Die Toolbar hat oben links einen Umschalter **Aufbauen | Analysieren**. Welche Aktionen verfügbar sind, hängt vom Modus ab.

### In beiden Modi

| Aktion | So geht's |
|---|---|
| Modus wechseln | Toolbar → **Aufbauen** / **Analysieren** (der Modus wird pro Browser gemerkt) |
| Metadaten bearbeiten | Objekt/Gruppe anklicken → die Sidebar zeigt es; Änderungen gelten **sofort** (kein Save). Anderes Element anklicken ⇒ Sidebar wechselt; mehrere markiert ⇒ Hinweis; ins Leere klicken, Esc oder × ⇒ Sidebar schließt. Nur bei einem ungültigen Entwurf (doppelter Feldname) fragt ein Dialog vor dem Wechsel/Schließen („Verwerfen“ / „Abbrechen“) |
| Pfeil beschriften | Pfeil anklicken → Feld **Label** (wirkt sofort) |
| Farbe ändern | Element anklicken → Sidebar → Feld **Farbe (color)** (wirkt sofort) |
| Status setzen | Objekt anklicken → Sidebar → Feld **Status** (offen / in Arbeit / fertig), wirkt sofort. Marke unten rechts am Objekt: ✓ fertig · ◐ in Arbeit · ○ offen · ? unbekannter Wert (zählt als offen) |
| Blocker erkennen | Rote Flagge am Objekt (Tooltip nennt die blockierenden Voraussetzungen); Gruppen: Flagge im Titel |
| Widerspruch erkennen | Amberfarbenes Warndreieck oben links: Objekt ist *fertig*, aber eine Voraussetzung nicht (Tooltip nennt sie); Gruppen: Dreieck im Titel. Die Release-Analyse listet es unter **Zu klären** |
| Zyklen finden | Toolbar → Warn-Button **⟳ n Zyklen** (nur sichtbar, wenn es Zyklen gibt): wählt den nächsten Zyklus aus und zeigt ihn; Zyklus-Verbindungen sind violett gestrichelt |
| Rückgängig / Wiederholen | Strg/Cmd + Z bzw. Strg/Cmd + Umschalt + Z (oder Strg + Y), oder die Icon-Buttons ↶ ↷ der Toolbar |
| Projekt umbenennen | Doppelklick auf den Projektnamen in der Toolbar, Enter übernimmt, Esc bricht ab |
| Export | Toolbar → **Export** (lädt `<Projektname>_<Datum>_<Uhrzeit>.json` herunter und merkt sich den Stand als „exportiert“) |
| Import | Toolbar → **Import** → Dialog „Projekt ersetzen?“: **Exportieren und importieren**, **Ohne Export importieren** oder **Abbrechen** (Esc). Bei Änderungen seit dem letzten Export steht dort eine hervorgehobene Warnung |
| Hilfe zur Toolbar | Mit der Maus über einen Button fahren (oder per Tab fokussieren): Ein Tooltip erklärt die Funktion, nennt das Tastenkürzel und sagt bei deaktivierten Buttons, was fehlt |

### Aufbauen

| Aktion | So geht's |
|---|---|
| Auswählen | Toolbar → Werkzeug **Auswählen** (**V**, Standard): Elemente anklicken, markieren, verschieben; Esc kehrt aus jedem anderen Werkzeug hierher zurück |
| Objekt anlegen | Toolbar → Werkzeug **Objekt** (**N**), dann auf eine freie Stelle der Fläche klicken: das Objekt entsteht dort (in einer Gruppe: als Mitglied), wird ausgewählt und die Sidebar zeigt es zum Benennen. Das Werkzeug bleibt aktiv für weitere Objekte; Esc beendet es |
| Verbinden | Einen der vier Konnektoren (kleine Kreise am Rand) auf einen Konnektor eines anderen Elements ziehen **oder** Toolbar → Werkzeug **Verbinden** (**C**), dann Quelle und Ziel anklicken (die einander zugewandten Seiten werden gewählt; Esc beendet) |
| Gruppieren | Elemente markieren (Strg/Cmd + Klick, oder Shift gedrückt halten und einen Rahmen aufziehen) → **Gruppieren** |
| Gruppe auflösen | Gruppe markieren → **Gruppe auflösen** (Inhalt bleibt erhalten) |
| In/aus Gruppe ziehen | Element auf eine Gruppe ziehen und loslassen bzw. aus ihr herausziehen. Ein Element, das mit einer Gruppe verbunden ist, kann nicht in genau diese Gruppe aufgenommen werden (es erscheint ein Hinweis). |
| Löschen | Markieren → **Löschen** oder Entf-Taste (bei Gruppen: nur die Gruppe, der Inhalt bleibt) |

### Analysieren

Die Struktur ist gesperrt (kein Anlegen, Verbinden, Löschen, Gruppieren, Auflösen, Umhängen); Verschieben, Größe ändern und die Sidebar-Bearbeitung bleiben möglich.

| Aktion | So geht's |
|---|---|
| Hervorhebung wählen | Toolbar → **Hervorhebung**: *Kritischer Pfad* (Standard), *→ Voraussetzungen*, *← Betroffene*, *↔ Beide* oder *Keine*. Die Richtungen folgen dem markierten Objekt (ohne Auswahl erscheint der Hinweis „Objekt markieren …“) |
| Status im Panel | Ein Objekt anklicken → Block **Auswahl** oben im Panel → Status wählen (wirkt sofort, ein Undo-Schritt je Änderung); bei einer Gruppe nur „Status aus Mitgliedern: n von m fertig“ |
| Release-Analyse | Das Panel rechts zeigt Zähler, „Zu klären“, kritischen Pfad und Blocker der Auswahl bzw. des Projekts; Eintrag anklicken zeigt das Objekt, **Als Markdown kopieren** exportiert den Bericht. × oder Esc blenden es aus, Toolbar → **Panel** wieder ein |

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
src/storage/     localStorage (Modell, Modus, Export-Fingerabdruck) und Datei-Download/-Upload
src/store/       zustand-Store (Modell + UI-Zustand)
src/flow/        Anbindung an React Flow (Canvas, Mapping)
src/components/  Toolbar, Sidebar, Knoten, Dialoge
docs/superpowers/specs/   Konzept und Entscheidungen
```

Das ausführliche Konzept steht in [docs/superpowers/specs/2026-10-10-release-management-design.md](docs/superpowers/specs/2026-10-10-release-management-design.md).
