import type { DependencyDirection, ToolbarProps } from './props'
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

export function Toolbar({
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
      <h1 className="toolbar__title">Release-Management</h1>

      <button type="button" className="ui-button" onClick={onAddNode}>
        Objekt anlegen
      </button>
      <button
        type="button"
        className="ui-button"
        aria-pressed={connectMode !== 'off'}
        onClick={onToggleConnect}
      >
        Verbinden
      </button>
      {hint && (
        <span className="toolbar__hint" role="status">
          {hint}
        </span>
      )}

      <Separator />

      <button type="button" className="ui-button" disabled={!canUndo} onClick={onUndo}>
        Rückgängig
      </button>
      <button type="button" className="ui-button" disabled={!canRedo} onClick={onRedo}>
        Wiederholen
      </button>

      <Separator />

      <button type="button" className="ui-button" disabled={!canGroup} onClick={onGroup}>
        Gruppieren
      </button>
      <button type="button" className="ui-button" disabled={!canUngroup} onClick={onUngroup}>
        Gruppe auflösen
      </button>
      <button type="button" className="ui-button" disabled={!canDelete} onClick={onDelete}>
        Löschen
      </button>

      <Separator />

      <button
        type="button"
        className="ui-button"
        aria-pressed={dependencyMode !== 'off'}
        title="Abhängigkeitsgraph der Auswahl dick und rot hervorheben"
        onClick={() => onDependencyModeChange(dependencyMode === 'off' ? 'outgoing' : 'off')}
      >
        Abhängigkeiten
      </button>
      {dependencyMode !== 'off' && (
        <>
          <select
            className="ui-input toolbar__select"
            aria-label="Richtung der Abhängigkeiten"
            value={dependencyMode}
            onChange={(event) => onDependencyModeChange(event.target.value as DependencyDirection)}
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

      <Separator />

      <button type="button" className="ui-button" onClick={onExport}>
        Export
      </button>
      <button type="button" className="ui-button" onClick={onImport}>
        Import
      </button>
    </header>
  )
}
