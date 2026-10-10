import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { useT } from '../i18n/react'
import type { Translate } from '../i18n/translate'
import { joinNames } from '../model/releaseAnalysis'
import { DEFAULT_STATUS, parseStatus, STATUS_LABEL_KEYS, STATUS_VALUES, type Status } from '../model/status'
import { BlockedFlag, StatusMark, WaitingMark } from './StatusMarks'
import type { AnalysisEntry, AnalysisPanelProps, AnalysisSelected } from './props'
import { useEditGesture } from './useSidebarEffects'
import './components.css'

const MAX_TITLE_NAMES = 3

function titleOf(names: readonly string[], t: Translate): string {
  if (names.length === 0) return t('analysis.wholeProject')
  const shown = names.slice(0, MAX_TITLE_NAMES).join(', ')
  return names.length > MAX_TITLE_NAMES ? t('analysis.titleMore', { names: shown, count: names.length - MAX_TITLE_NAMES }) : shown
}

const STATUS_CHIP: Record<Status, string> = {
  offen: 'open',
  'in Arbeit': 'progress',
  blockiert: 'blocked',
  fertig: 'done',
}

function StatusChip({ status }: { status: AnalysisEntry['status'] }) {
  const t = useT()
  return <span className={`analysis-chip analysis-chip--${STATUS_CHIP[status]}`}>{t(STATUS_LABEL_KEYS[status])}</span>
}

