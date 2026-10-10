import { useCallback, useEffect, useRef } from 'react'

/** Tells the owner whether a form holds an invalid draft; reports `false` again when the form goes away. */
export function useReportInvalid(invalid: boolean, onInvalidChange: (invalid: boolean) => void): void {
  const latest = useRef(onInvalidChange)
  useEffect(() => {
    latest.current = onInvalidChange
  })
  useEffect(() => {
    onInvalidChange(invalid)
  }, [invalid, onInvalidChange])
  useEffect(() => () => latest.current(false), [])
}

/**
 * Brackets a field edit for the owner (one undo step per edit). `start` may be called on every
 * keystroke; `end` only does something after a `start`, and runs on unmount so that a form that
 * goes away mid-edit never leaves the edit open.
 */
export function useEditGesture(
  onEditStart: () => void,
  onEditEnd: () => void,
): { start: () => void; end: () => void } {
  const editing = useRef(false)
  const latest = useRef({ onEditStart, onEditEnd })
  useEffect(() => {
    latest.current = { onEditStart, onEditEnd }
  })
  const start = useCallback(() => {
    editing.current = true
    // Repeated on purpose: the owner may have ended the edit meanwhile (undo), and starting is idempotent.
    latest.current.onEditStart()
  }, [])
  const end = useCallback(() => {
    if (!editing.current) return
    editing.current = false
    latest.current.onEditEnd()
  }, [])
  useEffect(() => end, [end])
  return { start, end }
}
