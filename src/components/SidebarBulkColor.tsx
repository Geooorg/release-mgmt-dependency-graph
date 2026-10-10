import { useId } from 'react'
import { DEFAULT_COLOR } from '../model/types'
import type { BulkColor } from './props'
import { useEditGesture } from './useSidebarEffects'
import './components.css'

interface SidebarBulkColorProps extends BulkColor {
  onEditStart: () => void
  onEditEnd: () => void
}

/** One colour for every selected object and group; dragging in the picker is a single undo step. */
export function SidebarBulkColor({ count, color, mixed, onChange, onEditStart, onEditEnd }: SidebarBulkColorProps) {
  const id = useId()
  const gesture = useEditGesture(onEditStart, onEditEnd)

  return (
    <div className="sidebar__field">
      <label className="sidebar__label" htmlFor={id}>
        {`Farbe (color) für ${count === 1 ? '1 Element' : `alle ${count} Elemente`}`}
      </label>
      <div className="sidebar__color">
        <input
          id={id}
          type="color"
          className="sidebar__color-input"
          value={color || DEFAULT_COLOR}
          onChange={(event) => {
            gesture.start()
            onChange(event.target.value.toLowerCase())
          }}
          onBlur={gesture.end}
        />
        <span className="sidebar__color-value">{mixed ? 'verschieden' : color || 'Standard'}</span>
        <button
          type="button"
          className="ui-button ui-button--secondary"
          disabled={!mixed && color === ''}
          onClick={() => {
            gesture.end()
            onChange(undefined)
          }}
        >
          Zurücksetzen
        </button>
      </div>
    </div>
  )
}
