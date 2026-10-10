import { createStore, type StoreApi } from 'zustand/vanilla'
import type { ConnectMode } from '../flow/types'
import * as graph from '../model/graph'
import * as placement from '../model/placement'
import { parseModelJson } from '../model/serialize'
import type { ConnectionCheck } from '../model/graph'
import type {
  GraphContent,
  IdGenerator,
  MetadataEntry,
  ModelEdge,
  ModelNode,
  Point,
  Size,
} from '../model/types'

export interface Notice {
  kind: 'info' | 'success' | 'error'
  message: string
  details?: string[]
}

export interface Selection {
  id: string
  selected: boolean
}

export interface GraphState {
  // --- model (single source of truth, persisted) ---
  nodes: ModelNode[]
  edges: ModelEdge[]

  // --- UI state (never persisted, never triggers a save) ---
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  sidebarId: string | null
  connectMode: ConnectMode
  connectSourceId: string | null
  dropTargetId: string | null
  notice: Notice | null
  /** Bumped when the whole content is replaced (import) so the canvas can re-fit the view. */
  contentRevision: number

  addNodeAt: (position: Point) => void
  moveNode: (id: string, position: Point) => void
  resizeNode: (id: string, size: Size) => void
  saveMetadata: (id: string, entries: readonly MetadataEntry[]) => void

  applyNodeSelection: (changes: readonly Selection[]) => void
  applyEdgeSelection: (changes: readonly Selection[]) => void
  openSidebar: (id: string) => void
  closeSidebar: () => void

  connect: (source: string, target: string) => void
  toggleConnectMode: () => void
  exitConnectMode: () => void
  pickForConnect: (id: string) => void
  clearConnectSource: () => void

  groupSelection: () => void
  ungroupSelection: () => void
  deleteSelection: () => void
  updateDropTarget: (draggedIds: readonly string[]) => void
  finishDrag: (draggedIds: readonly string[]) => void

  replaceContent: (content: GraphContent) => void
  /** Parses an exported JSON document; replaces the model on success, otherwise keeps it and reports why. */
  importText: (text: string) => boolean
  notify: (notice: Notice) => void
  dismissNotice: () => void
}

const CONNECTION_MESSAGES: Record<Exclude<ConnectionCheck, { ok: true }>['reason'], string> = {
  'unknown-node': 'Das Element existiert nicht mehr.',
  self: 'Ein Element kann nicht mit sich selbst verbunden werden.',
  duplicate: 'Diese Verbindung existiert bereits.',
  hierarchy: 'Eine Gruppe kann nicht mit ihrem eigenen Inhalt verbunden werden.',
}

export type GraphStore = StoreApi<GraphState>

