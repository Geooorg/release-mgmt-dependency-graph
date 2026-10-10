import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { findDuplicateKeys, isValidColor, normalizeMetadata } from '../model/metadata'
import { COLOR_KEY, DEFAULT_COLOR, NAME_KEY } from '../model/types'
import type { MetadataEntry } from '../model/types'
import type { SidebarElement, SidebarProps } from './props'
import './components.css'

/** One editable field row; `rid` is a stable local id used as React key. */
interface Row {
  rid: string
  key: string
  value: string
  /** Focus the key input on mount (set for rows added via "Feld hinzufügen"). */
  autoFocus?: boolean
}

/** Local edit state: the fixed `name` and `color` fields plus the free-form rows. */
interface Draft {
  name: string
  /** `#rrggbb`, or '' = no colour set (default blue). */
  color: string
  rows: Row[]
}

let rowCounter = 0

function newRowId(): string {
  rowCounter += 1
  return `row-${rowCounter}`
}

/** Rebuilds rows from entries; rows of `previous` donate their ids (by position) to keep input focus. */
function toRows(entries: readonly MetadataEntry[], previous: readonly Row[] = []): Row[] {
  return entries.map((entry, index) => ({
    rid: previous[index]?.rid ?? newRowId(),
    key: entry.key,
    value: entry.value,
  }))
}

function toDraft(entries: readonly MetadataEntry[], previousRows: readonly Row[] = []): Draft {
  const nameIndex = entries.findIndex((entry) => entry.key === NAME_KEY)
  const colorIndex = entries.findIndex((entry) => entry.key === COLOR_KEY)
  const color = colorIndex >= 0 ? entries[colorIndex].value.trim().toLowerCase() : ''
  return {
    name: nameIndex >= 0 ? entries[nameIndex].value : '',
    // An unusable colour value counts as "not set" and is dropped on the next save.
    color: isValidColor(color) ? color : '',
    rows: toRows(
      entries.filter((_, index) => index !== nameIndex && index !== colorIndex),
      previousRows,
    ),
  }
}

function toEntries(draft: Draft): MetadataEntry[] {
  return [
    { key: NAME_KEY, value: draft.name },
    ...(draft.color ? [{ key: COLOR_KEY, value: draft.color }] : []),
    ...draft.rows.map(({ key, value }) => ({ key, value })),
  ]
}

function sameEntries(a: readonly MetadataEntry[], b: readonly MetadataEntry[]): boolean {
  return a.length === b.length && a.every((entry, i) => entry.key === b[i].key && entry.value === b[i].value)
}

/** Entries in the shape the draft edits them (`name` first), so comparisons ignore ordering quirks. */
function canonical(entries: readonly MetadataEntry[]): MetadataEntry[] {
  return toEntries(toDraft(entries))
}

type SidebarFormProps = Omit<SidebarProps, 'element'> & { element: SidebarElement }

