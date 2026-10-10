import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react'
import { useCallback, useEffect, useMemo } from 'react'
import { nodeTypes } from '../components/nodeTypes'
import { findDependencies } from '../model/dependency'
import { checkConnection } from '../model/graph'
import { HANDLE_SIDES, type HandleSide } from '../model/types'
import { graphStore, useGraph } from '../store/appStore'
import { toFlowEdges, toFlowNodes } from './mapping'
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

export function Canvas() {
  const nodes = useGraph((s) => s.nodes)
  const edges = useGraph((s) => s.edges)
  const selectedNodeIds = useGraph((s) => s.selectedNodeIds)
  const selectedEdgeIds = useGraph((s) => s.selectedEdgeIds)
  const connectSourceId = useGraph((s) => s.connectSourceId)
  const dropTargetId = useGraph((s) => s.dropTargetId)
  const dependencyMode = useGraph((s) => s.dependencyMode)
  const contentRevision = useGraph((s) => s.contentRevision)
  const { fitView } = useReactFlow()

  // The dependency graph follows the selection while the mode is on.
  const dependencies = useMemo(
    () =>
      dependencyMode === 'off' || selectedNodeIds.length === 0
        ? { nodeIds: NO_IDS, edgeIds: NO_IDS }
        : findDependencies({ nodes, edges }, selectedNodeIds, dependencyMode),
    [nodes, edges, selectedNodeIds, dependencyMode],
  )

  const flowNodes = useMemo(
    () =>
      toFlowNodes(nodes, {
        selectedIds: new Set(selectedNodeIds),
        connectSourceId,
        dropTargetId,
        dependencyNodeIds: dependencies.nodeIds,
        dependencyEdgeIds: dependencies.edgeIds,
      }),
    [nodes, selectedNodeIds, connectSourceId, dropTargetId, dependencies],
  )
  const flowEdges = useMemo(
    () => toFlowEdges(edges, new Set(selectedEdgeIds), dependencies.edgeIds, nodes),
    [edges, nodes, selectedEdgeIds, dependencies],
  )

  // After an import the new graph may be anywhere: bring it into view.
  useEffect(() => {
    if (contentRevision === 0) return
    const frame = requestAnimationFrame(() => void fitView({ padding: 0.2, duration: 200 }))
    return () => cancelAnimationFrame(frame)
  }, [contentRevision, fitView])

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
