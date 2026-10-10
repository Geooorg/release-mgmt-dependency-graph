# Mehrsprachigkeit (DE/EN/FR) und Hilfe-Overlay – Design

Stand: 2026-10-10 · Ergänzt `2026-10-10-release-management-design.md`.

## Ziel

1. Hilfe-Button mit Icon in der Toolbar; Klick öffnet ein Overlay (Muster wie `JsonImportDialog`), das die Bedienung erklärt.
2. Sprachschalter (Dropdown) Deutsch / English / Français neben dem Hilfe-Button.
3. Die **gesamte Oberfläche** ist übersetzt: Beschriftungen, Tooltips, `aria-label`s, Sidebar, Analyse-Panel, Dialoge, Banner/Notices, Fehlermeldungen, Seitentitel, Agent-Hilfe (`#/agent-hilfe`) und die Markdown-Auswertung des Analyse-Panels.

Nicht-Ziele: Änderung des JSON-Formats/Schemas, Browsersprach-Erkennung, weitere Sprachen (Struktur lässt sie zu), Übersetzung von Nutzerdaten (Namen, Metadaten).

## Entscheidungen

- **Eigene, typisierte i18n-Schicht, keine neue Abhängigkeit** (CLAUDE.md: neue Laufzeit-Abhängigkeiten nur nach Rücksprache).
- **Standardsprache Deutsch**, keine Erkennung der Browsersprache (stabile UI für Automatisierungs-Agenten).
- **Datenformat bleibt deutsch:** Statuswerte (`offen | in Arbeit | blockiert | fertig`) und Schlüssel (`blockiert_grund`, `status`, `color`, `name`) sind Daten. Die Oberfläche zeigt übersetzte *Anzeigenamen*; der Parser erkennt weiterhin nur die deutschen Werte.
- **Sprachwahl** ist UI-Zustand: pro Browser in `release-management.ui.v1` (neben `mode`), nie im Export, kein Undo-Schritt.

## Architektur

Abhängigkeitsrichtung: `components` (nur Props + `useT`) · `flow`/`App` → `store` → `model` → `i18n`-Kern.

### `src/i18n/` (Kern, rein, ohne React/DOM)

- `types.ts`: `Locale = 'de' | 'en' | 'fr'`, `LOCALES`, `LOCALE_NAMES` (Eigenbezeichnungen: „Deutsch“, „English“, „Français“), `MessageKey = keyof typeof de`, `Translate = (key, params?) => string`.
- `de.ts` (Referenz, `as const`-Objekt), `en.ts`, `fr.ts` (`satisfies Record<MessageKey, string>` ⇒ `tsc` meldet fehlende/überzählige Schlüssel).
- `translate.ts`: `createTranslate(locale): Translate`. Platzhalter `{name}`; unbekannter Platzhalter bleibt stehen. Plural: Schlüssel `foo_one`/`foo_other` (ggf. `_zero`), Auswahl über `Intl.PluralRules(locale)` mit `params.count`; fehlende Form ⇒ `_other`.
- `locale.ts`: `DEFAULT_LOCALE = 'de'`, `isLocale`, `parseLocale(value): Locale` (ungültig ⇒ Standard).

### React-Anbindung (`src/i18n/react.tsx`)

- `I18nProvider` (Props: `locale`), `useT(): Translate`, `useLocale(): Locale`. Ohne Provider liefert der Kontext Deutsch (bestehende Tests bleiben unverändert).
- Komponentendateien exportieren nur Komponenten; Hooks liegen in eigener Datei bzw. folgen der react-refresh-Regel.

### Store / Persistenz

- `appStore`: `locale` (UI-Zustand) und Aktion `setLocale`. Persistiert in `UI_KEY` (`storage/`), `try/catch` wie bisher. Beim Start `parseLocale` auf den gelesenen Wert.
- `Root` liest die Sprache **vor** dem ersten Render (auch die Agent-Hilfe braucht sie, ohne den Projekt-Store zu laden): kleine Funktion in `storage/` (`loadLocale`), `Root` hält die Sprache im State und teilt sie über `I18nProvider`; `App` ändert sie über `setLocale` (Callback/Prop aus `Root`, kein Store-Import in `Root`).
- Beim Umschalten: `document.documentElement.lang`, `document.title` aktualisieren.

### Texte außerhalb von React

- **Model** bleibt pur: Funktionen mit Text bekommen `t: Translate` als Parameter (`serialize.ts`-Fehler: `parseModel`/`parseModelJson`; `releaseAnalysis.ts`: Markdown-Auswertung; `status.ts`: Anzeigenamen über Schlüssel). Der Standard ist `createTranslate('de')`, damit bestehende Aufrufer und Tests unverändert funktionieren.
- **Store-Notices** (`graphStore`, `appStore`) speichern kein fertiges Textstück mehr, sondern `{ key, params }`; `App`/`Banner` übersetzen beim Rendern. So folgt eine sichtbare Meldung dem Sprachwechsel. (Alternative bei zu großem Umbau: Store liest das aktuelle `t` aus `appStore.locale` – in der Planung nach Aufwand entscheiden, Verhalten bleibt gleich.)
- **`flow/mapping.ts`** (Knoten-Tooltips „Wartet auf …“) bekommt `t` als Parameter von `Canvas`.

## Bedienelemente

### Toolbar (Datei-Bereich wird zweizeilig, wie der Werkzeug-Block)

```
Zeile 1: [Export] [{ }] [Import] [Zwischenablage]
Zeile 2: [?] [Deutsch ▾]          ← linksbündig unter „Export“
```

