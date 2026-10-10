import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { findDuplicateKeys, isValidColor, normalizeMetadata } from '../model/metadata'
import {
  BLOCK_REASON_KEY,
  DEFAULT_STATUS,
  isBlockReasonKey,
  isStatusKey,
  parseStatus,
  STATUS_KEY,
  STATUS_VALUES,
} from '../model/status'
import { useT } from '../i18n/react'
import { COLOR_KEY, DEFAULT_COLOR, NAME_KEY } from '../model/types'
import type { MetadataEntry } from '../model/types'
import type { SidebarElement, SidebarProps } from './props'
import { SidebarBulkColor } from './SidebarBulkColor'
import { SidebarEdgeForm } from './SidebarEdgeForm'
import { useEditGesture, useReportInvalid } from './useSidebarEffects'
import './components.css'

/** One editable field row; `rid` is a stable local id used as React key. */
interface Row {
  rid: string
  key: string
  value: string
  /** Focus the key input on mount (set for rows added via "add field"). */
  autoFocus?: boolean
}

/** Local edit state: the fixed `name`, `color`, `status` and `blockiert_grund` fields plus the free-form rows. */
interface Draft {
  name: string
  /** `#rrggbb`, or '' = no colour set (default blue). */
  color: string
  /** Raw (trimmed) value of the `status` entry, '' = none; objects only (a group keeps `status` as a free row). */
  status: string
  /** Reason of the status `blockiert` (objects only, and only while blocked); '' = none. */
  reason: string
  rows: Row[]
}

let rowCounter = 0

function newRowId(): string {
  rowCounter += 1
  return `row-${rowCounter}`
}

function toRows(entries: readonly MetadataEntry[]): Row[] {
  return entries.map((entry) => ({ rid: newRowId(), key: entry.key, value: entry.value }))
}

function toDraft(entries: readonly MetadataEntry[], withStatus: boolean): Draft {
  const nameIndex = entries.findIndex((entry) => entry.key === NAME_KEY)
  const colorIndex = entries.findIndex((entry) => entry.key === COLOR_KEY)
  // The status key is matched trimmed and case-insensitively; it is written back as `status`.
  const statusIndex = withStatus ? entries.findIndex((entry) => isStatusKey(entry.key)) : -1
  const color = colorIndex >= 0 ? entries[colorIndex].value.trim().toLowerCase() : ''
  const status = statusIndex >= 0 ? entries[statusIndex].value.trim() : ''
  // Only a blocked object has a reason field; for any other status the key is an ordinary row.
  const reasonIndex = parseStatus(status) === 'blockiert' ? entries.findIndex((entry) => isBlockReasonKey(entry.key)) : -1
  return {
    name: nameIndex >= 0 ? entries[nameIndex].value : '',
    // An unusable colour value counts as "not set" and is dropped on the next edit.
    color: isValidColor(color) ? color : '',
    // An unknown value is kept as it is (and offered as an extra option), never silently replaced.
    status,
    reason: reasonIndex >= 0 ? entries[reasonIndex].value : '',
    rows: toRows(
      entries.filter(
        (_, index) => index !== nameIndex && index !== colorIndex && index !== statusIndex && index !== reasonIndex,
      ),
    ),
  }
}

function toEntries(draft: Draft): MetadataEntry[] {
  return [
    { key: NAME_KEY, value: draft.name },
    ...(draft.color ? [{ key: COLOR_KEY, value: draft.color }] : []),
    ...(draft.status ? [{ key: STATUS_KEY, value: draft.status }] : []),
    ...(draft.reason.trim() ? [{ key: BLOCK_REASON_KEY, value: draft.reason }] : []),
    ...draft.rows.map(({ key, value }) => ({ key, value })),
  ]
}

function sameEntries(a: readonly MetadataEntry[], b: readonly MetadataEntry[]): boolean {
  return a.length === b.length && a.every((entry, i) => entry.key === b[i].key && entry.value === b[i].value)
}

/**
 * What the draft stands for in the model. A free row typed as "Status" takes the place of the
 * status field, so the stored entry is canonical; empty keys are dropped, values trimmed.
 */
function entriesOf(draft: Draft, withStatus: boolean): MetadataEntry[] {
  return normalizeMetadata(toEntries(toDraft(toEntries(draft), withStatus)))
}

type SidebarFormProps = Omit<SidebarProps, 'element' | 'selectionCount' | 'hidden'> & {
  element: SidebarElement & { kind: 'node' | 'group' }
}