export function createGraphStore(
  initial: GraphContent,
  newId: IdGenerator = graph.defaultIdGenerator,
  initialNotice: Notice | null = null,
): GraphStore {
  return createStore<GraphState>()((set, get) => {
    const content = (): GraphContent => ({ nodes: get().nodes, edges: get().edges })

    /** Applies new content; keeps unchanged array references so persistence sees no false change. */
    const apply = (next: GraphContent, extra: Partial<GraphState> = {}) => {
      set({ nodes: next.nodes, edges: next.edges, ...extra })
    }

    const tryConnect = (source: string, target: string): boolean => {
      const check = graph.checkConnection(content(), source, target)
      if (!check.ok) {
        set({ notice: { kind: 'info', message: CONNECTION_MESSAGES[check.reason] } })
        return false
      }
      apply(graph.addEdge(content(), source, target, newId))
      return true
    }

    const mergeSelection = (current: string[], changes: readonly Selection[]): string[] => {
      const next = new Set(current)
      for (const { id, selected } of changes) {
        if (selected) next.add(id)
        else next.delete(id)
      }
      return [...next]
    }

    return {
      nodes: initial.nodes,
      edges: initial.edges,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      sidebarId: null,
      connectMode: 'off',
      connectSourceId: null,
      dropTargetId: null,
      notice: initialNotice,
      contentRevision: 0,

      addNodeAt: (position) => {
        const node = graph.createNode(placement.findFreePosition(get().nodes, position), newId)
        set({ nodes: [...get().nodes, node], selectedNodeIds: [node.id], selectedEdgeIds: [] })
      },
      moveNode: (id, position) => apply(graph.moveNode(content(), id, position)),
      resizeNode: (id, size) => apply(graph.resizeNode(content(), id, size)),
      saveMetadata: (id, entries) => apply(graph.updateMetadata(content(), id, entries)),

      applyNodeSelection: (changes) =>
        set({ selectedNodeIds: mergeSelection(get().selectedNodeIds, changes) }),
      applyEdgeSelection: (changes) =>
        set({ selectedEdgeIds: mergeSelection(get().selectedEdgeIds, changes) }),
      openSidebar: (id) => {
        if (get().nodes.some((node) => node.id === id)) set({ sidebarId: id })
      },
      closeSidebar: () => set({ sidebarId: null }),

      connect: (source, target) => {
        tryConnect(source, target)
      },
      toggleConnectMode: () =>
        set(
          get().connectMode === 'off'
            ? { connectMode: 'pickSource', connectSourceId: null }
            : { connectMode: 'off', connectSourceId: null },
        ),
      exitConnectMode: () => set({ connectMode: 'off', connectSourceId: null }),
      clearConnectSource: () => {
        if (get().connectMode === 'pickTarget') set({ connectMode: 'pickSource', connectSourceId: null })
      },
      pickForConnect: (id) => {
        const { connectMode, connectSourceId } = get()
        if (connectMode === 'off') return
        if (connectSourceId === null) {
          set({ connectMode: 'pickTarget', connectSourceId: id })
        } else if (connectSourceId === id) {
          set({ connectMode: 'pickSource', connectSourceId: null })
        } else {
          tryConnect(connectSourceId, id)
          set({ connectMode: 'pickSource', connectSourceId: null })
        }
      },

      groupSelection: () => {
        const { selectedNodeIds, nodes } = get()
        if (!graph.canGroup(nodes, selectedNodeIds)) return
        const result = graph.groupElements(content(), selectedNodeIds, newId)
        apply(result.content, { selectedNodeIds: [result.groupId], selectedEdgeIds: [] })
      },
      ungroupSelection: () => {
        const { selectedNodeIds, nodes } = get()
        const groupIds = new Set(
          nodes.filter((n) => n.kind === 'group' && selectedNodeIds.includes(n.id)).map((n) => n.id),
        )
        if (groupIds.size === 0) return
        const released = nodes.filter((n) => n.parentId && groupIds.has(n.parentId)).map((n) => n.id)
        let next = content()
        for (const groupId of groupIds) next = graph.ungroup(next, groupId)
        const { sidebarId } = get()
        apply(next, {
          selectedNodeIds: [...selectedNodeIds.filter((id) => !groupIds.has(id)), ...released],
          sidebarId: sidebarId && groupIds.has(sidebarId) ? null : sidebarId,
        })
      },
      deleteSelection: () => {
        const { selectedNodeIds, selectedEdgeIds, sidebarId, connectSourceId } = get()
        if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return
        const next = graph.deleteElements(content(), {
          nodeIds: selectedNodeIds,
          edgeIds: selectedEdgeIds,
        })
        const exists = (id: string | null) => id !== null && next.nodes.some((n) => n.id === id)
        const sourceGone = connectSourceId !== null && !exists(connectSourceId)
        apply(next, {
          selectedNodeIds: [],
          selectedEdgeIds: [],
          sidebarId: exists(sidebarId) ? sidebarId : null,
          connectSourceId: sourceGone ? null : connectSourceId,
          connectMode: sourceGone ? 'pickSource' : get().connectMode,
        })
      },

      updateDropTarget: (draggedIds) => {
        const { nodes } = get()
        const anchor = topLevelDragged(nodes, draggedIds)[0]
        const target = anchor ? graph.findDropTargetGroup(nodes, anchor.id) : undefined
        const accepted = anchor && !graph.wouldBreakHierarchy(content(), anchor.id, target)
        const next = anchor && accepted && target !== anchor.parentId ? (target ?? null) : null
        if (next !== get().dropTargetId) set({ dropTargetId: next })
      },
      finishDrag: (draggedIds) => {
        let next = content()
        let refused = false
        for (const node of topLevelDragged(next.nodes, draggedIds)) {
          const target = graph.findDropTargetGroup(next.nodes, node.id)
          if (target === node.parentId) continue
          if (graph.wouldBreakHierarchy(next, node.id, target)) refused = true
          else next = graph.reparent(next, node.id, target)
        }
        apply(next, {
          dropTargetId: null,
          ...(refused && {
            notice: {
              kind: 'info' as const,
              message: 'Element nicht in die Gruppe aufgenommen: Es besteht eine Verbindung zwischen beiden.',
            },
          }),
        })
      },

      replaceContent: (next) =>
        set({
          nodes: next.nodes,
          edges: next.edges,
          selectedNodeIds: [],
          selectedEdgeIds: [],
          sidebarId: null,
          connectMode: 'off',
          connectSourceId: null,
          dropTargetId: null,
          contentRevision: get().contentRevision + 1,
        }),
      importText: (text) => {
        const result = parseModelJson(text)
        if (!result.ok) {
          set({
            notice: {
              kind: 'error',
              message:
                'Import fehlgeschlagen – die Datei ist kein gültiges Modell. Das aktuelle Modell blieb unverändert.',
              details: result.errors,
            },
          })
          return false
        }
        get().replaceContent({ nodes: result.model.nodes, edges: result.model.edges })
        set({ notice: { kind: 'success', message: 'Modell importiert.' } })
        return true
      },
      notify: (notice) => set({ notice }),
      dismissNotice: () => set({ notice: null }),
    }
  })
}

/** Dragged elements that are not carried along by a dragged ancestor. */
function topLevelDragged(nodes: readonly ModelNode[], draggedIds: readonly string[]): ModelNode[] {
  const dragged = new Set(draggedIds)
  return nodes.filter(
    (node) =>
      dragged.has(node.id) && !graph.getAncestorIds(nodes, node.id).some((a) => dragged.has(a)),
  )
}
