import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { useT } from '../i18n/react'
import type { Translate } from '../i18n/translate'
import { NAME_KEY } from '../model/types'
import { EDGE_ROLE_NAME_KEYS } from './edgeRoleLabels'
import type { SidebarElement, SidebarProps } from './props'
import { SidebarTypeFields } from './SidebarTypeFields'
import { useEditGesture } from './useSidebarEffects'
import './components.css'


type SidebarEdgeFormProps = Omit<SidebarProps, 'element' | 'selectionCount'> & {
  element: SidebarElement
}

/** Which sentence says what the arrow of the connection means; the direction itself is always source to target. */
function directionHint(element: SidebarElement, t: Translate): string {
  const params = { source: element.ends?.source ?? '', target: element.ends?.target ?? '' }
  const { meaning } = element
  if (!meaning || meaning.state === 'untyped' || meaning.roles.includes('sequence')) return t('sidebar.direction.hint', params)
  const sentences: string[] = []
  if (meaning.roles.includes('dependency')) sentences.push(t('sidebar.direction.hint.dependency', params))
  if (meaning.roles.includes('flow')) sentences.push(t('sidebar.direction.hint.flow', params))
  return sentences.length > 0 ? sentences.join(' ') : t('sidebar.direction.hint.plain', params)
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
  typing,
  onEdgeTypeChange,
  onEdgeFieldChange,
}: SidebarEdgeFormProps) {
  const t = useT()
  const formId = useId()
  const [received, setReceived] = useState(element.metadata)
  const [applied, setApplied] = useState(() => labelOf(element).trim())
  const [label, setLabel] = useState(() => labelOf(element))
  const gesture = useEditGesture(onEditStart, onEditEnd)
  // Only a sequence connection can count for the critical path; an existing mark stays removable.
  const canBeSoft = !element.meaning || element.meaning.state === 'untyped' || element.meaning.roles.includes('sequence') || element.soft === true

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
              {directionHint(element, t)}
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

      {element.meaning && (
        <div className="sidebar__field" role="group" aria-labelledby={`${formId}-meaning ${formId}-meaning-value`}>
          <span id={`${formId}-meaning`} className="sidebar__label">
            {t('sidebar.field.meaning')}
          </span>
          <span id={`${formId}-meaning-value`} className="sidebar__check-hint">
            {element.meaning.state === 'untyped'
              ? t('sidebar.meaning.untyped')
              : element.meaning.state === 'unknown'
                ? t('sidebar.meaning.unknown')
                : element.meaning.roles.length === 0
                  ? t('sidebar.meaning.none')
                  : element.meaning.roles.map((role) => t(EDGE_ROLE_NAME_KEYS[role])).join(', ')}
          </span>
        </div>
      )}

      {canBeSoft && (
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
      )}

      {typing !== undefined && onEdgeTypeChange && onEdgeFieldChange && (
        <SidebarTypeFields
          typing={typing}
          typeId={element.typeId ?? ''}
          values={Object.fromEntries(element.metadata.map((entry) => [entry.key, entry.value]))}
          onTypeChange={(id) => onEdgeTypeChange(id === '' ? undefined : id)}
          onValueChange={(key, value) => onEdgeFieldChange(key, value)}
          onEditStart={onEditStart}
          onEditEnd={onEditEnd}
        />
      )}
    </form>
  )
}
