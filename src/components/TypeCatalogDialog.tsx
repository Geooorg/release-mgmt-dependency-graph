import { useEffect, useId, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { useT } from '../i18n/react'
import { tidyType } from '../model/catalog'
import type { CatalogSide } from '../model/catalog'
import { EDGE_ROLES, ICON_KEYS } from '../model/types'
import type { FieldDef, FieldKind, TypeDef } from '../model/types'
import { ConfirmDialog } from './ConfirmDialog'
import { EDGE_ROLE_HINT_KEYS, EDGE_ROLE_NAME_KEYS } from './edgeRoleLabels'
import { ArrowHeadIcon } from './icons'
import type { TypeCatalogDialogProps, TypeDialogType } from './props'
import { useEditGesture } from './useSidebarEffects'
import { useNativeDialog } from './useNativeDialog'
import './components.css'

const KINDS: readonly FieldKind[] = ['text', 'select', 'boolean']

/** Comparable form of a type without the usage count, to notice changes made behind the draft. */
function snapshot(type: TypeDef | TypeDialogType | undefined): string {
  if (type === undefined) return ''
  const { usage: _usage, ...def } = type as TypeDialogType
  return JSON.stringify(def)
}

interface Draft {
  value: TypeDef
  /** Stored state the draft was started from; a different stored state (undo, import) discards the draft. */
  base: string
}

/** Configuration of the type catalog: element and connection types with their fields. */
export function TypeCatalogDialog(props: TypeCatalogDialogProps) {
  const t = useT()
  const { open, readOnly, onClose } = props
  const dialogRef = useNativeDialog(open)
  const titleId = useId()
  const [side, setSide] = useState<CatalogSide>('elementTypes')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [pendingDelete, setPendingDelete] = useState<TypeDialogType | null>(null)
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null)
  const gesture = useEditGesture(props.onEditStart, props.onEditEnd)
  const endEdit = gesture.end

  // The owner may close the dialog without going through onClose; never leave an edit open.
  useEffect(() => {
    if (!open) endEdit()
  }, [open, endEdit])

  const types = side === 'elementTypes' ? props.elementTypes : props.edgeTypes
  const selected = types.find((type) => type.id === selectedId)
  const storedSnapshot = snapshot(selected)
  const draftOfSelected = draft !== null && draft.value.id === selectedId
  // The owner stores the tidied type (trimmed, no empty options). That is the echo of our own edit, not news
  // from outside: keep the raw draft, otherwise typing "a, b" would be rewritten under the cursor.
  const echoed = draftOfSelected && draft.base !== storedSnapshot && storedSnapshot === snapshot(tidyType(draft.value))
  if (echoed) setDraft({ value: draft.value, base: storedSnapshot })
  const draftIsCurrent = draftOfSelected && (draft.base === storedSnapshot || echoed)
  const shown: TypeDef | undefined = draftIsCurrent ? draft.value : selected
  const problems = shown === undefined ? [] : props.problemsOf(side, shown)

  function close() {
    endEdit()
    setPendingDelete(null)
    setPendingTemplate(null)
    setDraft(null)
    onClose()
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    close()
  }

  function select(type: TypeDialogType) {
    endEdit()
    setSelectedId(type.id)
    setDraft(null)
  }

  /**
   * Every edit changes the draft; it goes to the owner only while it has no problems. Typing and
   * picking a colour stay in one running edit (one undo step) until the field loses focus; discrete
   * changes end a running edit and are a step of their own.
   */
  function edit(next: TypeDef, discrete = false) {
    if (discrete) endEdit()
    else gesture.start()
    setDraft({ value: next, base: snapshot(selected) })
    if (props.problemsOf(side, next).length === 0) props.onUpdate(side, next)
  }

  function addType() {
    endEdit()
    const id = props.onAdd(side)
    if (id !== undefined) {
      setSelectedId(id)
      setDraft(null)
    }
  }

  function patchField(index: number, patch: Partial<FieldDef>, discrete = false) {
    if (shown === undefined) return
    edit({ ...shown, fields: shown.fields.map((field, i) => (i === index ? { ...field, ...patch } : field)) }, discrete)
  }

  function handleTemplate(templateId: string) {
    if (props.elementTypes.length + props.edgeTypes.length === 0) props.onTemplate(templateId, 'replace')
    else setPendingTemplate(templateId)
  }

  function finishTemplate(mode: 'merge' | 'replace') {
    if (pendingTemplate !== null) props.onTemplate(pendingTemplate, mode)
    setPendingTemplate(null)
  }

  return (
    <>
    <dialog ref={dialogRef} className="types-dialog" aria-labelledby={titleId} onCancel={handleCancel}>
      <div className="types-dialog__header">
        <h2 id={titleId}>{t('types.title')}</h2>
        <button type="button" className="ui-button ui-button--secondary" onClick={close}>
          {t('common.close')}
        </button>
      </div>
      {readOnly && <p className="types-dialog__hint">{t('types.readOnly')}</p>}

      <div role="tablist" className="types-dialog__tabs">
        {(['elementTypes', 'edgeTypes'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={side === value}
            className="ui-button ui-button--secondary"
            onClick={() => {
              endEdit()
              setSide(value)
              setSelectedId(null)
              setDraft(null)
            }}
          >
            {t(value === 'elementTypes' ? 'types.tab.elements' : 'types.tab.edges')}
          </button>
        ))}
      </div>

      <div className="types-dialog__body">
        <ul className="types-dialog__list">
          {types.map((type) => (
            <li key={type.id}>
              <button
                type="button"
                className="types-dialog__item"
                aria-pressed={type.id === selectedId}
                onClick={() => select(type)}
              >
                <span className="types-dialog__swatch" style={{ background: type.color ?? 'transparent' }} />
                <span>{type.name}</span>
                <small>{t.plural('types.usage', type.usage)}</small>
              </button>
            </li>
          ))}
          {types.length === 0 && <li className="types-dialog__hint">{t('types.empty')}</li>}
          <li>
            <button type="button" className="ui-button ui-button--secondary" disabled={readOnly} onClick={addType}>
              {t('types.new')}
            </button>
          </li>
        </ul>

        {shown !== undefined && (
          <fieldset className="types-dialog__details" disabled={readOnly}>
            <div className="types-dialog__row">
              <label className="types-dialog__label">
                {t('types.name')}
                <input
                  className="ui-input"
                  value={shown.name}
                  onChange={(event) => edit({ ...shown, name: event.target.value })}
                  onBlur={gesture.end}
                />
              </label>
              <button
                type="button"
                className="ui-button ui-button--danger"
                onClick={() => selected && setPendingDelete(selected)}
              >
                {t('types.delete')}
              </button>
            </div>
            <div className="types-dialog__row">
              <label className="types-dialog__label types-dialog__label--color">
                {t('types.color')}
                <input
                  type="color"
                  value={shown.color ?? '#2563eb'}
                  onChange={(event) => edit({ ...shown, color: event.target.value })}
                  onBlur={gesture.end}
                />
              </label>
              <button
                type="button"
                className="ui-button ui-button--secondary"
                disabled={shown.color === undefined}
                onClick={() => edit({ ...shown, color: undefined }, true)}
              >
                {t('types.color.reset')}
              </button>
            </div>
            <label className="types-dialog__row">
              {t('types.icon')}
              <select
                className="ui-input"
                value={shown.icon ?? ''}
                onChange={(event) => edit({ ...shown, icon: ICON_KEYS.find((key) => key === event.target.value) }, true)}
              >
                <option value="">{t('types.icon.none')}</option>
                {ICON_KEYS.map((icon) => (
                  <option key={icon} value={icon}>
                    {t(`types.icon.${icon}`)}
                  </option>
                ))}
              </select>
            </label>

            {side === 'edgeTypes' && (
              <fieldset className="types-dialog__roles">
                <legend>{t('types.roles')}</legend>
                {EDGE_ROLES.map((role) => {
                  const roles = shown.roles ?? []
                  const rival = role === 'sequence' ? 'dependency' : role === 'dependency' ? 'sequence' : undefined
                  return (
                    <label key={role} className="types-dialog__role">
                      <input
                        type="checkbox"
                        checked={roles.includes(role)}
                        disabled={rival !== undefined && roles.includes(rival)}
                        onChange={(event) =>
                          edit(
                            { ...shown, roles: EDGE_ROLES.filter((r) => (r === role ? event.target.checked : roles.includes(r))) },
                            true,
                          )
                        }
                      />
                      <ArrowHeadIcon head={role === 'dependency' ? 'open' : 'closed'} />
                      {t(EDGE_ROLE_NAME_KEYS[role])} – {t(EDGE_ROLE_HINT_KEYS[role])}
                    </label>
                  )
                })}
                <p className="types-dialog__hint">
                  {(shown.roles ?? []).length === 0 ? t('types.roles.none') : t('types.roles.exclusive')}
                </p>
              </fieldset>
            )}

            <h3>{t('types.fields')}</h3>
            <p className="types-dialog__hint">{t('types.renameHint')}</p>
            {shown.fields.map((field, index) => (
              <div className="types-dialog__field" key={index}>
                <input
                  aria-label={t('types.field.key')}
                  placeholder={t('types.field.key')}
                  className="ui-input"
                  value={field.key}
                  onChange={(event) => patchField(index, { key: event.target.value })}
                  onBlur={gesture.end}
                />
                <select
                  aria-label={t('types.field.kind')}
                  className="ui-input"
                  value={field.kind}
                  onChange={(event) => {
                    const kind = KINDS.find((value) => value === event.target.value)
                    if (kind !== undefined) patchField(index, { kind }, true)
                  }}
                >
                  {KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`types.kind.${kind}`)}
                    </option>
                  ))}
                </select>
                {field.kind === 'select' && (
                  <input
                    aria-label={t('types.field.options')}
                    placeholder={t('types.field.options')}
                    className="ui-input"
                    value={(field.options ?? []).join(',')}
                    onChange={(event) => patchField(index, { options: event.target.value.split(',') })}
                    onBlur={gesture.end}
                  />
                )}
                <input
                  aria-label={t('types.field.default')}
                  placeholder={t('types.field.default')}
                  className="ui-input"
                  value={field.default ?? ''}
                  onChange={(event) => patchField(index, { default: event.target.value })}
                  onBlur={gesture.end}
                />
                <label>
                  <input
                    type="checkbox"
                    checked={field.required === true}
                    onChange={(event) => patchField(index, { required: event.target.checked }, true)}
                  />
                  {t('types.field.required')}
                </label>
                <button
                  type="button"
                  className="ui-button ui-button--secondary"
                  onClick={() => edit({ ...shown, fields: shown.fields.filter((_, i) => i !== index) }, true)}
                >
                  {t('types.field.remove')}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="ui-button ui-button--secondary"
              onClick={() => edit({ ...shown, fields: [...shown.fields, { key: '', kind: 'text' }] }, true)}
            >
              {t('types.field.add')}
            </button>

            {problems.length > 0 && (
              <ul className="types-dialog__problems" role="alert">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
          </fieldset>
        )}
      </div>

      <div className="types-dialog__footer">
        <select
          aria-label={t('types.template')}
          className="ui-input"
          value=""
          disabled={readOnly || pendingTemplate !== null}
          onChange={(event) => event.target.value && handleTemplate(event.target.value)}
        >
          <option value="">{t('types.template.choose')}</option>
          {props.templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label}
            </option>
          ))}
        </select>
        <button type="button" className="ui-button ui-button--secondary" disabled={readOnly} onClick={props.onImportCatalog}>
          {t('types.import')}
        </button>
        <button type="button" className="ui-button ui-button--secondary" onClick={props.onExportCatalog}>
          {t('types.export')}
        </button>
        {pendingTemplate !== null && (
          <div className="types-dialog__merge" role="group" aria-label={t('types.merge.title')}>
            <p>{t('types.merge.message')}</p>
            <button type="button" className="ui-button" onClick={() => finishTemplate('merge')}>
              {t('types.merge.merge')}
            </button>
            <button type="button" className="ui-button ui-button--secondary" onClick={() => finishTemplate('replace')}>
              {t('types.merge.replace')}
            </button>
            <button type="button" className="ui-button ui-button--secondary" onClick={() => setPendingTemplate(null)}>
              {t('common.cancel')}
            </button>
          </div>
        )}
        {props.importError && (
          <p role="alert" className="types-dialog__problems">
            {t('types.importFailed')} {props.importError}
          </p>
        )}
      </div>

    </dialog>
    {/* Outside the dialog above: React's cancel event bubbles through the tree and Esc here must not close it. */}
      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('types.delete.title')}
        message={t.plural('types.delete.message', pendingDelete?.usage ?? 0)}
        confirmLabel={t('types.delete')}
        onConfirm={() => {
          endEdit()
          if (pendingDelete) props.onRemove(side, pendingDelete.id)
          setPendingDelete(null)
          setSelectedId(null)
          setDraft(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  )
}
