# RDF-Austausch (Turtle): Export und Round-Trip-Import – Design

Stand: 2026-11-06 · Status: freigegeben, Plan: [2026-11-06-rdf-austausch.md](../plans/2026-11-06-rdf-austausch.md) · Schema-Version bleibt 5

## Ausgangslage

Der Graph wird als JSON ausgetauscht (`GraphModel`, `src/model/types.ts`). Das ist verlustfrei, aber nur für dieses Werkzeug lesbar. RDF-Werkzeuge (SPARQL, Wissensgraphen, Triple Stores) können den Graphen nicht auswerten.

RDF kennt weder Positionen noch geordnete Metadaten, Gruppen als Container, Notizen oder Kanten mit eigener ID und eigenen Metadaten. Eine Abbildung braucht deshalb ein kleines eigenes Vokabular (`rm:`).

## Ziel

Der Graph lässt sich als Turtle-Datei exportieren und eine **so erzeugte** Datei verlustfrei wieder importieren. Dritte können die Datei mit Standardwerkzeugen lesen und abfragen: Namen, Typen, Gruppenzugehörigkeit und Abhängigkeiten stehen in gängigen Prädikaten.

## Nicht Teil dieses Entwurfs

- Import fremder RDF-Daten (Zuordnung von Prädikaten, Typ-Ableitung, Auto-Layout, Größenbegrenzung). Eigener späterer Entwurf; dieser hier legt dafür das Vokabular und die Pipeline an.
- JSON-LD, TriG, RDF/XML, RDF-star, SHACL.
- Export in die Zwischenablage und Einlesen im Dialog „JSON einfügen“.

## Entscheidungen

1. **Umfang:** Export und Round-Trip-Import eigener Dateien.
2. **Freie Felder hybrid:** feste Felder als echte Prädikate, freie Felder als geordnete `rdf:List` aus Schlüssel-Wert-Paaren.
3. **Kanten doppelt:** Abkürzungs-Tripel für Dritte, dazu eine Kantenressource mit allen Angaben. Der Import liest nur die Kantenressource, keine Heuristik.
4. **Gruppen als Ressourcen** mit `dcterms:isPartOf` am Kind. Benannte Graphen scheiden aus, weil sie sich nicht verschachteln lassen.
5. **Kein neues Speicherformat:** `SCHEMA_VERSION` bleibt 5; der Import läuft über das bestehende `parseModel`.
6. **Abhängigkeit:** nur `n3` (Laufzeit, per dynamischem `import()` nachgeladen). Typen aus `@rdfjs/types` werden nicht gebraucht, das Modell nutzt einen eigenen Tripel-Typ.

## Vokabular

Präfixe:

| Präfix | Namensraum |
|---|---|
| `rm:` | `urn:release-management:vocab:` (siehe „Offene Punkte“) |
| `rdf:`, `rdfs:`, `xsd:` | Standard |
| `dcterms:` | `http://purl.org/dc/terms/` |

Alle Ressourcen heißen `urn:uuid:<id>` (Objekte, Gruppen, Notizen, Kanten, Typen). Das Projekt ist ein Blank Node. Eine id, die keine UUID ist (ältere Dateien), steht als `urn:release-management:id:<percent-kodiert>`.

Klassen: `rm:Project`, `rm:Node`, `rm:Group`, `rm:Note`, `rm:Edge`, `rm:ElementType`, `rm:EdgeType`.

### Projekt

```turtle
[] a rm:Project ;
   rm:schemaVersion 5 ;
   rdfs:label "Mein-Projekt" .   # entfällt, wenn projectName nicht gesetzt ist
```

### Objekt, Gruppe, Notiz

