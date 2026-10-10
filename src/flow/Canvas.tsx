import {
  Background,
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
import { checkConnection } from '../model/graph'
import { graphStore, useGraph } from '../store/appStore'
import { toFlowEdges, toFlowNodes } from './mapping'
import type { AppFlowNode } from './types'

type EdgeLike = Edge | Connection

export function Canvas() {
  const nodes = useGraph((s) => s.nodes)
  const edges = useGraph((s) => s.edges)
  const selectedNodeIds = useGraph((s) => s.selectedNodeIds)
  const selectedEdgeIds = useGraph((s) => s.selectedEdgeIds)
  const connectSourceId = useGraph((s) => s.connectSourceId)
  const dropTargetId = useGraph((s) => s.dropTargetId)
  const contentRevision = useGraph((s) => s.contentRevision)
  const { fitView } = useReactFlow()

  const flowNodes = useMemo(
    () => toFlowNodes(nodes, { selectedIds: new Set(selectedNodeIds), connectSourceId, dropTargetId }),
    [nodes, selectedNodeIds, connectSourceId, dropTargetId],
  )
  const flowEdges = useMemo(
    () => toFlowEdges(edges, new Set(selectedEdgeIds)),
    [edges, selectedEdgeIds],
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
    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        state.moveNode(change.id, change.position)
      } else if (change.type === 'dimensions' && change.setAttributes && change.dimensions) {
        state.resizeNode(change.id, change.dimensions)
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
      onConnect={(c: Connection) => graphStore.getState().connect(c.source, c.target)}
      isValidConnection={isValidConnection}
      onNodeClick={(_, node) => graphStore.getState().pickForConnect(node.id)}
      onPaneClick={() => graphStore.getState().clearConnectSource()}
      onNodeDoubleClick={(_, node) => graphStore.getState().openSidebar(node.id)}
      onNodeDrag={(_, __, dragged) =>
        graphStore.getState().updateDropTarget(dragged.map((n) => n.id))
      }
      onNodeDragStop={(_, __, dragged) =>
        graphStore.getState().finishDrag(dragged.map((n) => n.id))
      }
      deleteKeyCode={null}
      zoomOnDoubleClick={false}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.2}
      maxZoom={2}
    >
      <Background gap={20} />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable nodeColor="#2563eb" />
    </ReactFlow>
  )
}
