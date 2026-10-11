import { useId } from 'react'
import type { SyntheticEvent } from 'react'
import { useT } from '../i18n/react'
import { HELP_SECTIONS, parseHelpBody } from './helpBody'
import type { HelpDialogProps } from './props'
import { useNativeDialog } from './useNativeDialog'
import './components.css'

/** The operating instructions as an overlay; the texts come from the language catalogs. */
export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const dialogRef = useNativeDialog(open)
  const titleId = useId()

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog json-dialog help-dialog"
      aria-labelledby={titleId}
      onCancel={handleCancel}
    >
      {open && <HelpContent titleId={titleId} onClose={onClose} />}
    </dialog>
  )
}

// Only mounted while open, so the scroll position starts at the top every time.
function HelpContent({ titleId, onClose }: { titleId: string; onClose: () => void }) {
  const t = useT()

  return (
    <div className="confirm-dialog__content">
      <h2 className="confirm-dialog__title" id={titleId}>
        {t('help.title')}
      </h2>
      <div className="help-dialog__body" role="region" tabIndex={0} aria-labelledby={titleId}>
        <p className="help-dialog__intro">{t('help.intro')}</p>
        {HELP_SECTIONS.map((section) => (
          <section key={section} className="help-dialog__section">
            <h3>{t(`help.${section}.title`)}</h3>
            {parseHelpBody(t(`help.${section}.body`)).map((block, index) =>
              block.kind === 'paragraph' ? (
                <p key={index}>{block.text}</p>
              ) : (
                <ul key={index}>
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}
      </div>
      <div className="confirm-dialog__actions">
        <button type="button" className="ui-button" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  )
}
