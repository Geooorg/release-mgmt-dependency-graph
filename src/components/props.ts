import type { ConnectMode } from '../flow/types'
import type { ElementKind, MetadataEntry } from '../model/types'

export interface ToolbarProps {
  connectMode: ConnectMode
  canGroup: boolean
  canUngroup: boolean
  canDelete: boolean
  onAddNode: () => void
  onToggleConnect: () => void
  onGroup: () => void
  onUngroup: () => void
  onDelete: () => void
  onExport: () => void
  onImport: () => void
}

export interface SidebarElement {
  id: string
  kind: ElementKind
  metadata: MetadataEntry[]
}

export interface SidebarProps {
  /** null = sidebar closed (render nothing). */
  element: SidebarElement | null
  /** Called with already normalized metadata (trimmed, empty keys dropped, `name` first). */
  onSave: (metadata: MetadataEntry[]) => void
  onClose: () => void
}

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export type BannerKind = 'info' | 'success' | 'error'

export interface BannerProps {
  /** null = nothing shown. */
  message: string | null
  kind: BannerKind
  /** Optional bullet list below the message (e.g. import validation errors). */
  details?: string[]
  onDismiss: () => void
}
