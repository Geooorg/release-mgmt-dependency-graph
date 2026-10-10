import type { ReactNode } from 'react'
import type { Highlight, Tool, WorkMode } from '../model/workMode'
import {
  AddObjectIcon,
  ConnectIcon,
  CursorIcon,
  CycleIcon,
  GraphIcon,
  GroupIcon,
  RedoIcon,
  TrashIcon,
  UndoIcon,
  UngroupIcon,
  WandIcon,
} from './icons'
import { ProjectTitle } from './ProjectTitle'
import type { ToolbarProps } from './props'
import { Tooltip } from './Tooltip'
import './components.css'

const ICON_SIZE = 16

const MODES: readonly { value: WorkMode; label: string; icon: ReactNode; title: string }[] = [
  {
    value: 'build',
    label: 'Aufbauen',
    icon: <GraphIcon size={ICON_SIZE} />,
    title: 'Den Graphen aufbauen: Objekte anlegen, verbinden, gruppieren und löschen. Ohne Analyse-Hervorhebung.',
  },
  {
    value: 'analyze',
    label: 'Analysieren',
    icon: <WandIcon size={ICON_SIZE} />,
    title:
      'Das Release analysieren: kritischer Pfad, Abhängigkeiten und Release-Analyse. Die Struktur ist gesperrt (nichts anlegen, verbinden, löschen oder umgruppieren); Status und Metadaten bleiben bearbeitbar.',
  },
]

/** The visible text is short; `name` is the full accessible name (and keeps the button named when the text is hidden on narrow windows). */
const TOOLS: readonly {
  value: Tool
  label: string
  name: string
  icon: ReactNode
  shortcut: string
  title: string
}[] = [
  {
    value: 'select',
    label: 'Auswählen',
    name: 'Auswählen',
    icon: <CursorIcon size={ICON_SIZE} />,
    shortcut: 'V',
    title: 'Elemente anklicken, markieren und verschieben; die Sidebar zeigt die Auswahl. Konnektoren am Rand eines Objekts lassen sich auf ein anderes Element ziehen.',
  },
  {
    value: 'create',
    label: 'Objekt',
    name: 'Objekt anlegen',
    icon: <AddObjectIcon size={ICON_SIZE} />,
    shortcut: 'N',
    title: 'Auf eine freie Stelle der Fläche klicken, um dort ein Objekt anzulegen (in einer Gruppe: als Mitglied). Das Werkzeug bleibt aktiv; Esc beendet es.',
  },
  {
    value: 'connect',
    label: 'Verbinden',
    name: 'Verbinden',
    icon: <ConnectIcon size={ICON_SIZE} />,
    shortcut: 'C',
    title: 'Zwei Objekte nacheinander anklicken (erst Quelle, dann Ziel), um sie zu verbinden. Esc beendet das Werkzeug.',
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
  tool,
  onToolChange,
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
  onGroup,
  onUngroup,
  onDelete,
  onExport,
  onImport,
}: ToolbarProps) {
  const dependencyHighlight = highlight === 'outgoing' || highlight === 'incoming' || highlight === 'both'

  return (
    <header className="toolbar" role="toolbar" aria-label="Werkzeuge">
      <ProjectTitle name={projectName} onRename={onRenameProject} />

      <div className="mode-switch" role="group" aria-label="Arbeitsmodus">
        {MODES.map(({ value, label, icon, title }) => (
          <Tooltip key={value} text={title}>
            <button
              type="button"
              className="ui-button"
              aria-pressed={mode === value}
              onClick={() => onModeChange(value)}
            >
              {icon}
              {label}
            </button>
          </Tooltip>
        ))}
      </div>

      <Separator />

      {mode === 'build' ? (
        <>
          <Section label="Erstellen">
            <div className="tool-switch" role="group" aria-label="Werkzeug">
              {TOOLS.map(({ value, label, name, icon, shortcut, title }) => (
                <Tooltip key={value} text={title} shortcut={shortcut}>
                  <button
                    type="button"
                    className="ui-button"
                    aria-label={name}
                    aria-pressed={tool === value}
                    onClick={() => onToolChange(value)}
                  >
                    {icon}
                    <span className="tool-switch__label">{label}</span>
                  </button>
                </Tooltip>
              ))}
            </div>
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
              <button
                type="button"
                className="ui-button ui-button--cycle"
                aria-label={cycleCount === 1 ? '1 Zyklus' : `${cycleCount} Zyklen`}
                onClick={onFocusCycle}
              >
                <CycleIcon />
                <span>{cycleCount}</span>
                <span className="cycle-button__word">{cycleCount === 1 ? ' Zyklus' : ' Zyklen'}</span>
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
