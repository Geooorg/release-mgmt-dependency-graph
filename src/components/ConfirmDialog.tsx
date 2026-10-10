import { useId } from 'react'
import type { SyntheticEvent } from 'react'
import type { ConfirmDialogProps } from './props'
import { useNativeDialog } from './useNativeDialog'
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
  const dialogRef = useNativeDialog(open)
  const titleId = useId()
  const messageId = useId()

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
