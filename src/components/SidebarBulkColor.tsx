import { useId } from 'react'
import { useT } from '../i18n/react'
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
  const t = useT()
  const id = useId()
  const gesture = useEditGesture(onEditStart, onEditEnd)

  return (
    <div className="sidebar__field">
      <label className="sidebar__label" htmlFor={id}>
        {t.plural('sidebar.bulkColor', count)}
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
        <span className="sidebar__color-value">{mixed ? t('sidebar.color.mixed') : color || t('sidebar.color.default')}</span>
        <button
          type="button"
          className="ui-button ui-button--secondary"
          disabled={!mixed && color === ''}
          onClick={() => {
            gesture.end()
            onChange(undefined)
          }}
        >
          {t('sidebar.color.reset')}
        </button>
      </div>
    </div>
  )
}
