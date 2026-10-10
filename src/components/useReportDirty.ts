import { useEffect } from 'react'

/** Tells the owner whether a form has unsaved changes; reports `false` again when the form goes away. */
export function useReportDirty(dirty: boolean, onDirtyChange: (dirty: boolean) => void): void {
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])
}
