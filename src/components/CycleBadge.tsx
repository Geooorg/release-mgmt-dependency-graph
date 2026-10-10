import { useT } from '../i18n/react'
import './components.css'

/** Small purple circle with a "loop" arrow, shown on elements that are part of a dependency cycle. */
export function CycleBadge({ onGroup = false }: { onGroup?: boolean }) {
  const label = useT()('cycleBadge.label')
  return (
    <span
      className={onGroup ? 'cycle-badge cycle-badge--group' : 'cycle-badge'}
      role="img"
      aria-label={label}
      title={label}
    >
      <svg
        viewBox="0 0 24 24"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M20 12a8 8 0 0 1-13.7 5.6" />
        <path d="M4 12a8 8 0 0 1 13.7-5.6" />
        <path d="M18 3v4h-4" />
        <path d="M6 21v-4h4" />
      </svg>
    </span>
  )
}
