import { STATUS_LABEL_KEYS, type Status } from '../model/status'
import { CheckIcon, FlagIcon, HourglassIcon, OpenCircleIcon, QuestionIcon } from './icons'
import { useT } from '../i18n/react'
import type { Translate } from '../i18n/translate'
import './components.css'

/** Red flag on elements with the status `blockiert`; `title` names the reason (also the accessible name). */
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

/** Hourglass on unfinished elements that wait for an unfinished prerequisite; `title` names them. */
export function WaitingMark({ title, inline = false }: { title: string; inline?: boolean }) {
  return (
    <span
      className={inline ? 'waiting-mark waiting-mark--inline' : 'waiting-mark'}
      role="img"
      aria-label={title}
      title={title}
    >
      <HourglassIcon size={12} />
    </span>
  )
}

interface StatusMarkProps {
  /** Effective status; undefined = no mark (groups). `blockiert` has none either: the red flag is its mark. */
  status: Status | undefined
  /** Trimmed raw status value; undefined = not set. */
  raw?: string
  /** False = the raw value is none of the four statuses. */
  known?: boolean
  /** In the text flow instead of the lower right corner of an element (legend). */
  inline?: boolean
}

function markOf({ status, raw, known = true }: StatusMarkProps & { status: Status }, t: Translate) {
  if (!known) {
    return { modifier: 'unknown', title: t('status.unknown', { value: raw ?? '' }), icon: <QuestionIcon size={12} /> }
  }
  const title = t('status.mark', { status: t(STATUS_LABEL_KEYS[status]) })
  if (status === 'fertig') return { modifier: 'done', title, icon: <CheckIcon size={11} /> }
  if (status === 'in Arbeit') {
    return {
      modifier: 'progress',
      title,
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
    title: raw === undefined ? t('status.mark.unset', { status: t(STATUS_LABEL_KEYS[status]) }) : title,
    icon: <OpenCircleIcon size={12} />,
  }
}

/**
 * Small corner mark for objects: green tick = fertig, amber half circle = in Arbeit, grey empty
 * circle = offen, amber question mark = unknown value (counts as offen).
 */
export function StatusMark(props: StatusMarkProps) {
  const t = useT()
  if (props.status === undefined || props.status === 'blockiert') return null
  const { modifier, title, icon } = markOf({ ...props, status: props.status }, t)
  const className = `status-mark status-mark--${modifier}${props.inline ? ' status-mark--inline' : ''}`
  return (
    <span className={className} role="img" aria-label={title} title={title}>
      {icon}
    </span>
  )
}
