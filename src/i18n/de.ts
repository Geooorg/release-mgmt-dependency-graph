/** Reference catalog: the other catalogs must have exactly these keys. */
export const de = {
  'language.label': 'Sprache',
  'cycle.count_one': '{count} Zyklus',
  'cycle.count_other': '{count} Zyklen',
  'common.close': 'Schließen',
  'help.title': 'Hilfe',
  'help.intro':
    'Der Editor zeichnet die Abhängigkeiten eines Releases als Graph. Ein Pfeil A → B bedeutet: A hängt von B ab (B kommt zuerst). Alles wird automatisch im Browser gespeichert; für den Austausch gibt es Export und Import. Eine Beschreibung für Automatisierungs-Agenten steht unter #/agent-hilfe.',
  'help.start.title': 'Erste Schritte',
  'help.start.body':
    '- Wähle das Werkzeug „Objekt“ (Taste N) und klicke auf eine freie Stelle der Fläche, um ein Objekt anzulegen.\n- Wähle „Verbinden“ (Taste C) und klicke nacheinander auf zwei Objekte: erst die Quelle, dann das Ziel.\n- Mit „Auswählen“ (Taste V) markierst und verschiebst du Elemente. Esc beendet das aktive Werkzeug.\n- Die Sidebar rechts zeigt die Auswahl und lässt dich Name, Farbe, Status und weitere Felder bearbeiten.',
  'help.objects.title': 'Objekte und Gruppen',
  'help.objects.body':
    '- „Gruppieren“ fasst markierte Objekte auf derselben Ebene zu einer Gruppe (Sub-Graph) zusammen; „Gruppe auflösen“ entfernt die Gruppe, ihr Inhalt bleibt erhalten.\n- Legst du ein Objekt oder eine Gruppe in eine Gruppe, wächst diese mit.\n- Ein Doppelklick auf einen Namen benennt das Element direkt um (Enter übernimmt, Esc verwirft).\n- „Löschen“ (Entf) entfernt markierte Objekte und Verbindungen; Gruppen werden nur aufgelöst.\n- Mehrere Elemente markierst du mit Strg/Cmd + Klick oder mit Umschalt + Aufziehen eines Rahmens.',
  'help.connect.title': 'Verbindungen',
  'help.connect.body':
    'Ein Pfeil A → B bedeutet „A hängt von B ab“: B muss zuerst fertig sein.\n- Mit dem Werkzeug „Verbinden“ klickst du erst die Quelle, dann das Ziel an.\n- Alternativ ziehst du einen Konnektor am Rand eines Objekts auf ein anderes Element; Loslassen irgendwo auf dem Objekt genügt.\n- Die Enden einer vorhandenen Verbindung lassen sich auf andere Konnektoren oder Elemente ziehen (nicht im Analysemodus).\n- Nicht möglich sind Verbindungen auf sich selbst, doppelte Verbindungen und Verbindungen zwischen einer Gruppe und ihrem eigenen Inhalt.\n- Eine Verbindung von oder zu einer Gruppe gilt für alle (auch verschachtelte) Mitglieder.\n- Eine Verbindung kannst du markieren und in der Sidebar beschriften.',
  'help.sidebar.title': 'Sidebar und Metadaten',
  'help.sidebar.body':
    '- Die Sidebar folgt der Auswahl und übernimmt jede gültige Änderung sofort; ein extra Speichern gibt es nicht. Jede Feldbearbeitung ist ein Schritt für „Rückgängig“.\n- Metadaten sind eine geordnete Liste aus Schlüssel und Wert; der erste Eintrag ist der Name. Feldnamen dürfen nicht doppelt vorkommen.\n- Die Farbe lässt sich je Element setzen; bei mehreren markierten Elementen setzt das Farbfeld die Farbe für alle.\n- Die ID eines Elements wird einmal erzeugt und ist nicht änderbar.',
  'help.status.title': 'Status',
  'help.status.body':
    'Jedes Objekt hat einen von vier Status: offen, in Arbeit, blockiert oder fertig. Fehlt der Status, gilt „offen“.\n- „blockiert“ setzt du von Hand (rote Flagge), optional mit Grund.\n- Die Sanduhr „wartet“ wird berechnet: Das Objekt ist nicht fertig und hat eine direkte, noch nicht fertige Voraussetzung.\n- Gruppen leiten ihren Status aus ihren Mitgliedern ab.\n- „fertig“ ist endgültig: Dahinter wird nicht weiter gerechnet.\n- Ein unbekannter Wert bleibt erhalten, wird mit „?“ markiert und zählt als offen.',
  'help.analysis.title': 'Analysemodus',
  'help.analysis.body':
    'Mit dem Umschalter „Analysieren“ wechselst du vom Editieren zur Auswertung. Die Struktur ist dort gesperrt; Status und Metadaten bleiben bearbeitbar.\n- Die Hervorhebung zeichnet dick rot: den kritischen Pfad, die Voraussetzungen der Auswahl, die davon Betroffenen oder beides.\n- Das Panel zeigt Status-Zähler, „Zu klären“, den kritischen Pfad und die offenen Voraussetzungen; die Auswertung lässt sich als Markdown kopieren.\n- Der Zyklen-Button erscheint, wenn Abhängigkeiten im Kreis laufen; ein Klick wählt den nächsten Zyklus.',
  'help.search.title': 'Suche',
  'help.search.body':
    'Die Lupe in der Toolbar öffnet das Suchfeld (in beiden Modi).\n- Gesucht wird nach dem Anfang des Namens, ohne Beachtung der Groß-/Kleinschreibung, bei Objekten und Gruppen.\n- Enter springt zum ersten Treffer, jedes weitere Enter bei unverändertem Text zum nächsten.\n- Esc schließt das Suchfeld.',
  'help.clipboard.title': 'Kopieren, Einfügen, Rückgängig',
  'help.clipboard.body':
    '- Strg/Cmd + C kopiert die markierten Objekte und Gruppen samt dem Inhalt der Gruppen, aber ohne Verbindungen. Strg/Cmd + V fügt sie als neue Elemente mit neuen IDs ein.\n- Strg/Cmd + Z macht die letzte Änderung rückgängig, Strg/Cmd + Umschalt + Z stellt sie wieder her.\n- Die Schaltflächen dafür stehen nur im Editiermodus zur Verfügung; im Analysemodus ist Einfügen gesperrt.',
  'help.file.title': 'Speichern, Export und Import',
  'help.file.body':
    '- Das Projekt wird automatisch im Browser gespeichert (nur in diesem Browser).\n- „Export“ lädt das Projekt als JSON-Datei <Projektname>_<Datum>_<Uhrzeit>.json herunter.\n- „Import“ lädt eine JSON-Datei und ersetzt das aktuelle Projekt; vorher wird gefragt, bei nicht exportierten Änderungen zusätzlich gewarnt.\n- „JSON anzeigen“ zeigt den Export als Text zum Kopieren, „JSON einfügen“ lädt ein Projekt aus eingefügtem Text.\n- Der Projektname (oben links, änderbar) darf nur A–Z, a–z, 0–9 sowie - _ . enthalten.',
  'help.shortcuts.title': 'Tastenkürzel',
  'help.shortcuts.body':
    '- V: Auswählen · N: Objekt · C: Verbinden (nur im Editiermodus)\n- Entf: Markiertes löschen\n- Esc: Werkzeug beenden, dann Panel schließen, dann Auswahl aufheben\n- Strg/Cmd + C / V: Kopieren / Einfügen\n- Strg/Cmd + Z / Strg/Cmd + Umschalt + Z: Rückgängig / Wiederholen\n- Enter im Suchfeld: nächster Treffer',
} as const
