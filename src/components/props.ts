import type { ConnectMode } from '../flow/types'
import type { DependencyDirection, DependencyMode } from '../model/dependency'
import type { ElementKind, MetadataEntry } from '../model/types'

export interface ToolbarProps {
  connectMode: ConnectMode
  canGroup: boolean
  canUngroup: boolean
  canDelete: boolean
  canUndo: boolean
  canRedo: boolean
  dependencyMode: DependencyMode
  /** Nothing selected: the highlight has nothing to start from. */
  selectionEmpty: boolean
  onUndo: () => void
  onRedo: () => void
  onDependencyModeChange: (mode: DependencyMode) => void
  onAddNode: () => void
  onToggleConnect: () => void
  onGroup: () => void
  onUngroup: () => void
  onDelete: () => void
  onExport: () => void
  onImport: () => void
}

export type { DependencyDirection }

export interface SidebarElement {
  id: string
  /** `edge`: only a `label` entry is shown/edited and saved (no name, colour or free-form fields). */
  kind: ElementKind | 'edge'
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
