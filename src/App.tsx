import { ReactFlowProvider } from '@xyflow/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnalysisPanel } from './components/AnalysisPanel'
import { Banner } from './components/Banner'
import { ConfirmDialog } from './components/ConfirmDialog'
import { HelpDialog } from './components/HelpDialog'
import { ImportDialog } from './components/ImportDialog'
import { ExportDialog } from './components/ExportDialog'
import { JsonImportDialog } from './components/JsonImportDialog'
import { FilterBar } from './components/FilterBar'
import { SearchBar } from './components/SearchBar'
import { Sidebar } from './components/Sidebar'
import { ToolHint } from './components/ToolHint'
import { Toolbar } from './components/Toolbar'
import type {
  AnalysisEntry,
  AnalysisPanelProps,
  AnalysisSelected,
  BulkColor,
  BulkStatus,
  ExportFormat,
  SearchOutcome,
  SidebarFilterProps,
} from './components/props'
import { Canvas } from './flow/Canvas'
import { buildSvg } from './flow/svgExport'
import { useLocale, useT } from './i18n/react'
import { findCycles } from './model/cycles'
import { canGroup } from './model/graph'
import { contentFingerprint } from './model/fingerprint'
import { displayName, getColor, getEdgeName } from './model/metadata'
import { isSoftEdge } from './model/softDependency'
import { findByMetadata } from './model/filter'
import { findByName, nextHit, normalizeQuery } from './model/search'
import { sidebarTarget } from './model/sidebarTarget'
import { DEFAULT_STATUS, getBlockReason, getStatusInfo, parseStatus } from './model/status'
import type { Tool } from './model/workMode'
import {
  analyzeProject,
  analyzeSelection,
  formatAnalysisMarkdown,
  type ProjectAnalysis,
  type SelectionAnalysis,
} from './model/releaseAnalysis'
import { exportFileName, parseModelJson, serializeModel, toModel } from './model/serialize'
import type { GraphContent } from './model/types'
import { copyText } from './storage/clipboard'
import { downloadTextFile, pickTextFile } from './storage/fileIO'
import { graphStore, useGraph } from './store/appStore'
import { setLocale } from './store/localeStore'
import './App.css'

const NOTICE_AUTO_DISMISS_MS = 5000

// Module-level so the identities are stable: the sidebar form reports through them in effects.
const reportSidebarInvalid = (invalid: boolean) => graphStore.getState().setSidebarInvalid(invalid)
const beginSidebarEdit = () => graphStore.getState().beginGesture()
const endSidebarEdit = () => graphStore.getState().endGesture()

/** Keyboard shortcuts of the build mode tools. */
const TOOL_KEYS: Record<string, Tool> = { v: 'select', n: 'create', s: 'note', c: 'connect', r: 'box' }

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.closest('input, textarea, select, dialog') !== null
}

/** Panel data from the analysis results; names and flags are resolved here so the panel stays presentational. */
function toPanelProps(
  content: GraphContent,
  project: ProjectAnalysis,
  selection: SelectionAnalysis,
): Omit<
  AnalysisPanelProps,
  'selected' | 'onStatusChange' | 'onBlockReasonChange' | 'onEditStart' | 'onEditEnd' | 'onReveal' | 'onCopy' | 'onClose'
> {
  const byId = new Map(content.nodes.map((n) => [n.id, n]))
  const nameOf = (id: string) => {
    const node = byId.get(id)
    return node ? displayName(node) : id.slice(0, 8)
  }
  const entry = (id: string): AnalysisEntry => ({
    id,
    name: nameOf(id),
    status: project.statusById.get(id) ?? 'offen',
    ready: project.readyIds.has(id),
    blocked: project.blockedIds.has(id),
    waiting: project.waitingIds.has(id),
    reason: project.blockReasons.get(id),
    waitingFor: (project.waitingFor.get(id) ?? []).map(nameOf),
  })
  const { counts } = project
  const path = selection.criticalPath
  return {
    scope: selection.scope,
    selectionNames: selection.selectedIds.map(nameOf),
    counts: {
      done: counts.done,
      inProgress: counts.inProgress,
      open: counts.open,
      blocked: counts.blocked,
      waiting: counts.waiting,
      ready: counts.ready,
    },
    selfBlocked: selection.selectedBlocked.map((id) => ({ id, name: nameOf(id), reason: project.blockReasons.get(id) })),
    criticalPath: path && {
      steps: path.nodeIds.map(entry),
      length: path.length,
    },
    cycleNames: selection.cycleIds.map(nameOf),
    unfinished: selection.unfinished.map((u) => entry(u.id)),
    selectionFinished: selection.selectionFinished,
    unknownStatus: selection.unknownStatus.map((item) => ({ id: item.id, name: nameOf(item.id), raw: item.raw })),
  }
}

