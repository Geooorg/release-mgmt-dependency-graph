import type { KeyboardEvent } from 'react'
import { useEffect, useRef } from 'react'
import type { FilterBarProps } from './props'
import { useT } from '../i18n/react'
import './components.css'

/** Two fields floating on the canvas: key and value of a metadata entry; the hits are listed in the sidebar. */
export function FilterBar({ keyText, valueText, count, onKeyChange, onValueChange, onClose }: FilterBarProps) {
  const t = useT()
  const keyRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    keyRef.current?.focus()
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Typing stays in the field: no canvas shortcuts (Delete, V/N/C, …).
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  const hasKey = keyText.trim() !== ''
  const none = hasKey && count === 0

  return (
    <div className="filter-bar" role="search" aria-label={t('filter.label')}>
      <input
        ref={keyRef}
        className="ui-input filter-bar__input"
        aria-label={t('filter.key')}
        placeholder={t('filter.keyPlaceholder')}
        spellCheck={false}
        autoComplete="off"
        value={keyText}
        onChange={(event) => onKeyChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <span aria-hidden="true">=</span>
      <input
        className="ui-input filter-bar__input"
        aria-label={t('filter.value')}
        placeholder={t('filter.valuePlaceholder')}
        spellCheck={false}
        autoComplete="off"
        value={valueText}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <span className={none ? 'filter-bar__status filter-bar__status--none' : 'filter-bar__status'} role="status">
        {hasKey ? (none ? t('filter.none') : t.plural('filter.count', count)) : ''}
      </span>
      <button type="button" className="ui-button ui-button--icon" aria-label={t('filter.close')} onClick={onClose}>
        ×
      </button>
    </div>
  )
}
