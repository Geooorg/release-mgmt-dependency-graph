# Typisierte Elemente und Verbindungen – Design

Stand: 2026-11-03 · Status: Entwurf zur Prüfung · Schema-Version: 4 → 5

## Ziel

Objekte und Verbindungen bekommen einen **Typ** aus einem **projektspezifischen Katalog**. Ein Typ legt Farbe, Icon und definierte Felder fest. So lässt sich das Tool für IT-Service-Landkarten und Threat-Modelling nutzen (Service, Datenbank, Queue, Datenfluss mit Protokoll und Port …), ohne dass ein fester Katalog eingebaut ist. Der Katalog ist über ein Konfigurationsmenü pflegbar.

Das ist Punkt 1 der Roadmap. Gruppentypen und Trust Boundaries (Punkt 2), Tags als eigenes Konzept und Auto-Layout gehören **nicht** dazu.

## Entscheidungen

1. **Katalog pro Projekt in der Datei** (`GraphContent.catalog`). Er ist Teil von Undo, Export, `localStorage` und Schema. Kein Katalog im Browser-Zustand. Vorlagen werden beim Wählen in die Datei kopiert.
2. **Koexistenz mit `class`/`entity`/`version`.** Diese Felder und die Box „Technische Angaben“ bleiben unverändert. Typfelder erscheinen in einer eigenen Box darüber. Eine Ablösung ist später möglich, aber nicht Teil dieser Stufe.
3. **Typfelder sind weiche Vorgaben.** Fehlende Pflichtfelder warnen, blockieren aber weder Eingabe noch Import.
4. **Typen sind Daten.** Die Zuordnung ist der Metadateneintrag `type` mit der Typ-ID, nicht ein neues Strukturfeld an `ModelNode`/`ModelEdge`.

## Datenmodell

```ts
interface Catalog {
  elementTypes: TypeDef[]   // für Objekte (kind: 'node')
  edgeTypes: TypeDef[]      // für Verbindungen
}

interface TypeDef {
  id: string                // UUID, einmal erzeugt, nie editierbar
  name: string              // Anzeigename, eindeutig je Liste (ohne Groß-/Kleinschreibung, getrimmt)
  color?: string            // '#rrggbb'
  icon?: IconKey            // fester Satz (z. B. service, database, queue, user, cloud)
  fields: FieldDef[]
}

interface FieldDef {
  key: string               // Metadatenschlüssel, eindeutig im Typ, nicht reserviert
  kind: 'text' | 'select' | 'boolean'
  options?: string[]        // nur bei 'select', mindestens ein Eintrag, ohne Duplikate
  required?: boolean
  default?: string          // bei 'boolean': 'ja' | 'nein'; bei 'select': eine der Optionen
}
```

`GraphContent` erhält `catalog?: Catalog` (optional wie `projectName`, fehlend = leer, damit bestehende `{ nodes, edges }`-Literale gültig bleiben). `GraphModel` und der Store halten ihn immer. `SCHEMA_VERSION = 5`.

### Zuordnung am Element

- Metadateneintrag `type` = Typ-ID. Lesen/Schreiben nur über `model/typing.ts`
  (`getTypeId`, `withTypeEntry`, `resolveType`), nie über `entry.key === 'type'`.
- Gilt für Objekte (`kind: 'node'`) und Verbindungen. Gruppen und Notizen bekommen in dieser Stufe keinen Typ.
- Die Anzeige löst die ID in den Namen auf; Umbenennen im Katalog wirkt auf alle Elemente.
- `resolveType` unterscheidet: **kein Typ**, **bekannter Typ**, **unbekannter Typ** (ID nicht im Katalog, z. B. nach Löschen oder Fremdimport). Ein unbekannter Typ bleibt erhalten und wird sichtbar markiert („? (gelöscht)“), analog zum unbekannten Status.

### Regeln