/** "Blocked: <reason>" / "Blocked (no reason given)": tooltip and accessible name of the flag. */
function blockedTitle(reason: string | undefined, t: Translate): string {
  return reason === undefined ? t('analysis.blocked.noReason') : t('analysis.blocked.reason', { reason })
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
  const t = useT()
  const noteText = entry.blocked
    ? (entry.reason ?? t('analysis.noReason'))
    : entry.waiting
      ? t('analysis.waitsFor', { names: joinNames(entry.waitingFor ?? []) })
      : undefined
  return (
    <button
      type="button"
      className="analysis-item"
      title={t('analysis.reveal')}
      onClick={() => onReveal(entry.id)}
    >
      <span className="analysis-item__name">{entry.name}</span>
      {/* The flag says "blockiert" already. */}
      {!entry.blocked && <StatusChip status={entry.status} />}
      {entry.ready && <span className="analysis-chip analysis-chip--ready">{t('analysis.ready')}</span>}
      {entry.blocked && <BlockedFlag title={blockedTitle(entry.reason, t)} inline />}
      {entry.waiting && <WaitingMark title={t('analysis.waitingMark', { names: joinNames(entry.waitingFor ?? []) })} inline />}
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

/** A plain text row that reveals the object on click (section "to clarify"). */
function ClarifyItem({ id, text, onReveal }: { id: string; text: string; onReveal: (id: string) => void }) {
  const t = useT()
  return (
    <li>
      <button type="button" className="analysis-item analysis-item--text" title={t('analysis.reveal')} onClick={() => onReveal(id)}>
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
  const t = useT()
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
        {t('analysis.field.reason')}
      </label>
      <input
        id={fieldId}
        className="ui-input"
        placeholder={t('analysis.reason.placeholder')}
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
  const t = useT()
  const selectId = useId()
  const known = parseStatus(selected.status)
  const { progress } = selected
  return (
    <section className="analysis-selected" aria-label={t('analysis.selected.label')}>
      <p className="analysis-selected__name" title={selected.name}>
        {t('analysis.selected.prefix')} <strong>{selected.name}</strong>
      </p>
      {selected.kind === 'node' ? (
        <>
          <div className="analysis-selected__field">
            <label className="analysis-selected__label" htmlFor={selectId}>
              {t('analysis.field.status')}
            </label>
            <select
              id={selectId}
              className="ui-input"
              value={known ?? (selected.status || DEFAULT_STATUS)}
              onChange={(event) => onStatusChange(event.target.value as Status)}
            >
              {STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {t(STATUS_LABEL_KEYS[status])}
                </option>
              ))}
              {selected.status !== '' && known === undefined && (
                <option value={selected.status}>{t('sidebar.status.unknown', { value: selected.status })}</option>
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
              ? t('sidebar.progress.none')
              : t('sidebar.progress.some', { done: progress.done, total: progress.total })}
          </p>
        )
      )}
    </section>
  )
}

/** "Zeichen erklärt": the marks of the graph, drawn with the same components as on the boxes. */
function Legend() {
  const t = useT()
  const rows: { icon: ReactNode; text: string }[] = [
    { icon: <BlockedFlag title={t('analysis.mark.blocked')} inline />, text: t('analysis.legend.blocked') },
    { icon: <WaitingMark title={t('analysis.mark.waiting')} inline />, text: t('analysis.legend.waiting') },
    { icon: <StatusMark status="fertig" inline />, text: t('analysis.legend.done') },
    { icon: <StatusMark status="in Arbeit" inline />, text: t('analysis.legend.progress') },
    { icon: <StatusMark status="offen" raw="offen" inline />, text: t('analysis.legend.open') },
    { icon: <StatusMark status="offen" raw="…" known={false} inline />, text: t('analysis.legend.unknown') },
  ]
  return (
    <details className="analysis-legend">
      <summary className="analysis-legend__summary">{t('analysis.legend.title')}</summary>
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
      <p className="analysis-hint">{t('analysis.legend.groups')}</p>
    </details>
  )
}

/** The selected objects that are blocked themselves, prominent at the top. */
function SelfBlocked({ entries }: { entries: AnalysisPanelProps['selfBlocked'] }) {
  const t = useT()
  return (
    <section className="analysis-self-blocked" aria-label={t('analysis.selfBlocked.label')}>
      {entries.map((entry) => (
        <p key={entry.id} className="analysis-self-blocked__row">
          <BlockedFlag title={blockedTitle(entry.reason, t)} inline />
          <span>
            <strong>{entry.name}</strong>{' '}
            {t('analysis.selfBlocked.suffix', { reason: entry.reason ?? t('analysis.noReason') })}
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
  const t = useT()
  const blocked = unfinished.filter((entry) => entry.blocked)
  const ready = unfinished.filter((entry) => entry.ready)
  const waiting = unfinished.filter((entry) => entry.waiting)
  const title = titleOf(selectionNames, t)
  const clarifyCount = unknownStatus.length

  const pathSection =
    criticalPath === null ? (
      <Section title={t('analysis.criticalPath')}>
        <p className="analysis-warning" role="alert">
          {t('analysis.criticalPath.cycle', { names: cycleNames.join(', ') })}
        </p>
      </Section>
    ) : (
      <Section title={t('analysis.criticalPath.steps', { steps: t.plural('analysis.steps', criticalPath.length) })}>
        {criticalPath.steps.length === 0 ? (
          <p className="analysis-empty">{t('analysis.criticalPath.empty')}</p>
        ) : (
          <>
            <p className="analysis-hint">{t('analysis.criticalPath.hint')}</p>
            <EntryList entries={criticalPath.steps} onReveal={onReveal} numbered />
          </>
        )}
      </Section>
    )

  const listSection = (heading: string, entries: readonly AnalysisEntry[], empty: string) => (
    <Section title={t('analysis.section.count', { heading, count: entries.length })}>
      {entries.length === 0 ? <p className="analysis-empty">{empty}</p> : <EntryList entries={entries} onReveal={onReveal} />}
    </Section>
  )

  return (
    <aside className="analysis-panel" aria-label={t('analysis.label')}>
      <div className="analysis-panel__header">
        <h2 className="analysis-panel__title" title={selectionNames.join(', ') || undefined}>
          {t('analysis.title', { title })}
        </h2>
        <button type="button" className="ui-button ui-button--icon" aria-label={t('analysis.close')} onClick={onClose}>
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

        <ul className="analysis-counts" aria-label={t('analysis.counts.label')}>
          <li>
            <strong>{counts.done}</strong> {t(STATUS_LABEL_KEYS.fertig)}
          </li>
          <li>
            <strong>{counts.inProgress}</strong> {t(STATUS_LABEL_KEYS['in Arbeit'])}
          </li>
          <li>
            <strong>{counts.open}</strong> {t(STATUS_LABEL_KEYS.offen)}
          </li>
          <li>
            <strong>{counts.blocked}</strong> {t(STATUS_LABEL_KEYS.blockiert)}
          </li>
          <li>
            <strong>{counts.waiting}</strong> {t('analysis.waiting')}
          </li>
          <li>
            <strong>{counts.ready}</strong> {t('analysis.ready')}
          </li>
          {clarifyCount > 0 && (
            <li className="analysis-counts__clarify">
              <strong>{clarifyCount}</strong> {t('analysis.toClarify')}
            </li>
          )}
        </ul>

        {clarifyCount > 0 && (
          <Section title={t('analysis.clarify.title')}>
            <h4 className="analysis-subtitle">{t('analysis.unknownStatus.title', { count: unknownStatus.length })}</h4>
            <ul className="analysis-list">
              {unknownStatus.map((item) => (
                <ClarifyItem
                  key={item.id}
                  id={item.id}
                  text={t('analysis.unknownStatus.item', { name: item.name, raw: item.raw })}
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
              t('analysis.section.prerequisites'),
              unfinished,
              selectionFinished ? t('analysis.finishedHint') : t('analysis.empty.prerequisites'),
            )}
          </>
        ) : (
          <>
            {listSection(t('analysis.section.blocked'), blocked, t('analysis.empty.blocked'))}
            {listSection(t('analysis.section.ready'), ready, t('analysis.empty.ready'))}
            {listSection(t('analysis.section.waiting'), waiting, t('analysis.empty.waiting'))}
            {pathSection}
          </>
        )}

        <Legend />
      </div>

      <div className="analysis-panel__footer">
        <button type="button" className="ui-button ui-button--secondary" onClick={onCopy}>
          {t('analysis.copy')}
        </button>
      </div>
    </aside>
  )
}
