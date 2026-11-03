import { useId, useState } from 'react'
import { useT } from '../i18n/react'
import type { PluralKey } from '../i18n/messages'
import type { BulkObjectFields, BulkText } from './props'
import { useEditGesture } from './useSidebarEffects'
import './components.css'

interface SidebarBulkFieldsProps extends BulkObjectFields {
  onEditStart: () => void
  onEditEnd: () => void
}

interface BulkTextFieldProps extends BulkText {
  /** Plural catalog key of the label; the count is passed along. */
  label: Extract<PluralKey, 'sidebar.bulkClass' | 'sidebar.bulkEntity' | 'sidebar.bulkVersion'>
  count: number
  onEditStart: () => void
  onEditEnd: () => void
}

/**
 * One text for every selected object. What is typed stays as typed until the field is left (the model
 * stores it trimmed); a whole typing session is a single undo step.
 */
function BulkTextField({ label, count, value, mixed, onChange, onEditStart, onEditEnd }: BulkTextFieldProps) {
  const t = useT()
  const id = useId()
  const gesture = useEditGesture(onEditStart, onEditEnd)
  const [typed, setTyped] = useState<string | null>(null)

  return (
    <div className="sidebar__field">
      <label className="sidebar__label" htmlFor={id}>
        {t.plural(label, count)}
      </label>
      <input
        id={id}
        className="ui-input"
        value={typed ?? (mixed ? '' : value)}
        placeholder={mixed ? t('sidebar.bulkField.mixed') : undefined}
        onChange={(event) => {
          gesture.start()
          setTyped(event.target.value)
          onChange(event.target.value)
        }}
        onBlur={() => {
          gesture.end()
          setTyped(null)
        }}
      />
    </div>
  )
}

/** `class`, `entity` and `version` for every selected object together, like the colour for all selected elements. */
export function SidebarBulkFields({ count, class: klass, entity, version, onEditStart, onEditEnd }: SidebarBulkFieldsProps) {
  return (
    <>
      <BulkTextField label="sidebar.bulkClass" count={count} {...klass} onEditStart={onEditStart} onEditEnd={onEditEnd} />
      <BulkTextField label="sidebar.bulkEntity" count={count} {...entity} onEditStart={onEditStart} onEditEnd={onEditEnd} />
      <BulkTextField label="sidebar.bulkVersion" count={count} {...version} onEditStart={onEditStart} onEditEnd={onEditEnd} />
    </>
  )
}