function SidebarForm({ element, onSave, onClose }: SidebarFormProps) {
  const formId = useId()
  const [received, setReceived] = useState(element.metadata)
  const [baseline, setBaseline] = useState(() => canonical(element.metadata))
  const [draft, setDraft] = useState(() => toDraft(element.metadata))
  const [saved, setSaved] = useState(false)
  const [attempted, setAttempted] = useState(false)

  // The parent delivered different metadata for this very element (e.g. changed elsewhere):
  // adopt it. Our own save echoes back as equal to `baseline` and is skipped.
  if (received !== element.metadata) {
    setReceived(element.metadata)
    if (!sameEntries(received, element.metadata) && !sameEntries(baseline, canonical(element.metadata))) {
      setBaseline(canonical(element.metadata))
      setDraft(toDraft(element.metadata))
      setSaved(false)
      setAttempted(false)
    }
  }

  const dirty = !sameEntries(baseline, toEntries(draft))
  // After the first failed save the duplicate check stays live, so the alert vanishes once fixed.
  const duplicates = attempted ? findDuplicateKeys(normalizeMetadata(toEntries(draft))) : []

  function edit(next: Draft) {
    setDraft(next)
    setSaved(false)
  }

  function updateRow(rid: string, patch: Partial<Pick<Row, 'key' | 'value'>>) {
    edit({ ...draft, rows: draft.rows.map((row) => (row.rid === rid ? { ...row, ...patch } : row)) })
  }

  function removeRow(rid: string) {
    edit({ ...draft, rows: draft.rows.filter((row) => row.rid !== rid) })
  }

  function addRow() {
    edit({ ...draft, rows: [...draft.rows, { rid: newRowId(), key: '', value: '', autoFocus: true }] })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = normalizeMetadata(toEntries(draft))
    if (findDuplicateKeys(normalized).length > 0) {
      setAttempted(true)
      return
    }
    onSave(normalized)
    // Re-sync from what was saved (empty-key rows vanish, values appear trimmed). Surviving rows keep
    // their ids so a focused input stays focused after Enter.
    const survivors = draft.rows.filter((row) => row.key.trim() !== '')
    setDraft(toDraft(normalized, survivors))
    setBaseline(normalized)
    setSaved(true)
    setAttempted(false)
  }

  const title = element.kind === 'group' ? 'Gruppe' : 'Objekt'

  return (
    <form className="sidebar__form" onSubmit={handleSubmit}>
      <div className="sidebar__header">
        <h2 className="sidebar__title">{title}</h2>
        <button
          type="button"
          className="ui-button ui-button--icon"
          aria-label="Schließen"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="sidebar__field">
        <label className="sidebar__label" htmlFor={`${formId}-uuid`}>
          UUID
        </label>
        <span className="sidebar__readonly">nicht editierbar</span>
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
          Name
        </label>
        <input
          id={`${formId}-name`}
          className="ui-input"
          value={draft.name}
          onChange={(event) => edit({ ...draft, name: event.target.value })}
        />
      </div>

      <div className="sidebar__field">
        <label className="sidebar__label" htmlFor={`${formId}-color`}>
          Farbe (color)
        </label>
        <div className="sidebar__color">
          <input
            id={`${formId}-color`}
            type="color"
            className="sidebar__color-input"
            value={draft.color || DEFAULT_COLOR}
            onChange={(event) => edit({ ...draft, color: event.target.value.toLowerCase() })}
          />
          <span className="sidebar__color-value">{draft.color || 'Standard'}</span>
          <button
            type="button"
            className="ui-button ui-button--secondary"
            disabled={draft.color === ''}
            onClick={() => edit({ ...draft, color: '' })}
          >
            Zurücksetzen
          </button>
        </div>
      </div>

      {draft.rows.length > 0 && (
        <ul className="sidebar__rows">
          {draft.rows.map((row) => (
            <li key={row.rid} className="sidebar__row">
              <input
                className="ui-input"
                placeholder="Feldname"
                aria-label="Feldname"
                value={row.key}
                autoFocus={row.autoFocus}
                onChange={(event) => updateRow(row.rid, { key: event.target.value })}
              />
              <input
                className="ui-input"
                placeholder="Wert"
                aria-label="Wert"
                value={row.value}
                onChange={(event) => updateRow(row.rid, { value: event.target.value })}
              />
              <button
                type="button"
                className="ui-button ui-button--icon"
                aria-label="Feld entfernen"
                onClick={() => removeRow(row.rid)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="ui-button ui-button--secondary sidebar__add" onClick={addRow}>
        Feld hinzufügen
      </button>

      <div className="sidebar__footer">
        {duplicates.length > 0 && (
          <p className="sidebar__error" role="alert">
            Doppelte Feldnamen: {duplicates.join(', ')}
          </p>
        )}
        {dirty && <p className="sidebar__hint">Ungespeicherte Änderungen</p>}
        {saved && (
          <p className="sidebar__saved" role="status">
            Gespeichert
          </p>
        )}
        <button type="submit" className="ui-button">
          Save
        </button>
      </div>
    </form>
  )
}

export function Sidebar({ element, onSave, onClose }: SidebarProps) {
  if (element === null) return null

  return (
    <aside className="sidebar" aria-label="Metadaten">
      {/* Keyed by id: opening a different element starts with a fresh draft. */}
      <SidebarForm key={element.id} element={element} onSave={onSave} onClose={onClose} />
    </aside>
  )
}
