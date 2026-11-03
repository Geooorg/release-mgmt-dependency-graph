import { useId } from 'react'
import { useT } from '../i18n/react'
import type { SidebarTyping } from './props'
import { useEditGesture } from './useSidebarEffects'
import './components.css'

interface SidebarTypeFieldsProps {
  typing: SidebarTyping
  /** Current type id, '' = none. */
  typeId: string
  /** Values of the type fields by key. */
  values: Record<string, string>
  onTypeChange: (typeId: string) => void
  /** `discrete`: a choice that is an undo step of its own; otherwise typing, bundled until the field is left. */
  onValueChange: (key: string, value: string, discrete: boolean) => void
  onEditStart: () => void
  onEditEnd: () => void
}

/** Type chooser plus the fields the type defines; the owner decides where the values live. */
export function SidebarTypeFields({
  typing,
  typeId,
  values,
  onTypeChange,
  onValueChange,
  onEditStart,
  onEditEnd,
}: SidebarTypeFieldsProps) {
  const t = useT()
  const id = useId()
  const gesture = useEditGesture(onEditStart, onEditEnd)
  const fields = typeId === '' ? [] : typing.fieldsOf(typeId)
  const unknown = typeId !== '' && fields === undefined

  return (
    <div className="sidebar__type">
      <div className="sidebar__field">
        <label className="sidebar__label" htmlFor={`${id}-type`}>
          {t('sidebar.type.label')}
        </label>
        <select
          id={`${id}-type`}
          className="ui-input"
          value={typeId}
          onChange={(event) => {
            gesture.end()
            onTypeChange(event.target.value)
          }}
        >
          <option value="">{t('sidebar.type.none')}</option>
          {typing.choices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.name}
            </option>
          ))}
          {unknown && <option value={typeId}>{t('sidebar.type.unknown', { value: typeId })}</option>}
        </select>
      </div>

      {fields !== undefined && fields.length > 0 && (
        <fieldset className="sidebar__type-fields">
          <legend className="sidebar__label">{t('sidebar.type.fields')}</legend>
          {fields.map((field) => {
            const value = values[field.key] ?? ''
            const empty = value.trim() === ''
            const fieldId = `${id}-f-${field.key}`
            const options = field.kind === 'boolean' ? ['ja', 'nein'] : field.options
            return (
              <div className="sidebar__field" key={field.key}>
                <label className="sidebar__label" htmlFor={fieldId}>
                  {field.key}
                  {field.required && ' *'}
                </label>
                {field.kind === 'text' ? (
                  <input
                    id={fieldId}
                    className="ui-input"
                    value={value}
                    onChange={(event) => {
                      gesture.start()
                      onValueChange(field.key, event.target.value, false)
                    }}
                    onBlur={gesture.end}
                  />
                ) : (
                  <select
                    id={fieldId}
                    className="ui-input"
                    value={value}
                    onChange={(event) => {
                      gesture.end()
                      onValueChange(field.key, event.target.value, true)
                    }}
                  >
                    <option value="">{t('sidebar.type.unset')}</option>
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {field.kind === 'boolean' ? t(option === 'ja' ? 'sidebar.type.yes' : 'sidebar.type.no') : option}
                      </option>
                    ))}
                    {value !== '' && !options.includes(value) && <option value={value}>{value}</option>}
                  </select>
                )}
                {field.required && empty && <span className="sidebar__warn">{t('sidebar.type.missing')}</span>}
              </div>
            )
          })}
        </fieldset>
      )}
    </div>
  )
}
