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

**Sicherheit:** Der Build setzt eine Content-Security-Policy als `<meta>` in `dist/index.html` (`csp.ts`; nur im Build, der Dev-Server braucht Inline-Skripte). Gegen Einbettung in fremde Seiten schützt nur ein HTTP-Header des Webservers: `Content-Security-Policy: frame-ancestors 'none'`. Der `localStorage` gilt pro Origin, nicht pro Pfad – bei Betrieb unter einem Unterpfad teilen sich alle Apps dieser Origin den Speicher.

## Anforderungen

### Graph

1. Über eine **Toolbar** legt der Benutzer (im Modus *Editieren*, siehe 29.–32.) **Objekte** an und **verbindet** sie miteinander. Objekte erscheinen als **blaue Kästen**, Verbindungen als **blaue Linien** (mit Pfeil von Quelle zu Ziel). Dadurch entsteht ein Graph.
2. Jedes neue Objekt erhält initial eine **generierte UUID**.
3. Objekte können **Metadaten** haben, mindestens einen **Namen**.

### Metadaten bearbeiten

4. Ein **einfacher Klick** auf ein Objekt wählt es aus; rechts im Browser zeigt die **Sidebar**, die der Auswahl folgt, seine Metadaten zum Bearbeiten (ein Doppelklick wirkt wie ein Klick, ist aber nicht nötig). Klick auf ein anderes Element ⇒ die Sidebar zeigt sofort dieses. Sind **mehrere** Elemente markiert (Rahmen, Strg/Cmd + Klick), steht dort nur der Hinweis „n Elemente markiert – zum Bearbeiten genau eines auswählen.“. Bei leerer Auswahl (Klick ins Leere, Esc) ist die Sidebar geschlossen; **×** schließt sie und hebt die Auswahl auf. Mit dem Werkzeug *Verbinden* (siehe 32.) dienen Klicks der Wahl von Quelle und Ziel: Die Sidebar öffnet oder wechselt dann nicht.
5. Die **UUID** ist dort als **`disabled`**-Feld zu sehen (nicht editierbar).
6. **Weitere Felder** lassen sich einfach hinzufügen und eintragen. Der **Feldname** (Attribut des Metadatums) ist **frei wählbar**.
7. **Felder ohne Attributnamen werden ignoriert.** **Leere Werte sind erlaubt.** Feldnamen und Werte werden **getrimmt** (Leerzeichen am Rand entfallen).
8. **Es gibt kein „Save“.** Jede Änderung in der Sidebar (Name, Farbe, Status, freie Felder hinzufügen/ändern/entfernen, Verbindungsname) wird **sofort** ins Modell übernommen und ist im Graph sichtbar (und damit gespeichert, siehe 23.). Übernommen wird der normalisierte Stand (getrimmt, Zeilen ohne Feldnamen entfallen); das Formular behält dabei, was getippt wurde (z. B. ein Leerzeichen am Ende, eine neue Zeile mit noch leerem Feldnamen) und lädt sich nur neu, wenn sich das Modell von außen ändert (Rückgängig/Wiederholen, Import). **Doppelte Feldnamen** sind ein Fehler: Er wird am Feld angezeigt, solange er besteht, bleibt das Modell auf dem letzten gültigen Stand. Nur in diesem Fall werden Änderungen **nie stillschweigend verworfen**: Wechselt die Auswahl oder wird die Sidebar (×) geschlossen, fragt ein Dialog „Ungültige Änderungen an „<Name>“ verwerfen? (doppelter Feldname)“ (*Verwerfen* / *Abbrechen*; bei *Abbrechen* bleibt alles unverändert). Bei gültigem Formular gibt es keine Rückfrage.

### Gruppen (Sub-Graphen)

9. Der Benutzer kann Objekte zu einer **Gruppe** zusammenfassen. Eine Gruppe hat – wie ein Objekt – eine UUID und **Metadaten** (Name + freie Felder, Bearbeitung per Klick wie in 4.–8.). Fachlich entspricht eine Gruppe einem **Sub-Graphen**: Sie enthält Objekte und weitere Gruppen; Verbindungen sind innerhalb, außerhalb und zu Gruppen möglich.

### Konnektoren, Rückgängig, Abhängigkeitsgraph, Farbe

