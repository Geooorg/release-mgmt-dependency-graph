import type { Status } from '../model/status'
import { CheckIcon, FlagIcon, OpenCircleIcon, QuestionIcon, WarningIcon } from './icons'
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

/** Amber warning triangle on elements that are finished although a prerequisite is not. */
export function InconsistentMark({ title, inline = false }: { title: string; inline?: boolean }) {
  return (
    <span
      className={inline ? 'inconsistent-mark inconsistent-mark--inline' : 'inconsistent-mark'}
      role="img"
      aria-label={title}
      title={title}
    >
      <WarningIcon size={inline ? 18 : 22} />
    </span>
  )
}

interface StatusMarkProps {
  /** Effective status; undefined = no mark (groups). */
  status: Status | undefined
  /** Trimmed raw status value; undefined = not set. */
  raw?: string
  /** False = the raw value is none of the three statuses. */
  known?: boolean
}

function markOf({ status, raw, known = true }: StatusMarkProps & { status: Status }) {
  if (!known) {
    return { modifier: 'unknown', title: `Status „${raw}“ unbekannt – zählt als offen`, icon: <QuestionIcon size={12} /> }
  }
  if (status === 'fertig') return { modifier: 'done', title: 'Status: fertig', icon: <CheckIcon size={11} /> }
  if (status === 'in Arbeit') {
    return {
      modifier: 'progress',
      title: 'Status: in Arbeit',
      icon: (
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
        </svg>
      ),
    }
  }
  return {
    modifier: 'open',
    title: raw === undefined ? 'Status: offen (nicht gesetzt)' : 'Status: offen',
    icon: <OpenCircleIcon size={12} />,
  }
}

/**
 * Small corner mark for objects: green tick = fertig, amber half circle = in Arbeit, grey empty
 * circle = offen, amber question mark = unknown value (counts as offen).
 */
export function StatusMark(props: StatusMarkProps) {
  if (props.status === undefined) return null
  const { modifier, title, icon } = markOf({ ...props, status: props.status })
  return (
    <span className={`status-mark status-mark--${modifier}`} role="img" aria-label={title} title={title}>
      {icon}
    </span>
  )
}
