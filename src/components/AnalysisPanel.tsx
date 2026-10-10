import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { FINISHED_HINT, joinNames } from '../model/releaseAnalysis'
import { DEFAULT_STATUS, parseStatus, STATUS_VALUES, type Status } from '../model/status'
import { BlockedFlag, StatusMark, WaitingMark } from './StatusMarks'
import type { AnalysisEntry, AnalysisPanelProps, AnalysisSelected } from './props'
import { useEditGesture } from './useSidebarEffects'
import './components.css'

const MAX_TITLE_NAMES = 3
const NO_REASON = 'kein Grund angegeben'

function titleOf(names: readonly string[]): string {
  if (names.length === 0) return 'Gesamtes Projekt'
  const shown = names.slice(0, MAX_TITLE_NAMES).join(', ')
  return names.length > MAX_TITLE_NAMES ? `${shown} und ${names.length - MAX_TITLE_NAMES} weitere` : shown
}

function stepsText(count: number): string {
  return count === 1 ? '1 Schritt' : `${count} Schritte`
}

const STATUS_CHIP: Record<Status, string> = {
  offen: 'open',
  'in Arbeit': 'progress',
  blockiert: 'blocked',
  fertig: 'done',
}

function StatusChip({ status }: { status: AnalysisEntry['status'] }) {
  return <span className={`analysis-chip analysis-chip--${STATUS_CHIP[status]}`}>{status}</span>
}

/** "Blockiert: <reason>" / "Blockiert (kein Grund angegeben)": tooltip and accessible name of the flag. */
function blockedTitle(reason: string | undefined): string {
  return reason === undefined ? `Blockiert (${NO_REASON})` : `Blockiert: ${reason}`
}

function waitingText(entry: AnalysisEntry): string {
  return `wartet auf ${joinNames(entry.waitingFor ?? [])}`
}

