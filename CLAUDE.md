# CLAUDE.md

Browser-only Abhängigkeitsgraph-Editor für das Release-Management (React 19 + TypeScript + Vite + @xyflow/react + zustand).
Anforderungen: [README.md](README.md) · Konzept/Entscheidungen: `docs/superpowers/specs/2026-10-10-release-management-design.md`.

## Befehle

```bash
npm run dev         # Dev-Server (Vite)
npm test            # Vitest einmalig (jsdom); npm run test:watch zum Entwickeln
npm run typecheck   # tsc -b
npm run lint        # oxlint
npm run build       # tsc -b && vite build -> dist/
```

Vor „fertig" immer: `npm test && npm run typecheck && npm run lint && npm run build`.

## Harte Randbedingungen

- **Kein Backend, keine Server-Abhängigkeit zur Laufzeit.** Alles läuft im Browser; Persistenz nur über `localStorage` und Datei-Export/-Import.
- Austauschformat ist **JSON** (kein XML). Export == `localStorage`-Format == `GraphModel` aus `src/model/types.ts`. Format ändern ⇒ `SCHEMA_VERSION` erhöhen, Migration in `parseModel` ergänzen, README-Beispiel anpassen.
- Neue Laufzeit-Abhängigkeiten nur nach Rücksprache.
- Node ≥ 22.12 (Vite 8 / Vitest 5).

## Architektur (Abhängigkeiten nur in dieser Richtung)

`components` (nur Props) · `flow`/`App` → `store` → `model`

- `src/model/` – **reine** Funktionen, immutable, ohne React/DOM (Ausnahme: `crypto.randomUUID` als injizierbarer `IdGenerator`). Hier liegt die gesamte Fachlogik (Gruppieren, Auflösen, Reparent, Kanten-Regeln, Metadaten-Normalisierung, Validierung). Neue Regeln zuerst hier mit Test.
- `src/store/` – zustand-Store: Modell (`nodes`, `edges`) + UI-Zustand (Auswahl, geöffnete Sidebar, Verbinden-Modus). Das Modell ist die einzige Quelle der Wahrheit. Auswahl liegt **getrennt** vom Modell, damit Klicken kein Speichern auslöst.
- `src/storage/` – `localStorage` (immer `try/catch`) und Datei-Download/-Upload.
- `src/flow/` – Anbindung an React Flow: Mapping Modell ↔ Flow-Knoten (`mapping.ts`: `parentId`, Positionen relativ zur Gruppe, Eltern vor Kindern) und `Canvas.tsx` (übersetzt React-Flow-Events in Store-Aktionen).
- `src/components/` – präsentational, Props-getrieben (`props.ts` ist der Vertrag), keine Fachlogik, kein Store-Zugriff.

## Domänen-Invarianten (nicht brechen)

- `id` (UUID) wird einmal erzeugt, ist nie editierbar (Sidebar: `disabled`).
- `metadata[0]` ist immer `name`. Schlüssel und Werte werden getrimmt, Einträge ohne Schlüssel verworfen, leere Werte erlaubt, doppelte Schlüssel sind ein Fehler. Immer über `normalizeMetadata` gehen.
- Metadaten sind eine **geordnete Liste von Paaren**, kein Objekt.
- `parentId` zeigt nur auf `kind: 'group'`, keine Zyklen; `position` ist relativ zum Elternelement. Beim Umhängen bleibt die Bildschirmposition erhalten.
- Kanten sind gerichtet, ohne Selbstschleife/Duplikat und nicht zwischen Gruppe und eigenem Mitglied. `reparent` fasst Kanten nicht an – vorher `wouldBreakHierarchy` prüfen (macht der Store beim Drag & Drop).
- Löschen einer Gruppe löst sie auf – Inhalt wird nie implizit mitgelöscht.
- Jede Modelländerung im Store läuft über `apply` (legt den Undo-Schritt an). Mehrteilige Gesten (Drag, Resize) mit `beginGesture`/`endGesture` klammern. UI-Zustand (Auswahl, Sidebar, Modi) wird nicht aufgezeichnet.
- Kanten haben optional `sourceHandle`/`targetHandle` (`top|right|bottom|left`); fehlen sie, zeichnet `toFlowEdges` die zugewandten Seiten (`pickSides`). Die Knoten haben 4 `source`-Handles, der Canvas läuft im Loose-Modus.
- `color` ist ein normaler Metadateneintrag (`#rrggbb`, direkt nach `name`); nur `getColor` liefert gültige Werte. Die Sidebar rendert ihn als Farbwähler, nicht als freie Zeile.

## Konventionen

- Sprache: UI-Texte, Doku und Fehlermeldungen **Deutsch**; Bezeichner und Code-Kommentare **Englisch**. Der Sidebar-Button heißt wörtlich „Save".
- TypeScript strict, `erasableSyntaxOnly` (keine `enum`, keine Parameter-Properties, keine Namespaces). Kein Semikolon, einfache Anführungszeichen, 2 Leerzeichen.
- Kommentare nur für das *Warum*. Funktionen klein halten; React-Komponenten exportieren keine Nicht-Komponenten (react-refresh) – z. B. `nodeTypes` liegt in `nodeTypes.ts`.
- Tests liegen neben dem Code (`*.test.ts[x]`), Vitest mit globalem jsdom. Tests deterministisch halten: IDs über `IdGenerator` injizieren. Fachlogik wird test-first entwickelt.
- Keine `localStorage`-/Browser-API-Aufrufe in `src/model`.

## Arbeitsweise

- Nicht committen oder pushen, solange nicht ausdrücklich verlangt. `.claude/settings.local.json` ist git-ignoriert.
- Abnahme von UI-Änderungen im Browser (Dev-Server) prüfen, nicht nur per Test: Anlegen, Verbinden, Doppelklick-Sidebar, Gruppieren, Reload (Persistenz), Export, Import mit Rückfrage.
