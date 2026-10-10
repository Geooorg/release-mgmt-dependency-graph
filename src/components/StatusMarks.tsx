import type { Status } from '../model/status'
import { CheckIcon, FlagIcon } from './icons'
import './components.css'

/** Red flag on blocked elements; `title` says what blocks (also the accessible name). */
export function BlockedFlag({ title, inline = false }: { title: string; inline?: boolean }) {
  return (
    <span
      className={inline ? 'blocked-flag blocked-flag--inline' : 'blocked-flag'}
      role="img"
      aria-label={title}
      title={title}
    >
      <FlagIcon size={12} />
    </span>
  )
}

const STATUS_TITLES = { fertig: 'Status: fertig', 'in Arbeit': 'Status: in Arbeit' } as const

/** Small corner mark: green tick = fertig, amber half circle = in Arbeit; nothing for offen. */
export function StatusMark({ status }: { status: Status | undefined }) {
  if (status !== 'fertig' && status !== 'in Arbeit') return null
  const title = STATUS_TITLES[status]
  return (
    <span
      className={status === 'fertig' ? 'status-mark status-mark--done' : 'status-mark status-mark--progress'}
      role="img"
      aria-label={title}
      title={title}
    >
      {status === 'fertig' ? (
        <CheckIcon size={11} />
      ) : (
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
        </svg>
      )}
    </span>
  )
}
