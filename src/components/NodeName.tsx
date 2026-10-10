import { useContext, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { NodeNameEditContext } from './nodeNameEdit'
import { useT } from '../i18n/react'
import './components.css'

interface NodeNameProps {
  id: string
  name: string
  /** Class of the label span; `--empty` is appended while the name is blank. */
  className: string
}

/** The name on an object or group; a double click turns it into an inline editor. */
export function NodeName({ id, name, className }: NodeNameProps) {
  const t = useT()
  const { enabled, onRename } = useContext(NodeNameEditContext)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  // Enter closes the editor, which then also blurs: only finish once.
  const finished = useRef(false)

  const hasName = name.trim() !== ''

  function start() {
    finished.current = false
    setDraft(name)
    setEditing(true)
  }

  function finish(commit: boolean) {
    if (finished.current) return
    finished.current = true
    setEditing(false)
    if (commit && draft.trim() !== name.trim()) onRename(id, draft)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Keep typing away from the canvas shortcuts (Delete, V/N/C, Esc, …).
    event.stopPropagation()
    if (event.key === 'Enter') {
      event.preventDefault()
      finish(true)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      finish(false)
    }
  }

  if (editing) {
    return (
      <input
        // nodrag/nopan: selecting text must not move the node or pan the canvas.
        className="node-name-input nodrag nopan"
        aria-label={t('node.name')}
        value={draft}
        autoFocus
        spellCheck={false}
        autoComplete="off"
        onFocus={(event) => event.target.select()}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => finish(true)}
        onDoubleClick={(event) => event.stopPropagation()}
      />
    )
  }

  return (
    <span
      className={hasName ? className : `${className} ${className}--empty`}
      onDoubleClick={
        enabled
          ? (event) => {
              // Rename here instead of opening the sidebar.
              event.stopPropagation()
              start()
            }
          : undefined
      }
    >
      {hasName ? name : id.slice(0, 8)}
    </span>
  )
}
