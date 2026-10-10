import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnalysisPanel } from './components/AnalysisPanel'
import { Banner } from './components/Banner'
import { ConfirmDialog } from './components/ConfirmDialog'
import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import type { AnalysisEntry, AnalysisPanelProps } from './components/props'
import { Canvas } from './flow/Canvas'
import { findCycles } from './model/cycles'
import { canGroup } from './model/graph'
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
  }
}

function AppShell() {
  const { screenToFlowPosition } = useReactFlow()
  const [confirmImportOpen, setConfirmImportOpen] = useState(false)

  const projectName = useGraph((s) => s.projectName)
  const connectMode = useGraph((s) => s.connectMode)
  const groupable = useGraph((s) => canGroup(s.nodes, s.selectedNodeIds))
  const ungroupable = useGraph((s) =>
    s.nodes.some((n) => n.kind === 'group' && s.selectedNodeIds.includes(n.id)),
  )
  const canUndo = useGraph((s) => s.history.past.length > 0)
  const canRedo = useGraph((s) => s.history.future.length > 0)
  const dependencyMode = useGraph((s) => s.dependencyMode)
  const selectionEmpty = useGraph((s) => s.selectedNodeIds.length === 0)
  const deletable = useGraph((s) => s.selectedNodeIds.length + s.selectedEdgeIds.length > 0)
  const notice = useGraph((s) => s.notice)
  const nodes = useGraph((s) => s.nodes)
  const edges = useGraph((s) => s.edges)
  // Derived on demand, never stored in the model.
  const cycles = useMemo(() => findCycles({ nodes, edges }), [nodes, edges])
  const analysis = useMemo(() => analyzeProject({ nodes, edges }), [nodes, edges])
  const analysisOpen = useGraph((s) => s.analysisOpen)
  const selectedNodeIds = useGraph((s) => s.selectedNodeIds)
  const selection = useMemo(
    () => (analysisOpen ? analyzeSelection({ nodes, edges }, selectedNodeIds) : null),
    [analysisOpen, nodes, edges, selectedNodeIds],
  )
  const critical = useMemo(
    () =>
      selection?.criticalPath
        ? { nodeIds: new Set(selection.criticalPath.nodeIds), edgeIds: new Set(selection.criticalPath.edgeIds) }
        : selection
          ? { nodeIds: new Set<string>(), edgeIds: new Set<string>() }
          : null,
    [selection],
  )
  const panelProps = useMemo(
    () => (selection ? toPanelProps({ nodes, edges }, analysis, selection) : null),
    [selection, nodes, edges, analysis],
  )
  const nextCycle = useRef(0)
  const sidebarNode = useGraph((s) =>
    s.sidebarId ? (s.nodes.find((n) => n.id === s.sidebarId) ?? null) : null,
  )
  const sidebarEdge = useGraph((s) =>
    s.sidebarEdgeId ? (s.edges.find((e) => e.id === s.sidebarEdgeId) ?? null) : null,
  )
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
        else state.setAnalysisOpen(false)
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
    const { nodes, edges, projectName: name } = graphStore.getState()
    downloadTextFile(
      exportFileName(new Date(), name),
      serializeModel(toModel({ nodes, edges, projectName: name })),
    )
  }

  // Runs inside the click handler of the confirm button, so the file picker still counts as user-initiated.
  const importModel = async () => {
    setConfirmImportOpen(false)
    const text = await pickTextFile()
    if (text === null) return
    graphStore.getState().importText(text)
  }

  return (
    <div className="app">
      <Toolbar
        projectName={projectName}
        onRenameProject={(name) => graphStore.getState().renameProject(name)}
        connectMode={connectMode}
        canGroup={groupable}
        canUngroup={ungroupable}
        canDelete={deletable}
        canUndo={canUndo}
        canRedo={canRedo}
        dependencyMode={dependencyMode}
        selectionEmpty={selectionEmpty}
        cycleCount={cycles.cycles.length}
        onFocusCycle={focusNextCycle}
        analysisOpen={analysisOpen}
        onToggleAnalysis={() => graphStore.getState().setAnalysisOpen(!analysisOpen)}
        onUndo={() => graphStore.getState().undo()}
        onRedo={() => graphStore.getState().redo()}
        onDependencyModeChange={(mode) => graphStore.getState().setDependencyMode(mode)}
        onAddNode={addNode}
        onToggleConnect={() => graphStore.getState().toggleConnectMode()}
        onGroup={() => graphStore.getState().groupSelection()}
        onUngroup={() => graphStore.getState().ungroupSelection()}
        onDelete={() => graphStore.getState().deleteSelection()}
        onExport={exportModel}
        onImport={() => setConfirmImportOpen(true)}
      />
      <div className="workspace">
        <main className={analysisOpen ? 'canvas canvas--analysis' : 'canvas'}>
          <Canvas cycles={cycles} analysis={analysis} critical={critical} />
          {panelProps && (
            <AnalysisPanel
              {...panelProps}
              onReveal={(id) => graphStore.getState().revealNode(id)}
              onCopy={() => void copyAnalysis()}
              onClose={() => graphStore.getState().setAnalysisOpen(false)}
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
        />
      </div>
      <ConfirmDialog
        open={confirmImportOpen}
        title="Modell importieren"
        message="Beim Import wird das aktuelle Modell ersetzt. Aktuelle Änderungen verwerfen?"
        confirmLabel="Verwerfen und importieren"
        onConfirm={() => void importModel()}
        onCancel={() => setConfirmImportOpen(false)}
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
