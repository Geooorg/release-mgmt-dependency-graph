import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { SidebarElement, SidebarProps } from './props'
import './components.css'

export const LABEL_KEY = 'label'

type SidebarEdgeFormProps = Omit<SidebarProps, 'element'> & { element: SidebarElement }

/** Sidebar content for an edge: the read-only UUID and a single "Label" field. */
export function SidebarEdgeForm({ element, onSave, onClose }: SidebarEdgeFormProps) {
  const formId = useId()
  const initial = element.metadata.find((entry) => entry.key === LABEL_KEY)?.value ?? ''
  const [baseline, setBaseline] = useState(initial)
  const [label, setLabel] = useState(initial)
  const [saved, setSaved] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = label.trim()
    onSave([{ key: LABEL_KEY, value: trimmed }])
    setLabel(trimmed)
    setBaseline(trimmed)
    setSaved(true)
  }

  return (
    <form className="sidebar__form" onSubmit={handleSubmit}>
      <div className="sidebar__header">
        <h2 className="sidebar__title">Verbindung</h2>
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
        <label className="sidebar__label" htmlFor={`${formId}-label`}>
          Label
        </label>
        <input
          id={`${formId}-label`}
          className="ui-input"
          value={label}
          autoFocus
          onChange={(event) => {
            setLabel(event.target.value)
            setSaved(false)
          }}
        />
      </div>

      <div className="sidebar__footer">
        {label !== baseline && <p className="sidebar__hint">Ungespeicherte Änderungen</p>}
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
