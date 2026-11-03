import { useId } from 'react'
import { useT } from '../i18n/react'
import type { BulkType } from './props'
import './components.css'

/** One type for every selected object. */
export function SidebarBulkType({ choices, typeId, mixed, onChange }: BulkType) {
  const t = useT()
  const id = useId()
  return (
    <div className="sidebar__field">
      <label className="sidebar__label" htmlFor={id}>
        {t('sidebar.bulkType')}
      </label>
      <select
        id={id}
        className="ui-input"
        value={mixed ? '__mixed' : typeId}
        onChange={(event) => onChange(event.target.value === '' ? undefined : event.target.value)}
      >
        {mixed && (
          <option value="__mixed" disabled>
            {t('sidebar.bulkType.mixed')}
          </option>
        )}
        <option value="">{t('sidebar.type.none')}</option>
        {choices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.name}
          </option>
        ))}
      </select>
    </div>
  )
}
