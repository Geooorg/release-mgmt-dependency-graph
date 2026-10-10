import { useId } from 'react'
import type { ReactNode } from 'react'
import { DEFAULT_STATUS, parseStatus, STATUS_VALUES, type Status } from '../model/status'
import { BlockedFlag, InconsistentMark } from './StatusMarks'
import type { AnalysisEntry, AnalysisPanelProps, AnalysisSelected } from './props'
import './components.css'

const MAX_TITLE_NAMES = 3
const BLOCKED_TITLE = 'Blockiert: hat noch nicht fertige Voraussetzungen'
const INCONSISTENT_TITLE = 'Fertig, aber Voraussetzung nicht fertig'

function titleOf(names: readonly string[]): string {
  if (names.length === 0) return 'Gesamtes Projekt'
  const shown = names.slice(0, MAX_TITLE_NAMES).join(', ')
  return names.length > MAX_TITLE_NAMES ? `${shown} und ${names.length - MAX_TITLE_NAMES} weitere` : shown
}

function stepsText(count: number): string {
  return count === 1 ? '1 Schritt' : `${count} Schritte`
}

function StatusChip({ status }: { status: AnalysisEntry['status'] }) {
  const modifier = status === 'fertig' ? 'done' : status === 'in Arbeit' ? 'progress' : 'open'
  return <span className={`analysis-chip analysis-chip--${modifier}`}>{status}</span>
}

function Entry({ entry, onReveal }: { entry: AnalysisEntry; onReveal: (id: string) => void }) {
  return (
    <button
      type="button"
      className="analysis-item"
      title="Im Graph zeigen"
      onClick={() => onReveal(entry.id)}
    >
      <span className="analysis-item__name">{entry.name}</span>
      <StatusChip status={entry.status} />
      {entry.ready && <span className="analysis-chip analysis-chip--ready">jetzt umsetzbar</span>}
      {entry.blocked && <BlockedFlag title={BLOCKED_TITLE} inline />}
      {entry.inconsistent && <InconsistentMark title={INCONSISTENT_TITLE} inline />}
    </button>
  )
}

function EntryList({
  entries,
  onReveal,
  numbered = false,
}: {
  entries: readonly AnalysisEntry[]
  onReveal: (id: string) => void
  numbered?: boolean
}) {
  const Tag = numbered ? 'ol' : 'ul'
  return (
    <Tag className="analysis-list">
      {entries.map((entry) => (
        <li key={entry.id}>
          <Entry entry={entry} onReveal={onReveal} />
        </li>
      ))}
    </Tag>
  )
}

/** A plain text row that reveals the object on click (section "Zu klären"). */
function ClarifyItem({ id, text, onReveal }: { id: string; text: string; onReveal: (id: string) => void }) {
  return (
    <li>
      <button type="button" className="analysis-item analysis-item--text" title="Im Graph zeigen" onClick={() => onReveal(id)}>
        {text}
      </button>
    </li>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="analysis-section">
      <h3 className="analysis-section__title">{title}</h3>
      {children}
    </section>
  )
}

