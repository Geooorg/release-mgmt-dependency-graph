import type { ReactNode } from 'react'
import { GroupIcon, RedoIcon, UndoIcon, UngroupIcon } from './icons'
import { ProjectTitle } from './ProjectTitle'
import type { DependencyDirection, ToolbarProps } from './props'
import { Tooltip } from './Tooltip'
import './components.css'

const CONNECT_HINTS = {
  off: null,
  pickSource: 'Quelle wählen …',
  pickTarget: 'Ziel wählen …',
} as const

const DEPENDENCY_DIRECTIONS = [
  { value: 'outgoing', label: 'Ausgehend →', title: 'Alles, was von der Auswahl aus in Pfeilrichtung erreichbar ist' },
  { value: 'incoming', label: '← Eingehend', title: 'Alles, was in Pfeilrichtung zur Auswahl führt' },
  { value: 'both', label: '↔ Beide', title: 'Der gesamte verbundene Teilgraph' },
] as const

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
  connectMode,
  canGroup,
  canUngroup,
  canDelete,
  canUndo,
  canRedo,
  dependencyMode,
  selectionEmpty,
  onUndo,
  onRedo,
  onDependencyModeChange,
  onAddNode,
  onToggleConnect,
  onGroup,
  onUngroup,
  onDelete,
  onExport,
  onImport,
}: ToolbarProps) {
  const hint = CONNECT_HINTS[connectMode]

  return (
    <header className="toolbar" role="toolbar" aria-label="Werkzeuge">
      <ProjectTitle name={projectName} onRename={onRenameProject} />

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
          <button type="button" className="ui-button" disabled={!canDelete} onClick={onDelete}>
            Löschen
          </button>
        </Tooltip>
      </Section>

      <Separator />

      <Section label="Analyse">
        <Tooltip text="Abhängigkeitsgraph der Auswahl ermitteln: alle erreichbaren Verbindungen werden dick und rot hervorgehoben.">
          <button
            type="button"
            className="ui-button"
            aria-pressed={dependencyMode !== 'off'}
            onClick={() => onDependencyModeChange(dependencyMode === 'off' ? 'outgoing' : 'off')}
          >
            Abhängigkeiten
          </button>
        </Tooltip>
        {dependencyMode !== 'off' && (
          <>
            <select
              className="ui-input toolbar__select"
              aria-label="Richtung der Abhängigkeiten"
              value={dependencyMode}
              onChange={(event) =>
                onDependencyModeChange(event.target.value as DependencyDirection)
              }
            >
              {DEPENDENCY_DIRECTIONS.map(({ value, label, title }) => (
                <option key={value} value={value} title={title}>
                  {label}
                </option>
              ))}
            </select>
            {selectionEmpty && (
              <span className="toolbar__hint" role="status">
                Objekt markieren …
              </span>
            )}
          </>
        )}
      </Section>

      <span className="toolbar__spacer" />
      <Separator />

      <Section label="Datei">
        <Tooltip text="Das Modell als JSON-Datei herunterladen">
          <button type="button" className="ui-button" onClick={onExport}>
            Export
          </button>
        </Tooltip>
        <Tooltip text="Ein Modell aus einer JSON-Datei laden. Das aktuelle Modell wird ersetzt (vorher wird gefragt).">
          <button type="button" className="ui-button" onClick={onImport}>
            Import
          </button>
        </Tooltip>
      </Section>
    </header>
  )
}
