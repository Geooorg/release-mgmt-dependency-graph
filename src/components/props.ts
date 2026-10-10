import type { Status } from '../model/status'
import type { ElementKind, MetadataEntry } from '../model/types'
import type { Highlight, Tool, WorkMode } from '../model/workMode'

export interface ToolbarProps {
  projectName: string
  onRenameProject: (name: string) => void
  /** `build` shows the structure tools, `analyze` the analysis tools (and locks the structure). */
  mode: WorkMode
  onModeChange: (mode: WorkMode) => void
  /** Build mode: the active tool (select, create object, connect). */
  tool: Tool
  onToolChange: (tool: Tool) => void
  canGroup: boolean
  canUngroup: boolean
  canDelete: boolean
  canUndo: boolean
  canRedo: boolean
  /** Analysis mode: what is drawn in red. */
  highlight: Highlight
  onHighlightChange: (highlight: Highlight) => void
  /** Nothing selected: a dependency highlight has nothing to start from. */
  selectionEmpty: boolean
  /** Number of dependency cycles; the warning button is only shown when above 0. */
  cycleCount: number
  /** Select the objects of the next cycle and show them. */
  onFocusCycle: () => void
  /** Analysis mode: the release analysis panel is shown. */
  panelVisible: boolean
  onTogglePanel: () => void
  onUndo: () => void
  onRedo: () => void
  onGroup: () => void
  onUngroup: () => void
  onDelete: () => void
  onExport: () => void
  onImport: () => void
}

export interface ToolHintProps {
  tool: Tool
  /** Connect tool: the source is picked, the target is next. */
  sourcePicked: boolean
}

export interface SidebarElement {
  id: string
  /** `edge`: only a `label` entry is shown/edited and saved (no name, colour or free-form fields). */
  kind: ElementKind | 'edge'
  metadata: MetadataEntry[]
  /** Groups only: finished and total objects inside, shown as a read-only status summary. */
  progress?: { done: number; total: number }
}

export interface SidebarProps {
  /** null = no single element to edit. */
  element: SidebarElement | null
  /** With `element === null`: more than one selected element shows a hint instead of a form; otherwise the sidebar is closed. */
  selectionCount: number
  /**
   * Live edit: called with every valid draft, already normalized (trimmed, empty keys dropped, `name`
   * first). An invalid draft (duplicate field names) is not reported; the owner keeps the last valid state.
   */
  onChange: (metadata: MetadataEntry[]) => void
  /**
   * A field edit begins / ends (typing: first change to leaving the field). The owner bundles
   * everything in between into one undo step. `onEditStart` may be called repeatedly; `onEditEnd`
   * also when the form goes away.
   */
  onEditStart: () => void
  onEditEnd: () => void
  /** Closes the sidebar and clears the selection. */
  onClose: () => void
  /** Hidden but kept (analysis mode): the form with its draft stays alive for when the sidebar returns. */
  hidden?: boolean
  /** Whether the open form holds an invalid draft that is not in the model; `false` again once it closes. */
  onInvalidChange: (invalid: boolean) => void
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

export interface ImportDialogProps {
  open: boolean
  /** Name of the project that would be replaced. */
  projectName: string
  /** Size of the project that would be replaced. */
  counts: { objects: number; groups: number; connections: number }
  /** The current project differs from the last export or import. */
  unsaved: boolean
  /** Export the current project, then choose the file to import. */
  onExportAndImport: () => void
  /** Choose the file to import without exporting first. */
  onImportWithoutExport: () => void
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
  /** Unfinished, not blocked and without an unfinished prerequisite: can be worked on right now. */
  ready: boolean
  /** Status `blockiert` (set by hand): red flag. */
  blocked: boolean
  /** Unfinished, not blocked, with an unfinished direct prerequisite: hourglass. */
  waiting: boolean
  /** Blocked entries: the reason; undefined = none given. */
  reason?: string
  /** Names of the direct prerequisites a waiting entry waits for, in release order. */
  waitingFor?: string[]
}

/** An object whose status value is none of the four (it counts as `offen`). */
export interface UnknownStatusEntry {
  id: string
  name: string
  raw: string
}

export interface AnalysisCounts {
  done: number
  inProgress: number
  open: number
  /** Status `blockiert` (set by hand). */
  blocked: number
  /** Unfinished, not blocked, with an unfinished direct prerequisite. */
  waiting: number
  ready: number
}

/** A selected object that is blocked itself. */
export interface SelfBlockedEntry {
  id: string
  name: string
  reason?: string
}

/** The single selected element, shown at the top of the panel for its status. */
export interface AnalysisSelected {
  id: string
  name: string
  kind: 'node' | 'group'
  /** Objects: trimmed raw value of the status entry, '' = none. May be none of the four statuses. */
  status: string
  /** Objects with the status `blockiert`: the trimmed reason, '' = none. */
  reason: string
  /** Groups: finished and total objects inside (read-only). */
  progress?: { done: number; total: number }
}

export interface AnalysisPanelProps {
  /** Exactly one object or group selected; null otherwise. */
  selected: AnalysisSelected | null
  /** Sets the status of the selected object. */
  onStatusChange: (status: Status) => void
  /** Sets the reason of the selected blocked object (live: called with every change of the field). */
  onBlockReasonChange: (reason: string) => void
  /** A reason edit begins / ends (first change to leaving the field); the owner bundles it into one undo step. */
  onEditStart: () => void
  onEditEnd: () => void
  /** Selected objects that are blocked themselves; shown prominently at the top. */
  selfBlocked: SelfBlockedEntry[]
  /** `project`: nothing selected, the figures cover the whole project. */
  scope: 'selection' | 'project'
  /** Names of the selected elements (empty for the whole project). */
  selectionNames: string[]
  counts: AnalysisCounts
  /** Steps in release order (first to do first); null = not computable because of a cycle. */
  criticalPath: { steps: AnalysisEntry[]; length: number } | null
  /** Names of the objects in the cycles that make the critical path undefined. */
  cycleNames: string[]
  /**
   * Unfinished prerequisites of the selection (scope `project`: all unfinished objects): blocked
   * ones first, then ready ones, then waiting ones.
   */
  unfinished: AnalysisEntry[]
  /** The selection itself is finished: its prerequisites are not looked at (hint instead of the list). */
  selectionFinished: boolean
  /** Section "Zu klären": objects with an unknown status value (selection and its unfinished prerequisites, or the whole project). */
  unknownStatus: UnknownStatusEntry[]
  /** Bring the object into view without changing the selection. */
  onReveal: (id: string) => void
  onCopy: () => void
  onClose: () => void
}
