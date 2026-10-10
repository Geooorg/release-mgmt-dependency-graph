import type { ReactNode } from 'react'
import { BlockedFlag } from './StatusMarks'
import type { AnalysisEntry, AnalysisPanelProps } from './props'
import './components.css'

const MAX_TITLE_NAMES = 3
const BLOCKED_TITLE = 'Blockiert: hat noch nicht fertige Voraussetzungen'

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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="analysis-section">
      <h3 className="analysis-section__title">{title}</h3>
      {children}
    </section>
  )
}

export function AnalysisPanel({
  scope,
  selectionNames,
  counts,
  criticalPath,
  cycleNames,
  blockers,
  onReveal,
  onCopy,
  onClose,
}: AnalysisPanelProps) {
  const ready = blockers.filter((entry) => entry.ready)
  const blocked = blockers.filter((entry) => !entry.ready)
  const title = titleOf(selectionNames)

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
        </ul>

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