```turtle
<urn:uuid:…> a rm:Node ;                    # rm:Group / rm:Note
    rdfs:label "Datenbank migrieren" ;      # Eintrag name; bei Notizen der (mehrzeilige) Text
    rm:x 120 ; rm:y 80 ;                    # relativ zur Gruppe, wie im Modell
    rm:width 160 ; rm:height 56 ;           # nur wenn size gesetzt ist
    rm:index 0 ;                            # Position in nodes[]
    dcterms:isPartOf <urn:uuid:…> ;         # nur mit parentId
    rm:color "#2563eb" ;
    rm:status "in Arbeit" ;
    rm:blockReason "…" ;
    rm:type <urn:uuid:…> ;                  # Typ-ID
    rdf:type <urn:uuid:…> ;                 # derselbe Typ als Klasse, für Dritte
    rm:class "java.lang.Object" ; rm:entity "" ; rm:version "" ;   # nur Objekte
    <urn:uuid:TYP#Owner> "Team A" ;         # Typfeld
    rm:metadata ( [ rm:key "Notiz" ; rm:value "…" ] … ) .   # freie Felder, geordnet
```

Regeln:

- Zahlen: ganze Zahlen als `xsd:integer`, sonst `xsd:double` (JavaScript-Schreibweise).
- Alle Metadatenwerte sind **einfache Zeichenketten**, auch `ja`/`nein` und Status. Das hält den Round-Trip exakt. Ein unbekannter Statuswert bleibt erhalten.
- `rdfs:label` wird immer geschrieben (auch leer), weil `name` an Index 0 steht.
- Nur vorhandene Einträge werden geschrieben: `color`, `status`, `blockiert_grund` fehlen im Modell, wenn sie nicht gesetzt sind.
- `class`, `entity`, `version` sind Prädikate nur bei Objekten (`kind: 'node'`). Bei Gruppen und Notizen sind sie freie Zeilen in `rm:metadata`.
- **Typfeld** = Metadateneintrag, dessen Schlüssel ein `FieldDef` des Typs ist, **und** der Typ steht im Katalog. Prädikat: `urn:uuid:<typeId>#<encodeURIComponent(key)>`. Gehört der Eintrag zu einem unbekannten Typ oder einem nicht mehr definierten Feld, ist er ein freies Feld.
- `rm:type` ist immer eine IRI (auch für unbekannte Typen, ids ohne UUID-Form wie oben kodiert); `rdf:type` kommt nur dazu, wenn der Typ im Katalog steht.
- Ein leerer Name einer Verbindung wird nicht als `rdfs:label` geschrieben; der Import ergänzt ihn bei Bedarf. Bei Objekten, Gruppen und Notizen steht `rdfs:label` immer.
- Für feste Felder und Typfelder gilt nur die exakte Schreibweise des Schlüssels; andere Schreibweisen (z. B. `Status`) laufen als freie Felder.
- Die Reihenfolge der Einträge (name, color, status, blockiert_grund, type, class, entity, version, Typfelder, freie Felder) baut der Import direkt aus der gemeinsamen Tabelle `FIXED_FIELDS`, dem Katalog und der Liste der freien Felder zusammen. In RDF selbst ist sie nur bei den freien Feldern kodiert (Liste).

### Kante

```turtle
<urn:uuid:KANTE> a rm:Edge ;
    rm:source <urn:uuid:A> ; rm:target <urn:uuid:B> ;   # Pfeilrichtung
    rm:sourceHandle "right" ; rm:targetHandle "left" ;  # nur wenn gesetzt
    rm:index 0 ;
    rdfs:label "ruft auf" ;                             # Eintrag name, nur wenn gesetzt
    rm:optional "ja" ;                                  # Eintrag optional, nur wenn gesetzt
    rm:type <urn:uuid:TYP> ;
    <urn:uuid:TYP#Protokoll> "gRPC" ;                   # Typfeld
    rm:metadata ( … ) .                                 # freie Felder

<urn:uuid:A> rm:precedes <urn:uuid:B> .                 # Abkürzung
```

**Abkürzungs-Tripel** (nur für Dritte, der Import ignoriert sie), ein Tripel je wirksamer Rolle (`getEdgeRoles`):

| Rolle | Prädikat |
|---|---|
| `sequence` (auch Kante ohne Typ) | `rm:precedes`; bei `optional: ja` stattdessen `rm:softPrecedes` |
| `dependency` | `dcterms:requires` |
| `flow` | `rm:flowsTo` |

Zusätzlich bekommt jede typisierte Kante die Typ-IRI als Prädikat (`<A> <urn:uuid:TYP> <B>`), auch bei beschreibenden Typen und bei unbekanntem Typ.

### Katalog

