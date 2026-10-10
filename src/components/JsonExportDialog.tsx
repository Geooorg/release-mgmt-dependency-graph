import { useEffect, useId, useRef, useState } from 'react'
import type { SyntheticEvent } from 'react'
import type { JsonExportDialogProps } from './props'
import { useNativeDialog } from './useNativeDialog'
import './components.css'

type CopyState = 'idle' | 'done' | 'failed'

/** Shows the project JSON read-only, preselected, with a button that copies it. */
export function JsonExportDialog({ open, json, onCopy, onClose }: JsonExportDialogProps) {
  const dialogRef = useNativeDialog(open)
  const titleId = useId()

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog json-dialog"
      aria-labelledby={titleId}
      onCancel={handleCancel}
    >
      {open && <ExportContent json={json} titleId={titleId} onCopy={onCopy} onClose={onClose} />}
    </dialog>
  )
}

interface ExportContentProps extends Pick<JsonExportDialogProps, 'json' | 'onCopy' | 'onClose'> {
  titleId: string
}

// Only mounted while open, so the copy feedback starts fresh every time.
function ExportContent({ json, titleId, onCopy, onClose }: ExportContentProps) {
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const areaId = useId()
  const [copy, setCopy] = useState<CopyState>('idle')

  // Preselected, so Strg/Cmd + C works even where the clipboard button cannot.
  useEffect(() => {
    areaRef.current?.focus()
    areaRef.current?.select()
  }, [])

  async function handleCopy() {
    const ok = await onCopy()
    setCopy(ok ? 'done' : 'failed')
    if (!ok) {
      areaRef.current?.focus()
      areaRef.current?.select()
    }
  }

  return (
    <div className="confirm-dialog__content">
      <h2 className="confirm-dialog__title" id={titleId}>
        Projekt als JSON
      </h2>
      <label className="json-dialog__label" htmlFor={areaId}>
        Projekt-JSON (schreibgeschützt)
      </label>
      <textarea
        id={areaId}
        ref={areaRef}
        className="ui-input json-dialog__text"
        readOnly
        wrap="off"
        spellCheck={false}
        value={json}
      />
      <p className="json-dialog__status" role="status">
        {copy === 'done' && 'In die Zwischenablage kopiert.'}
        {copy === 'failed' && 'Kopieren nicht möglich – der Text ist markiert, bitte mit Strg/Cmd + C kopieren.'}
      </p>
      <div className="confirm-dialog__actions">
        <button type="button" className="ui-button ui-button--secondary" onClick={onClose}>
          Schließen
        </button>
        <button type="button" className="ui-button" onClick={() => void handleCopy()}>
          In Zwischenablage kopieren
        </button>
      </div>
    </div>
  )
}
