import type { ToolbarProps } from './props'
import './components.css'

const CONNECT_HINTS = {
  off: null,
  pickSource: 'Quelle wählen …',
  pickTarget: 'Ziel wählen …',
} as const

function Separator() {
  return <span className="toolbar__separator" role="separator" aria-orientation="vertical" />
}

export function Toolbar({
  connectMode,
  canGroup,
  canUngroup,
  canDelete,
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

      <button type="button" className="ui-button" onClick={onExport}>
        Export
      </button>
      <button type="button" className="ui-button" onClick={onImport}>
        Import
      </button>
    </header>
  )
}
