import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnalysisPanel } from './components/AnalysisPanel'
import { Banner } from './components/Banner'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ImportDialog } from './components/ImportDialog'
import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import type { AnalysisEntry, AnalysisPanelProps } from './components/props'
import { Canvas } from './flow/Canvas'
import { findCycles } from './model/cycles'
import { canGroup } from './model/graph'
import { contentFingerprint } from './model/fingerprint'
import { displayName } from './model/metadata'
import {
  analyzeProject,
  analyzeSelection,
  formatAnalysisMarkdown,
  type ProjectAnalysis,
  type SelectionAnalysis,
} from './model/releaseAnalysis'
import { exportFileName, serializeModel, toModel } from './model/serialize'
import { NODE_SIZE, type GraphContent } from './model/types'
import { copyText } from './storage/clipboard'
import { downloadTextFile, pickTextFile } from './storage/fileIO'
import { graphStore, useGraph } from './store/appStore'
import './App.css'

const NOTICE_AUTO_DISMISS_MS = 5000

// Module-level so the identity is stable: the sidebar form reports through it in effects.
const reportSidebarDirty = (dirty: boolean) => graphStore.getState().setSidebarDirty(dirty)

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.closest('input, textarea, select, dialog') !== null
}

/** Panel data from the analysis results; names and flags are resolved here so the panel stays presentational. */
function toPanelProps(
  content: GraphContent,
  project: ProjectAnalysis,
  selection: SelectionAnalysis,
): Omit<AnalysisPanelProps, 'onReveal' | 'onCopy' | 'onClose'> {
  const byId = new Map(content.nodes.map((n) => [n.id, n]))
  const nameOf = (id: string) => {
    const node = byId.get(id)
    return node ? displayName(node) : id.slice(0, 8)
  }
  const entry = (id: string, ready: boolean): AnalysisEntry => ({
    id,
    name: nameOf(id),
    status: project.statusById.get(id) ?? 'offen',
    ready,
    blocked: project.blockedIds.has(id),
    inconsistent: project.inconsistentIds.has(id),
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
      ready: counts.ready,
    },
    criticalPath: path && {
      steps: path.nodeIds.map((id) => entry(id, project.readyIds.has(id))),
      length: path.length,
    },
    cycleNames: selection.cycleIds.map(nameOf),
    blockers: selection.blockers.map((b) => entry(b.id, b.ready)),
    inconsistent: selection.inconsistent.map((item) => ({
      id: item.id,
      name: nameOf(item.id),
      waitingFor: item.waitingFor.map((id) => ({ name: nameOf(id), status: project.statusById.get(id) ?? 'offen' })),
    })),
    unknownStatus: selection.unknownStatus.map((item) => ({ id: item.id, name: nameOf(item.id), raw: item.raw })),
  }
}

function AppShell() {
  const { screenToFlowPosition } = useReactFlow()
  // Set while the import dialog is open; `unsaved` is decided when it opens.
  const [importDialog, setImportDialog] = useState<{ unsaved: boolean } | null>(null)

  const projectName = useGraph((s) => s.projectName)
  const connectMode = useGraph((s) => s.connectMode)
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
  const sidebarNode = useGraph((s) =>
    s.sidebarId ? (s.nodes.find((n) => n.id === s.sidebarId) ?? null) : null,
  )
  const sidebarEdge = useGraph((s) =>
    s.sidebarEdgeId ? (s.edges.find((e) => e.id === s.sidebarEdgeId) ?? null) : null,
  )
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
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        state.deleteSelection()
      } else if (event.key === 'Escape') {
        // One level at a time: first the connect mode, then the analysis panel (the sidebar stays).
        if (state.connectMode !== 'off') state.exitConnectMode()
        else if (state.mode === 'analyze') state.setAnalysisPanelVisible(false)
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

  const addNode = () => {
    const pane = document.querySelector('.react-flow')?.getBoundingClientRect()
    const center = pane
      ? { x: pane.left + pane.width / 2, y: pane.top + pane.height / 2 }
      : { x: 400, y: 300 }
    const origin = screenToFlowPosition(center)
    graphStore.getState().addNodeAt({
      x: origin.x - NODE_SIZE.width / 2,
      y: origin.y - NODE_SIZE.height / 2,
    })
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
        connectMode={connectMode}
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
        onAddNode={addNode}
        onToggleConnect={() => graphStore.getState().toggleConnectMode()}
        onGroup={() => graphStore.getState().groupSelection()}
        onUngroup={() => graphStore.getState().ungroupSelection()}
        onDelete={() => graphStore.getState().deleteSelection()}
        onExport={exportModel}
        onImport={requestImport}
      />
      <div className="workspace">
        <main className={panelVisible ? 'canvas canvas--analysis' : 'canvas'}>
          <Canvas cycles={cycles} analysis={analysis} critical={critical} />
          {panelProps && (
            <AnalysisPanel
              {...panelProps}
              onReveal={(id) => graphStore.getState().revealNode(id)}
              onCopy={() => void copyAnalysis()}
              onClose={() => graphStore.getState().setAnalysisPanelVisible(false)}
            />
          )}
          <div className="banner-host">
            <Banner
              message={notice?.message ?? null}
              kind={notice?.kind ?? 'info'}
              details={notice?.details}
              onDismiss={() => graphStore.getState().dismissNotice()}
            />
          </div>
        </main>
        <Sidebar
          element={sidebarElement}
          onSave={(metadata) => {
            if (!sidebarElement) return
            const state = graphStore.getState()
            if (sidebarElement.kind === 'edge') {
              state.saveEdgeLabel(sidebarElement.id, metadata.find((m) => m.key === 'label')?.value ?? '')
            } else {
              state.saveMetadata(sidebarElement.id, metadata)
            }
          }}
          onClose={() => graphStore.getState().closeSidebar()}
          onDirtyChange={reportSidebarDirty}
        />
      </div>
      <ConfirmDialog
        open={sidebarChangePending}
        title="Änderungen verwerfen"
        message={`Ungespeicherte Änderungen an „${sidebarNode ? displayName(sidebarNode) : 'Verbindung'}“ verwerfen?`}
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
