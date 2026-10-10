import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import './components.css'

const SHOW_DELAY_MS = 250
const GAP = 8
const VIEWPORT_MARGIN = 8

export interface TooltipProps {
  /** The explanation. */
  text: string
  /** Optional second, muted line, e.g. why the action is currently unavailable. */
  hint?: string
  /** Optional keyboard shortcut, shown as a key cap. */
  shortcut?: string
  /** The single trigger element (usually a button). */
  children: ReactElement<{ 'aria-describedby'?: string }>
}

/**
 * Tooltip for hover and keyboard focus. It is rendered in a portal with fixed positioning, so it
 * is neither clipped by the scrollable toolbar nor hidden below other panels. The wrapper (not the
 * button) receives the hover, so disabled buttons explain themselves as well.
 */
export function Tooltip({ text, hint, shortcut, children }: TooltipProps) {
  const id = useId()
  const hostRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const show = useCallback((delay: number) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(true), delay)
  }, [])
  const hide = useCallback(() => {
    clearTimeout(timer.current)
    setOpen(false)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  // Centre below the trigger, then shift to stay inside the window.
  useLayoutEffect(() => {
    if (!open || !hostRef.current || !tipRef.current) return
    const host = hostRef.current.getBoundingClientRect()
    const width = tipRef.current.offsetWidth
    const centred = host.left + host.width / 2 - width / 2
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(centred, window.innerWidth - width - VIEWPORT_MARGIN),
    )
    setPosition({ top: host.bottom + GAP, left })
  }, [open, text, hint, shortcut])

  return (
    <span
      ref={hostRef}
      className="tooltip-host"
      onMouseEnter={() => show(SHOW_DELAY_MS)}
      onMouseLeave={hide}
      onFocus={() => show(0)}
      onBlur={hide}
      onKeyDown={(event) => {
        if (event.key === 'Escape') hide()
      }}
      onClick={hide}
    >
      {cloneElement(children, { 'aria-describedby': open ? id : undefined })}
      {open &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            className="tooltip"
            style={{ top: position.top, left: position.left }}
          >
            <span className="tooltip__text">{text}</span>
            {shortcut && <kbd className="tooltip__shortcut">{shortcut}</kbd>}
            {hint && <span className="tooltip__hint">{hint}</span>}
          </div>,
          document.body,
        )}
    </span>
  )
}
