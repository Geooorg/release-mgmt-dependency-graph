import { useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import {
  MAX_PROJECT_NAME_LENGTH,
  PROJECT_NAME_RULE,
  sanitizeProjectName,
} from '../model/projectName'
import { Tooltip } from './Tooltip'
import './components.css'

export interface ProjectTitleProps {
  name: string
  /** Called with a valid, changed name. */
  onRename: (name: string) => void
}

/** The project name in the toolbar; a double click turns it into an inline editor. */
export function ProjectTitle({ name, onRename }: ProjectTitleProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [problem, setProblem] = useState<string | null>(null)
  // Enter closes the editor, which then also blurs: make sure the edit is only finished once.
  const finished = useRef(false)

  function start() {
    finished.current = false
    setDraft(name)
    setProblem(null)
    setEditing(true)
  }

  function finish(commit: boolean) {
    if (finished.current) return
    if (commit && draft === '') {
      // Enter on an empty field: explain and stay. (Blur discards, see below.)
      setProblem('Der Name darf nicht leer sein.')
      return
    }
    finished.current = true
    if (commit && draft !== name) onRename(draft)
    setEditing(false)
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const typed = event.target.value
    const clean = sanitizeProjectName(typed)
    setDraft(clean)
    // Sticky on purpose: it would flash by unnoticed if the next keystroke cleared it.
    if (clean !== typed) setProblem('Nicht erlaubtes Zeichen entfernt.')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      finish(true)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      finish(false)
    }
  }

  if (!editing) {
    return (
      <h1 className="toolbar__title">
        <Tooltip text="Projektname – Doppelklick (oder Enter) zum Umbenennen" hint={PROJECT_NAME_RULE}>
          <button
            type="button"
            className="project-title"
            onDoubleClick={start}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'F2') {
                event.preventDefault()
                start()
              }
            }}
          >
            {name}
          </button>
        </Tooltip>
      </h1>
    )
  }

  return (
    <h1 className="toolbar__title project-title-editor">
      <input
        className="ui-input project-title__input"
        aria-label="Projektname"
        aria-invalid={problem !== null}
        value={draft}
        maxLength={MAX_PROJECT_NAME_LENGTH}
        size={Math.max(12, Math.min(draft.length + 2, 40))}
        autoFocus
        spellCheck={false}
        autoComplete="off"
        onFocus={(event) => event.target.select()}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => finish(draft !== '')}
      />
      {problem ? (
        <span className="project-title__hint project-title__hint--error" role="alert">
          {problem} {PROJECT_NAME_RULE}
        </span>
      ) : (
        <span className="project-title__hint">{PROJECT_NAME_RULE}</span>
      )}
    </h1>
  )
}