- **Reservierte Feldschlüssel** (ohne Beachtung der Groß-/Kleinschreibung): `name`, `color`, `status`, `blockiert_grund`, `type`, `class`, `entity`, `version`, `optional`. Sie werden im Katalog abgewiesen.
- **Reihenfolge der Metadaten:** `name`, `color`, `status`, `blockiert_grund`, `type`, `class`, `entity`, `version`, Typfelder in Katalogreihenfolge, freie Felder. Das Normalisieren läuft weiter über `normalizeMetadata`.
- **Typwechsel:** Setzt `type`, ergänzt fehlende Typfelder mit ihrem Standardwert (leer, wenn keiner definiert ist), **überschreibt oder löscht nie** vorhandene Werte. Werte des alten Typs bleiben als freie Felder stehen.
- **Farbe:** eigener `color`-Eintrag am Element > Typfarbe > `DEFAULT_COLOR`. Der Zugriff bleibt über `getColor`, das um die Typfarbe erweitert wird.
- **Löschen eines Typs:** Elemente behalten den Eintrag `type` (unbekannt, siehe oben). Der Dialog nennt vorher die Anzahl betroffener Elemente.
- **Feld im Katalog umbenannt:** Werte in bestehenden Elementen bleiben unter dem alten Schlüssel als freies Feld stehen, es gibt keine stille Datenmigration. Der Dialog warnt.
- **Kein Zyklus- oder Statuseinfluss:** Typen verändern weder `releaseAnalysis` noch den Status.

### Migration und Schema

- `parseModel` ergänzt für Versionen 1–4 `catalog: { elementTypes: [], edgeTypes: [] }`. Fehlende `class`/`entity`/`version` werden wie bisher ergänzt.
- Version 5 erwartet `catalog`. Ein kaputter Katalog (doppelte Namen/IDs, reservierte oder doppelte Feldschlüssel, `select` ohne Optionen, ungültige Farbe) wird mit klarer Meldung abgelehnt. Ein unbekannter Typverweis an einem Element wird **nicht** abgelehnt.
- `public/graph.schema.json`, README-Beispiel und `schema.test.ts` werden angepasst.

## Oberfläche

### Konfigurationsmenü „Typen“ (`TypeCatalogDialog`)

- Button in der Toolbar neben „Hilfe“, in beiden Modi erreichbar; im Analysemodus **nur lesend**.
- Zwei Reiter: Elemente / Verbindungen. Links die Typliste mit Anzahl der verwendenden Elemente und „+ Neuer Typ“, rechts die Details (Name, Farbe, Icon, Felder mit Art, Pflicht, Optionen, Standard) und „Typ löschen“.
- Änderungen werden sofort übernommen; ein Feldeingriff ist **ein** Undo-Schritt (`onEditStart`/`onEditEnd`). Ungültige Entwürfe (doppelter Name, doppelter oder reservierter Schlüssel) werden nicht übernommen und rot markiert.
- **Vorlagen** („IT-Services“, „Datenfluss-Diagramm“) werden in den Katalog kopiert; bei vorhandenem Katalog fragt ein Dialog, ob ergänzt oder ersetzt wird. Ergänzen gleicht über den Namen ab, Namenskollisionen werden übersprungen.
- **Katalog importieren/exportieren** als eigene kleine JSON-Datei mit eigenem Schema. Fehler stehen im Dialog (wie bei „JSON einfügen“).
- Die Toolbar muss bei 1024 px in beiden Modi weiterhin ohne Scrollen passen (nachmessen, ggf. Icon-only).

### Sidebar

- Oben ein Feld „Typ“ (leer = ohne Typ), danach die Box mit den Typfeldern (Text, Auswahl, Checkbox; Pflichtfelder mit Stern, leere mit Warnung). Darunter bleibt „Technische Angaben“ (`class`/`entity`/`version`).
- Gilt für `SidebarForm` (Objekte) und `SidebarEdgeForm` (Verbindungen).
- Bei Mehrfachauswahl von Objekten: Typ-Wechsel für alle Markierten (ein Undo-Schritt, auch im Analysemodus erlaubt wie Farbe/Status; Katalogänderungen selbst nicht).

### Darstellung

- Knoten: Typfarbe, Icon links vom Namen, Typname klein. Kanten: Typfarbe für die Linie (Linienstil pro Typ ist bewusst nicht Teil dieser Stufe, damit er sich nicht mit der gepunkteten optionalen Abhängigkeit überschneidet).
- Der Filter (`findByMetadata`) vergleicht bei `type` den **aufgelösten Typnamen**, nicht die ID.
- `flow/svgExport.ts` zeichnet Farbe/Icon/Typname mit.

### Texte und Hilfe

- Alle neuen Texte in `de`, `en`, `fr`; Hilfeabschnitt `help.types.*`; `AgentHelp` (Katalog-Format, Labels, `aria-label`s) nachziehen.

## Architektur und Sperren

