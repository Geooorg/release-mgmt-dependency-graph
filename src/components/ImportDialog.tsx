import { useEffect, useId, useRef } from 'react'
import type { SyntheticEvent } from 'react'
import type { ImportDialogProps } from './props'
import { projectSummary } from './projectSummary'
import { useNativeDialog } from './useNativeDialog'
import { useT } from '../i18n/react'
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
  const t = useT()
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

  const summary = projectSummary(counts, t)

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
          {t('import.title')}
        </h2>
        <p className="confirm-dialog__message" id={messageId}>
          {t('import.message', { name: projectName, summary })}
        </p>
        {unsaved ? (
          <p className="import-dialog__warning" role="alert">
            {t('import.warning')}
          </p>
        ) : (
          <p className="import-dialog__ok">{t('import.exported')}</p>
        )}
        <p className="import-dialog__note">{t('import.note')}</p>
        <div className="confirm-dialog__actions">
          <button type="button" className="ui-button ui-button--secondary" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className={unsaved ? 'ui-button ui-button--danger' : 'ui-button'}
            ref={unsaved ? undefined : primaryRef}
            onClick={onImportWithoutExport}
          >
            {t('import.withoutExport')}
          </button>
          <button
            type="button"
            className={unsaved ? 'ui-button' : 'ui-button ui-button--secondary'}
            ref={unsaved ? primaryRef : undefined}
            onClick={onExportAndImport}
          >
            {t('import.exportAndImport')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