```turtle
<urn:uuid:TYP> a rdfs:Class, rm:ElementType ;     # Verbindungstyp: rdf:Property, rm:EdgeType
    rdfs:label "Service" ;
    rm:color "#16a34a" ; rm:icon "service" ;
    rm:role "sequence", "flow" ;                  # nur Verbindungstypen; Reihenfolge ohne Bedeutung
    rm:index 0 ;                                  # Position in elementTypes / edgeTypes
    rm:field ( [ rm:key "Owner" ; rm:kind "text" ;
                 rm:options ( "a" "b" ) ;         # nur select
                 rm:required true ;                # xsd:boolean, nur wenn true
                 rm:default "…" ] … ) .
```

Das Typfeld-Prädikat `<urn:uuid:TYP#Owner>` erhält zusätzlich `a rdf:Property`, `rdfs:label "Owner"` und `rdfs:domain <urn:uuid:TYP>`, damit Dritte es verstehen.

## Architektur

Abhängigkeitsrichtung wie bisher; n3 bleibt in `storage/`.

| Datei | Aufgabe |
|---|---|
| `src/model/rdfTerms.ts` | Eigener Tripel-Typ in RDF/JS-Form (`NamedNode`, `BlankNode`, `Literal` mit `datatype`), Namensräume `NS`, Hilfen für IRIs (`idToIri`/`iriToId`, `fieldPredicate`) und die gemeinsame Tabelle `FIXED_FIELDS` für Export und Import. |
| `src/model/rdfExport.ts` | Rein: `toTriples(content: GraphContent): Triple[]`, deterministisch nach `rm:index` sortiert. |
| `src/model/rdfImport.ts` | Rein: `modelFromTriples(triples, t): ParseResult`. Baut ein rohes `GraphModel`-Objekt und reicht es an `parseModel` weiter, dessen Ergebnis (Modell oder Fehlerliste) zurückkommt. Kein zweiter Regelsatz. |
| `src/storage/rdfIo.ts` | `looksLikeJson`, `triplesToTurtle`, `parseTurtle`, `exportTurtle`, `turtleToModelJson` über `n3` (`Writer` mit Präfixen, `Parser`), nachgeladen per `import('n3')`. |
| `src/storage/fileIO.ts` | Unverändert; `App` übergibt `text/turtle` an `downloadTextFile` und `.json,application/json,.ttl,text/turtle` an `pickTextFile`. |
| `src/model/serialize.ts` | `exportFileName(date, name, 'ttl')`. |
| `src/components/props.ts` | `ExportFormat` um `'rdf-file'` erweitert; `ExportDialog` bekommt die Option. |
| `src/App.tsx` | `runExport` für `rdf-file` (ruft `markExported`); Import erkennt am ersten nicht leeren Zeichen JSON (`{`) oder Turtle und nutzt danach denselben Pfad inklusive Rückfrage bei ungesichertem Stand. |
| `src/i18n/*` | Neue Texte in `de`, `en`, `fr`: Format-Beschriftung, `rdf.error.*`. |

Import im Einzelnen (`modelFromTriples`):

1. Genau ein `rm:Project` mit lesbarer `rm:schemaVersion`, sonst `rdf.error.notThisTool`. Die Version muss `5` sein; jede andere ⇒ `rdf.error.version` („Die Datei hat die Schema-Version … ; unterstützt wird 5“).
2. Objekte, Gruppen, Notizen: alle Subjekte mit `a rm:Node|rm:Group|rm:Note`, sortiert nach `rm:index`.
3. Metadaten werden direkt in kanonischer Reihenfolge zusammengesetzt: feste Einträge laut gemeinsamer Tabelle `FIXED_FIELDS` (dieselbe wie im Export), dann Typfelder in Katalogreihenfolge, dann die Liste der freien Felder.
4. Kanten: alle Subjekte `a rm:Edge`, nach `rm:index`. Fehlt `rm:source` oder `rm:target`, Fehler mit der Kanten-ID.
5. Katalog: `a rm:ElementType|rm:EdgeType`, nach `rm:index`.
6. Alle anderen Tripel (insbesondere die Abkürzungen und `rdf:type`) werden ignoriert.
7. Das rohe Objekt geht durch `parseModel`; dessen Fehler werden wie beim JSON-Import gezeigt.

