import { ReactFlowProvider } from '@xyflow/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnalysisPanel } from './components/AnalysisPanel'
import { Banner } from './components/Banner'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ImportDialog } from './components/ImportDialog'
import { Sidebar } from './components/Sidebar'
import { ToolHint } from './components/ToolHint'
import { Toolbar } from './components/Toolbar'
import type { AnalysisEntry, AnalysisPanelProps, AnalysisSelected } from './components/props'
import { Canvas } from './flow/Canvas'
import { findCycles } from './model/cycles'
import { canGroup } from './model/graph'
import { contentFingerprint } from './model/fingerprint'
import { displayName } from './model/metadata'
import { sidebarTarget } from './model/sidebarTarget'
import { getBlockReason, getStatusInfo } from './model/status'
import type { Tool } from './model/workMode'
import {
  analyzeProject,
  analyzeSelection,
  formatAnalysisMarkdown,
  type ProjectAnalysis,
  type SelectionAnalysis,
} from './model/releaseAnalysis'
import { exportFileName, serializeModel, toModel } from './model/serialize'
import type { GraphContent } from './model/types'
import { copyText } from './storage/clipboard'
import { downloadTextFile, pickTextFile } from './storage/fileIO'
import { graphStore, useGraph } from './store/appStore'
import './App.css'

const NOTICE_AUTO_DISMISS_MS = 5000

// Module-level so the identities are stable: the sidebar form reports through them in effects.
const reportSidebarInvalid = (invalid: boolean) => graphStore.getState().setSidebarInvalid(invalid)
const beginSidebarEdit = () => graphStore.getState().beginGesture()
const endSidebarEdit = () => graphStore.getState().endGesture()

/** Keyboard shortcuts of the build mode tools. */
const TOOL_KEYS: Record<string, Tool> = { v: 'select', n: 'create', c: 'connect' }

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
  const sidebarEdge = useMemo(
    () => (target.kind === 'edge' ? (edges.find((e) => e.id === target.id) ?? null) : null),
    [target, edges],
  )
  // The panel edits the status of a single selected object; for a group it shows the progress.
  const panelSelected = useMemo<AnalysisSelected | null>(() => {
    if (!sidebarNode) return null
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
        metadata: [{ key: 'label', value: sidebarEdge.label ?? '' }],
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
      } else if (!modifier && !event.altKey && state.mode === 'build' && Object.hasOwn(TOOL_KEYS, key)) {
        state.setTool(TOOL_KEYS[key])
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        state.deleteSelection()
      } else if (event.key === 'Escape') {
        // One level at a time: the tool, then the analysis panel, finally the selection (and with it the sidebar).
        if (state.tool !== 'select') state.setTool('select')
        else if (state.mode === 'analyze' && state.analysisPanelVisible) state.setAnalysisPanelVisible(false)
        else state.closeSidebar()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    document.title = `${projectName} – Abhängigkeiten`
  }, [projectName])

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
    const text = formatAnalysisMarkdown({ nodes, edges, projectName }, analysis, selection)
    if (await copyText(text)) {
      state.notify({ kind: 'success', message: 'Analyse in die Zwischenablage kopiert.' })
    } else {
      state.notify({
        kind: 'error',
        message: 'Die Analyse konnte nicht in die Zwischenablage kopiert werden.',
      })
    }
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

  const requestImport = () => {
    const { nodes, edges, projectName: name, exportedFingerprint } = graphStore.getState()
    setImportDialog({ unsaved: contentFingerprint({ nodes, edges, projectName: name }) !== exportedFingerprint })
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
        onExport={exportModel}
        onImport={requestImport}
      />
      <div className="workspace">
        <main className="canvas">
          <Canvas cycles={cycles} analysis={analysis} critical={critical} />
          <ToolHint tool={tool} sourcePicked={connectSourcePicked} />
          <div className="banner-host">
            <Banner
              message={notice?.message ?? null}
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
        {/* Hidden, not unmounted, while analysing: the selection and an unfinished sidebar draft stay as they are. */}
        <Sidebar
          hidden={analyzing}
          element={sidebarElement}
          selectionCount={selectedNodeIds.length + selectedEdgeIds.length}
          onChange={(metadata) => {
            if (!sidebarElement) return
            const state = graphStore.getState()
            if (sidebarElement.kind === 'edge') {
              state.updateEdgeLabel(sidebarElement.id, metadata.find((m) => m.key === 'label')?.value ?? '')
            } else {
              state.updateMetadata(sidebarElement.id, metadata)
            }
          }}
          onEditStart={beginSidebarEdit}
          onEditEnd={endSidebarEdit}
          onClose={() => graphStore.getState().closeSidebar()}
          onInvalidChange={reportSidebarInvalid}
        />
      </div>
      <ConfirmDialog
        open={sidebarChangePending}
        title="Änderungen verwerfen"
        message={`Ungültige Änderungen an „${sidebarNode ? displayName(sidebarNode) : 'Verbindung'}“ verwerfen? (doppelter Feldname)`}
        confirmLabel="Verwerfen"
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