function AppShell() {
  // Set while the import dialog is open; `unsaved` is decided when it opens.
  const [importDialog, setImportDialog] = useState<{ unsaved: boolean } | null>(null)
  // JSON as text instead of a file: the shown text (null = closed) and the paste dialog with its last errors.
  const [searchOpen, setSearchOpen] = useState(false)
  // The filter texts outlive the bar, so reopening it shows the last filter again.
  const [filter, setFilter] = useState({ open: false, key: '', value: '' })
  const [helpOpen, setHelpOpen] = useState(false)
  const locale = useLocale()
  const t = useT()
  const lastSearch = useRef<{ query: string; id: string | null }>({ query: '', id: null })
  const [exportOpen, setExportOpen] = useState(false)
  const [jsonImport, setJsonImport] = useState<{ unsaved: boolean; errors: string[] } | null>(null)

  const projectName = useGraph((s) => s.projectName)
  const tool = useGraph((s) => s.tool)
  const connectSourcePicked = useGraph((s) => s.connectSourceId !== null)
  const groupable = useGraph((s) => canGroup(s.nodes, s.selectedNodeIds))
  const ungroupable = useGraph((s) =>
    s.nodes.some((n) => n.kind === 'group' && s.selectedNodeIds.includes(n.id)),
  )
  const canUndo = useGraph((s) => s.history.past.length > 0)
  const canRedo = useGraph((s) => s.history.future.length > 0)
  const mode = useGraph((s) => s.mode)
  const highlight = useGraph((s) => s.highlight)
  const panelShown = useGraph((s) => s.analysisPanelVisible)
  const selectionEmpty = useGraph((s) => s.selectedNodeIds.length === 0)
  const copyable = useGraph((s) => s.selectedNodeIds.length > 0)
  const pasteable = useGraph((s) => s.clipboard !== null)
  const deletable = useGraph((s) => s.selectedNodeIds.length + s.selectedEdgeIds.length > 0)
  const notice = useGraph((s) => s.notice)
  const nodes = useGraph((s) => s.nodes)
  const edges = useGraph((s) => s.edges)
  // Derived on demand, never stored in the model.
  const cycles = useMemo(() => findCycles({ nodes, edges }), [nodes, edges])
  const analysis = useMemo(() => analyzeProject({ nodes, edges }), [nodes, edges])
  const analyzing = mode === 'analyze'
  const panelVisible = analyzing && panelShown
  const drawCritical = analyzing && highlight === 'critical'
  const selectedNodeIds = useGraph((s) => s.selectedNodeIds)
  const selectedEdgeIds = useGraph((s) => s.selectedEdgeIds)
  // The selection analysis feeds the panel and the critical path highlight; skip it when neither is shown.
  const selection = useMemo(
    () => (panelVisible || drawCritical ? analyzeSelection({ nodes, edges }, selectedNodeIds) : null),
    [panelVisible, drawCritical, nodes, edges, selectedNodeIds],
  )
  const critical = useMemo(
    () =>
      drawCritical && selection
        ? {
            nodeIds: new Set(selection.criticalPath?.nodeIds),
            edgeIds: new Set(selection.criticalPath?.edgeIds),
          }
        : null,
    [drawCritical, selection],
  )
  const panelProps = useMemo(
    () => (panelVisible && selection ? toPanelProps({ nodes, edges }, analysis, selection) : null),
    [panelVisible, selection, nodes, edges, analysis],
  )
  const nextCycle = useRef(0)
  // The sidebar follows the selection: one element is edited, several only get a hint.
  const target = useMemo(
    () => sidebarTarget(selectedNodeIds, selectedEdgeIds),
    [selectedNodeIds, selectedEdgeIds],
  )
  const sidebarNode = useMemo(
    () => (target.kind === 'node' ? (nodes.find((n) => n.id === target.id) ?? null) : null),
    [target, nodes],
  )
  // The global Escape handler is set up once; it reads the open state from here.
  const filterOpenRef = useRef(false)
  useEffect(() => {
    filterOpenRef.current = filter.open
  })
  const closeFilter = () => setFilter((current) => ({ ...current, open: false }))
  // Derived, never stored: the elements with the entered metadata entry, listed in the sidebar while the bar is open.
  const filterHits = useMemo(
    () => (filter.open ? findByMetadata(nodes, filter.key, filter.value) : []),
    [filter, nodes],
  )
  const sidebarFilter = useMemo<SidebarFilterProps | undefined>(() => {
    if (!filter.open) return undefined
    return {
      results: filterHits.flatMap((hit) => {
        const node = nodes.find((n) => n.id === hit.id)
        return node
          ? [{ id: hit.id, name: displayName(node), color: getColor(node.metadata), key: hit.key, value: hit.value }]
          : []
      }),
      selectedIds: selectedNodeIds,
      hasQuery: filter.key.trim() !== '',
      onPick: (id) => graphStore.getState().focusNodes([id]),
      onClose: closeFilter,
    }
  }, [filter, filterHits, nodes, selectedNodeIds])
  // Several elements selected: their colour can be set together (connections have none).
  const bulkColor = useMemo<BulkColor | undefined>(() => {
    if (target.kind !== 'multiple') return undefined
    const colors = nodes.filter((n) => selectedNodeIds.includes(n.id)).map((n) => getColor(n.metadata) ?? '')
    if (colors.length === 0) return undefined
    const shared = new Set(colors)
    return {
      count: colors.length,
      color: shared.size === 1 ? colors[0] : '',
      mixed: shared.size > 1,
      onChange: (color) => graphStore.getState().setSelectionColor(color),
    }
  }, [target, nodes, selectedNodeIds])
  // ... and so can their status (groups have none, they stay out of the count).
  const bulkStatus = useMemo<BulkStatus | undefined>(() => {
    if (target.kind !== 'multiple') return undefined
    const infos = nodes
      .filter((n) => n.kind === 'node' && selectedNodeIds.includes(n.id))
      .map((n) => getStatusInfo(n.metadata))
    if (infos.length === 0) return undefined
    // A missing value is `offen`; an unknown one counts as its own value, so it is never overwritten unseen.
    const values = infos.map((info) => (info.raw === undefined ? DEFAULT_STATUS : (parseStatus(info.raw) ?? info.raw)))
    const shared = new Set(values)
    return {
      count: infos.length,
      status: shared.size === 1 ? values[0] : '',
      mixed: shared.size > 1,
      onChange: (status) => graphStore.getState().setSelectionStatus(status),
    }
  }, [target, nodes, selectedNodeIds])
  const sidebarEdge = useMemo(
    () => (target.kind === 'edge' ? (edges.find((e) => e.id === target.id) ?? null) : null),
    [target, edges],
  )
  // The panel edits the status of a single selected object; for a group it shows the progress.
  const panelSelected = useMemo<AnalysisSelected | null>(() => {
    if (!sidebarNode || sidebarNode.kind === 'note') return null
    return {
      id: sidebarNode.id,
      name: displayName(sidebarNode),
      kind: sidebarNode.kind,
      status: sidebarNode.kind === 'node' ? (getStatusInfo(sidebarNode.metadata).raw ?? '') : '',
      reason: sidebarNode.kind === 'node' ? (getBlockReason(sidebarNode.metadata) ?? '') : '',
      progress: sidebarNode.kind === 'group' ? analysis.groupProgress.get(sidebarNode.id) : undefined,
    }
  }, [sidebarNode, analysis])
  const sidebarChangePending = useGraph((s) => s.pendingSidebarChange !== null)
  const sidebarElement = useMemo(() => {
    if (sidebarNode) {
      return {
        id: sidebarNode.id,
        kind: sidebarNode.kind,
        metadata: sidebarNode.metadata,
        progress: sidebarNode.kind === 'group' ? analysis.groupProgress.get(sidebarNode.id) : undefined,
      }
    }
    if (sidebarEdge) {
      return {
        id: sidebarEdge.id,
        kind: 'edge' as const,
        metadata: [{ key: 'name', value: getEdgeName(sidebarEdge) }],
        soft: isSoftEdge(sidebarEdge),
      }
    }
    return null
  }, [sidebarNode, sidebarEdge, analysis])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      const state = graphStore.getState()
      const modifier = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      if (modifier && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) state.redo()
        else state.undo()
      } else if (modifier && key === 'y') {
        event.preventDefault()
        state.redo()
      } else if (modifier && !event.shiftKey && !event.altKey && state.mode === 'build' && (key === 'c' || key === 'v')) {
        // Only the app's own selection: with nothing selected / copied the browser keeps its shortcut.
        if (key === 'c' && state.selectedNodeIds.length > 0) {
          event.preventDefault()
          state.copySelection()
        } else if (key === 'v' && state.clipboard) {
          event.preventDefault()
          state.paste()
        }
      } else if (!modifier && !event.altKey && state.mode === 'build' && Object.hasOwn(TOOL_KEYS, key)) {
        state.setTool(TOOL_KEYS[key])
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        state.deleteSelection()
      } else if (event.key === 'Escape') {
        // One level at a time: the tool, the filter, then the analysis panel, finally the selection (and with it the sidebar).
        if (state.tool !== 'select') state.setTool('select')
        else if (filterOpenRef.current) setFilter((current) => ({ ...current, open: false }))
        else if (state.mode === 'analyze' && state.analysisPanelVisible) state.setAnalysisPanelVisible(false)
        else state.closeSidebar()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    document.title = t('app.title', { name: projectName })
  }, [projectName, t])

  useEffect(() => {
    if (!notice || notice.kind === 'error') return
    const timer = setTimeout(() => graphStore.getState().dismissNotice(), NOTICE_AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [notice])

  const focusNextCycle = () => {
    if (cycles.cycles.length === 0) return
    const index = nextCycle.current % cycles.cycles.length
    nextCycle.current = index + 1
    graphStore.getState().focusNodes(cycles.cycles[index])
  }

  const copyAnalysis = async () => {
    if (!selection) return
    const state = graphStore.getState()
    const text = formatAnalysisMarkdown({ nodes, edges, projectName }, analysis, selection, t)
    if (await copyText(text)) {
      state.notify({ kind: 'success', message: { key: 'notice.analysis.copied' } })
    } else {
      state.notify({ kind: 'error', message: { key: 'notice.analysis.copyFailed' } })
    }
  }

  // Enter in the search field: the first hit, and with an unchanged text every further Enter the next one (then round again).
  const runSearch = (query: string): SearchOutcome => {
    const hits = findByName(graphStore.getState().nodes, query)
    const wanted = normalizeQuery(query)
    const last = lastSearch.current
    const id = nextHit(hits, last.query === wanted ? last.id : null)
    lastSearch.current = { query: wanted, id: id ?? null }
    if (id === undefined) return { count: 0, position: 0 }
    graphStore.getState().focusNodes([id])
    return { count: hits.length, position: hits.indexOf(id) + 1 }
  }

  // Search and filter share the spot above the canvas: opening one closes the other.
  const toggleSearch = () => {
    lastSearch.current = { query: '', id: null }
    if (!searchOpen) setFilter((current) => ({ ...current, open: false }))
    setSearchOpen(!searchOpen)
  }

  const toggleFilter = () => {
    if (!filter.open) {
      lastSearch.current = { query: '', id: null }
      setSearchOpen(false)
    }
    setFilter((current) => ({ ...current, open: !current.open }))
  }

  const exportModel = () => {
    const state = graphStore.getState()
    const { nodes, edges, projectName: name } = state
    downloadTextFile(
      exportFileName(new Date(), name),
      serializeModel(toModel({ nodes, edges, projectName: name })),
    )
    state.markExported()
  }

  const hasUnexportedChanges = () => {
    const { nodes, edges, projectName: name, exportedFingerprint } = graphStore.getState()
    return contentFingerprint({ nodes, edges, projectName: name }) !== exportedFingerprint
  }

  const requestImport = () => setImportDialog({ unsaved: hasUnexportedChanges() })

  // Files and the clipboard JSON are full copies of the project and so count as an export; the SVG is not (it cannot be imported).
  const runExport = async (format: ExportFormat): Promise<boolean> => {
    const state = graphStore.getState()
    const { nodes: current, edges: currentEdges, projectName: name } = state
    const content = { nodes: current, edges: currentEdges, projectName: name }
    if (format === 'json-file') {
      exportModel()
      return true
    }
    if (format === 'svg') {
      downloadTextFile(exportFileName(new Date(), name, 'svg'), buildSvg(content), 'image/svg+xml')
      return true
    }
    if (!(await copyText(serializeModel(toModel(content))))) return false
    state.markExported()
    return true
  }

  // Validated here first so the dialog (which covers the banner) can show what is wrong.
  const importJson = (text: string) => {
    const result = parseModelJson(text, t)
    if (!result.ok) {
      setJsonImport((current) => current && { ...current, errors: result.errors })
      return
    }
    graphStore.getState().importText(text)
    setJsonImport(null)
  }

  // Both import paths call this synchronously from the click handler (no `await` before the picker),
  // so the file picker still counts as user-initiated.
  const pickAndImport = async () => {
    setImportDialog(null)
    const text = await pickTextFile()
    if (text === null) return
    graphStore.getState().importText(text)
  }

  const exportAndImport = () => {
    exportModel()
    void pickAndImport()
  }

  const importCounts = useMemo(
    () => ({
      objects: nodes.filter((n) => n.kind === 'node').length,
      groups: nodes.filter((n) => n.kind === 'group').length,
      connections: edges.length,
    }),
    [nodes, edges],
  )

  return (
    <div className="app">
      <Toolbar
        projectName={projectName}
        onRenameProject={(name) => graphStore.getState().renameProject(name)}
        mode={mode}
        onModeChange={(next) => graphStore.getState().setMode(next)}
        tool={tool}
        onToolChange={(next) => graphStore.getState().setTool(next)}
        canGroup={groupable}
        canUngroup={ungroupable}
        canDelete={deletable}
        canCopy={copyable}
        canPaste={pasteable}
        canUndo={canUndo}
        canRedo={canRedo}
        highlight={highlight}
        onHighlightChange={(next) => graphStore.getState().setHighlight(next)}
        selectionEmpty={selectionEmpty}
        cycleCount={cycles.cycles.length}
        onFocusCycle={focusNextCycle}
        panelVisible={panelShown}
        onTogglePanel={() => graphStore.getState().setAnalysisPanelVisible(!panelShown)}
        onUndo={() => graphStore.getState().undo()}
        onRedo={() => graphStore.getState().redo()}
        onGroup={() => graphStore.getState().groupSelection()}
        onUngroup={() => graphStore.getState().ungroupSelection()}
        onDelete={() => graphStore.getState().deleteSelection()}
        onCopy={() => graphStore.getState().copySelection()}
        onPaste={() => graphStore.getState().paste()}
        filterOpen={filter.open}
        onToggleFilter={toggleFilter}
        searchOpen={searchOpen}
        onToggleSearch={toggleSearch}
        onExport={() => setExportOpen(true)}
        onImport={requestImport}
        onPasteJson={() => setJsonImport({ unsaved: hasUnexportedChanges(), errors: [] })}
        locale={locale}
        onLocaleChange={setLocale}
        onHelp={() => setHelpOpen(true)}
      />
      <div className="workspace">
        <main className="canvas">
          <Canvas cycles={cycles} analysis={analysis} critical={critical} />
          <ToolHint tool={tool} sourcePicked={connectSourcePicked} />
          {searchOpen && <SearchBar onSearch={runSearch} onClose={toggleSearch} />}
          {filter.open && (
            <FilterBar
              keyText={filter.key}
              valueText={filter.value}
              count={filterHits.length}
              onKeyChange={(key) => setFilter((current) => ({ ...current, key }))}
              onValueChange={(value) => setFilter((current) => ({ ...current, value }))}
              onClose={closeFilter}
            />
          )}
          <div className="banner-host">
            <Banner
              message={notice ? t(notice.message.key, notice.message.params) : null}
              kind={notice?.kind ?? 'info'}
              details={notice?.details}
              onDismiss={() => graphStore.getState().dismissNotice()}
            />
          </div>
        </main>
        {panelProps && (
          <AnalysisPanel
            {...panelProps}
            selected={panelSelected}
            onStatusChange={(status) => {
              if (panelSelected) graphStore.getState().setStatus(panelSelected.id, status)
            }}
            onBlockReasonChange={(reason) => {
              if (panelSelected) graphStore.getState().setBlockReason(panelSelected.id, reason)
            }}
            onEditStart={beginSidebarEdit}
            onEditEnd={endSidebarEdit}
            onReveal={(id) => graphStore.getState().revealNode(id)}
            onCopy={() => void copyAnalysis()}
            onClose={() => graphStore.getState().setAnalysisPanelVisible(false)}
          />
        )}
        {/* Hidden, not unmounted, while analysing: the selection and an unfinished sidebar draft stay as they are.
            An open filter shows its hits in it even then. */}
        <Sidebar
          hidden={analyzing && !filter.open}
          filter={sidebarFilter}
          element={sidebarElement}
          selectionCount={selectedNodeIds.length + selectedEdgeIds.length}
          bulkColor={bulkColor}
          bulkStatus={bulkStatus}
          onChange={(metadata) => {
            if (!sidebarElement) return
            const state = graphStore.getState()
            if (sidebarElement.kind === 'edge') {
              state.renameEdge(sidebarElement.id, metadata.find((m) => m.key === 'name')?.value ?? '')
            } else {
              state.updateMetadata(sidebarElement.id, metadata)
            }
          }}
          onEditStart={beginSidebarEdit}
          onEditEnd={endSidebarEdit}
          onClose={() => graphStore.getState().closeSidebar()}
          onSoftChange={(soft) => {
            if (sidebarElement?.kind === 'edge') graphStore.getState().setEdgeSoft(sidebarElement.id, soft)
          }}
          onInvalidChange={reportSidebarInvalid}
        />
      </div>
      <ConfirmDialog
        open={sidebarChangePending}
        title={t('app.discard.title')}
        message={t('app.discard.message', {
          name: sidebarNode ? displayName(sidebarNode) : t('sidebar.title.edge'),
        })}
        confirmLabel={t('app.discard.confirm')}
        onConfirm={() => graphStore.getState().confirmSidebarChange()}
        onCancel={() => graphStore.getState().cancelSidebarChange()}
      />
      <ImportDialog
        open={importDialog !== null}
        projectName={projectName}
        counts={importCounts}
        unsaved={importDialog?.unsaved ?? false}
        onExportAndImport={exportAndImport}
        onImportWithoutExport={() => void pickAndImport()}
        onCancel={() => setImportDialog(null)}
      />
      <ExportDialog
        open={exportOpen}
        svgDisabled={nodes.length === 0}
        onExport={runExport}
        onClose={() => setExportOpen(false)}
      />
      <JsonImportDialog
        open={jsonImport !== null}
        projectName={projectName}
        counts={importCounts}
        unsaved={jsonImport?.unsaved ?? false}
        errors={jsonImport?.errors ?? []}
        onImport={importJson}
        onCancel={() => setJsonImport(null)}
      />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <AppShell />
    </ReactFlowProvider>
  )
}