- `model/catalog.ts` und `model/typing.ts` sind rein und immutabel, ohne React/DOM. Texte von Fehlermeldungen kommen über `t: Translate` (Standard `createTranslate('de')`).
- Katalogaktionen im Store laufen über `apply` (ein Undo-Schritt, Gesten mit `beginGesture`/`endGesture`) und sind im Analysemodus ein stilles No-Op (`structureLocked`). `TypeCatalogDialog` kennt den Store nicht (Props-Vertrag in `props.ts`).
- Der Dialog-Zustand (offen, Reiter, Auswahl) ist reiner UI-Zustand, nicht aufgezeichnet und nicht exportiert.

## Teststrategie

Fachlogik test-first, deterministisch (IDs über `IdGenerator`).

| Bereich | Prüfpunkte |
|---|---|
| `catalog.ts` | Anlegen/Umbenennen/Löschen von Typen und Feldern; Eindeutigkeit; reservierte/doppelte Schlüssel; `select` braucht Optionen; Immutabilität |
| `typing.ts` | `getTypeId`/`withTypeEntry`/`resolveType` (kein/bekannt/unbekannt); Typwechsel ergänzt Standardwerte und löscht nichts; Reihenfolge; Farbpriorität |
| Serialisierung/Schema | Migration 1–4 → 5; Roundtrip; kaputter Katalog abgelehnt; unbekannter Typverweis akzeptiert; Schema und Importer stimmen überein |
| Filter | `type` über Typnamen |
| Store | Aktionen als ein Undo-Schritt; Sperre im Analysemodus; Import/Vorlage ersetzen oder ergänzen; Undo hält Katalog und Elemente konsistent |
| Komponenten | Dialog (ungültige Entwürfe, Löschwarnung, Lesemodus), Sidebar (Typfelder, Bulk-Typwechsel, Pflichtwarnung) |
| i18n | `catalog.test.ts`, `noHardcodedGerman.test.ts` mit den neuen Schlüsseln |

Vor „fertig“: `npm test && npm run typecheck && npm run lint && npm run build`. Zusätzlich im Browser (DE/EN/FR): Toolbar bei 1024 px in beiden Modi, Reload, Export/Import eines Projekts mit Katalog, Undo pro Feld, Anlegen in Gruppen.

## Fehlerfälle

- Typ gelöscht, Elemente verweisen darauf: „? (gelöscht)“, Daten bleiben.
- Feld im Katalog umbenannt: alte Werte bleiben als freie Felder.
- Fremder Katalog beim Import: wird wie jedes Modell übernommen; die Import-Warnung (`contentFingerprint`) greift unverändert.
- Katalog-Datei kaputt: Meldung im Dialog, keine Änderung.
- Keine Obergrenze für Typen/Felder; Listen scrollen.

## Umsetzungsschritte

1. `model/catalog.ts` mit Tests.
2. `model/typing.ts` mit Tests (inkl. `getColor`-Erweiterung, Reihenfolge).
3. Schema 5: `types.ts`, `parseModel`-Migration, `graph.schema.json`, README, Roundtrip-Tests.
4. Store: Katalogaktionen, Typwechsel (einzeln/Bulk), Sperre.
5. Sidebar: Typ-Auswahl und Typfelder für Objekte und Verbindungen.
6. Darstellung: Knoten/Kanten, `svgExport.ts`, Filter über Typnamen.
7. `TypeCatalogDialog` mit Toolbar-Button und Nachmessen bei 1024 px.
8. Vorlagen und Katalog-Import/-Export.
9. Texte (`de`/`en`/`fr`), `help.types.*`, `AgentHelp`, Browserprüfung.

Die Schritte 1–3 bilden das Fundament, Schritt 6 liefert den ersten sichtbaren Nutzen; 7 und 8 sind danach unabhängig lieferbar.

## Nicht Teil dieser Stufe

Gruppentypen und Trust Boundaries (Punkt 2), Tags als eigenes Konzept (später als Feldart „Mehrfachauswahl“ denkbar), Icon-Upload, Vererbung zwischen Typen, Linienstil pro Verbindungstyp, automatische Datenmigration bei Feld-Umbenennung, Ablösung von `class`/`entity`/`version`, ein persönlicher Standardkatalog pro Browser.

## Offene Punkte

Keine. Der feste Icon-Satz (`IconKey`) wird in Schritt 6 mit den ersten Vorlagen festgelegt (Vorschlag: service, database, queue, user, cloud, external, process, storage).
