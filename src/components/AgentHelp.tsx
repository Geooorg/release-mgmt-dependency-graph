import { STORAGE_KEY } from '../storage/localStorage'
import { GROUP_HEADER_HEIGHT, GROUP_PADDING, NODE_SIZE, SCHEMA_VERSION } from '../model/types'
import './AgentHelp.css'

/** Served from `public/`, so it follows the base path the app is hosted under. */
const SCHEMA_URL = `${import.meta.env.BASE_URL}graph.schema.json`

const { width: W, height: H } = NODE_SIZE
const GAP = GROUP_PADDING
const OFFSET = { x: GROUP_PADDING, y: GROUP_HEADER_HEIGHT + GROUP_PADDING }
const SINGLE_GROUP = { width: W + 2 * GROUP_PADDING, height: H + 2 * GROUP_PADDING + GROUP_HEADER_HEIGHT }

/** Static page for automation agents (no store access, so opening it never changes the saved project). */
export function AgentHelp() {
  return (
    <main className="agent-help">
      <h1>Agent-Hilfe: Release-Management (Vite, localhost:5173)</h1>

      <h2>Datenmodell</h2>
      <p>
        Der Graph liegt in <code>localStorage</code> unter <code>{STORAGE_KEY}</code> (JSON):
      </p>
      <pre>{`{ version: ${SCHEMA_VERSION}, projectName, nodes: [...], edges: [...] }`}</pre>
      <ul>
        <li>
          Objekt: <code>{'{ id, kind: "node", position:{x,y}, metadata:[{key:"name",value}], parentId? }'}</code>
        </li>
        <li>
          Gruppe:{' '}
          <code>{'{ id, kind: "group", position:{x,y}, size:{width,height}, metadata:[...] }'}</code>
        </li>
        <li>
          Kante: <code>{'{ id, source, target, metadata? }'}</code> (Pfeil zeigt auf target; source/target dürfen Gruppen
          sein). Optional <code>metadata</code> wie bei Objekten: der Eintrag <code>name</code> ist die Beschriftung der
          Verbindung, z. B. <code>{'[{"key":"name","value":"braucht"}]'}</code>. Ältere Dateien mit <code>version: 1</code> und{' '}
          <code>label</code> werden weiter importiert.
        </li>
        <li>
          Kinder verweisen per <code>parentId</code> auf die Gruppe; ihre <code>position</code> ist RELATIV zur
          Gruppe.
        </li>
        <li>Gruppen müssen im Array VOR ihren Kindern stehen.</li>
        <li>
          Maße: Objekt {W}x{H}, Gruppen-Header {GROUP_HEADER_HEIGHT}px, Innenabstand {GROUP_PADDING}. Kind-Offset (
          {OFFSET.x},{OFFSET.y}), Abstand zwischen Kindern {GAP}, Standardgruppe (um ein Objekt) {SINGLE_GROUP.width}x
          {SINGLE_GROUP.height}. Breite einer Gruppe mit n Kindern: {GROUP_PADDING} + n*{W} + (n-1)*{GAP} +{' '}
          {GROUP_PADDING}.
        </li>
        <li>Leere Gruppen sind erlaubt.</li>
        <li>Beim Gruppieren in der UI bekommt ein Objekt eine neue ID.</li>
      </ul>

      <h2>JSON-Schema</h2>
      <p>
        Das Format ist als JSON Schema (Draft 2020-12) beschrieben: <a href={SCHEMA_URL}>graph.schema.json</a>. Damit
        lässt sich ein gebautes JSON vorab prüfen (Struktur, Typen, Pflichtfelder, Größe der Gruppen, Connector-Seiten).
        Nicht im Schema prüfbar und erst beim Import der App kontrolliert: eindeutige ids, existierende{' '}
        <code>parentId</code> (nur Gruppen, keine Zyklen), Kanten zu vorhandenen Elementen ohne Selbstschleife oder
        Duplikat, keine doppelten Metadaten-Schlüssel. Unbekannte Eigenschaften lehnt das Schema ab (die App
        ignoriert sie).
      </p>

      <h2>Schnellster Weg für Massenänderungen</h2>
      <ol>
        <li>
          JSON bauen (UUIDs per <code>crypto.randomUUID()</code>).
        </li>
        <li>
          <code>{`localStorage.setItem('${STORAGE_KEY}', json); location.reload();`}</code> Die App lädt den Stand und
          überschreibt ihn nicht.
        </li>
        <li>
          Prüfen: <code>.react-flow__node</code> und <code>.react-flow__edge</code> zählen.
        </li>
      </ol>

      <h2>JSON als Text lesen und importieren (ohne Datei)</h2>
      <ul>
        <li>
          Lesen: Button <code>aria-label="JSON anzeigen"</code> öffnet den Dialog „Projekt als JSON“. Das Textfeld{' '}
          <code>Projekt-JSON (schreibgeschützt)</code> enthält genau den Inhalt der Export-Datei (
          <code>textarea.value</code>). „In Zwischenablage kopieren“ kopiert ihn (zählt als exportiert).
        </li>
        <li>
          Schreiben: Button <code>aria-label="JSON einfügen"</code> öffnet den Dialog „JSON einfügen“. Das Textfeld{' '}
          <code>JSON-Text</code> ist ein React-Textarea: nativen value-Setter nutzen und ein <code>input</code>-Event
          auslösen, dann Button „Importieren“. Das Projekt wird ersetzt (mit „Rückgängig“ zurücknehmbar); bei ungültigem
          JSON bleibt der Dialog offen und nennt die Fehler (<code>role="alert"</code>), das Projekt bleibt unverändert.
        </li>
        <li>
          Beides geht auch im Analysemodus. Für große Änderungen ohne UI bleibt der <code>localStorage</code>-Weg oben
          der schnellste.
        </li>
      </ul>

      <h2>UI-Bedienung (nur wenn nötig)</h2>
      <ul>
        <li>
          Objekt: Button <code>aria-label="Objekt anlegen"</code>, dann Klick auf <code>.react-flow__pane</code>. Name
          im Sidebar-Input (id endet auf <code>-name</code>). Es ist ein React-Input: nativen value-Setter nutzen und
          ein <code>input</code>-Event auslösen.
        </li>
        <li>
          Gruppieren: Button <code>aria-label="Gruppieren"</code> (funktioniert auch mit 1 Objekt).
        </li>
        <li>
          Mehrfachauswahl (Strg/Shift-Klick, Aufziehrechteck) funktioniert mit simulierten Events NICHT. Stattdessen
          den JSON-Weg nehmen.
        </li>
        <li>Datei-Import/-Export („Import“, „Export“) öffnen native Dateidialoge bzw. Downloads und sind für Agenten unzuverlässig. Dafür gibt es den Weg über Text (nächster Abschnitt).</li>
      </ul>

      <h2>Stolpersteine bei Chrome-Steuerung (execute_javascript)</h2>
      <ul>
        <li>
          Läuft in einer isolierten Welt: kein Zugriff auf React-Fiber oder page-eigene window-Objekte; DOM und Events
          sind geteilt.
        </li>
        <li>
          Kein Top-Level-await. Code in eine IIFE packen und das Ergebnis <code>return</code>en. Async-Ergebnisse in{' '}
          <code>window.__r</code> ablegen und im zweiten Aufruf lesen.
        </li>
        <li>„JavaScript von Apple Events zulassen“ muss in Chrome aktiv sein.</li>
      </ul>

      <h2>Kantenrichtung</h2>
      <p>
        Pfeil <code>A -&gt; B</code> heißt „A hängt von B ab“ (B wird vor A released). Konvention für{' '}
        <code>{'{ source, target }'}</code>: source = abhängige Einheit, target = Einheit, von der sie abhängt.
      </p>
    </main>
  )
}
