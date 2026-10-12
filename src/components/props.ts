import type { Locale } from '../i18n/locale'
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
  /** Something that can be copied (an object or group) is selected. */
  canCopy: boolean
  /** The clipboard holds copied elements. */
  canPaste: boolean
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
  onCopy: () => void
  onPaste: () => void
  /** The filter bar (and with it the result list in the sidebar) is shown. */
  filterOpen: boolean
  onToggleFilter: () => void
  /** The search field is shown. */
  searchOpen: boolean
  onToggleSearch: () => void
  /** Opens the export dialog (JSON file, SVG, JSON on the clipboard). */
  onExport: () => void
  onImport: () => void
  /** Open the dialog to import pasted JSON text. */
  onPasteJson: () => void
  /** The interface language shown in the language switch. */
  locale: Locale
  onLocaleChange: (locale: Locale) => void
  /** Open the help overlay. */
  onHelp: () => void
}

/** Result of one search step: how many elements match and which one (1-based) was jumped to; 0 of 0 = none. */
export interface SearchOutcome {
  count: number
  position: number
}

export interface SearchBarProps {
  /** Runs the search for this text (a jump to a hit) and reports where it landed. */
  onSearch: (query: string) => SearchOutcome
  onClose: () => void
}

export interface FilterBarProps {
  /** Texts of the two fields; the owner keeps them so they survive closing the bar. */
  keyText: string
  valueText: string
  /** Number of matching elements for the current texts. */
  count: number
  onKeyChange: (text: string) => void
  onValueChange: (text: string) => void
  onClose: () => void
}

export interface ToolHintProps {
  tool: Tool
  /** Connect tool: the source is picked, the target is next. */
  sourcePicked: boolean
}

export interface SidebarElement {
  id: string
  /** `edge`: only the `name` entry (the caption) is shown/edited and saved, plus the `soft` checkbox (no colour, status or free-form fields). */
  kind: ElementKind | 'edge'
  metadata: MetadataEntry[]
  /** Groups only: finished and total objects inside, shown as a read-only status summary. */
  progress?: { done: number; total: number }
  /** Edges only: marked as a soft (optional) dependency, shown as a checkbox. */
  soft?: boolean
}

/** The colour of all selected objects and groups, set in one go (several elements selected). */
export interface BulkColor {
  /** Number of selected objects and groups (connections have no colour). */
  count: number
  /** `#rrggbb` all of them share; '' = none set (default blue) or they differ, see `mixed`. */
  color: string
  /** The selected elements have different colours. */
  mixed: boolean
  /** A colour, or undefined to remove it from all of them. */
  onChange: (color: string | undefined) => void
}

/** The status of all selected objects (not groups), set in one go (several elements selected). */
export interface BulkStatus {
  /** Number of selected objects; groups have no status. */
  count: number
  /** Trimmed status they share ('' = none set, i.e. `offen`); may be none of the four. Ignored when `mixed`. */
  status: string
  /** The selected objects have different statuses. */
  mixed: boolean
  onChange: (status: Status) => void
}

/** One hit of the metadata filter. */
export interface FilterResult {
  id: string
  name: string
  /** `#rrggbb` of the element; undefined = default colour. */
  color?: string
  /** The metadata entry that matched, as stored. */
  key: string
  value: string
}

/** The result list of the filter; its presence replaces the form of the sidebar. */
export interface SidebarFilterProps {
  results: FilterResult[]
  /** Selected elements; their rows are marked. */
  selectedIds: readonly string[]
  /** A key has been entered: an empty list then means "no hits" rather than "nothing asked yet". */
  hasQuery: boolean
  /** Select the hit and bring it into view. */
  onPick: (id: string) => void
  /** Closes the filter (not the selection). */
  onClose: () => void
}

export interface SidebarProps {
  /** Filter open: the hit list is shown and the form is kept, hidden. */
  filter?: SidebarFilterProps
  /** null = no single element to edit. */
  element: SidebarElement | null
  /** With `element === null`: more than one selected element shows a hint instead of a form; otherwise the sidebar is closed. */
  selectionCount: number
  /** With several elements selected: the shared colour control; absent when none of them can have one. */
  bulkColor?: BulkColor
  /** With several elements selected: the shared status control; absent when the selection has no object (only groups). */
  bulkStatus?: BulkStatus
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
  /** Edges only: the soft-dependency checkbox was toggled (applied at once, one undo step). */
  onSoftChange?: (soft: boolean) => void
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

/** What the export dialog offers: the project as a JSON file, the graph as an SVG file, the project as JSON text on the clipboard. */
export type ExportFormat = 'json-file' | 'svg' | 'json-clipboard'

export interface ExportDialogProps {
  open: boolean
  /** The graph has no elements, so there is nothing to draw as SVG. */
  svgDisabled: boolean
  /** Runs the export; resolves with whether it worked (only the clipboard can fail). */
  onExport: (format: ExportFormat) => Promise<boolean>
  onClose: () => void
}

export interface JsonImportDialogProps {
  open: boolean
  /** Name of the project that would be replaced. */
  projectName: string
  /** Size of the project that would be replaced. */
  counts: { objects: number; groups: number; connections: number }
  /** The current project differs from the last export, copy or import. */
  unsaved: boolean
  /** Validation messages of the last failed attempt; the project was left unchanged. */
  errors: string[]
  /** Replace the project by the pasted text. */
  onImport: (text: string) => void
  onCancel: () => void
}

export interface HelpDialogProps {
  open: boolean
  onClose: () => void
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