/**
 * Every valid change goes to the model right away (`onChange`). The draft stays in charge while
 * typing (trailing spaces, rows with an empty key survive); it is only reloaded when the metadata
 * changed from outside (undo/redo, import), recognised by not being what this form applied last.
 */
function SidebarForm({
  element,
  onChange,
  onEditStart,
  onEditEnd,
  onClose,
  onInvalidChange,
}: SidebarFormProps) {
  const t = useT()
  const formId = useId()
  const withStatus = element.kind === 'node'
  const [received, setReceived] = useState(element.metadata)
  const [applied, setApplied] = useState(() => entriesOf(toDraft(element.metadata, withStatus), withStatus))
  const [draft, setDraft] = useState(() => toDraft(element.metadata, withStatus))
  const gesture = useEditGesture(onEditStart, onEditEnd)

  if (received !== element.metadata) {
    setReceived(element.metadata)
    const incoming = entriesOf(toDraft(element.metadata, withStatus), withStatus)
    // Our own change coming back is equal to `applied`; anything else is news from outside.
    if (!sameEntries(incoming, applied)) {
      setApplied(incoming)
      setDraft(toDraft(element.metadata, withStatus))
    }
  }

  const duplicates = findDuplicateKeys(entriesOf(draft, withStatus))
  useReportInvalid(duplicates.length > 0, onInvalidChange)
  // The fixed fields show what the model will hold, e.g. also for a free row typed as "Status".
  const shown = toDraft(toEntries(draft), withStatus)
  const blocked = parseStatus(shown.status) === 'blockiert'

  /** `discrete`: a click or choice that is one undo step of its own; otherwise typing, bundled until the field is left. */
  function edit(next: Draft, discrete = false) {
    setDraft(next)
    const entries = entriesOf(next, withStatus)
    // Invalid or nothing new (e.g. a freshly added row without a key): the model keeps its state.
    if (findDuplicateKeys(entries).length > 0 || sameEntries(entries, applied)) return
    if (discrete) gesture.end()
    else gesture.start()
    setApplied(entries)
    onChange(entries)
  }

  function updateRow(rid: string, patch: Partial<Pick<Row, 'key' | 'value'>>) {
    edit({ ...draft, rows: draft.rows.map((row) => (row.rid === rid ? { ...row, ...patch } : row)) })
  }

  /** A status other than `blockiert` also drops the reason, in the same change (also a stray reason row). */
  function chooseStatus(status: string) {
    const rows = status === 'blockiert' ? draft.rows : draft.rows.filter((row) => !isBlockReasonKey(row.key))
    edit({ ...draft, status, reason: status === 'blockiert' ? shown.reason : '', rows }, true)
  }

  function removeRow(rid: string) {
    edit({ ...draft, rows: draft.rows.filter((row) => row.rid !== rid) }, true)
  }

  function addRow() {
    gesture.end()
    edit({ ...draft, rows: [...draft.rows, { rid: newRowId(), key: '', value: '', autoFocus: true }] }, true)
  }

  // A form with a single field would otherwise reload the page on Enter.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
  }

  const title = element.kind === 'group' ? t('sidebar.title.group') : t('sidebar.title.node')

  return (
    <form className="sidebar__form" onSubmit={handleSubmit}>
      <div className="sidebar__header">
        <h2 className="sidebar__title">{title}</h2>
        <button
          type="button"
          className="ui-button ui-button--icon"
          aria-label={t('common.close')}
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="sidebar__field">
        <label className="sidebar__label" htmlFor={`${formId}-uuid`}>
          {t('sidebar.field.uuid')}
        </label>
        <span className="sidebar__readonly">{t('sidebar.field.readonly')}</span>
        <input
          id={`${formId}-uuid`}
          className="ui-input sidebar__uuid"
          value={element.id}
          disabled
          readOnly
        />
      </div>

      <div className="sidebar__field">
        <label className="sidebar__label" htmlFor={`${formId}-name`}>
          {t('sidebar.field.name')}
        </label>
        <input
          id={`${formId}-name`}
          className="ui-input"
          value={draft.name}
          onChange={(event) => edit({ ...draft, name: event.target.value })}
          onBlur={gesture.end}
        />
      </div>

      <div className="sidebar__field">
        <label className="sidebar__label" htmlFor={`${formId}-color`}>
          {t('sidebar.field.color')}
        </label>
        <div className="sidebar__color">
          <input
            id={`${formId}-color`}
            type="color"
            className="sidebar__color-input"
            value={shown.color || DEFAULT_COLOR}
            onChange={(event) => edit({ ...draft, color: event.target.value.toLowerCase() })}
            onBlur={gesture.end}
          />
          <span className="sidebar__color-value">{shown.color || t('sidebar.color.default')}</span>
          <button
            type="button"
            className="ui-button ui-button--secondary"
            disabled={shown.color === ''}
            onClick={() => edit({ ...draft, color: '' }, true)}
          >
            {t('sidebar.color.reset')}
          </button>
        </div>
      </div>

      {withStatus && (
        <div className="sidebar__field">
          <label className="sidebar__label" htmlFor={`${formId}-status`}>
            {t('sidebar.field.status')}
          </label>
          <select
            id={`${formId}-status`}
            className="ui-input"
            value={parseStatus(shown.status) ?? (shown.status || DEFAULT_STATUS)}
            onChange={(event) => chooseStatus(event.target.value)}
          >
            {STATUS_VALUES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
            {shown.status !== '' && parseStatus(shown.status) === undefined && (
              <option value={shown.status}>{t('sidebar.status.unknown', { value: shown.status })}</option>
            )}
          </select>
        </div>
      )}

      {withStatus && blocked && (
        <div className="sidebar__field">
          <label className="sidebar__label" htmlFor={`${formId}-reason`}>
            {t('sidebar.field.reason')}
          </label>
          <input
            id={`${formId}-reason`}
            className="ui-input"
            placeholder={t('sidebar.reason.placeholder')}
            value={shown.reason}
            onChange={(event) => edit({ ...draft, reason: event.target.value })}
            onBlur={gesture.end}
          />
        </div>
      )}

      {element.kind === 'group' && element.progress && (
        <p className="sidebar__info">
          {element.progress.total === 0
            ? t('sidebar.progress.none')
            : t('sidebar.progress.some', { done: element.progress.done, total: element.progress.total })}
        </p>
      )}

      {draft.rows.length > 0 && (
        <ul className="sidebar__rows">
          {draft.rows.map((row) => (
            <li key={row.rid} className="sidebar__row">
              <input
                className="ui-input"
                placeholder={t('sidebar.field.key')}
                aria-label={t('sidebar.field.key')}
                value={row.key}
                autoFocus={row.autoFocus}
                onChange={(event) => updateRow(row.rid, { key: event.target.value })}
                onBlur={gesture.end}
              />
              <input
                className="ui-input"
                placeholder={t('sidebar.field.value')}
                aria-label={t('sidebar.field.value')}
                value={row.value}
                onChange={(event) => updateRow(row.rid, { value: event.target.value })}
                onBlur={gesture.end}
              />
              <button
                type="button"
                className="ui-button ui-button--icon"
                aria-label={t('sidebar.field.remove')}
                onClick={() => removeRow(row.rid)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="ui-button ui-button--secondary sidebar__add" onClick={addRow}>
        {t('sidebar.field.add')}
      </button>

      {duplicates.length > 0 && (
        <div className="sidebar__footer">
          <p className="sidebar__error" role="alert">
            {t('sidebar.duplicates', { names: duplicates.join(', ') })}
          </p>
          <p className="sidebar__hint">{t('sidebar.duplicates.hint')}</p>
        </div>
      )}
    </form>
  )
}

export function Sidebar({ element, selectionCount, bulkColor, hidden, ...handlers }: SidebarProps) {
  const t = useT()
  if (element === null) {
    if (selectionCount < 2) return null
    return (
      <aside className="sidebar" aria-label={t('sidebar.label')} hidden={hidden}>
        <div className="sidebar__form">
          <div className="sidebar__header">
            <h2 className="sidebar__title">{t('sidebar.title.selection')}</h2>
            <button
              type="button"
              className="ui-button ui-button--icon"
              aria-label={t('common.close')}
              onClick={handlers.onClose}
            >
              ×
            </button>
          </div>
          <p className="sidebar__info" role="status">
            {t.plural('sidebar.selection', selectionCount)}
          </p>
          {bulkColor && (
            <SidebarBulkColor {...bulkColor} onEditStart={handlers.onEditStart} onEditEnd={handlers.onEditEnd} />
          )}
        </div>
      </aside>
    )
  }

  return (
    <aside className="sidebar" aria-label={t('sidebar.label')} hidden={hidden}>
      {/* Keyed by id: opening a different element starts with a fresh draft. */}
      {element.kind === 'edge' ? (
        <SidebarEdgeForm key={element.id} element={element} {...handlers} />
      ) : (
        <SidebarForm key={element.id} element={{ ...element, kind: element.kind }} {...handlers} />
      )}
    </aside>
  )
}
