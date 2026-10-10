import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { SidebarElement, SidebarProps } from './props'
import { useEditGesture } from './useSidebarEffects'
import './components.css'

export const LABEL_KEY = 'label'

type SidebarEdgeFormProps = Omit<SidebarProps, 'element' | 'selectionCount'> & {
  element: SidebarElement
}

const labelOf = (element: SidebarElement) =>
  element.metadata.find((entry) => entry.key === LABEL_KEY)?.value ?? ''

/**
 * Sidebar content for an edge: the read-only UUID and a single "Label" field. The label is applied
 * (trimmed) with every keystroke; the draft keeps what was typed until the label changes from outside.
 */
export function SidebarEdgeForm({
  element,
  onChange,
  onEditStart,
  onEditEnd,
  onClose,
}: SidebarEdgeFormProps) {
  const formId = useId()
  const [received, setReceived] = useState(element.metadata)
  const [applied, setApplied] = useState(() => labelOf(element).trim())
  const [label, setLabel] = useState(() => labelOf(element))
  const gesture = useEditGesture(onEditStart, onEditEnd)

  if (received !== element.metadata) {
    setReceived(element.metadata)
    const incoming = labelOf(element).trim()
    // Our own change coming back equals `applied`; anything else changed from outside.
    if (incoming !== applied) {
      setApplied(incoming)
      setLabel(labelOf(element))
    }
  }

  function edit(next: string) {
    setLabel(next)
    const trimmed = next.trim()
    if (trimmed === applied) return
    gesture.start()
    setApplied(trimmed)
    onChange([{ key: LABEL_KEY, value: trimmed }])
  }

  // A form with a single field would otherwise reload the page on Enter.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
          onChange={(event) => edit(event.target.value)}
          onBlur={gesture.end}
        />
      </div>
    </form>
  )
}