- Hilfe-Button: `ui-button--tool`, neues `HelpIcon` (Fragezeichen im Kreis) in `icons.tsx`, `aria-label` und Tooltip „Hilfe“ (übersetzt), Prop `onHelp`.
- Sprachwahl: natives `<select class="ui-input toolbar__select">` mit `aria-label` „Sprache“, Optionen in Eigenbezeichnung; Props `locale`, `onLocaleChange`.
- Sticky-Verhalten des Datei-Bereichs bleibt; zweite Zeile nutzt denselben Null-Breiten-Trick wie `toolbar__edit`, damit die erste Zeile nicht breiter wird. Bei 1024 px in beiden Modi ohne horizontales Scrollen (Mess-Vorgabe der CLAUDE.md; mit Zyklen-Button nachmessen).
- Beide Elemente sind in beiden Modi sichtbar.

### `HelpDialog`

- `src/components/HelpDialog.tsx`, präsentational, Props `{ open, onClose }` in `props.ts`; Muster `useNativeDialog` + `confirm-dialog json-dialog` (Esc und Schließen-Button; scrollt im Dialog).
- Inhalt aus dem Katalog: Schlüssel `help.<abschnitt>.title` und `help.<abschnitt>.body`; `body` ist Text mit Zeilenumbrüchen, jede Zeile = ein Absatz bzw. Listenpunkt (Zeilen mit `- ` am Anfang als Liste). Abschnitte:
  1. Erste Schritte (Objekt anlegen, Reihenfolge der Werkzeuge)
  2. Objekte und Gruppen (Gruppieren/Auflösen, Mitwachsen, Verschieben, Namen per Doppelklick)
  3. Verbinden (Pfeilrichtung „A → B: A hängt von B ab“, Ende ziehen, Regeln)
  4. Sidebar und Metadaten (Live-Übernahme, geordnete Felder, Farbe, Mehrfachauswahl)
  5. Status (offen / in Arbeit / blockiert / fertig; „blockiert“ manuell vs. „wartet“ berechnet)
  6. Analysemodus (kritischer Pfad, Hervorhebung, Panel, gesperrte Struktur)
  7. Suche
  8. Kopieren, Einfügen, Rückgängig/Wiederholen
  9. Speichern, Export, Import, JSON als Text
  10. Tastenkürzel (V/N/C, Strg/Cmd + C/V/Z, Entf, Esc)
- Geöffnet über UI-Zustand `helpOpen` in `App` (nicht aufgezeichnet).

## Übersetzungsumfang (Dateien)

`Toolbar`, `Sidebar` (+ `SidebarEdgeForm`, `SidebarBulkColor`), `AnalysisPanel`, `StatusMarks`, `CycleBadge`, `Banner`, `ToolHint`, `SearchBar`, `ProjectTitle`, `ImportDialog`, `JsonImportDialog`, `JsonExportDialog`, `ConfirmDialog`-Aufrufe in `App`, `AgentHelp`, `App` (Titel, Notices), `store/*` (Notices), `flow/mapping.ts`, `model/serialize.ts`, `model/releaseAnalysis.ts`, Anzeigenamen in `model/status.ts`. Code-Kommentare und Bezeichner bleiben englisch.

Besonderheit **Agent-Hilfe:** Sie nennt `aria-label`s und Bedienung; diese stehen in der gewählten Sprache. Ein Hinweis sagt, dass Agenten bei Deutsch (Standard) bleiben können, und nennt den Storage-Key bzw. wie man die Sprache setzt (`release-management.ui.v1`, Feld `locale`).

## Fehlerbehandlung

- Ungültiger/fehlender gespeicherter Wert ⇒ Deutsch, kein Fehlerbanner.
- Speichern der Sprache schlägt fehl (Storage gesperrt) ⇒ Sprache gilt für die Sitzung, kein Banner (reine Komfortfunktion).
- Fehlende Schlüssel zur Laufzeit (nur über Typ-Umgehung möglich) ⇒ deutscher Text, sonst Schlüssel selbst.

## Tests

- **Kern:** Platzhalter, mehrere Vorkommen, fehlender Parameter; Plural für `de`/`en`/`fr` (0, 1, 2, 5; Französisch: 0 und 1 = Singular).
- **Katalog:** gleiche Schlüsselmenge in `en`/`fr` wie `de`, keine leeren Werte, identische Platzhaltermengen je Schlüssel, Plural-Schlüssel jeweils mit `_one` und `_other`.
- **Model:** `parseModelJson` und Markdown-Auswertung liefern in `en`/`fr` übersetzte Texte; mit Standard-`t` bleiben bestehende Ausgaben byte-identisch (bestehende Tests unverändert).
- **Komponenten:** Toolbar zeigt Hilfe-Button und Sprachwahl in zweiter Zeile unter „Export“; Sprachwechsel ruft `onLocaleChange`; Beschriftung, Tooltip und `aria-label` ändern sich je Sprache; `HelpDialog` öffnet/schließt per Button, Esc und Schließen-Button und rendert alle Abschnitte.
- **App/Root:** Sprache überlebt Neuladen (`UI_KEY`), setzt `<html lang>` und Titel; ungültiger Speicherwert ⇒ Deutsch; Agent-Hilfe folgt der Sprache.
- **Bestehende Tests** laufen unverändert in Deutsch (Standard ohne Provider).
- Abschluss: `npm test && npm run typecheck && npm run lint && npm run build` und Sichtprüfung im Browser (DE/EN/FR, beide Modi, 1024 px, Hilfe-Overlay, Import-Fehlermeldung, Analyse-Markdown).

## Dokumentation

`CLAUDE.md` (Modul `src/i18n/`, Regel „neue Texte in alle drei Kataloge“, Notices als Schlüssel, Daten bleiben deutsch), `README.md` (Sprachwahl, Hilfe), `AgentHelp` (siehe oben).
