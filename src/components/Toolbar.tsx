import type { ReactNode } from 'react'
import { CycleIcon, GroupIcon, RedoIcon, UndoIcon, UngroupIcon } from './icons'
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
  {
    value: 'outgoing',
    label: '→ Voraussetzungen',
    title: 'Alles, wovon die Auswahl (direkt oder indirekt) abhängt – in Pfeilrichtung',
  },
  {
    value: 'incoming',
    label: '← Betroffene',
    title: 'Alles, was (direkt oder indirekt) von der Auswahl abhängt – gegen die Pfeilrichtung',
  },
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
  cycleCount,
  onFocusCycle,
  analysisOpen,
  onToggleAnalysis,
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
        <Tooltip text="Abhängigkeitsgraph der Auswahl ermitteln: alle erreichbaren Verbindungen werden dick und rot hervorgehoben. Richtung: Voraussetzungen (wovon die Auswahl abhängt) oder Betroffene (was von ihr abhängt). Schließt die Release-Analyse.">
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
        <Tooltip text="Release-Analyse öffnen: Status-Zähler, Blocker und kritischer Pfad (längste Kette offener Voraussetzungen, rot im Graph) für die Auswahl bzw. das ganze Projekt. Schließt die Abhängigkeits-Hervorhebung.">
          <button
            type="button"
            className="ui-button"
            aria-pressed={analysisOpen}
            onClick={onToggleAnalysis}
          >
            Release-Analyse
          </button>
        </Tooltip>
        {cycleCount > 0 && (
          <Tooltip text="Zyklische Abhängigkeiten verhindern eine gültige Release-Reihenfolge. Klicken wählt den nächsten Zyklus aus.">
            <button type="button" className="ui-button ui-button--cycle" onClick={onFocusCycle}>
              <CycleIcon />
              {cycleCount === 1 ? '1 Zyklus' : `${cycleCount} Zyklen`}
            </button>
          </Tooltip>
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
