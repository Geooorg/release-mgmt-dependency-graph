import { useEffect, useId, useRef } from 'react'
import type { SyntheticEvent } from 'react'
import type { ConfirmDialogProps } from './props'
import './components.css'

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Abbrechen',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const messageId = useId()

  // Sync the native dialog with the `open` prop. jsdom (and very old browsers) lack
  // showModal()/close(), so fall back to toggling the `open` attribute there.
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

  // Escape fires `cancel`. The parent owns the state, so keep the browser from closing
  // the dialog itself and let the `open` prop do it.
  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    onCancel()
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={handleCancel}
    >
      <div className="confirm-dialog__content">
        <h2 className="confirm-dialog__title" id={titleId}>
          {title}
        </h2>
        <p className="confirm-dialog__message" id={messageId}>
          {message}
        </p>
        <div className="confirm-dialog__actions">
          <button type="button" className="ui-button ui-button--secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="ui-button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
