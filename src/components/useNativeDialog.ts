import { useEffect, useRef } from 'react'

/**
 * Keeps a native `<dialog>` in sync with an `open` flag owned by the parent. jsdom (and very old
 * browsers) lack showModal()/close(), so the `open` attribute is toggled there instead.
 */
export function useNativeDialog(open: boolean) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.hasAttribute('open')) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    } else if (!open && dialog.hasAttribute('open')) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
  }, [open])

  return dialogRef
}