/** "Auswahl": the status of the selected object (or the read-only progress of a group). */
function SelectedStatus({
  selected,
  onStatusChange,
}: {
  selected: AnalysisSelected
  onStatusChange: (status: Status) => void
}) {
  const selectId = useId()
  const known = parseStatus(selected.status)
  const { progress } = selected
  return (
    <section className="analysis-selected" aria-label="Auswahl">
      <p className="analysis-selected__name" title={selected.name}>
        Auswahl: <strong>{selected.name}</strong>
      </p>
      {selected.kind === 'node' ? (
        <div className="analysis-selected__field">
          <label className="analysis-selected__label" htmlFor={selectId}>
            Status
          </label>
          <select
            id={selectId}
            className="ui-input"
            value={known ?? (selected.status || DEFAULT_STATUS)}
            onChange={(event) => onStatusChange(event.target.value as Status)}
          >
            {STATUS_VALUES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
            {selected.status !== '' && known === undefined && (
              <option value={selected.status}>{selected.status} (unbekannt)</option>
            )}
          </select>
        </div>
      ) : (
        progress && (
          <p className="analysis-selected__progress">
            {progress.total === 0
              ? 'Status aus Mitgliedern: keine Mitglieder'
              : `Status aus Mitgliedern: ${progress.done} von ${progress.total} fertig`}
          </p>
        )
      )}
    </section>
  )
}

export function AnalysisPanel({
  selected,
  onStatusChange,
  scope,
  selectionNames,
  counts,
  criticalPath,
  cycleNames,
  blockers,
  inconsistent,
  unknownStatus,
  onReveal,
  onCopy,
  onClose,
}: AnalysisPanelProps) {
  const ready = blockers.filter((entry) => entry.ready)
  const blocked = blockers.filter((entry) => !entry.ready)
  const title = titleOf(selectionNames)
  const clarifyCount = inconsistent.length + unknownStatus.length

  return (
    <aside className="analysis-panel" aria-label="Release-Analyse">
      <div className="analysis-panel__header">
        <h2 className="analysis-panel__title" title={selectionNames.join(', ') || undefined}>
          Analyse: {title}
        </h2>
        <button type="button" className="ui-button ui-button--icon" aria-label="Analyse schließen" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="analysis-panel__body">
        {selected && <SelectedStatus selected={selected} onStatusChange={onStatusChange} />}

        <ul className="analysis-counts" aria-label="Projektstand">
          <li>
            <strong>{counts.done}</strong> fertig
          </li>
          <li>
            <strong>{counts.inProgress}</strong> in Arbeit
          </li>
          <li>
            <strong>{counts.open}</strong> offen
          </li>
          <li>
            <strong>{counts.blocked}</strong> blockiert
          </li>
          <li>
            <strong>{counts.ready}</strong> jetzt umsetzbar
          </li>
          {clarifyCount > 0 && (
            <li className="analysis-counts__clarify">
              <strong>{clarifyCount}</strong> zu klären
            </li>
          )}
        </ul>

        {clarifyCount > 0 && (
          <Section title="Zu klären">
            {inconsistent.length > 0 && (
              <>
                <h4 className="analysis-subtitle">Fertig trotz offener Voraussetzung ({inconsistent.length})</h4>
                <ul className="analysis-list">
                  {inconsistent.map((item) => (
                    <ClarifyItem
                      key={item.id}
                      id={item.id}
                      text={`${item.name} – wartet auf ${item.waitingFor.map((w) => `${w.name} (${w.status})`).join(', ')}`}
                      onReveal={onReveal}
                    />
                  ))}
                </ul>
              </>
            )}
            {unknownStatus.length > 0 && (
              <>
                <h4 className="analysis-subtitle">Unbekannter Status ({unknownStatus.length})</h4>
                <ul className="analysis-list">
                  {unknownStatus.map((item) => (
                    <ClarifyItem
                      key={item.id}
                      id={item.id}
                      text={`${item.name} – „${item.raw}“ (zählt als offen)`}
                      onReveal={onReveal}
                    />
                  ))}
                </ul>
              </>
            )}
          </Section>
        )}

        {criticalPath === null ? (
          <Section title="Kritischer Pfad">
            <p className="analysis-warning" role="alert">
              Kritischer Pfad nicht berechenbar – Zyklus zwischen {cycleNames.join(', ')}.
            </p>
          </Section>
        ) : (
          <Section title={`Kritischer Pfad (${stepsText(criticalPath.length)})`}>
            {criticalPath.steps.length === 0 ? (
              <p className="analysis-empty">Kein offener Schritt.</p>
            ) : (
              <>
                <p className="analysis-hint">Zuerst zu erledigen steht oben; der Pfad ist im Graph rot markiert.</p>
                <EntryList entries={criticalPath.steps} onReveal={onReveal} numbered />
              </>
            )}
          </Section>
        )}

        {scope === 'selection' ? (
          <Section title={`Blockierende Objekte (${blockers.length})`}>
            {blockers.length === 0 ? (
              <p className="analysis-empty">Keine offenen Voraussetzungen – kann released werden.</p>
            ) : (
              <EntryList entries={blockers} onReveal={onReveal} />
            )}
          </Section>
        ) : (
          <>
            <Section title={`Jetzt umsetzbar (${ready.length})`}>
              {ready.length === 0 ? (
                <p className="analysis-empty">Keine umsetzbaren Objekte.</p>
              ) : (
                <EntryList entries={ready} onReveal={onReveal} />
              )}
            </Section>
            <Section title={`Blockiert (${blocked.length})`}>
              {blocked.length === 0 ? (
                <p className="analysis-empty">Keine blockierten Objekte.</p>
              ) : (
                <EntryList entries={blocked} onReveal={onReveal} />
              )}
            </Section>
          </>
        )}
      </div>

      <div className="analysis-panel__footer">
        <button type="button" className="ui-button ui-button--secondary" onClick={onCopy}>
          Als Markdown kopieren
        </button>
      </div>
    </aside>
  )
}
