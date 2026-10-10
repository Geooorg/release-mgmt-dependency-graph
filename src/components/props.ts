import type { ConnectMode } from '../flow/types'
import type { DependencyDirection, DependencyMode } from '../model/dependency'
import type { Status } from '../model/status'
import type { ElementKind, MetadataEntry } from '../model/types'

export interface ToolbarProps {
  projectName: string
  onRenameProject: (name: string) => void
  connectMode: ConnectMode
  canGroup: boolean
  canUngroup: boolean
  canDelete: boolean
  canUndo: boolean
  canRedo: boolean
  dependencyMode: DependencyMode
  /** Nothing selected: the highlight has nothing to start from. */
  selectionEmpty: boolean
  /** Number of dependency cycles; the warning button is only shown when above 0. */
  cycleCount: number
  /** Select the objects of the next cycle and show them. */
  onFocusCycle: () => void
  /** The release analysis panel is open. */
  analysisOpen: boolean
  onToggleAnalysis: () => void
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
  /** Groups only: finished and total objects inside, shown as a read-only status summary. */
  progress?: { done: number; total: number }
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

/** One object in the analysis panel. */
export interface AnalysisEntry {
  id: string
  name: string
  status: Status
  /** Unfinished and not blocked: can be worked on right now. */
  ready: boolean
  /** Has an unfinished transitive prerequisite. */
  blocked: boolean
}

export interface AnalysisCounts {
  done: number
  inProgress: number
  open: number
  blocked: number
  ready: number
}

export interface AnalysisPanelProps {
  /** `project`: nothing selected, the figures cover the whole project. */
  scope: 'selection' | 'project'
  /** Names of the selected elements (empty for the whole project). */
  selectionNames: string[]
  counts: AnalysisCounts
  /** Steps in release order (first to do first); null = not computable because of a cycle. */
  criticalPath: { steps: AnalysisEntry[]; length: number } | null
  /** Names of the objects in the cycles that make the critical path undefined. */
  cycleNames: string[]
  /** Unfinished prerequisites of the selection, ready ones first (scope `project`: all unfinished objects). */
  blockers: AnalysisEntry[]
  /** Bring the object into view without changing the selection. */
  onReveal: (id: string) => void
  onCopy: () => void
  onClose: () => void
}
