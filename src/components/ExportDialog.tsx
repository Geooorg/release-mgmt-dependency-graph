import { useId, useState } from 'react'
import type { SyntheticEvent } from 'react'
import type { MessageKey } from '../i18n/messages'
import { useT } from '../i18n/react'
import type { ExportDialogProps, ExportFormat } from './props'
import { useNativeDialog } from './useNativeDialog'
import './components.css'

const FORMATS: readonly { value: ExportFormat; labelKey: MessageKey; hintKey: MessageKey }[] = [
  { value: 'json-file', labelKey: 'export.json', hintKey: 'export.json.hint' },
  { value: 'svg', labelKey: 'export.svg', hintKey: 'export.svg.hint' },
  { value: 'json-clipboard', labelKey: 'export.clipboard', hintKey: 'export.clipboard.hint' },
]

type Feedback = 'none' | 'copied' | 'failed'

/** Asks in which form to export: JSON file, SVG file or JSON text on the clipboard. */
export function ExportDialog(props: ExportDialogProps) {
  const dialogRef = useNativeDialog(props.open)
  const titleId = useId()

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    props.onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog export-dialog"
      aria-labelledby={titleId}
      onCancel={handleCancel}
    >
      {props.open && <ExportContent {...props} titleId={titleId} />}
    </dialog>
  )
}

// Only mounted while open, so the choice and the feedback start fresh every time.
function ExportContent({ svgDisabled, onExport, onClose, titleId }: ExportDialogProps & { titleId: string }) {
  const t = useT()
  const [format, setFormat] = useState<ExportFormat>('json-file')
  const [feedback, setFeedback] = useState<Feedback>('none')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    const ok = await onExport(format)
    setBusy(false)
    // A download speaks for itself; the clipboard needs a word.
    if (format !== 'json-clipboard') {
      if (ok) onClose()
      return
    }
    setFeedback(ok ? 'copied' : 'failed')
  }

  return (
    <div className="confirm-dialog__content">
      <h2 className="confirm-dialog__title" id={titleId}>
        {t('export.title')}
      </h2>
      <fieldset className="export-dialog__formats">
        <legend className="export-dialog__legend">{t('export.format')}</legend>
        {FORMATS.map(({ value, labelKey, hintKey }) => {
          const disabled = value === 'svg' && svgDisabled
          return (
            <label key={value} className={disabled ? 'export-dialog__option export-dialog__option--disabled' : 'export-dialog__option'}>
              <input
                type="radio"
                name="export-format"
                value={value}
                checked={format === value}
                disabled={disabled}
                onChange={() => {
                  setFormat(value)
                  setFeedback('none')
                }}
              />
              <span className="export-dialog__text">
                <span className="export-dialog__label">{t(labelKey)}</span>
                <span className="export-dialog__hint">{disabled ? t('export.svg.empty') : t(hintKey)}</span>
              </span>
            </label>
          )
        })}
      </fieldset>
      <p className="json-dialog__status" role="status">
        {feedback === 'copied' && t('export.copied')}
        {feedback === 'failed' && t('export.copyFailed')}
      </p>
      <div className="confirm-dialog__actions">
        <button type="button" className="ui-button ui-button--secondary" onClick={onClose}>
          {feedback === 'copied' ? t('common.close') : t('common.cancel')}
        </button>
        <button type="button" className="ui-button" disabled={busy} onClick={() => void submit()}>
          {t('export.submit')}
        </button>
      </div>
    </div>
  )
}
