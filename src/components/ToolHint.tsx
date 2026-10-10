import type { ToolHintProps } from './props'
import './components.css'

/** What the active tool expects next; nothing for the select tool. */
function hintText({ tool, sourcePicked }: ToolHintProps): string | null {
  if (tool === 'create') return 'Auf eine freie Stelle klicken, um ein Objekt anzulegen …'
  if (tool === 'connect') return sourcePicked ? 'Ziel anklicken …' : 'Quelle anklicken …'
  return null
}

/** Short instruction floating on the canvas while a tool needs more than a click. */
export function ToolHint(props: ToolHintProps) {
  const text = hintText(props)
  if (text === null) return null
  return (
    <p className="tool-hint" role="status">
      {text}
    </p>
  )
}
