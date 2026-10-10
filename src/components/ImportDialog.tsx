import { useEffect, useId, useRef } from 'react'
import type { SyntheticEvent } from 'react'
import type { ImportDialogProps } from './props'
import { projectSummary } from './projectSummary'
import { useNativeDialog } from './useNativeDialog'
import './components.css'

/** Asks before an import replaces the project, and warns when that would lose changes never exported. */
export function ImportDialog({
  open,
  projectName,
  counts,
  unsaved,
  onExportAndImport,
  onImportWithoutExport,
  onCancel,
}: ImportDialogProps) {
  const dialogRef = useNativeDialog(open)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const messageId = useId()

  // The safe choice gets the focus, so a stray Enter never loses data.
  useEffect(() => {
    if (open) primaryRef.current?.focus()
  }, [open])

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    onCancel()
  }

  const summary = projectSummary(counts)

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog import-dialog"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={handleCancel}
    >
      <div className="confirm-dialog__content">
        <h2 className="confirm-dialog__title" id={titleId}>
          Projekt ersetzen?
        </h2>
        <p className="confirm-dialog__message" id={messageId}>
          {`Der Import ersetzt das aktuelle Projekt „${projectName}“ (${summary}).`}
        </p>
        {unsaved ? (
          <p className="import-dialog__warning" role="alert">
            Es gibt Änderungen, die noch nicht exportiert wurden. Sie gehen verloren, wenn ohne Export importiert
            wird.
          </p>
        ) : (
          <p className="import-dialog__ok">Der aktuelle Stand wurde bereits exportiert.</p>
        )}
        <p className="import-dialog__note">
          In dieser Sitzung lässt sich der Import mit „Rückgängig“ zurücknehmen.
        </p>
        <div className="confirm-dialog__actions">
          <button type="button" className="ui-button ui-button--secondary" onClick={onCancel}>
            Abbrechen
          </button>
          <button
            type="button"
            className={unsaved ? 'ui-button ui-button--danger' : 'ui-button'}
            ref={unsaved ? undefined : primaryRef}
            onClick={onImportWithoutExport}
          >
            Ohne Export importieren
          </button>
          <button
            type="button"
            className={unsaved ? 'ui-button' : 'ui-button ui-button--secondary'}
            ref={unsaved ? primaryRef : undefined}
            onClick={onExportAndImport}
          >
            Exportieren und importieren
          </button>
        </div>
      </div>
    </dialog>
  )
}
