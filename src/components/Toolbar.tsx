import type { ReactNode } from 'react'
import type { Highlight, WorkMode } from '../model/workMode'
import { CycleIcon, GroupIcon, RedoIcon, TrashIcon, UndoIcon, UngroupIcon } from './icons'
import { ProjectTitle } from './ProjectTitle'
import type { ToolbarProps } from './props'
import { Tooltip } from './Tooltip'
import './components.css'

const CONNECT_HINTS = {
  off: null,
  pickSource: 'Quelle wählen …',
  pickTarget: 'Ziel wählen …',
} as const

const MODES: readonly { value: WorkMode; label: string; title: string }[] = [
  {
    value: 'build',
    label: 'Aufbauen',
    title: 'Den Graphen aufbauen: Objekte anlegen, verbinden, gruppieren und löschen. Ohne Analyse-Hervorhebung.',
  },
  {
    value: 'analyze',
    label: 'Analysieren',
    title:
      'Das Release analysieren: kritischer Pfad, Abhängigkeiten und Release-Analyse. Die Struktur ist gesperrt (nichts anlegen, verbinden, löschen oder umgruppieren); Status und Metadaten bleiben bearbeitbar.',
  },
]

const HIGHLIGHTS: readonly { value: Highlight; label: string }[] = [
  { value: 'critical', label: 'Kritischer Pfad' },
  { value: 'outgoing', label: '→ Voraussetzungen' },
  { value: 'incoming', label: '← Betroffene' },
  { value: 'both', label: '↔ Beide' },
  { value: 'off', label: 'Keine' },
]

const HIGHLIGHT_HELP =
  'Was im Graph dick rot gezeichnet wird. Kritischer Pfad: die längste Kette offener Voraussetzungen der Auswahl bzw. des Projekts. → Voraussetzungen: wovon die markierte Auswahl (direkt oder indirekt) abhängt. ← Betroffene: was von ihr abhängt. ↔ Beide: der gesamte verbundene Teilgraph.'

function Separator() {
  return <span className="toolbar__separator" role="separator" aria-orientation="vertical" />
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="toolbar__section" role="group" aria-label={label}>
      {children}
    </div>
  )
}

