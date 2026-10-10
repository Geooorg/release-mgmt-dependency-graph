import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { SearchBarProps, SearchOutcome } from './props'
import { useT } from '../i18n/react'
import './components.css'

/** Search field floating on the canvas: Enter jumps to the first hit, every further Enter to the next one. */
export function SearchBar({ onSearch, onClose }: SearchBarProps) {
  const t = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  // What the last Enter found; stale as soon as the text changes.
  const [outcome, setOutcome] = useState<{ query: string; result: SearchOutcome } | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Typing stays in the field: no canvas shortcuts (Delete, V/N/C, …).
    event.stopPropagation()
    if (event.key === 'Enter') {
      event.preventDefault()
      if (query.trim() !== '') setOutcome({ query, result: onSearch(query) })
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  const shown = outcome !== null && outcome.query === query ? outcome.result : null
  const status =
    shown === null
      ? ''
      : shown.count === 0
        ? t('search.none')
        : t('search.hit', { position: shown.position, count: shown.count })

  return (
    <div className="search-bar" role="search">
      <input
        ref={inputRef}
        className="ui-input search-bar__input"
        aria-label={t('search.label')}
        placeholder={t('search.placeholder')}
        spellCheck={false}
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <span className={shown?.count === 0 ? 'search-bar__status search-bar__status--none' : 'search-bar__status'} role="status">
        {status}
      </span>
      <button type="button" className="ui-button ui-button--icon" aria-label={t('search.close')} onClick={onClose}>
        ×
      </button>
    </div>
  )
}
