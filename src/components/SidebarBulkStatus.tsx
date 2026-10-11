import { useId } from 'react'
import { useT } from '../i18n/react'
import { DEFAULT_STATUS, parseStatus, STATUS_LABEL_KEYS, STATUS_VALUES } from '../model/status'
import type { Status } from '../model/status'
import type { BulkStatus } from './props'
import './components.css'

/** One status for every selected object; an unknown shared value stays selectable, never silently replaced. */
export function SidebarBulkStatus({ count, status, mixed, onChange }: BulkStatus) {
  const t = useT()
  const id = useId()
  const unknown = !mixed && status !== '' && parseStatus(status) === undefined

  return (
    <div className="sidebar__field">
      <label className="sidebar__label" htmlFor={id}>
        {t.plural('sidebar.bulkStatus', count)}
      </label>
      <select
        id={id}
        className="ui-input"
        value={mixed ? '' : (parseStatus(status) ?? (status || DEFAULT_STATUS))}
        onChange={(event) => {
          const chosen = parseStatus(event.target.value)
          if (chosen !== undefined) onChange(chosen satisfies Status)
        }}
      >
        {mixed && (
          <option value="" disabled>
            {t('sidebar.bulkStatus.mixed')}
          </option>
        )}
        {STATUS_VALUES.map((value) => (
          <option key={value} value={value}>
            {t(STATUS_LABEL_KEYS[value])}
          </option>
        ))}
        {unknown && <option value={status}>{t('sidebar.status.unknown', { value: status })}</option>}
      </select>
    </div>
  )
}