export function Toolbar({
  projectName,
  onRenameProject,
  mode,
  onModeChange,
  connectMode,
  canGroup,
  canUngroup,
  canDelete,
  canUndo,
  canRedo,
  highlight,
  onHighlightChange,
  selectionEmpty,
  cycleCount,
  onFocusCycle,
  panelVisible,
  onTogglePanel,
  onUndo,
  onRedo,
  onAddNode,
  onToggleConnect,
  onGroup,
  onUngroup,
  onDelete,
  onExport,
  onImport,
}: ToolbarProps) {
  const hint = CONNECT_HINTS[connectMode]
  const dependencyHighlight = highlight === 'outgoing' || highlight === 'incoming' || highlight === 'both'

  return (
    <header className="toolbar" role="toolbar" aria-label="Werkzeuge">
      <ProjectTitle name={projectName} onRename={onRenameProject} />

      <div className="mode-switch" role="group" aria-label="Arbeitsmodus">
        {MODES.map(({ value, label, title }) => (
          <Tooltip key={value} text={title}>
            <button
              type="button"
              className="ui-button"
              aria-pressed={mode === value}
              onClick={() => onModeChange(value)}
            >
              {label}
            </button>
          </Tooltip>
        ))}
      </div>

      <Separator />

      {mode === 'build' ? (
        <>
          <Section label="Erstellen">
            <Tooltip text="Neues Objekt in der Mitte des sichtbaren Bereichs anlegen">
              <button type="button" className="ui-button" onClick={onAddNode}>
                Objekt anlegen
              </button>
            </Tooltip>
            <Tooltip
              text="Zwei Objekte nacheinander anklicken (erst Quelle, dann Ziel), um sie zu verbinden. Alternativ einen Konnektor am Rand eines Objekts ziehen."
              shortcut="Esc beendet"
            >
              <button
                type="button"
                className="ui-button"
                aria-pressed={connectMode !== 'off'}
                onClick={onToggleConnect}
              >
                Verbinden
              </button>
            </Tooltip>
            {hint && (
              <span className="toolbar__hint" role="status">
                {hint}
              </span>
            )}
          </Section>

          <Separator />

          <Section label="Gruppen">
            <Tooltip
              text="Markierte Objekte zu einer Gruppe (Sub-Graph) zusammenfassen"
              hint={
                canGroup
                  ? undefined
                  : 'Zuerst ein oder mehrere Objekte markieren, die auf derselben Ebene liegen.'
              }
            >
              <button
                type="button"
                className="ui-button ui-button--tool"
                aria-label="Gruppieren"
                disabled={!canGroup}
                onClick={onGroup}
              >
                <GroupIcon />
              </button>
            </Tooltip>
            <Tooltip
              text="Markierte Gruppe auflösen – ihr Inhalt bleibt erhalten und rückt eine Ebene nach oben"
              hint={canUngroup ? undefined : 'Zuerst eine Gruppe markieren.'}
            >
              <button
                type="button"
                className="ui-button ui-button--tool"
                aria-label="Gruppe auflösen"
                disabled={!canUngroup}
                onClick={onUngroup}
              >
                <UngroupIcon />
              </button>
            </Tooltip>
            <Tooltip
              text="Markierte Objekte und Verbindungen löschen. Gruppen werden nur aufgelöst, ihr Inhalt bleibt."
              shortcut="Entf"
              hint={canDelete ? undefined : 'Zuerst etwas markieren.'}
            >
              <button
                type="button"
                className="ui-button ui-button--tool"
                aria-label="Löschen"
                disabled={!canDelete}
                onClick={onDelete}
              >
                <TrashIcon />
              </button>
            </Tooltip>
          </Section>
        </>
      ) : (
        <Section label="Analyse">
          <Tooltip text={HIGHLIGHT_HELP}>
            <label className="toolbar__field">
              <span>Hervorhebung</span>
              <select
                className="ui-input toolbar__select"
                value={highlight}
                onChange={(event) => onHighlightChange(event.target.value as Highlight)}
              >
                {HIGHLIGHTS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </Tooltip>
          {dependencyHighlight && selectionEmpty && (
            <span className="toolbar__hint" role="status">
              Objekt markieren …
            </span>
          )}
          <Tooltip text="Das Release-Analyse-Panel ein- oder ausblenden: Status-Zähler, Zu klären, kritischer Pfad und Blocker der Auswahl bzw. des Projekts.">
            <button type="button" className="ui-button" aria-pressed={panelVisible} onClick={onTogglePanel}>
              Panel
            </button>
          </Tooltip>
        </Section>
      )}

      <Separator />

      <Section label="Verlauf">
        <Tooltip
          text="Letzte Änderung rückgängig machen"
          shortcut="Strg/Cmd + Z"
          hint={canUndo ? undefined : 'Es gibt nichts rückgängig zu machen.'}
        >
          <button
            type="button"
            className="ui-button ui-button--tool"
            aria-label="Rückgängig"
            disabled={!canUndo}
            onClick={onUndo}
          >
            <UndoIcon />
          </button>
        </Tooltip>
        <Tooltip
          text="Rückgängig gemachte Änderung wiederherstellen"
          shortcut="Strg/Cmd + Umschalt + Z"
          hint={canRedo ? undefined : 'Es gibt nichts zu wiederholen.'}
        >
          <button
            type="button"
            className="ui-button ui-button--tool"
            aria-label="Wiederholen"
            disabled={!canRedo}
            onClick={onRedo}
          >
            <RedoIcon />
          </button>
        </Tooltip>
      </Section>

      {cycleCount > 0 && (
        <>
          <Separator />
          <Section label="Zyklen">
            <Tooltip text="Zyklische Abhängigkeiten verhindern eine gültige Release-Reihenfolge. Klicken wählt den nächsten Zyklus aus.">
              <button type="button" className="ui-button ui-button--cycle" onClick={onFocusCycle}>
                <CycleIcon />
                {cycleCount === 1 ? '1 Zyklus' : `${cycleCount} Zyklen`}
              </button>
            </Tooltip>
          </Section>
        </>
      )}

      <span className="toolbar__spacer" />

      {/* Sticky: stays reachable when a narrow window scrolls the toolbar sideways. */}
      <div className="toolbar__file">
        <Separator />
        <Section label="Datei">
          <Tooltip text="Das Projekt als JSON-Datei herunterladen">
            <button type="button" className="ui-button" onClick={onExport}>
              Export
            </button>
          </Tooltip>
          <Tooltip text="Ein Projekt aus einer JSON-Datei laden. Es ersetzt das aktuelle Projekt; vorher wird gefragt und bei nicht exportierten Änderungen gewarnt.">
            <button type="button" className="ui-button" onClick={onImport}>
              Import
            </button>
          </Tooltip>
        </Section>
      </div>
    </header>
  )
}
