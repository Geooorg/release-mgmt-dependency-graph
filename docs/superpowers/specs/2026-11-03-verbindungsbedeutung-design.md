# Bedeutung von Verbindungstypen und Analyse – Design

Stand: 2026-11-03 · Status: Entwurf zur Prüfung · Schema-Version bleibt 5

Baut auf [Typisierte Elemente und Verbindungen](2026-11-03-typisierte-elemente-design.md) auf.

## Ausgangslage

Verbindungen können getypt werden (Katalog `edgeTypes`), doch die Analyse liest den Typ nicht. `buildEffectiveGraph` (`model/effectiveGraph.ts`) wertet **jede** Verbindung als „A kommt vor B“; nur die optionale Abhängigkeit (`optional: ja`) wird im kritischen Pfad ausgelassen (`releaseAnalysis.ts`). Folgen:

- Eine Verbindung vom Typ „Aufruf“ (A ruft B auf, A hängt von B ab) erzeugt im Analysemodus „wartet“, Zyklen und kritischen Pfad in der falschen Richtung. Gegenseitige Aufrufe melden einen Zyklus.
- Der Benutzer erfährt nicht, welche Verbindungen die Analyse speisen.
- Release-Reihenfolge („A kommt vor B“), Abhängigkeit („A hängt von B ab“) und Datenfluss („Daten fließen von A nach B“) brauchen unterschiedliche Pfeilrichtungen und dürfen nicht vermischt werden.

## Ziel

Jeder Verbindungstyp legt fest, **was sein Pfeil bedeutet**. Jede Analyse nutzt nur die Verbindungen mit passender Bedeutung. Die Oberfläche zeigt, was zählt. Die Auswirkungsanalyse wird dadurch auch für Architekturgraphen brauchbar.

Nicht Teil dieses Entwurfs: die Angriffspfad-Analyse (Einstiegspunkte, Ziele, Vertrauensgrenzen). Sie ist ein eigener späterer Entwurf (Roadmap-Punkte 2 und 3) und nutzt die hier deklarierte Bedeutung `flow`.

## Entscheidungen

1. **Zweck:** Die Analyse soll Release-Planung, Auswirkungsanalyse und (später) Angriffspfade bedienen.
2. **Mischen erlaubt, aber nie unklar:** In einem Projekt dürfen Verbindungen mit verschiedener Bedeutung gleichzeitig vorkommen. Jeder Typ legt seine Bedeutung fest.
3. **Mehrere Bedeutungen je Typ** per Ankreuzen. Das passt zur Regel „ein Paar, eine Verbindung“: ein Aufruf ist zugleich Abhängigkeit und Datenfluss.
4. **Status strikt, Hervorhebung offen:** Status-Berechnung nutzt nur Reihenfolge; die Hervorhebungen nutzen Reihenfolge und Abhängigkeit.
5. **Ohne Typ gilt Reihenfolge**, wie heute. Bestehende Release-Projekte verhalten sich unverändert.
6. **Umfang:** Bedeutungsmodell und die bestehenden Analysen, ohne Angriffspfade.

## Datenmodell und Regeln

### Rollen am Verbindungstyp

`TypeDef.roles?: EdgeRole[]` mit `EdgeRole = 'sequence' | 'dependency' | 'flow'`.

| Rolle | Bedeutung des Pfeils A → B | Anzeigename |
|---|---|---|
| `sequence` | A kommt vor B (B hängt von A ab) | Reihenfolge |
| `dependency` | A hängt von B ab | Abhängigkeit |
| `flow` | Daten fließen von A nach B | Datenfluss |

- Nur bei `edgeTypes`. Ein Objekttyp mit `roles` ist ein Fehler.
- Keine Doppelten, nur die drei Werte. Fehlt das Feld oder ist es leer, ist der Typ **nur beschreibend**.
- **`sequence` und `dependency` schließen sich an einem Typ aus.** Derselbe Pfeil hieße sonst zugleich „A ist Voraussetzung von B“ und „B ist Voraussetzung von A“ (Zyklus mit sich selbst). `flow` lässt sich mit jeder der beiden kombinieren.
- Die Werte sind Format-Bezeichner wie `kind` und `icon`; übersetzt werden nur die Anzeigenamen.
- `tidyType` behält `roles` in fester Reihenfolge (`sequence`, `dependency`, `flow`) und lässt ein leeres Feld weg.

