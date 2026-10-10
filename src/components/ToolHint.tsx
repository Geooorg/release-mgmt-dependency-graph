import type { ToolHintProps } from './props'
import { useT } from '../i18n/react'
import type { Translate } from '../i18n/translate'
import './components.css'

/** What the active tool expects next; nothing for the select tool. */
function hintText({ tool, sourcePicked }: ToolHintProps, t: Translate): string | null {
  if (tool === 'create') return t('toolHint.create')
  if (tool === 'connect') return t(sourcePicked ? 'toolHint.connect.target' : 'toolHint.connect.source')
  return null
}

/** Short instruction floating on the canvas while a tool needs more than a click. */
export function ToolHint(props: ToolHintProps) {
  const t = useT()
  const text = hintText(props, t)
  if (text === null) return null
  return (
    <p className="tool-hint" role="status">
      {text}
    </p>
  )
}
