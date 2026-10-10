import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  useStoreApi,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react'
import { useCallback, useEffect, useMemo } from 'react'
import { nodeTypes } from '../components/nodeTypes'
import type { CycleResult } from '../model/cycles'
import { findDependencies } from '../model/dependency'
import { checkConnection } from '../model/graph'
import type { ProjectAnalysis } from '../model/releaseAnalysis'
import { HANDLE_SIDES, type HandleSide } from '../model/types'
import { graphStore, useGraph } from '../store/appStore'
import { toFlowEdges, toFlowNodes } from './mapping'
import { coveredLeftWidth, viewportForFocus } from './viewport'
import type { AppFlowNode } from './types'

type EdgeLike = Edge | Connection

const NO_IDS: ReadonlySet<string> = new Set()

const asSide = (id: string | null | undefined): HandleSide | undefined =>
  (HANDLE_SIDES as readonly (string | null | undefined)[]).includes(id) ? (id as HandleSide) : undefined

const endDragGesture = (draggedIds: readonly string[]) => {
  const state = graphStore.getState()
  state.finishDrag(draggedIds)
  state.endGesture()
}

const REVEAL_FLASH_MS = 1600

interface CanvasProps {
  cycles: CycleResult
  /** Status and blockers of the project (status marks, red flags). */
  analysis: ProjectAnalysis
  /** Critical path drawn in red while the analysis panel is open; null = none. */
  critical: { nodeIds: ReadonlySet<string>; edgeIds: ReadonlySet<string> } | null
}

