import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { useT } from '../i18n/react'
import { NAME_KEY } from '../model/types'
import type { SidebarElement, SidebarProps } from './props'
import { useEditGesture } from './useSidebarEffects'
import './components.css'


type SidebarEdgeFormProps = Omit<SidebarProps, 'element' | 'selectionCount'> & {
  element: SidebarElement
}

const labelOf = (element: SidebarElement) =>
  element.metadata.find((entry) => entry.key === NAME_KEY)?.value ?? ''

/**
 * Sidebar content for an edge: the read-only UUID, the `name` field every element has, which is the
 * caption on the edge, its direction with the button to turn it around, and the checkbox for a soft
 * (optional) dependency. The name is applied (trimmed)
 * with every keystroke; the draft keeps what was typed until the name changes from outside.
 */
export function SidebarEdgeForm({
  element,
  onChange,
  onEditStart,
  onEditEnd,
  onClose,
  onSoftChange,
  onReverse,
}: SidebarEdgeFormProps) {
  const t = useT()
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
    onChange([{ key: NAME_KEY, value: trimmed }])
  }

  // A form with a single field would otherwise reload the page on Enter.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
  }

  return (
    <form className="sidebar__form" onSubmit={handleSubmit}>
      <div className="sidebar__header">
        <h2 className="sidebar__title">{t('sidebar.title.edge')}</h2>
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
          value={label}
          onChange={(event) => edit(event.target.value)}
          onBlur={gesture.end}
        />
      </div>

      {onReverse && (
        <div className="sidebar__field" role="group" aria-labelledby={`${formId}-direction`}>
          <span id={`${formId}-direction`} className="sidebar__label">
            {t('sidebar.field.direction')}
          </span>
          {element.ends && (
            <span className="sidebar__check-hint">
              {t('sidebar.direction.hint', { source: element.ends.source, target: element.ends.target })}
            </span>
          )}
          <button
            type="button"
            className="ui-button sidebar__reverse"
            disabled={element.canReverse === false}
            aria-describedby={element.canReverse === false ? `${formId}-reverse-blocked` : undefined}
            onClick={onReverse}
          >
            {t('sidebar.reverse')}
          </button>
          {element.canReverse === false && (
            <span id={`${formId}-reverse-blocked`} className="sidebar__check-hint">
              {t('sidebar.reverse.blocked')}
            </span>
          )}
        </div>
      )}

      <div className="sidebar__field">
        <label className="sidebar__check">
          <input
            type="checkbox"
            checked={element.soft ?? false}
            aria-describedby={`${formId}-soft-hint`}
            onChange={(event) => onSoftChange?.(event.target.checked)}
          />
          {t('sidebar.field.soft')}
        </label>
        <span id={`${formId}-soft-hint`} className="sidebar__check-hint">
          {t('sidebar.soft.hint')}
        </span>
      </div>
    </form>
  )
}
