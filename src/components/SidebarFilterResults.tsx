import type { SidebarFilterProps } from './props'
import { useT } from '../i18n/react'
import './components.css'

/** Hits of the metadata filter, one button per element; picking selects it and brings it into view. */
export function SidebarFilterResults({ results, selectedIds, hasQuery, onPick, onClose }: SidebarFilterProps) {
  const t = useT()
  return (
    <div className="sidebar__form">
      <div className="sidebar__header">
        <h2 className="sidebar__title">{t('filter.results.title')}</h2>
        <button type="button" className="ui-button ui-button--icon" aria-label={t('common.close')} onClick={onClose}>
          ×
        </button>
      </div>
      {!hasQuery && <p className="sidebar__info">{t('filter.results.hint')}</p>}
      {hasQuery && (
        <p className="sidebar__info" role="status">
          {results.length === 0 ? t('filter.none') : t.plural('filter.count', results.length)}
        </p>
      )}
      {results.length > 0 && (
        <ul className="filter-results">
          {results.map(({ id, name, color, key, value }) => (
            <li key={id}>
              <button
                type="button"
                className="filter-results__item"
                aria-label={t('filter.results.pick', { name })}
                aria-current={selectedIds.includes(id) ? 'true' : undefined}
                onClick={() => onPick(id)}
              >
                <span className="filter-results__dot" style={{ background: color ?? 'var(--blue-600)' }} aria-hidden="true" />
                <span className="filter-results__name">{name}</span>
                <span className="filter-results__entry">
                  {key} = {value}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