### Wirksame Rollen einer Verbindung (`model/edgeRoles.ts`, rein)

`getEdgeRoles(edge, catalog): readonly EdgeRole[]`:

- **Ohne Typ:** `['sequence']`.
- **Bekannter Typ:** seine `roles`.
- **Unbekannter Typ** (aus dem Katalog gelöscht oder fremde Datei): keine Rolle. Die Bedeutung ist unbekannt, die Verbindung zählt für keine Analyse. Der Typ erscheint weiter mit „?“.

### Welche Analyse nutzt welche Rolle

| Analyse | Rollen | Richtung |
|---|---|---|
| Status: wartet, blockiert, kritischer Pfad (auch Hervorhebung „kritischer Pfad“), Zyklen-Button | nur `sequence` | A → B heißt „A kommt vor B“ |
| Hervorhebungen „← Voraussetzungen“, „→ Betroffene“, „↔ Trans. Hülle“ | `sequence` und `dependency` | `dependency` A → B wird umgedreht: B ist Voraussetzung von A |
| Angriffspfade | `flow` | nicht Teil dieses Entwurfs |

Die optionale Abhängigkeit (`optional: ja`) bleibt unverändert und wirkt nur im kritischen Pfad auf Verbindungen mit der Rolle `sequence`.

### Aufbereitung der Kanten für die Analyse

`analysisContent(content, purpose: 'status' | 'highlight'): GraphContent` (rein, `model/edgeRoles.ts`):

- `'status'`: nur Verbindungen mit der Rolle `sequence`.
- `'highlight'`: Verbindungen mit der Rolle `sequence` unverändert, mit der Rolle `dependency` mit vertauschten Enden (Kanten-ID, Anschlüsse und Metadaten bleiben, damit die Hervorhebung dieselbe ID findet).

Das Ergebnis geht unverändert an `buildEffectiveGraph`, `findCycles`, `analyzeProject`, `analyzeSelection` und `findDependencies`. Diese Modellfunktionen ändern sich nicht. Der Katalog muss dafür im Inhalt stehen: `App.tsx` ruft sie mit `selectContent(state)` auf (nicht mit `{ nodes, edges }`), sonst gälten alle Verbindungen still als untypisiert.

Verbindungen zu oder von Gruppen werden unverändert vom `buildEffectiveGraph` aufgelöst (gelten für alle verschachtelten Mitglieder).

### Format

`roles` kommt in den Typ im Katalog (`public/graph.schema.json`, `public/catalog.schema.json`, `catalogParse.ts`, `serializeModel`/`serializeCatalog` in fester Schlüsselreihenfolge). **Schema-Version bleibt 5**, weil Version 5 noch nicht ausgeliefert ist (nichts gepusht): keine Migration. Version-5-Dateien ohne `roles` lesen sich als „nur beschreibend“. Betroffen ist nur Testmaterial dieser Entwicklungsphase.

## Oberfläche

### Typen-Dialog, Reiter „Verbindungen“

- Neuer Block „Bedeutung“ mit drei Ankreuzfeldern; neben jedem steht die Pfeilspitze als kleines Vorschau-Symbol:
  - „Reihenfolge – A kommt vor B“
  - „Abhängigkeit – A hängt von B ab“
  - „Datenfluss – Daten fließen von A nach B“
- „Reihenfolge“ und „Abhängigkeit“ sind gegenseitig gesperrt, mit Hinweistext.
- Ist nichts angekreuzt: „Nur beschreibend: wird in keiner Analyse berücksichtigt“.
- Änderungen sind wie die anderen Feldeingriffe ein Undo-Schritt. Im Analysemodus ist der Dialog weiter nur lesbar.
- Der Reiter „Elemente“ ändert sich nicht.

### Pfeilspitzen auf der Fläche und im SVG

`arrowHeadFor(roles): 'closed' | 'open'` (rein, `model/edgeRoles.ts`):

| Verbindung | Spitze |
|---|---|
| Reihenfolge, ohne Typ, nur beschreibend, nur Datenfluss | gefülltes Dreieck (wie heute) |
| Abhängigkeit (auch mit Datenfluss) | offene Spitze („V“, wie die UML-Abhängigkeit) |

