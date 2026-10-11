import { useContext, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { NodeResizer } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { NoteFlowNode } from '../flow/types'
import { useT } from '../i18n/react'
import { NOTE_DEFAULT_SIZE, NOTE_MIN_SIZE } from '../model/types'
import { NodeNameEditContext } from './nodeNameEdit'
import './components.css'

/** Padding of the note and line height of its text; the number of visible lines follows from the height. */
const NOTE_PADDING = 10
const NOTE_LINE_HEIGHT = 20

/**
 * A sticky note: freely placed, no connectors. Its text (the `name` entry) never makes the note
 * grow; what does not fit is cut off with "…". A double click edits the text in place.
 */
export function NoteNode({ data, selected, height }: NodeProps<NoteFlowNode>) {
  const t = useT()
  const { enabled, onRename } = useContext(NodeNameEditContext)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.name)
  // Ctrl+Enter closes the editor, which then also blurs: only finish once.
  const finished = useRef(false)

  const lines = Math.max(1, Math.floor(((height ?? NOTE_DEFAULT_SIZE.height) - 2 * NOTE_PADDING) / NOTE_LINE_HEIGHT))
  const style = {
    '--note-color': data.color,
    '--note-text': data.textColor,
    '--note-lines': lines,
  } as CSSProperties
  const hasText = data.name.trim() !== ''

  function start() {
    finished.current = false
    setDraft(data.name)
    setEditing(true)
  }

  function finish(commit: boolean) {
    if (finished.current) return
    finished.current = true
    setEditing(false)
    if (commit && draft.trim() !== data.name.trim()) onRename(data.id, draft)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Keep typing away from the canvas shortcuts (Delete, V/N/C, Esc, …).
    event.stopPropagation()
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      finish(true)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      finish(false)
    }
  }

  return (
    <div className={selected ? 'note-node note-node--selected' : 'note-node'} style={style}>
      <NodeResizer isVisible={selected} minWidth={NOTE_MIN_SIZE.width} minHeight={NOTE_MIN_SIZE.height} />
      {editing ? (
        <textarea
          // nodrag/nopan/nowheel: selecting and scrolling text must not move the note or the canvas.
          className="note-node__input nodrag nopan nowheel"
          aria-label={t('note.text')}
          title={t('note.edit.hint')}
          value={draft}
          autoFocus
          spellCheck={false}
          onFocus={(event) => event.target.select()}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => finish(true)}
          onDoubleClick={(event) => event.stopPropagation()}
        />
      ) : (
        <p
          className={hasText ? 'note-node__text' : 'note-node__text note-node__text--empty'}
          onDoubleClick={
            enabled
              ? (event) => {
                  event.stopPropagation()
                  start()
                }
              : undefined
          }
        >
          {hasText ? data.name : t('note.placeholder')}
        </p>
      )}
    </div>
  )
}
