import type { ReactNode } from 'react'
import { useT } from '../i18n/react'
import './components.css'

interface SidebarDetailsProps {
  open: boolean
  onToggle: (open: boolean) => void
  children: ReactNode
}

/** Collapsible box for the technical object fields (class, entity, version); the owner keeps whether it is open. */
export function SidebarDetails({ open, onToggle, children }: SidebarDetailsProps) {
  const t = useT()
  return (
    <details
      className="sidebar__details"
      open={open}
      onToggle={(event) => onToggle(event.currentTarget.open)}
    >
      <summary className="sidebar__details-summary">{t('sidebar.details')}</summary>
      <div className="sidebar__details-body">{children}</div>
    </details>
  )
}