- Die Spitze folgt der Linienfarbe wie bisher. Auswahl, Hervorhebung und Zyklen färben sie weiter um.
- Keine andere Linienart: gepunktet gehört der optionalen Abhängigkeit, gestrichelt den Zyklen.
- Datenfluss bekommt hier keine eigene Spitze. `arrowHeadFor` ist der Platz dafür im späteren Entwurf.
- `flow/mapping.ts` setzt `markerEnd` je nach Spitze (`MarkerType.ArrowClosed` bzw. `MarkerType.Arrow`). `flow/svgExport.ts` zeichnet dieselben Spitzen; die Marker-Definitionen entstehen pro Farbe und Spitzenart (bisher `arrow-<hex>`, jetzt zusätzlich eine offene Variante).

### Sidebar einer Verbindung

Eine schreibgeschützte Zeile „Bedeutung“:

- die Anzeigenamen der Rollen des Typs, getrennt durch Komma
- „Reihenfolge (ohne Typ)“ bei einer Verbindung ohne Typ
- „Nur beschreibend“ bei einem Typ ohne Rolle
- „Unbekannter Typ: zählt für keine Analyse“

### Analysemodus

Die Sidebar ist dort ausgeblendet, deshalb zeigt die Fläche, was zählt:

- Gedämpft gezeichnet werden Verbindungen, die **weder `sequence` noch `dependency`** haben (nur beschreibend, unbekannter Typ oder nur `flow`), weil sie in keiner Analyse dieses Modus vorkommen. Verbindungen mit nur `flow` werden also ebenfalls gedämpft, solange es keine Analyse dafür gibt. Das ändert sich mit dem späteren Entwurf zu den Angriffspfaden.
- Das Analyse-Panel bekommt eine Zeile „Berücksichtigt: 12 Reihenfolge, 3 Abhängigkeit; 5 ohne Bedeutung für diese Analysen“. Die letzte Zahl zählt dieselben Verbindungen wie die Dämpfung. Die Zeile erscheint nur, wenn mindestens eine Verbindung nicht `sequence` ist. Reine Release-Projekte sehen keinen Unterschied. Die Zählung kommt aus einer reinen Funktion in `model/edgeRoles.ts`.

### Vorlagen

„Aufruf“ erhält `dependency` und `flow`, „Datenfluss“ nur `flow`. Felder bleiben leer.

### Texte

Alle neuen Texte in `de`, `en`, `fr` (Anzeigenamen der Rollen, Dialog-Block, Hinweise, Sidebar-Zeile, Panel-Zeile, Meldung der Katalogregel `sequence` + `dependency`), dazu Hilfeabschnitt `help.types.*` (ergänzen), Agent-Hilfe, README und CLAUDE.md.

## Architektur und Sperren

- `model/edgeRoles.ts` ist rein und immutabel (kein React/DOM) und importiert nur Typen und `catalog`.
- Der Dialog bleibt props-getrieben; Rollen und Zählungen kommen als Props aus `App`.
- Die Katalogaktionen bleiben im Analysemodus gesperrt (`structureLocked`), unverändert.
- Die Modellfunktionen der Analysen (`releaseAnalysis.ts`, `cycles.ts`, `dependency.ts`, `effectiveGraph.ts`) bleiben unverändert; neu ist nur die Aufbereitung der Kanten davor.

## Teststrategie

Fachlogik test-first, deterministisch.

