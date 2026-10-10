import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { useEffect, useMemo, useState } from 'react'
import { Banner } from './components/Banner'
import { ConfirmDialog } from './components/ConfirmDialog'
import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import { Canvas } from './flow/Canvas'
import { canGroup } from './model/graph'
import { exportFileName, serializeModel, toModel } from './model/serialize'
import { NODE_SIZE } from './model/types'
import { downloadTextFile, pickTextFile } from './storage/fileIO'
import { graphStore, useGraph } from './store/appStore'
import './App.css'

const NOTICE_AUTO_DISMISS_MS = 5000

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.closest('input, textarea, select, dialog') !== null
}

function AppShell() {
  const { screenToFlowPosition } = useReactFlow()
  const [confirmImportOpen, setConfirmImportOpen] = useState(false)

  const connectMode = useGraph((s) => s.connectMode)
  const groupable = useGraph((s) => canGroup(s.nodes, s.selectedNodeIds))
  const ungroupable = useGraph((s) =>
    s.nodes.some((n) => n.kind === 'group' && s.selectedNodeIds.includes(n.id)),
  )
  const deletable = useGraph((s) => s.selectedNodeIds.length + s.selectedEdgeIds.length > 0)
  const notice = useGraph((s) => s.notice)
  const sidebarNode = useGraph((s) =>
    s.sidebarId ? (s.nodes.find((n) => n.id === s.sidebarId) ?? null) : null,
  )
  const sidebarElement = useMemo(
    () =>
      sidebarNode
        ? { id: sidebarNode.id, kind: sidebarNode.kind, metadata: sidebarNode.metadata }
        : null,
    [sidebarNode],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      const state = graphStore.getState()
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        state.deleteSelection()
      } else if (event.key === 'Escape') {
        state.exitConnectMode()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!notice || notice.kind === 'error') return
    const timer = setTimeout(() => graphStore.getState().dismissNotice(), NOTICE_AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [notice])

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
    const { nodes, edges } = graphStore.getState()
    downloadTextFile(exportFileName(), serializeModel(toModel({ nodes, edges })))
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
        connectMode={connectMode}
        canGroup={groupable}
        canUngroup={ungroupable}
        canDelete={deletable}
        onAddNode={addNode}
        onToggleConnect={() => graphStore.getState().toggleConnectMode()}
        onGroup={() => graphStore.getState().groupSelection()}
        onUngroup={() => graphStore.getState().ungroupSelection()}
        onDelete={() => graphStore.getState().deleteSelection()}
        onExport={exportModel}
        onImport={() => setConfirmImportOpen(true)}
      />
      <div className="workspace">
        <main className="canvas">
          <Canvas />
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
            if (sidebarElement) graphStore.getState().saveMetadata(sidebarElement.id, metadata)
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