export function Canvas({ cycles, analysis, critical }: CanvasProps) {
  const nodes = useGraph((s) => s.nodes)
  const edges = useGraph((s) => s.edges)
  const selectedNodeIds = useGraph((s) => s.selectedNodeIds)
  const selectedEdgeIds = useGraph((s) => s.selectedEdgeIds)
  const connectSourceId = useGraph((s) => s.connectSourceId)
  const dropTargetId = useGraph((s) => s.dropTargetId)
  const dependencyMode = useGraph((s) => s.dependencyMode)
  const contentRevision = useGraph((s) => s.contentRevision)
  const focusRequest = useGraph((s) => s.focusRequest)
  const revealedId = useGraph((s) => s.revealedId)
  const { fitView, getNodesBounds, setViewport } = useReactFlow()
  const flowStore = useStoreApi()

  // The dependency graph follows the selection while the mode is on.
  const dependencies = useMemo(
    () =>
      dependencyMode === 'off' || selectedNodeIds.length === 0
        ? { nodeIds: NO_IDS, edgeIds: NO_IDS }
        : findDependencies({ nodes, edges }, selectedNodeIds, dependencyMode),
    [nodes, edges, selectedNodeIds, dependencyMode],
  )

  // Panel and dependency mode exclude each other, so at most one of them draws the red highlight.
  const highlight = critical ?? dependencies

  const flowNodes = useMemo(
    () =>
      toFlowNodes(nodes, {
        selectedIds: new Set(selectedNodeIds),
        connectSourceId,
        dropTargetId,
        dependencyNodeIds: highlight.nodeIds,
        dependencyEdgeIds: highlight.edgeIds,
        cycleNodeIds: cycles.nodeIds,
        analysis,
        revealedId,
      }),
    [nodes, selectedNodeIds, connectSourceId, dropTargetId, highlight, cycles, analysis, revealedId],
  )
  const flowEdges = useMemo(
    () => toFlowEdges(edges, new Set(selectedEdgeIds), highlight.edgeIds, nodes, cycles.edgeIds),
    [edges, nodes, selectedEdgeIds, highlight, cycles],
  )

  // After an import the new graph may be anywhere: bring it into view.
  useEffect(() => {
    if (contentRevision === 0) return
    const frame = requestAnimationFrame(() => void fitView({ padding: 0.2, duration: 200 }))
    return () => cancelAnimationFrame(frame)
  }, [contentRevision, fitView])

  // Focus requests (cycle button, analysis panel): bring the requested elements into view, beside
  // the analysis panel that overlays the pane. Not via fitView: with controlled nodes it stays
  // queued until the next node change, so the view would lag one click behind.
  useEffect(() => {
    if (!focusRequest || focusRequest.nodeIds.length === 0) return
    const { width, height, minZoom, domNode } = flowStore.getState()
    const panel = domNode?.parentElement?.querySelector('.analysis-panel')?.getBoundingClientRect()
    const covered = domNode ? coveredLeftWidth(domNode.getBoundingClientRect(), panel) : 0
    const bounds = getNodesBounds(focusRequest.nodeIds)
    const viewport = viewportForFocus(bounds, { width, height }, covered, { min: minZoom, max: 1.2 }, 0.4)
    void setViewport(viewport, { duration: 300 })
  }, [focusRequest, flowStore, getNodesBounds, setViewport])

  // The flash after "reveal" is a CSS animation; drop the marker once it is over.
  useEffect(() => {
    if (!focusRequest || revealedId === null) return
    const timer = setTimeout(() => graphStore.getState().clearReveal(), REVEAL_FLASH_MS)
    return () => clearTimeout(timer)
  }, [focusRequest, revealedId])

  const onNodesChange = useCallback((changes: NodeChange<AppFlowNode>[]) => {
    const state = graphStore.getState()
    const selection: { id: string; selected: boolean }[] = []
    // A resize arrives as many changes: bundle them into one undo step before the first applies.
    if (changes.some((c) => c.type === 'dimensions' && c.resizing === true)) state.beginGesture()
    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        state.moveNode(change.id, change.position)
      } else if (change.type === 'dimensions' && change.setAttributes && change.dimensions) {
        state.resizeNode(change.id, change.dimensions)
      } else if (change.type === 'dimensions' && change.resizing === false) {
        state.endGesture()
      } else if (change.type === 'select') {
        selection.push({ id: change.id, selected: change.selected })
      }
    }
    if (selection.length > 0) state.applyNodeSelection(selection)
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const selection = changes.flatMap((change) =>
      change.type === 'select' ? [{ id: change.id, selected: change.selected }] : [],
    )
    if (selection.length > 0) graphStore.getState().applyEdgeSelection(selection)
  }, [])

  const isValidConnection = useCallback((connection: EdgeLike) => {
    const { nodes: current, edges: currentEdges } = graphStore.getState()
    return checkConnection({ nodes: current, edges: currentEdges }, connection.source, connection.target).ok
  }, [])

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      connectionMode={ConnectionMode.Loose}
      onConnect={(c: Connection) =>
        graphStore
          .getState()
          .connect(c.source, c.target, asSide(c.sourceHandle), asSide(c.targetHandle))
      }
      isValidConnection={isValidConnection}
      onNodeClick={(_, node) => graphStore.getState().pickForConnect(node.id)}
      onPaneClick={() => graphStore.getState().clearConnectSource()}
      onNodeDoubleClick={(_, node) => graphStore.getState().openSidebar(node.id)}
      onEdgeDoubleClick={(_, edge) => graphStore.getState().openEdgeSidebar(edge.id)}
      onNodeDragStart={() => graphStore.getState().beginGesture()}
      onSelectionDragStart={() => graphStore.getState().beginGesture()}
      onNodeDrag={(_, __, dragged) =>
        graphStore.getState().updateDropTarget(dragged.map((n) => n.id))
      }
      onNodeDragStop={(_, __, dragged) => endDragGesture(dragged.map((n) => n.id))}
      onSelectionDragStop={(_, dragged) => endDragGesture(dragged.map((n) => n.id))}
      deleteKeyCode={null}
      zoomOnDoubleClick={false}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.2}
      maxZoom={2}
    >
      <Background gap={20} />
      <Controls showInteractive={false} />
      <MiniMap
        pannable
        zoomable
        nodeColor={(node) => (node.data as { color?: string }).color ?? '#2563eb'}
      />
    </ReactFlow>
  )
}