| Bereich | Prüfpunkte |
|---|---|
| Katalogregeln | `roles` nur bei Verbindungstypen; keine Doppelten; nur die drei Werte; `sequence` + `dependency` abgelehnt (neues Problem mit Meldung); `tidyType` behält Reihenfolge und lässt leere Listen weg |
| Format | Roundtrip mit `roles`; ungültige Rollen werden mit klarer Meldung abgelehnt (Projekt und Katalogdatei); `graph.schema.json` und `catalog.schema.json` stimmen mit dem Importer überein; Version-5-Dateien ohne `roles` lesen sich als „nur beschreibend“ |
| `edgeRoles` | ohne Typ = `sequence`; bekannter Typ = seine Rollen; unbekannter Typ = keine; `analysisContent` filtert und dreht richtig, Gruppenverbindungen bleiben gültig; Zählung für das Panel |
| Regression | Reine Release-Projekte liefern mit `analysisContent` exakt die bisherigen Ergebnisse (Zyklen, wartet, kritischer Pfad, Hervorhebung, optionale Abhängigkeit) |
| Neu | Eine Abhängigkeitsverbindung erzeugt weder „wartet“ noch einen Zyklus, erscheint aber in Voraussetzungen/Betroffene/Hülle, richtungsrichtig umgedreht; gegenseitige Aufrufe melden keinen Zyklus; eine Verbindung ohne Rolle erscheint nirgends |
| Verdrahtung | `App` ruft die Analysen mit Katalog-Inhalt auf (ein typisierter Fall, der ohne Katalog anders ausginge) |
| Darstellung | `arrowHeadFor`; offene Marker für Abhängigkeit, gefüllte sonst; SVG-Marker pro Farbe und Spitzenart; gedämpft im Analysemodus nur ohne Rolle |
| Komponenten | Dialog-Block „Bedeutung“ (Sperre Reihenfolge/Abhängigkeit, Hinweis „nur beschreibend“, nur im Reiter „Verbindungen“); Sidebar-Zeile; Panel-Zeile erscheint nur, wenn nicht alles `sequence` ist |
| i18n | `catalog.test.ts`, `noHardcodedGerman.test.ts` mit den neuen Schlüsseln |

Vor „fertig“: `npm test && npm run typecheck && npm run lint && npm run build`. Zusätzlich im Browser (DE/EN/FR): Pfeilspitzen sichtbar, Dämpfung im Analysemodus, Panel-Zeile, Sperre im Dialog, Toolbar unverändert bei 1024 px in beiden Modi mit Zyklen-Button, Katalog- und Projekt-Export/Import mit `roles`.

## Fehlerfälle

- **Typ gelöscht oder fremde Datei:** unbekannter Typ, keine Rolle, gedämpft im Analysemodus, „?“ in der Sidebar.
- **Katalogdatei mit unzulässigen Rollen:** Fehler im Dialog, nichts wird verändert.
- **Löschen eines Typs und Rückgängig:** Rollen kommen mit dem Typ zurück (Teil des Katalogs).
- **Verbindung umkehren:** Der Pfeil dreht sich, die Bedeutung folgt der Pfeilrichtung.
- **Unbekannte Rolle in einer Datei:** Importfehler mit Position, kein stilles Verwerfen.

## Umsetzungsschritte

1. **Modell:** `EdgeRole`, `TypeDef.roles?`, Katalogregeln, Importer, Export, beide Schemas, Vorlagen mit Rollen, Texte der neuen Katalogregel.
2. **`model/edgeRoles.ts`:** `getEdgeRoles`, `analysisContent`, Zählung für das Panel, `arrowHeadFor`, jeweils mit Tests.
3. **Verdrahtung in `App.tsx`:** Status- und Hervorhebungs-Inhalt an die Analysen (mit `selectContent`), Regressionstests.
4. **Darstellung:** Pfeilspitzen auf der Fläche und im SVG, Dämpfung im Analysemodus.
5. **Dialog, Sidebar-Zeile und Panel-Zeile** mit Props, Tests und Texten in drei Sprachen.
6. **Hilfe, Agent-Hilfe, README, CLAUDE.md**, danach Browserprüfung.

Die Schritte 1 und 2 sind das Fundament; ab Schritt 3 ändert sich das sichtbare Verhalten der Analyse.

## Nicht Teil dieses Entwurfs

- Angriffspfad-Analyse (Einstiegspunkte, Ziele, Pfadsuche), Vertrauensgrenzen und Datenfluss-Spitze: späterer Entwurf zu den Roadmap-Punkten 2 und 3.
- **Standardtyp für neue Verbindungen:** Neue Verbindungen bleiben untypisiert und zählen damit als Reihenfolge. In einem Architekturprojekt müssen alle Verbindungen typisiert werden. Ein einstellbarer Standardtyp würde das vereinfachen und ist ein Folgepunkt.
- Eigene Linienarten je Verbindungstyp, Bedeutungen für Objekttypen, Migration von Schema-Version 4 und früher (bleibt wie in Entwurf „Typisierte Elemente“).

## Offene Punkte

Keine.