## Fehler und Randfälle

- Kein gültiges Turtle (Syntaxfehler des Parsers mit Zeile): `rdf.error.syntax`.
- Kein `rm:Project`: `rdf.error.notThisTool` („keine Datei dieses Werkzeugs; der Import fremder RDF-Daten ist noch nicht möglich“).
- Fehlende Pflichtangaben, Zyklen, doppelte Kanten usw.: durch `parseModel`.
- Schlägt das Laden von `n3` fehl, meldet der Export-Dialog „Der Export ist fehlgeschlagen“ und der Import eine Fehlermeldung.
- Der Parser lädt nichts aus dem Netz (`@base`/`@prefix` sind nur Syntax). Das passt zu „kein Backend“.
- Die Import-Warnung bei ungesichertem Stand (`contentFingerprint` gegen `exportedFingerprint`) gilt unverändert, ebenso der Wechsel des Werkzeugs auf `select` beim Import.

## Tests (test-first, deterministische IDs)

- `rdfExport.test.ts`: je Elementart die erwarteten Tripel; Abkürzungen je Rolle inklusive `optional` und unbekanntem Typ; Zahlenformate; Sortierung.
- `rdfImport.test.ts`: Fehlerfälle aus der Liste oben; Ignorieren fremder Tripel.
- **Round-Trip:** `modelFromTriples(toTriples(m))` ergibt nach `parseModel` genau `m`. Modelle: Startgraph, verschachtelte Gruppen, mehrzeilige Notiz, Typen mit allen Feldarten (`text`, `select`, `boolean`), Verbindungstypen mit mehreren Rollen, optionale Kante, unbekannter Typ, unbekannter Statuswert, leere Werte, Sonderzeichen (Anführungszeichen, `#`, Unicode, Zeilenumbrüche, Tabulator), leerer Katalog.
- `rdfIo.test.ts`: Text-Round-Trip über n3 (Turtle schreiben, lesen, gleiche Tripel); syntaktisch kaputte Datei.
- Komponenten: Export-Dialog zeigt das Format (`ExportDialog.test.tsx`). Die Weiche `App.importFileText` (JSON oder Turtle) hat keinen eigenen Test; sie ist durch `looksLikeJson` und `turtleToModelJson` (`rdfIo.test.ts`) gedeckt und wird manuell im Browser geprüft.
- Der Export übersteht außerdem eine unabhängige Prüfung der Syntax (ein Parser außer n3, falls eine Dev-Abhängigkeit vertretbar ist, sonst manuell mit einem externen Werkzeug).

## Dokumentation

- README: Abschnitt „RDF-Austausch (Turtle)“ mit Vokabular-Tabelle und Hinweis, dass nur eigene Dateien importierbar sind.
- Hilfe (`help.*`) und `AgentHelp` in allen drei Sprachen: Format, Dateiendung, Aussage zum Import.
- CLAUDE.md: Abschnitt zum RDF-Austausch (Dateien, Regeln, „Vokabular ändern ⇒ Round-Trip-Test und README“).

## Offene Punkte

- **Namensraum:** Vorgabe `urn:release-management:vocab:` (nicht abrufbar). Ist eine `https://…`-Adresse gewünscht, ist das eine Konstante in `rdfTerms.ts`; spätere Änderung bricht aber die Lesbarkeit bereits exportierter Dateien.
- **Reihenfolge der Typfelder (entschieden):** Der Import stellt Typfelder in der Reihenfolge des Katalogs her (wie `withTypeDefaults`); eine davon abweichende gespeicherte Reihenfolge geht verloren. Der Rückfall in die Liste entfällt.
- **Größe von `n3`:** Gemessen: eigener Chunk `src-*.js` 58,48 kB (gzip 16,51), nur beim RDF-Export und -Import nachgeladen. `index-*.js` wächst nur um 2,2 kB; `App-*.js` um rund 11 kB, weil `rdfIo.ts` das RDF-Modell statisch einbindet.
- **Unabhängige Syntaxprüfung** (siehe oben): kein zweiter Parser als Abhängigkeit; die Datei wird stattdessen im Round-Trip durch den Parser von `n3` gelesen und bei Bedarf manuell mit einem externen Werkzeug geprüft.
