import { useEffect, useId, useRef, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { projectSummary } from './projectSummary'
import type { JsonImportDialogProps } from './props'
import { useNativeDialog } from './useNativeDialog'
import './components.css'

/** Replaces the project by pasted JSON text (the counterpart of the file import, without a file). */
export function JsonImportDialog(props: JsonImportDialogProps) {
  const dialogRef = useNativeDialog(props.open)
  const titleId = useId()

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    props.onCancel()
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog json-dialog"
      aria-labelledby={titleId}
      onCancel={handleCancel}
    >
      {props.open && <ImportContent {...props} titleId={titleId} />}
    </dialog>
  )
}

// Only mounted while open, so the text box starts empty every time.
function ImportContent({
  projectName,
  counts,
  unsaved,
  errors,
  onImport,
  onCancel,
  titleId,
}: JsonImportDialogProps & { titleId: string }) {
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const areaId = useId()
  const [text, setText] = useState('')
  // Errors belong to the text that was submitted; editing it hides them.
  const [submitted, setSubmitted] = useState<string | null>(null)

  useEffect(() => {
    areaRef.current?.focus()
  }, [])

  function submit() {
    setSubmitted(text)
    onImport(text)
  }

  const shownErrors = submitted === text ? errors : []

  return (
    <div className="confirm-dialog__content">
      <h2 className="confirm-dialog__title" id={titleId}>
        JSON einfügen
      </h2>
      <p className="confirm-dialog__message">
        {`Der Import ersetzt das aktuelle Projekt „${projectName}“ (${projectSummary(counts)}).`}
      </p>
      {unsaved ? (
        <p className="import-dialog__warning" role="alert">
          Es gibt Änderungen, die noch nicht exportiert oder kopiert wurden. Sie gehen verloren, wenn jetzt importiert wird.
        </p>
      ) : (
        <p className="import-dialog__ok">Der aktuelle Stand wurde bereits exportiert.</p>
      )}
      <label className="json-dialog__label" htmlFor={areaId}>
        JSON-Text
      </label>
      <textarea
        id={areaId}
        ref={areaRef}
        className="ui-input json-dialog__text"
        wrap="off"
        spellCheck={false}
        placeholder='{ "version": 1, "nodes": [...], "edges": [...] }'
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {shownErrors.length > 0 && (
        <div className="json-dialog__errors" role="alert">
          <p>Der Text ist kein gültiges Modell. Das aktuelle Projekt blieb unverändert.</p>
          <ul>
            {shownErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="import-dialog__note">In dieser Sitzung lässt sich der Import mit „Rückgängig“ zurücknehmen.</p>
      <div className="confirm-dialog__actions">
        <button type="button" className="ui-button ui-button--secondary" onClick={onCancel}>
          Abbrechen
        </button>
        <button
          type="button"
          className={unsaved ? 'ui-button ui-button--danger' : 'ui-button'}
          disabled={text.trim() === ''}
          onClick={submit}
        >
          Importieren
        </button>
      </div>
    </div>
  )
}