10. Jedes Objekt (und jede Gruppe) hat **vier Konnektoren** – oben, rechts, unten, links. Eine Verbindung kann an jedem Konnektor beginnen und enden; die gewählten Seiten werden mit der Kante gespeichert.
11. Änderungen lassen sich **rückgängig machen** (Strg/Cmd + Z, Button „Rückgängig") und **wiederholen** (Strg/Cmd + Umschalt + Z bzw. Strg + Y, Button „Wiederholen"). Ein Verschieben/Größe ändern zählt als ein Schritt, ebenso **eine Bearbeitung eines Sidebar-Feldes** (vom Hineinklicken bis zum Verlassen des Feldes, auch der Farbwähler); Zeile entfernen, Status wählen und Farbe zurücksetzen sind je ein Schritt. In einem Eingabefeld gilt Strg/Cmd + Z das Feld-Undo des Browsers; der Verlauf umfasst bis zu 100 Schritte pro Sitzung.
12. Aus den verbundenen Objekten wird **automatisch ein Abhängigkeitsgraph ermittelt**: Im Modus *Analysieren* werden mit der **Hervorhebung** „→ Voraussetzungen“, „← Betroffene“ oder „↔ Beide“ und einem markierten Objekt alle Verbindungen, die von der Auswahl aus (transitiv) erreichbar sind, **dick und rot** gezeichnet; die erreichten Objekte erhalten einen roten Rahmen. Die Auswertung läuft auf Objektebene (Gruppen-Semantik wie in 16.): eine Verbindung zu oder von einer **Gruppe** gilt für alle ihre Mitglieder, eine erreichte Gruppe erreicht also alle ihre Mitglieder; eine markierte Gruppe startet an allen Mitgliedern. Die Richtung ist wählbar: *→ Voraussetzungen* (wovon die Auswahl abhängt, in Pfeilrichtung), *← Betroffene* (was von der Auswahl abhängt, gegen die Pfeilrichtung), *↔ Beide* (gesamter verbundener Teilgraph). Die Hervorhebung folgt der Auswahl; es gilt immer genau eine Hervorhebung (kritischer Pfad, eine Richtung oder keine, siehe 30.), unabhängig davon, ob das Panel der Release-Analyse (22.) eingeblendet ist.
13. In der Sidebar ist die **UUID grau** dargestellt (gestrichelter Rand, Hinweis „nicht editierbar"), damit erkennbar ist, dass sie nicht änderbar ist.
14. Die Sidebar enthält ein Feld **`color`** mit **Farbwähler**. Die Farbe wird **Hintergrund- und Rahmenfarbe** des Objekts (bei Gruppen: Rahmen, Titel und leichte Tönung) und in der Minimap verwendet; die Schriftfarbe passt sich automatisch an. „Zurücksetzen" stellt das Standard-Blau wieder her.

### Beschriftung von Pfeilen

15. Auch **Pfeile (Verbindungen)** lassen sich beschriften. Ein **Klick auf den Pfeil** zeigt in derselben Sidebar wie bei Objekten (sie folgt der Auswahl); sie zeigt die UUID der Verbindung (nicht editierbar) und genau ein Feld **„Name"** – der Metadateneintrag `name`, derselbe wie bei Objekten und Gruppen (in der Datei als `metadata` der Verbindung, Format-Version 2) –, das anfangs leer ist. Der Name (getrimmt) erscheint mittig auf dem Pfeil, schon während des Tippens; ein leerer Name entfernt die Beschriftung. Darunter macht das Häkchen **„Optionale Abhängigkeit“** die Verbindung zu einer **optionalen Abhängigkeit (soft dependency)**: gespeichert als Metadateneintrag `optional` mit dem Wert `ja` direkt nach `name` (Schlüssel und Wert ohne Groß-/Kleinschreibung; jeder andere Wert gilt als normale Abhängigkeit, Abwählen entfernt den Eintrag), gezeichnet als **gepunktete** Linie (auch in Zyklus- und Hervorhebungsfarbe), und **beim kritischen Pfad nicht berücksichtigt** (22.). Für „wartet“, offene Voraussetzungen, die Hervorhebung der Richtungen und Zyklen zählt sie wie jede andere Verbindung. Änderungen sind rückgängig machbar (das Häkchen ist je Klick ein Schritt).

### Zyklen

16. **Bedeutung der Pfeile:** Ein Pfeil **A → B** heißt „**A hängt von B ab**" (B muss vor A released werden). Eine Verbindung zu oder von einer **Gruppe** gilt für **alle (auch verschachtelten) Mitglieder** der Gruppe: „X hängt von Gruppe G ab" heißt, X hängt von allen Objekten in G ab; „G hängt von Y ab" heißt, alle Objekte in G hängen von Y ab. Eine Gruppe ohne Objekte steht für sich selbst.
17. **Zyklen** (A hängt direkt oder über andere von sich selbst ab) verhindern eine gültige Release-Reihenfolge und werden **immer automatisch erkannt** (kein Modus): die beteiligten Verbindungen sind **violett, gestrichelt und dick** (3 px; die rote Abhängigkeits-Hervorhebung hat Vorrang vor der Farbe, die Strichelung bleibt), die beteiligten Objekte tragen ein **violettes Zyklus-Badge** („Teil eines Zyklus").
18. In der Toolbar erscheint (in beiden Modi), solange Zyklen existieren, der Warn-Button **„⟳ n Zyklen"**. Ein Klick wählt nacheinander die Objekte des nächsten Zyklus aus und zeigt sie im Ausschnitt.

### Projektname

19. Das Projekt hat einen **Namen**, der in der Toolbar steht und anfangs immer **`Release-Management`** lautet. Ein **Doppelklick** (oder Enter bzw. F2 auf dem fokussierten Namen) öffnet ihn **inline** zum Bearbeiten; Enter oder Verlassen des Feldes übernimmt, Esc verwirft. **Erlaubt sind nur die Zeichen `A-Z a-z 0-9 - _ .`** (1 bis 100 Zeichen); andere Zeichen werden beim Tippen und Einfügen entfernt, mit Hinweis. Der Name wird mit dem Modell gespeichert, exportiert und importiert, erscheint im Browser-Tab und ist rückgängig machbar.

### Status, Blockiert/Wartet und kritischer Pfad

20. Jedes Objekt hat einen **Status** (`offen`, `in Arbeit`, `blockiert`, `fertig` – in dieser Reihenfolge im Auswahlfeld), gesetzt in der Sidebar über eine Auswahl (Metadatenfeld `status`). Der Schlüssel wird **getrimmt und ohne Groß-/Kleinschreibung** erkannt (`Status` und ` STATUS ` gelten; bei der nächsten Bearbeitung wird er kanonisch als `status` geschrieben); bei mehreren passenden Einträgen gilt der erste. Fehlt der Eintrag oder ist der Wert leer, gilt `offen`. Ein **unbekannter Wert** (z. B. `erledigt`) zählt ebenfalls als `offen`, bleibt aber erhalten, wird in der Sidebar als „… (unbekannt)“ angeboten und ist nie unsichtbar: am Objekt steht ein amberfarbenes „?“, in der Release-Analyse steht er unter „Zu klären“. **`blockiert` wird von Hand gesetzt** und steht für ein externes Hindernis (z. B. fehlende Freigabe, kritischer Bug); es ist unabhängig von den Voraussetzungen im Graph. Optional lässt sich ein **Grund** angeben (Metadatenfeld `blockiert_grund`, Schlüssel wie `status` getrimmt und ohne Groß-/Kleinschreibung erkannt, kanonisch klein geschrieben, direkt nach `status` abgelegt): Ist der Status `blockiert`, erscheint in der Sidebar direkt unter „Status“ das Textfeld **„Grund“** (live übernommen wie alle Sidebar-Felder, eine Feldbearbeitung ist ein Undo-Schritt). Wird ein anderer Status gewählt, wird der Grund entfernt (im selben Undo-Schritt; Rückgängig stellt beides wieder her). Gruppen haben keinen eigenen Status; die Sidebar zeigt für sie „Status aus Mitgliedern: n von m fertig“. Unten rechts am Objekt zeigt eine **Status-Marke** den Zustand: grünes Häkchen (fertig), amberfarbener Halbkreis (in Arbeit), **grauer leerer Kreis (offen**; Tooltip „Status: offen“ bzw. „Status: offen (nicht gesetzt)“, wenn es keinen Eintrag gibt) und amberfarbenes **„?“** (Tooltip „Status „erledigt“ unbekannt – zählt als offen“). Für `blockiert` gibt es bewusst keine Marke unten rechts: die rote Flagge oben links (21.) ist das Zeichen dieses Status, eine zweite rote Marke wäre doppelt. Gruppen tragen keine Marke.
21. **Blockiert** und **wartet** sind zwei getrennte Begriffe. **Blockiert** (manuell) ist ein Objekt mit Status `blockiert`; es trägt eine **rote Flagge** oben links (Tooltip „Blockiert: <Grund>“ bzw. „Blockiert (kein Grund angegeben)“; hat es zusätzlich nicht fertige Voraussetzungen, steht dort „– wartet außerdem auf: …“, die Flagge dominiert). Die Flagge entfernt man, indem man einen anderen Status wählt. Ein blockiertes Objekt gilt als **nicht fertig**: Alles, was davon abhängt, wartet. **Wartet** (berechnet) ist ein nicht fertiges Objekt mit Status `offen`, `in Arbeit` oder unbekanntem Wert, das direkt von mindestens einem nicht fertigen Objekt abhängt (durch Gruppen ohne Objekte hindurch; über mehrere Stufen ergibt sich das von selbst, weil die Kette nur über nicht fertige Objekte läuft). Es trägt eine **indigofarbene Sanduhr** oben links (Tooltip „Wartet auf: …“ mit den direkten nicht fertigen Voraussetzungen, höchstens fünf Namen, dann „…“). Nicht fertige Objekte in einem Zyklus aus lauter nicht fertigen Objekten warten (sie werden nie bereit). **Jetzt umsetzbar** sind nicht fertige Objekte mit Status `offen`, `in Arbeit` oder unbekanntem Wert ohne nicht fertige direkte Voraussetzung; manuell blockierte Objekte sind nie umsetzbar. Es gilt immer: Anzahl nicht fertiger Objekte = blockiert + wartet + jetzt umsetzbar. Gruppen tragen im Titel eine rote Flagge, wenn ein Mitglied blockiert ist, und eine Sanduhr, wenn ein Mitglied wartet (beides kann gemeinsam erscheinen). **Fertig ist endgültig:** Hinter einem Objekt mit Status `fertig` wird nicht weitergerechnet. Fertig heißt ausgeliefert; was das Objekt selbst einmal voraussetzte, spielt für die davon abhängigen Objekte keine Rolle mehr. Ein fertiges Objekt trägt daher nie Flagge oder Sanduhr, nur das Häkchen, und es verlängert keine Kette, keine Liste von Voraussetzungen und keinen Zyklus. Beispiel: Bei App → Lib → Core mit App offen, Lib fertig und Core offen sind App und Core jetzt umsetzbar und Lib trägt nur das Häkchen. Beispiel: Bei A → B, A → C, C → D mit A offen, B ohne Status, C fertig, D ohne Status wartet A (Sanduhr, nur auf B); C trägt nur das Häkchen, B und D sind jetzt umsetzbar; setzt man B auf `blockiert`, trägt B die rote Flagge und A weiterhin die Sanduhr (wartet auf B).
22. Im Modus *Analysieren* ist rechts neben dem Graphen, als eingerahmte Karte in der Spalte der Sidebar (die dort ausgeblendet ist, siehe 33.), das **Panel der Release-Analyse** sichtbar (die Toolbar-Schaltfläche **„Panel“** blendet es aus und ein), das der Auswahl folgt (ohne Auswahl: das gesamte Projekt): Zähler (fertig / in Arbeit / offen / blockiert / wartet / jetzt umsetzbar sowie „n zu klären“, nur wenn > 0; „blockiert“ zählt nur manuell blockierte), der Abschnitt **„Zu klären“**, der **kritische Pfad** und die **Listen der nicht fertigen Objekte**. „Zu klären“ (nur wenn nicht leer) enthält ausschließlich „Unbekannter Status“ (Einträge „X – „erledigt“ (zählt als offen)“; „n zu klären“ ist deren Anzahl); betrachtet werden die Auswahl und ihre nicht fertigen Voraussetzungen bzw. das ganze Projekt. **Ohne Auswahl** folgen auf „Zu klären“ die Abschnitte **„Blockiert (n)“** (je Eintrag mit Flagge und Grund, z. B. „Lib – Freigabe fehlt“, sonst „kein Grund angegeben“), **„Jetzt umsetzbar (n)“**, **„Wartet (n)“** (je Eintrag „wartet auf …“, mit Sanduhr) und zuletzt der kritische Pfad. **Mit Auswahl** folgen auf „Zu klären“ der kritische Pfad und **„Offene Voraussetzungen (n)“** (die nicht fertigen transitiven Voraussetzungen der Auswahl, gesucht nur über nicht fertige Objekte: fertige werden weder aufgelistet noch durchlaufen; manuell blockierte zuerst, mit Flagge und Grund, dann jetzt umsetzbare, dann wartende; innerhalb jeder Gruppe in Release-Reihenfolge). Ist die Auswahl selbst fertig, ist die Liste leer und das Panel sagt „Fertig – Voraussetzungen werden nicht mehr betrachtet.“. Ist ein ausgewähltes Objekt selbst blockiert, steht oben im Panel ein rot hinterlegter Hinweis „<Name> ist blockiert – <Grund>“. Der kritische Pfad ist die längste Kette **aufeinanderfolgender nicht fertiger** Objekte entlang der Voraussetzungen ab der Auswahl, **nur über normale Verbindungen** (optionale Abhängigkeiten, 15., beenden die Kette; ein Zyklus, der nur über eine optionale Abhängigkeit geschlossen oder erreicht wird, macht ihn nicht unberechenbar) (ein fertiges Objekt beendet die Kette, Gruppen ohne Objekte sind durchlässig und zählen 0, ein blockiertes zählt wie jedes nicht fertige Objekt 1; eine fertige Auswahl hat einen leeren Pfad), aufgelistet in Release-Reihenfolge (zuerst zu erledigen zuerst) und – solange die Hervorhebung „Kritischer Pfad“ (Standard) gewählt ist – im Graph **dick rot** gezeichnet (Objekte mit rotem Rahmen). Enthält der betrachtete Teilgraph einen Zyklus aus lauter nicht fertigen Objekten, ist er nicht berechenbar (Hinweis mit den beteiligten Objekten); ein Zyklus, der durch ein fertiges Objekt läuft, ist für die Analyse unterbrochen (am Graph bleibt er violett gezeichnet, siehe 17.). Ein Klick auf einen Eintrag (auch in „Zu klären“) zeigt das Objekt im Graph (zentriert und kurz hervorgehoben), die Auswahl bleibt unverändert. **„Als Markdown kopieren“** legt die Analyse (inkl. „Zu klären“, Gründen und „wartet auf …“) in die Zwischenablage; Esc oder × blenden das Panel aus (Esc beendet zuerst ein aktives Werkzeug; danach blendet es das Panel aus, ein weiterer Esc hebt die Auswahl auf). Am Ende des Panels erklärt die eingeklappte **Legende „Zeichen erklärt“** (`<details>`) mit denselben Icons wie am Kasten: rote Flagge = blockiert (manuell), Sanduhr = wartet auf Voraussetzung, Status-Marken (Häkchen, Halbkreis, grauer Kreis, „?“). Ist genau ein Objekt ausgewählt, zeigt das Panel oben den Block **„Auswahl: <Name>“** mit einem **Status-Auswahlfeld** (offen / in Arbeit / blockiert / fertig; ein unbekannter Wert steht als „<Wert> (unbekannt)“ zur Wahl und wird nicht stillschweigend geändert); bei `blockiert` zusätzlich dem Feld **„Grund“** (live, eine Feldbearbeitung ein Undo-Schritt). Die Änderung gilt sofort und ist je Änderung ein Undo-Schritt. Bei einer ausgewählten Gruppe steht dort nur „Status aus Mitgliedern: n von m fertig“ (nur Anzeige). Andere Metadaten werden im Analysemodus nicht bearbeitet (dafür zurück in *Editieren*).

### Persistenz und Austausch

23. Das Modell des Graphen wird **bei jeder Änderung im `localStorage`** des Browsers gespeichert.
24. Beim **Neuladen** der Seite wird zuerst im `localStorage` nach einem Modell aus einer früheren Sitzung gesucht und – falls vorhanden – geladen. Andernfalls werden **initial zwei miteinander verbundene Objekte** angezeigt.
25. Der **Export-Button der Toolbar** öffnet einen **Dialog „Exportieren“** mit drei Formaten: **JSON-Datei** (Voreinstellung; Austauschformat, siehe unten), **SVG** (der Graph als Vektorgrafik, z. B. für Dokumente; nicht importierbar; bei leerem Graph nicht wählbar) und **JSON (Zwischenablage)** (derselbe JSON-Text wie in der Datei). Der **Dateiname** lautet `<Projektname>_<JJJJ-MM-TT>_<HHmmss>.json` bzw. `.svg` (lokale Zeit), z. B. `Release-Management_2026-10-09_141022.json`. Das SVG zeigt Objekte (Farbe, Name), Gruppen, Verbindungen mit Pfeil, Beschriftung und gepunkteter Linie für optionale Abhängigkeiten sowie die Status-Marken (Häkchen, Halbkreis, leerer Kreis, „?“, Flagge, Sanduhr); Auswahl, Hervorhebungen und Zyklenfärbung gehören nicht dazu. JSON-Datei und Zwischenablage zählen als exportiert (Import-Warnung), das SVG nicht.
26. Der Benutzer kann ein Modell aus einer **JSON-Datei importieren**. **Vorher warnt ein Dialog „Projekt ersetzen?“ vor Datenverlust:** Er nennt das Projekt, das ersetzt wird (Name, Anzahl Objekte, Gruppen und Verbindungen), und warnt hervorgehoben, wenn es **Änderungen gibt, die noch nicht exportiert wurden** (Vergleich des aktuellen Stands mit dem Stand beim letzten Export bzw. Import in diesem Browser; ohne bisherigen Export gilt der Stand als nicht exportiert). Sonst steht dort „Der aktuelle Stand wurde bereits exportiert.“ Außerdem weist er darauf hin, dass sich der Import in der laufenden Sitzung mit „Rückgängig“ zurücknehmen lässt (der Verlauf überlebt kein Neuladen). Angeboten werden **„Exportieren und importieren“** (lädt zuerst die Export-Datei herunter, dann folgt die Dateiauswahl; bei ungesicherten Änderungen die primäre Aktion), **„Ohne Export importieren“** und **„Abbrechen“** (auch Esc). Ungültige Dateien werden mit Fehlerliste abgelehnt; das aktuelle Modell bleibt dann unverändert. Bricht der Benutzer die Dateiauswahl ab, bleibt das Projekt unverändert (ein bereits erfolgter Export bleibt bestehen).

### Rahmenbedingungen

27. Rein clientseitig (`npm` + `vite`), keine Server-Abhängigkeit zur Laufzeit.
28. Eingesetzte Technik: React Flow für die Graph-Darstellung und -Interaktion.

### Arbeitsmodi

29. Die Toolbar hat einen **Modus-Umschalter „Editieren | Analysieren“** (direkt rechts vom Projektnamen). Die Modi tragen ein Icon (Graph bzw. Zauberstab). Der zuletzt gewählte Modus wird **pro Browser gemerkt** (`localStorage`-Schlüssel `release-management.ui.v1`; fehlt er oder ist er ungültig, gilt *Editieren*); er ist nicht Teil des Projekts und wird nicht exportiert, und ein Wechsel ist kein Undo-Schritt. Der **Zyklen-Hinweis** und **Datei** (Export/Import, ganz rechts, bei schmalen Fenstern am rechten Rand fixiert) stehen in beiden Modi zur Verfügung; der Bereich **Verlauf** (Rückgängig/Wiederholen) nur im Modus *Editieren* (die Tastenkürzel gelten weiterhin).
30. **Editieren**: Bereiche *Erstellen* (Werkzeug-Umschalter *Auswählen | Objekt | Verbinden*, siehe 32.) und *Gruppen* (Gruppieren, Gruppe auflösen, Löschen). Es gibt keine Analyse-Hervorhebung (nur die Zyklen, die immer sichtbar sind) und kein Analyse-Panel. **Analysieren**: Das Panel der Release-Analyse (22.) ist sichtbar, und die Toolbar zeigt das Auswahlfeld **„Hervorhebung“** – *Kritischer Pfad* (Standard), *→ Voraussetzungen*, *← Betroffene*, *↔ Beide* oder *Keine* – sowie den Schalter **„Panel“**. Die Hervorhebung zeichnet Verbindungen dick rot und Objekte mit rotem Rahmen (12., 22.).
31. **Strukturschutz im Analysemodus**: Es lassen sich keine Objekte anlegen, keine Verbindungen ziehen (die Konnektoren sind ausgeblendet; ein aktives Werkzeug endet beim Wechsel, es gilt wieder *Auswählen*), nichts löschen (auch nicht mit der Entf-Taste), nicht gruppieren oder auflösen und beim Ziehen nicht in oder aus Gruppen umhängen (Verschieben ist erlaubt, die Gruppenzugehörigkeit bleibt unverändert, es gibt keine Drop-Ziel-Hervorhebung). Die **Sidebar-Bearbeitung bleibt in beiden Modi möglich** (Status, Metadaten, Verbindungs-Label), ebenso Rückgängig/Wiederholen sowie Export/Import. Der Store sperrt die Strukturaktionen zusätzlich selbst, sodass auch Tastenkürzel nichts umgehen.

### Werkzeuge und Layout

32. **Werkzeuge** (Modus *Editieren*, Segment-Umschalter in der Toolbar, genau eines aktiv, jeweils Icon + kurzer Text, Tooltip mit Tastenkürzel): **Auswählen** (**V**, Standard; Klick wählt, die Sidebar folgt der Auswahl, Konnektoren lassen sich ziehen), **Objekt anlegen** (**N**; Klick auf eine freie Stelle der Fläche legt dort ein Objekt an: der Mittelpunkt liegt an der Klickposition, bei Überlappung rückt es an die nächste freie Stelle; liegt die Stelle in einer Gruppe, wird das Objekt Mitglied der tiefsten Gruppe dort und bleibt innerhalb von ihr; ein Klick in den Körper einer Gruppe zählt als freie Stelle in ihr, ein Klick auf ihren Titel wählt sie; das neue Objekt wird ausgewählt, die Sidebar zeigt es zum Benennen; das Werkzeug bleibt aktiv, Klick auf ein bestehendes Objekt oder eine Verbindung wählt nur aus; Cursor: Fadenkreuz) und **Verbinden** (**C**; erst Quelle, dann Ziel anklicken) und **Notiz** (**S**, rechts von „Verbinden“; siehe 35.). Die Kürzel gelten nicht in Eingabefeldern, nicht mit Strg/Cmd und nicht im Modus *Analysieren*. **Esc** beendet das aktive Werkzeug (zurück zu *Auswählen*), bevor es die übrigen Esc-Stufen gibt. Ein Hinweis auf der Fläche sagt, was das Werkzeug als Nächstes erwartet. Das Werkzeug wird nicht gespeichert und gehört nicht zum Projekt.
33. **Karten-Layout**: Unter der Toolbar liegt ein leicht grauer Arbeitsbereich; Graph, Sidebar und Analyse-Panel sind je eine eingerahmte Karte (dünner Rand, abgerundet, dezenter Schatten). Im Modus *Analysieren* steht das Analyse-Panel in der Spalte der Sidebar; die **Sidebar ist dort ausgeblendet** (die Auswahl bleibt erhalten, zurück in *Editieren* zeigt die Sidebar sie wieder; ein ungültiger Entwurf geht beim Wechsel nicht verloren). In Fenstern unter 720 px liegen Sidebar und Panel als Karte über dem Graphen (die Toolbar bleibt frei).
34. **Breite**: Die Toolbar passt bei 1024 px Fensterbreite in beiden Modi ohne seitliches Scrollen; dafür zeigt der Werkzeug-Umschalter unter 1340 px nur die Icons (die Namen bleiben als Tooltip und für Screenreader), unter 1100 px kürzt auch der Zyklen-Button auf die Zahl und der Projektname auf höchstens 120 px.
35. **Notizen** (Stick-it): Das Werkzeug **Notiz** (**S**) legt mit einem Klick auf eine freie Stelle der Fläche einen Notizzettel an (Mitte an der Klickposition, ohne Ausweichen vor anderen Elementen; in einer Gruppe: als Mitglied, die Gruppe wächst bei Bedarf mit). Danach ist wieder *Auswählen* aktiv, damit der Text per **Doppelklick** direkt am Zettel eingegeben werden kann (Enter = neue Zeile, Strg/Cmd + Enter oder Verlassen des Feldes übernimmt, Esc verwirft; ein Undo-Schritt). Der Zettel wächst nie mit dem Text: Was nicht hineinpasst, wird mit „…“ abgekürzt (so viele Zeilen, wie die Höhe zulässt). Am Rahmen (bei Auswahl) ändert man die Größe (Standard 160×120, mindestens 80×56). Notizen haben **keine Verbindungen** (keine Konnektoren) und keine Metadaten außer UUID, Text und **Farbe** (Standard Gelb; Sidebar-Feld „Text“ und Farbe, auch gemeinsam mit anderen Elementen); sie gehören nicht zur Analyse, werden nicht durchsucht, lassen sich aber verschieben, kopieren, löschen und gruppieren. Im Modus *Analysieren* lassen sich keine neuen anlegen. Im JSON: `{ id, kind: "note", position, size?, metadata:[{key:"name",value:<Text>}, {key:"color",…}?] }`; im SVG-Export erscheinen sie als Zettel mit demselben Text.

## Bedienung

Die Toolbar hat oben links einen Umschalter **Editieren | Analysieren**. Welche Aktionen verfügbar sind, hängt vom Modus ab.

**Hilfe und Sprache:** Im Datei-Bereich der Toolbar (ganz rechts, zweite Zeile unter *Export*/*Import*) öffnet der Button **Hilfe** (Fragezeichen, ganz rechts) ein Overlay, das die Bedienung in zehn Abschnitten erklärt (Esc oder der Button *Schließen* schließt es). Links daneben wählt die **Sprachwahl** zwischen *Deutsch*, *English* und *Français*; sie betrifft die gesamte Oberfläche (Beschriftungen, Tooltips, Meldungen, Dialoge, Analyse-Panel samt Markdown-Auswertung, Agent-Hilfe, Seitentitel). Standard ist Deutsch (keine Erkennung der Browsersprache); die Wahl bleibt pro Browser erhalten (`release-management.ui.v1`, Feld `locale`), gehört nicht zum Projekt und wird nicht exportiert. **Die Daten bleiben unverändert deutsch:** Statuswerte (`offen`, `in Arbeit`, `blockiert`, `fertig`) und Schlüssel (`status`, `blockiert_grund`, `color`, `name`) stehen in JSON und `localStorage` immer so; die Oberfläche zeigt dafür übersetzte Anzeigenamen. Namen neuer Elemente („Neues Objekt“ / „New object“ / „Nouvel objet“) werden in der beim Anlegen gewählten Sprache gespeichert.

### In beiden Modi

| Aktion | So geht's |
|---|---|
| Modus wechseln | Toolbar → **Editieren** / **Analysieren** (der Modus wird pro Browser gemerkt) |
| Metadaten bearbeiten | Objekt/Gruppe anklicken → die Sidebar zeigt es; Änderungen gelten **sofort** (kein Save). Anderes Element anklicken ⇒ Sidebar wechselt; mehrere markiert ⇒ Hinweis; ins Leere klicken, Esc oder × ⇒ Sidebar schließt. Nur bei einem ungültigen Entwurf (doppelter Feldname) fragt ein Dialog vor dem Wechsel/Schließen („Verwerfen“ / „Abbrechen“) |
| Pfeil beschriften | Pfeil anklicken → Feld **Name** (wirkt sofort); es ist derselbe Metadateneintrag `name` wie bei Objekten und Gruppen |
| Pfeil umhängen | Das Ende eines markierten Pfeils (an Quelle oder Ziel) auf einen anderen Konnektor ziehen – desselben oder eines anderen Objekts/einer anderen Gruppe. So lässt sich die Pfeilführung optisch ändern; Beschriftung und ID bleiben. Nicht erlaubte Ziele (Duplikat, Gruppe mit eigenem Mitglied) erklärt ein Hinweis. Im Modus *Editieren*, ein Undo-Schritt |
| Farbe ändern | Element anklicken → Sidebar → Feld **Farbe (color)** (wirkt sofort) |
| Status setzen | Objekt anklicken → Sidebar → Feld **Status** (offen / in Arbeit / blockiert / fertig), wirkt sofort. Marke unten rechts am Objekt: ✓ fertig · ◐ in Arbeit · ○ offen · ? unbekannter Wert (zählt als offen) |
| Objekt blockieren | Status **„blockiert“** wählen (Sidebar oder Analyse-Panel), optional das Feld **Grund** ausfüllen. Das Objekt trägt eine rote Flagge (Tooltip „Blockiert: <Grund>“). Flagge entfernen: anderen Status wählen (der Grund entfällt dabei) |
| Warten erkennen | Indigofarbene Sanduhr am Objekt: nicht fertig und von einer nicht fertigen Voraussetzung abhängig (Tooltip „Wartet auf: …“); Gruppen: Sanduhr im Titel. Fertige Objekte tragen nie Flagge oder Sanduhr („fertig ist endgültig“). Die Legende „Zeichen erklärt“ am Ende des Analyse-Panels erklärt alle Zeichen |
| Zyklen finden | Toolbar → Warn-Button **⟳ n Zyklen** (nur sichtbar, wenn es Zyklen gibt): wählt den nächsten Zyklus aus und zeigt ihn; Zyklus-Verbindungen sind violett gestrichelt |
| Rückgängig / Wiederholen | Strg/Cmd + Z bzw. Strg/Cmd + Umschalt + Z (oder Strg + Y), oder die Icon-Buttons ↶ ↷ der Toolbar |
| Projekt umbenennen | Doppelklick auf den Projektnamen in der Toolbar, Enter übernimmt, Esc bricht ab |
| Objekt/Gruppe umbenennen | **Doppelklick auf den Namen** im Graph (Werkzeug *Auswählen*): Der Name wird zum Eingabefeld (vorausgewählt), Enter oder Klick daneben übernimmt, Esc verwirft; ein Undo-Schritt. Die Sidebar öffnet sich dabei nicht zusätzlich und zeigt den neuen Namen sofort |
| Suchen | Toolbar → **Lupe** (beide Modi): Über dem Graph erscheint ein Suchfeld. Gesucht wird über den Metadateneintrag **name** von Objekten und Gruppen, einfach „beginnt mit“ und ohne Beachtung der Groß-/Kleinschreibung. **Enter** wählt den ersten Treffer aus und zeigt ihn im Graph, jedes weitere **Enter** (bei gleichem Text) springt zum nächsten Treffer und nach dem letzten wieder zum ersten; „Treffer 2 von 5“ bzw. „Kein Treffer“ steht neben dem Feld. Ein geänderter Text beginnt wieder beim ersten Treffer. **Esc**, **×** oder die Lupe schließen das Feld |
| Verbindung auf einen Knoten ziehen | Im Modus *Editieren* einen Konnektor eines Objekts oder einer Gruppe ziehen und **irgendwo auf dem Körper** eines anderen Objekts/einer anderen Gruppe loslassen (nicht nur auf dessen kleinem Konnektor): Die Verbindung wird dorthin gelegt, an der gezogenen Seite beginnend und an der zugewandten Seite endend. Das Ziel zeigt beim Darüberfahren einen gestrichelten Rahmen. Nicht erlaubte Verbindungen (Duplikat, Gruppe mit eigenem Mitglied) erklärt ein Hinweis; Loslassen auf der Fläche oder auf dem Ausgangsobjekt tut nichts |
| Kopieren / Einfügen | Im Modus *Editieren* Toolbar-Bereich **Zwischenablage** (Strg/Cmd + C und V, nicht in Textfeldern): **Kopieren** merkt die markierten Objekte und Gruppen samt dem Inhalt der Gruppen, **Einfügen** legt Kopien mit **neuen UUIDs** an (leicht nach unten rechts versetzt, jede weitere Wiederholung ein Stück weiter) und markiert sie; sie landen wieder in ihrer Gruppe (die bei Bedarf mitwächst), sonst auf der obersten Ebene. **Verbindungen werden weder kopiert noch eingefügt.** Ein Undo-Schritt; im Modus *Analysieren* nicht verfügbar. Die Zwischenablage gilt nur in dieser Sitzung (nicht gespeichert, nicht die System-Zwischenablage) |
| Gruppe wächst mit | Legt man ein Objekt in einer Gruppe an (Werkzeug *Objekt*) oder zieht eines hinein, vergrößert sich die Gruppe von selbst (auch nach links/oben, ohne dass sich etwas auf dem Bildschirm verschiebt, und bei verschachtelten Gruppen die Elterngruppen mit), sobald das Objekt nicht mehr hineinpasst. Ist eine Gruppe voll, entsteht das neue Objekt am Rand und die Gruppe wächst darum. Ein Undo-Schritt |
| Farbe mehrerer Elemente | Mehrere Objekte/Gruppen markieren (Strg/Cmd-Klick oder Aufziehrechteck): Die Sidebar zeigt das Feld **Farbe (color) für alle n Elemente** (Anzeige „verschieden“, wenn die Farben abweichen) und **Zurücksetzen** (entfernt die Farbe bei allen). Ein Undo-Schritt |
| Status mehrerer Objekte | Mehrere Elemente markieren: Enthält die Auswahl Objekte (Gruppen haben keinen Status und bleiben außen vor), zeigt die Sidebar unter der Farbe das Auswahlfeld **Status für alle n Objekte** (offen / in Arbeit / blockiert / fertig; „verschieden“, wenn die Status abweichen; ein gemeinsamer unbekannter Wert steht als „<Wert> (unbekannt)“ zur Wahl). Die Wahl setzt den Status bei allen markierten Objekten, ein Undo-Schritt; bei jedem anderen Status als `blockiert` entfällt dort der Grund (`blockiert_grund`). Auch im Modus *Analysieren* |
| Export | Toolbar → **Export** → Dialog „Exportieren“: **JSON-Datei** (lädt `<Projektname>_<Datum>_<Uhrzeit>.json` herunter und merkt sich den Stand als „exportiert“), **SVG** (lädt `<Projektname>_<Datum>_<Uhrzeit>.svg` mit dem gezeichneten Graph herunter, zählt nicht als exportiert) oder **JSON (Zwischenablage)** (kopiert denselben Text wie die Datei, zählt als exportiert; meldet, wenn die Zwischenablage nicht verfügbar ist) |
| Import | Toolbar → **Import** → Dialog „Projekt ersetzen?“: **Exportieren und importieren**, **Ohne Export importieren** oder **Abbrechen** (Esc). Bei Änderungen seit dem letzten Export steht dort eine hervorgehobene Warnung |
| JSON als Text importieren | Toolbar → Zwischenablage-Icon **JSON einfügen**: Dialog „JSON einfügen“ (nennt das zu ersetzende Projekt, warnt vor nicht exportierten Änderungen), Text einfügen → **Importieren**. Ungültiger Text bleibt im Dialog stehen und nennt die Fehler, das Projekt bleibt unverändert. In beiden Modi verfügbar, per „Rückgängig“ zurücknehmbar |
| Hilfe zur Toolbar | Mit der Maus über einen Button fahren (oder per Tab fokussieren): Ein Tooltip erklärt die Funktion, nennt das Tastenkürzel und sagt bei deaktivierten Buttons, was fehlt |

### Editieren

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
| Status im Panel | Ein Objekt anklicken → Block **Auswahl** oben im Panel → Status wählen (wirkt sofort, ein Undo-Schritt je Änderung); bei `blockiert` erscheint das Feld **Grund**; bei einer Gruppe nur „Status aus Mitgliedern: n von m fertig“ |
| Release-Analyse | Das Panel rechts zeigt Zähler, „Zu klären“ (unbekannte Status), die Listen *Blockiert / Jetzt umsetzbar / Wartet* (ohne Auswahl) bzw. *Offene Voraussetzungen* (mit Auswahl), den kritischen Pfad und die Legende; Eintrag anklicken zeigt das Objekt, **Als Markdown kopieren** exportiert den Bericht (mit Gründen). × oder Esc blenden es aus, Toolbar → **Panel** wieder ein |

## Datenformat (JSON)

Der Export entspricht exakt dem im `localStorage` abgelegten Modell (Schlüssel `release-management.graph.v1`):

```json
{
  "version": 3,
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
        { "key": "status", "value": "blockiert" },
        { "key": "blockiert_grund", "value": "Freigabe fehlt" }
      ]
    }
  ],
  "edges": [
    { "id": "c4e8…", "source": "7d2a91f0-…", "target": "…", "sourceHandle": "right", "targetHandle": "left",
      "metadata": [{ "key": "name", "value": "braucht" }] }
  ]
}
```

- `projectName` (optional): Projektname, nur `A-Z a-z 0-9 - _ .`; fehlt er, gilt `Release-Management`.
- `kind`: `node` (blauer Kasten) oder `group` (Gruppe/Sub-Graph).
- `parentId` (optional) verweist auf eine Gruppe; `position` ist dann relativ zu dieser Gruppe.
- `metadata` ist eine geordnete Liste; der Eintrag `name` steht immer an erster Stelle.
- **Version 3** ergänzt `kind: "note"` (Notizzettel, siehe 35.); Dateien der Version 2 werden unverändert weiter geladen und beim nächsten Speichern als Version 3 geschrieben.
- **Version 2** ersetzt das frühere `label` einer Kante durch `metadata` mit dem Eintrag `name`. Dateien und gespeicherte Stände der Version 1 werden weiter geladen: Das `label` wird zum Namen der Verbindung.
- Kanten sind gerichtet: von `source` nach `target`; „`source` hängt von `target` ab"; bei Gruppen gilt die Kante für alle Mitglieder. Eine Kante hat optional `metadata` wie ein Objekt; der Eintrag `name` ist ihre Beschriftung, der Eintrag `optional` mit dem Wert `ja` kennzeichnet eine optionale Abhängigkeit (ohne Namen und weitere Einträge entfällt das Feld). `sourceHandle`/`targetHandle` (`top`, `right`, `bottom`, `left`) sind optional; fehlen sie (ältere Dateien), werden die einander zugewandten Seiten gezeichnet.
- `color` ist ein optionaler Metadateneintrag der Form `#rrggbb`; andere Werte werden wie „keine Farbe" behandelt.
- `status` ist ein optionaler Metadateneintrag mit einem der vier Werte `offen`, `in Arbeit`, `blockiert`, `fertig` (nur bei Objekten); fehlt er, gilt `offen`, ein unbekannter Wert zählt als `offen` und bleibt erhalten. `blockiert_grund` ist ein optionaler Freitext, der nur zusammen mit dem Status `blockiert` gilt (die App entfernt ihn beim Wechsel auf einen anderen Status). Reihenfolge der Sondereinträge: `name`, `color`, `status`, `blockiert_grund`, danach die freien Felder. Ältere Dateien ohne diese Einträge bleiben gültig, das Schema ist weiter `version: 1`.

**Warum JSON statt XML?** Gleiches Format wie im `localStorage`, nativer Parser, und freie
Feldnamen (z. B. `Release-Datum`) wären als XML-Elementnamen ungültig.

## Projektstruktur

```
src/model/       reine Domänenlogik (Typen, Metadaten, Gruppen/Kanten, Validierung/Serialisierung)
src/i18n/        Übersetzung (Kataloge de/en/fr, createTranslate, useT)
src/storage/     localStorage (Modell, Modus, Sprache, Export-Fingerabdruck) und Datei-Download/-Upload
src/store/       zustand-Store (Modell + UI-Zustand)
src/flow/        Anbindung an React Flow (Canvas, Mapping)
src/components/  Toolbar, Sidebar, Knoten, Dialoge
docs/superpowers/specs/   Konzept und Entscheidungen
```

Das Austauschformat ist als **JSON Schema** (Draft 2020-12) beschrieben: [public/graph.schema.json](public/graph.schema.json), im Build unter `<Basis-URL>/graph.schema.json` ausgeliefert (z. B. `https://georgstach.de/release-management/graph.schema.json`). Es prüft Struktur und Typen; Querverweise (eindeutige ids, `parentId`, Kanten zu vorhandenen Elementen, doppelte Metadaten-Schlüssel) prüft erst der Import der App.

Für Automatisierungs-Agenten gibt es unter `#/agent-hilfe` (z. B. `http://localhost:5173/#/agent-hilfe`) eine statische Hilfeseite zu Datenmodell, Massenänderung per `localStorage` und UI-Bedienung.

Das ausführliche Konzept steht in [docs/superpowers/specs/2026-10-10-release-management-design.md](docs/superpowers/specs/2026-10-10-release-management-design.md).