/** `note`: a second line with the reason (blocked) or what the entry waits for (waiting). */
function Entry({
  entry,
  onReveal,
  note,
}: {
  entry: AnalysisEntry
  onReveal: (id: string) => void
  note: boolean
}) {
  const noteText = entry.blocked ? (entry.reason ?? NO_REASON) : entry.waiting ? waitingText(entry) : undefined
  return (
    <button
      type="button"
      className="analysis-item"
      title="Im Graph zeigen"
      onClick={() => onReveal(entry.id)}
    >
      <span className="analysis-item__name">{entry.name}</span>
      {/* The flag says "blockiert" already. */}
      {!entry.blocked && <StatusChip status={entry.status} />}
      {entry.ready && <span className="analysis-chip analysis-chip--ready">jetzt umsetzbar</span>}
      {entry.blocked && <BlockedFlag title={blockedTitle(entry.reason)} inline />}
      {entry.waiting && <WaitingMark title={`Wartet auf: ${joinNames(entry.waitingFor ?? [])}`} inline />}
      {note && noteText !== undefined && <span className="analysis-item__note">{noteText}</span>}
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
  /** The critical path: numbered, compact (flags only, no second line). */
  numbered?: boolean
}) {
  const Tag = numbered ? 'ol' : 'ul'
  return (
    <Tag className="analysis-list">
      {entries.map((entry) => (
        <li key={entry.id}>
          <Entry entry={entry} onReveal={onReveal} note={!numbered} />
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

/**
 * The reason of a blocked object. The field keeps what was typed (e.g. a trailing blank) and is only
 * reloaded when the reason changes from outside (undo/redo), recognised by not being what it applied last.
 */
function BlockReasonField({
  reason,
  onChange,
  onEditStart,
  onEditEnd,
}: {
  reason: string
  onChange: (reason: string) => void
  onEditStart: () => void
  onEditEnd: () => void
}) {
  const fieldId = useId()
  const [applied, setApplied] = useState(reason)
  const [draft, setDraft] = useState(reason)
  const gesture = useEditGesture(onEditStart, onEditEnd)
  if (reason !== applied) {
    setApplied(reason)
    setDraft(reason)
  }
  return (
    <div className="analysis-selected__field">
      <label className="analysis-selected__label" htmlFor={fieldId}>
        Grund
      </label>
      <input
        id={fieldId}
        className="ui-input"
        placeholder="Warum ist das Objekt blockiert? (optional)"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          setApplied(event.target.value.trim())
          gesture.start()
          onChange(event.target.value)
        }}
        onBlur={gesture.end}
      />
    </div>
  )
}

/** "Auswahl": status (and reason) of the selected object, or the read-only progress of a group. */
function SelectedStatus({
  selected,
  onStatusChange,
  onBlockReasonChange,
  onEditStart,
  onEditEnd,
}: {
  selected: AnalysisSelected
  onStatusChange: (status: Status) => void
  onBlockReasonChange: (reason: string) => void
  onEditStart: () => void
  onEditEnd: () => void
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
        <>
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
          {known === 'blockiert' && (
            <BlockReasonField
              key={selected.id}
              reason={selected.reason}
              onChange={onBlockReasonChange}
              onEditStart={onEditStart}
              onEditEnd={onEditEnd}
            />
          )}
        </>
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

/** "Zeichen erklärt": the marks of the graph, drawn with the same components as on the boxes. */
function Legend() {
  const rows: { icon: ReactNode; text: string }[] = [
    {
      icon: <BlockedFlag title="Blockiert" inline />,
      text: 'Rote Flagge: blockiert – manuell gesetzt (Status „blockiert“), z. B. weil eine Freigabe fehlt. Entfernen: anderen Status wählen.',
    },
    {
      icon: <WaitingMark title="Wartet" inline />,
      text: 'Sanduhr: wartet – nicht fertig und von einer noch nicht fertigen Voraussetzung abhängig.',
    },
    { icon: <StatusMark status="fertig" inline />, text: 'Häkchen: fertig' },
    { icon: <StatusMark status="in Arbeit" inline />, text: 'Halbkreis: in Arbeit' },
    { icon: <StatusMark status="offen" raw="offen" inline />, text: 'Grauer Kreis: offen (auch ohne gesetzten Status)' },
    { icon: <StatusMark status="offen" raw="…" known={false} inline />, text: '„?“: unbekannter Status – zählt als offen' },
  ]
  return (
    <details className="analysis-legend">
      <summary className="analysis-legend__summary">Zeichen erklärt</summary>
      <ul className="analysis-legend__list">
        {rows.map((row) => (
          <li key={row.text} className="analysis-legend__row">
            <span aria-hidden="true" className="analysis-legend__icon">
              {row.icon}
            </span>
            <span>{row.text}</span>
          </li>
        ))}
      </ul>
      <p className="analysis-hint">Bei Gruppen stehen Flagge und Sanduhr im Titel, wenn ein Mitglied betroffen ist.</p>
    </details>
  )
}

/** The selected objects that are blocked themselves, prominent at the top. */
function SelfBlocked({ entries }: { entries: AnalysisPanelProps['selfBlocked'] }) {
  return (
    <section className="analysis-self-blocked" aria-label="Auswahl ist blockiert">
      {entries.map((entry) => (
        <p key={entry.id} className="analysis-self-blocked__row">
          <BlockedFlag title={blockedTitle(entry.reason)} inline />
          <span>
            <strong>{entry.name}</strong> ist blockiert – {entry.reason ?? NO_REASON}
          </span>
        </p>
      ))}
    </section>
  )
}

export function AnalysisPanel({
  selected,
  onStatusChange,
  onBlockReasonChange,
  onEditStart,
  onEditEnd,
  selfBlocked,
  scope,
  selectionNames,
  counts,
  criticalPath,
  cycleNames,
  unfinished,
  selectionFinished,
  unknownStatus,
  onReveal,
  onCopy,
  onClose,
}: AnalysisPanelProps) {
  const blocked = unfinished.filter((entry) => entry.blocked)
  const ready = unfinished.filter((entry) => entry.ready)
  const waiting = unfinished.filter((entry) => entry.waiting)
  const title = titleOf(selectionNames)
  const clarifyCount = unknownStatus.length

  const pathSection =
    criticalPath === null ? (
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
    )

  const listSection = (heading: string, entries: readonly AnalysisEntry[], empty: string) => (
    <Section title={`${heading} (${entries.length})`}>
      {entries.length === 0 ? <p className="analysis-empty">{empty}</p> : <EntryList entries={entries} onReveal={onReveal} />}
    </Section>
  )

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
        {selfBlocked.length > 0 && <SelfBlocked entries={selfBlocked} />}

        {selected && (
          <SelectedStatus
            selected={selected}
            onStatusChange={onStatusChange}
            onBlockReasonChange={onBlockReasonChange}
            onEditStart={onEditStart}
            onEditEnd={onEditEnd}
          />
        )}

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
            <strong>{counts.waiting}</strong> wartet
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
          </Section>
        )}

        {scope === 'selection' ? (
          <>
            {pathSection}
            {listSection(
              'Offene Voraussetzungen',
              unfinished,
              selectionFinished ? FINISHED_HINT : 'Keine offenen Voraussetzungen – kann released werden.',
            )}
          </>
        ) : (
          <>
            {listSection('Blockiert', blocked, 'Keine blockierten Objekte.')}
            {listSection('Jetzt umsetzbar', ready, 'Keine umsetzbaren Objekte.')}
            {listSection('Wartet', waiting, 'Keine wartenden Objekte.')}
            {pathSection}
          </>
        )}

        <Legend />
      </div>

      <div className="analysis-panel__footer">
        <button type="button" className="ui-button ui-button--secondary" onClick={onCopy}>
          Als Markdown kopieren
        </button>
      </div>
    </aside>
  )
}
