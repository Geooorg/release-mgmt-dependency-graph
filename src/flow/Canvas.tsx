import {
  Background,
  ConnectionMode,
  Controls,
  getViewportForBounds,
  MiniMap,
  ReactFlow,
  useReactFlow,
  useStore,
  useStoreApi,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import { NodeNameEditContext } from '../components/nodeNameEdit'
import { nodeTypes } from '../components/nodeTypes'
import { useT } from '../i18n/react'
import type { CycleResult } from '../model/cycles'
import { findDependencies } from '../model/dependency'
import { checkConnection, checkReconnection } from '../model/graph'
import type { ProjectAnalysis } from '../model/releaseAnalysis'
import { HANDLE_SIDES, type HandleSide } from '../model/types'
import { graphStore, useGraph } from '../store/appStore'
import { flowAriaLabels } from './ariaLabels'
import { nodeIdAtPoint, pointOfEvent } from './dropTarget'
import { toFlowEdges, toFlowNodes } from './mapping'
import { viewportToReveal } from './reveal'
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
  /** Critical path drawn in red while it is the chosen highlight of the analysis mode; null = none. */
  critical: { nodeIds: ReadonlySet<string>; edgeIds: ReadonlySet<string> } | null
}

export function Canvas({ cycles, analysis, critical }: CanvasProps) {
  const t = useT()
  const ariaLabels = useMemo(() => flowAriaLabels(t), [t])
  const nodes = useGraph((s) => s.nodes)
  const edges = useGraph((s) => s.edges)
  const selectedNodeIds = useGraph((s) => s.selectedNodeIds)
  const selectedEdgeIds = useGraph((s) => s.selectedEdgeIds)
  const connectSourceId = useGraph((s) => s.connectSourceId)
  const dropTargetId = useGraph((s) => s.dropTargetId)
  const analyzing = useGraph((s) => s.mode === 'analyze')
  const tool = useGraph((s) => s.tool)
  const highlightChoice = useGraph((s) => s.highlight)
  const contentRevision = useGraph((s) => s.contentRevision)
  const focusRequest = useGraph((s) => s.focusRequest)
  const revealedId = useGraph((s) => s.revealedId)
  const { fitView, getInternalNode, getNodesBounds, getViewport, screenToFlowPosition, setViewport } = useReactFlow()
  const flowStore = useStoreApi()
  const paneWidth = useStore((s) => s.width)
  const paneHeight = useStore((s) => s.height)
  const singleSelectedId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : null

  // A dependency highlight follows the selection; it only exists in the analysis mode.
  const dependencies = useMemo(
    () =>
      !analyzing || highlightChoice === 'off' || highlightChoice === 'critical' || selectedNodeIds.length === 0
        ? { nodeIds: NO_IDS, edgeIds: NO_IDS }
        : findDependencies({ nodes, edges }, selectedNodeIds, highlightChoice),
    [nodes, edges, selectedNodeIds, analyzing, highlightChoice],
  )

  // One highlight at a time: the critical path, a dependency direction, or none (also in build mode).
  const highlight = analyzing && highlightChoice === 'critical' && critical ? critical : dependencies

  const flowNodes = useMemo(
    () =>
      toFlowNodes(
        nodes,
        {
          selectedIds: new Set(selectedNodeIds),
          connectSourceId,
          dropTargetId,
          dependencyNodeIds: highlight.nodeIds,
          dependencyEdgeIds: highlight.edgeIds,
          cycleNodeIds: cycles.nodeIds,
          analysis,
          revealedId,
        },
        t,
      ),
    [nodes, selectedNodeIds, connectSourceId, dropTargetId, highlight, cycles, analysis, revealedId, t],
  )
  const flowEdges = useMemo(
    () => toFlowEdges(edges, new Set(selectedEdgeIds), highlight.edgeIds, nodes, cycles.edgeIds, t),
    [edges, nodes, selectedEdgeIds, highlight, cycles, t],
  )

  // After an import the new graph may be anywhere: bring it into view.
  useEffect(() => {
    if (contentRevision === 0) return
    const frame = requestAnimationFrame(() => void fitView({ padding: 0.2, duration: 200 }))
    return () => cancelAnimationFrame(frame)
  }, [contentRevision, fitView])

  // Selecting opens the sidebar (or the analysis panel narrows the pane) and may push the selected
  // element out of view, e.g. one just created near the right edge. Pan just enough to keep it
  // visible. Declared before the focus effect so an explicit focus request wins.
  useEffect(() => {
    if (singleSelectedId === null || paneWidth === 0 || getInternalNode(singleSelectedId)?.dragging) return
    const viewport = viewportToReveal(getNodesBounds([singleSelectedId]), getViewport(), {
      width: paneWidth,
      height: paneHeight,
    })
    if (viewport) void setViewport(viewport, { duration: 200 })
  }, [singleSelectedId, paneWidth, paneHeight, getInternalNode, getNodesBounds, getViewport, setViewport])

  // Focus requests (cycle button, analysis panel): bring the requested elements into view. Not via
  // fitView: with controlled nodes it stays queued until the next node change, so the view would
  // lag one click behind.
  useEffect(() => {
    if (!focusRequest || focusRequest.nodeIds.length === 0) return
    const { width: storedWidth, height: storedHeight, minZoom, domNode } = flowStore.getState()
    const pane = domNode?.getBoundingClientRect()
    // The sidebar follows the selection, so it may have just opened and narrowed the pane; the stored
    // size only catches up after the next resize notification. The live size is what counts.
    const size =
      pane && pane.width > 0
        ? { width: pane.width, height: pane.height }
        : { width: storedWidth, height: storedHeight }
    const bounds = getNodesBounds(focusRequest.nodeIds)
    const viewport = getViewportForBounds(bounds, size.width, size.height, minZoom, 1.2, 0.4)
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

  // The edge whose end is being dragged: it must not count as a duplicate of itself (moving it to another connector).
  const reconnectingId = useRef<string | null>(null)
  const isValidConnection = useCallback((connection: EdgeLike) => {
    const { nodes: current, edges: currentEdges } = graphStore.getState()
    const content = { nodes: current, edges: currentEdges }
    return reconnectingId.current === null
      ? checkConnection(content, connection.source, connection.target).ok
      : checkReconnection(content, reconnectingId.current, connection.source, connection.target).ok
  }, [])

  // The create tool adds an object where the click landed, centred on it.
  const createAt = useCallback(
    (event: { clientX: number; clientY: number }) =>
      graphStore.getState().addNodeAt(screenToFlowPosition({ x: event.clientX, y: event.clientY })),
    [screenToFlowPosition],
  )

  // The note tool does the same with a sticky note.
  const noteAt = useCallback(
    (event: { clientX: number; clientY: number }) =>
      graphStore.getState().addNoteAt(screenToFlowPosition({ x: event.clientX, y: event.clientY })),
    [screenToFlowPosition],
  )

  const onPaneClick = useCallback(
    (event: ReactMouseEvent) => {
      const state = graphStore.getState()
      if (state.tool === 'create') createAt(event)
      else if (state.tool === 'note') noteAt(event)
      else state.clearConnectSource()
    },
    [createAt, noteAt],
  )

  // With the create tool, the body of a group is free space inside it (a click on the title still
  // selects the group); any other element is only selected. The connect tool picks source and target.
  const onNodeClick = useCallback(
    (event: ReactMouseEvent, node: AppFlowNode) => {
      const state = graphStore.getState()
      if (state.tool === 'create' || state.tool === 'note') {
        const onTitle = event.target instanceof Element && event.target.closest('.group-node__header') !== null
        if (node.type === 'group' && !onTitle) (state.tool === 'create' ? createAt : noteAt)(event)
      } else {
        state.pickForConnect(node.id)
      }
    },
    [createAt, noteAt],
  )

  // Renaming by double click needs the plain select tool: the other tools use the clicks themselves.
  const nameEdit = useMemo(
    () => ({
      enabled: tool === 'select',
      onRename: (id: string, name: string) => graphStore.getState().renameElement(id, name),
    }),
    [tool],
  )

  return (
    <NodeNameEditContext value={nameEdit}>
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
        // Dropped beside a connector but on a node: connect to that node (not only to its small connectors).
        onConnectEnd={(event, state) => {
          if (state.isValid === true || !state.fromNode) return
          const target = nodeIdAtPoint(pointOfEvent(event), state.fromNode.id)
          if (target) graphStore.getState().connectToNode(state.fromNode.id, target, asSide(state.fromHandle?.id))
        }}
        isValidConnection={isValidConnection}
        // Dragging the end of a connection to another connector changes how it is drawn (or where it points to).
        edgesReconnectable={!analyzing}
        reconnectRadius={16}
        onReconnectStart={(_, edge) => {
          reconnectingId.current = edge.id
        }}
        onReconnectEnd={() => {
          reconnectingId.current = null
        }}
        onReconnect={(edge, c) =>
          graphStore.getState().reconnectEdge(edge.id, {
            source: c.source,
            target: c.target,
            sourceHandle: asSide(c.sourceHandle),
            targetHandle: asSide(c.targetHandle),
          })
        }
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
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
        // The structure is locked while analysing: no connecting (connectors are hidden too).
        nodesConnectable={!analyzing}
        className={[analyzing && 'flow--locked', (tool === 'create' || tool === 'note') && 'flow--create'].filter(Boolean).join(' ') || undefined}
        zoomOnDoubleClick={false}
        ariaLabelConfig={ariaLabels}
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
    </NodeNameEditContext>
  )
}
