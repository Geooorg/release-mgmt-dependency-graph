import { createStore, type StoreApi } from 'zustand/vanilla'
import type { ConnectMode } from '../flow/types'
import { contentFingerprint } from '../model/fingerprint'
import * as graph from '../model/graph'
import {
  discardLastRecord,
  emptyHistory,
  recordHistory,
  redoHistory,
  undoHistory,
  type History,
} from '../model/history'
import * as placement from '../model/placement'
import { DEFAULT_PROJECT_NAME, isValidProjectName } from '../model/projectName'
import { parseModelJson } from '../model/serialize'
import { DEFAULT_HIGHLIGHT, DEFAULT_WORK_MODE, type Highlight, type WorkMode } from '../model/workMode'
import type { ConnectionCheck } from '../model/graph'
import type {
  GraphContent,
  HandleSide,
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

/** A sidebar change that waits for the user to decide about unsaved edits. */
export type SidebarChange = { kind: 'close' } | { kind: 'node'; id: string } | { kind: 'edge'; id: string }

export interface GraphState {
  // --- model (single source of truth, persisted) ---
  nodes: ModelNode[]
  edges: ModelEdge[]
  /** Always set; `A-Z a-z 0-9 - _ .` only. */
  projectName: string

  // --- UI state (never persisted, never triggers a save) ---
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  sidebarId: string | null
  /** Edge whose label is being edited (mutually exclusive with `sidebarId`). */
  sidebarEdgeId: string | null
  /** The open sidebar form has unsaved edits (reported by the form). */
  sidebarDirty: boolean
  /** Closing or switching the sidebar that was held back because of unsaved edits; asked about in a dialog. */
  pendingSidebarChange: SidebarChange | null
  connectMode: ConnectMode
  connectSourceId: string | null
  dropTargetId: string | null
  notice: Notice | null
  /** `build`: edit the structure; `analyze`: release analysis, structural actions are locked. */
  mode: WorkMode
  /** What the analysis mode draws in red (critical path, dependencies of the selection, nothing). */
  highlight: Highlight
  /** The release analysis panel is shown (analysis mode only; shown again on every switch to it). */
  analysisPanelVisible: boolean
  /** Fingerprint of the content at the last export or import; null = never exported. */
  exportedFingerprint: string | null
  /** Undo/redo stacks. */
  history: History
  /** A multi-event gesture (drag, resize) is running; its changes form one undo step. */
  gesture: boolean
  /** Bumped when the whole content is replaced (import) so the canvas can re-fit the view. */
  contentRevision: number
  /** Ask the canvas to select and bring elements into view; `id` makes repeated requests distinct. */
  focusRequest: { id: number; nodeIds: string[] } | null
  /** Element briefly highlighted after `revealNode`; cleared by the canvas. */
  revealedId: string | null

  addNodeAt: (position: Point) => void
  moveNode: (id: string, position: Point) => void
  resizeNode: (id: string, size: Size) => void
  saveMetadata: (id: string, entries: readonly MetadataEntry[]) => void

  applyNodeSelection: (changes: readonly Selection[]) => void
  applyEdgeSelection: (changes: readonly Selection[]) => void
  /** Selects exactly these (existing) elements and asks the canvas to show them. UI state only. */
  focusNodes: (ids: readonly string[]) => void
  /** Brings one element into view and flashes it; selection, sidebar and model stay untouched. UI state only. */
  revealNode: (id: string) => void
  clearReveal: () => void
  /** Returns false (and changes nothing) if `name` is not a valid project name. */
  renameProject: (name: string) => boolean
  openSidebar: (id: string) => void
  openEdgeSidebar: (id: string) => void
  saveEdgeLabel: (id: string, label: string) => void
  /** Asks first (see `pendingSidebarChange`) if the open form has unsaved edits. */
  closeSidebar: () => void
  setSidebarDirty: (dirty: boolean) => void
  /** Carries out the held-back change and discards the unsaved edits. */
  confirmSidebarChange: () => void
  /** Keeps the sidebar and its edits as they are. */
  cancelSidebarChange: () => void

  connect: (
    source: string,
    target: string,
    sourceHandle?: HandleSide,
    targetHandle?: HandleSide,
  ) => void
  toggleConnectMode: () => void
  exitConnectMode: () => void
  pickForConnect: (id: string) => void
  clearConnectSource: () => void

  groupSelection: () => void
  ungroupSelection: () => void
  deleteSelection: () => void
  updateDropTarget: (draggedIds: readonly string[]) => void
  finishDrag: (draggedIds: readonly string[]) => void

  undo: () => void
  redo: () => void
  /** Start/end a drag or resize: everything in between becomes one undo step. */
  beginGesture: () => void
  endGesture: () => void
  /** Switching to analysis ends the connect mode and shows the panel; no undo step. */
  setMode: (mode: WorkMode) => void
  setHighlight: (highlight: Highlight) => void
  setAnalysisPanelVisible: (visible: boolean) => void
  /** Remembers the current content as exported (called after an export). */
  markExported: () => void

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

/** UI state restored from the previous session. */
export interface InitialUi {
  mode?: WorkMode
  exportedFingerprint?: string | null
}

export function createGraphStore(
  initial: GraphContent,
  newId: IdGenerator = graph.defaultIdGenerator,
  initialNotice: Notice | null = null,
  initialUi: InitialUi = {},
): GraphStore {
  return createStore<GraphState>()((set, get) => {
    const content = (): GraphContent => ({
      nodes: get().nodes,
      edges: get().edges,
      projectName: get().projectName,
    })

    /**
     * Applies new content and records the previous state as an undo step (unless a gesture is
     * running, which recorded its start already). Keeps unchanged array references so persistence
     * sees no false change.
     */
    const apply = (next: GraphContent, extra: Partial<GraphState> = {}) => {
      const current = content()
      const renamed = next.projectName !== undefined && next.projectName !== current.projectName
      const changed = renamed || next.nodes !== current.nodes || next.edges !== current.edges
      const history =
        changed && !get().gesture ? recordHistory(get().history, current) : get().history
      set({
        nodes: next.nodes,
        edges: next.edges,
        projectName: next.projectName ?? current.projectName ?? DEFAULT_PROJECT_NAME,
        history,
        ...extra,
      })
    }

    /** UI state that references elements must not outlive them (after undo, delete, …). */
    const pruneUi = (next: GraphContent): Partial<GraphState> => {
      const { selectedNodeIds, selectedEdgeIds, sidebarId, sidebarEdgeId, connectSourceId, connectMode } =
        get()
      const hasNode = (id: string | null) => id !== null && next.nodes.some((n) => n.id === id)
      const sourceGone = connectSourceId !== null && !hasNode(connectSourceId)
      return {
        selectedNodeIds: selectedNodeIds.filter(hasNode),
        selectedEdgeIds: selectedEdgeIds.filter((id) => next.edges.some((e) => e.id === id)),
        sidebarId: hasNode(sidebarId) ? sidebarId : null,
        sidebarEdgeId: next.edges.some((e) => e.id === sidebarEdgeId) ? sidebarEdgeId : null,
        connectSourceId: sourceGone ? null : connectSourceId,
        connectMode: sourceGone && connectMode === 'pickTarget' ? 'pickSource' : connectMode,
        dropTargetId: null,
      }
    }

    const restore = (result: { history: History; content: GraphContent } | undefined) => {
      if (!result) return
      set({
        nodes: result.content.nodes,
        edges: result.content.edges,
        projectName: result.content.projectName ?? DEFAULT_PROJECT_NAME,
        history: result.history,
        gesture: false,
        ...pruneUi(result.content),
      })
    }

    /** Analysis mode protects the structure: add, connect, delete, (un)group and re-parent do nothing. */
    const structureLocked = () => get().mode === 'analyze'

    const tryConnect = (
      source: string,
      target: string,
      handles: graph.EdgeHandles = {},
    ): boolean => {
      const check = graph.checkConnection(content(), source, target)
      if (!check.ok) {
        set({ notice: { kind: 'info', message: CONNECTION_MESSAGES[check.reason] } })
        return false
      }
      apply(graph.addEdge(content(), source, target, newId, handles))
      return true
    }

    const showSidebar = (change: SidebarChange) =>
      set({
        sidebarId: change.kind === 'node' ? change.id : null,
        sidebarEdgeId: change.kind === 'edge' ? change.id : null,
        sidebarDirty: false,
        pendingSidebarChange: null,
      })

    /** Unsaved edits in the open form are never dropped silently: the change waits for the dialog. */
    const requestSidebarChange = (change: SidebarChange) => {
      const { sidebarId, sidebarEdgeId, sidebarDirty } = get()
      const open = sidebarId !== null || sidebarEdgeId !== null
      if (open && sidebarDirty) set({ pendingSidebarChange: change })
      else showSidebar(change)
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
      projectName: initial.projectName ?? DEFAULT_PROJECT_NAME,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      sidebarId: null,
      sidebarEdgeId: null,
      sidebarDirty: false,
      pendingSidebarChange: null,
      connectMode: 'off',
      connectSourceId: null,
      dropTargetId: null,
      notice: initialNotice,
      mode: initialUi.mode ?? DEFAULT_WORK_MODE,
      highlight: DEFAULT_HIGHLIGHT,
      analysisPanelVisible: true,
      exportedFingerprint: initialUi.exportedFingerprint ?? null,
      history: emptyHistory,
      gesture: false,
      contentRevision: 0,
      focusRequest: null,
      revealedId: null,

      addNodeAt: (position) => {
        if (structureLocked()) return
        const node = graph.createNode(placement.findFreePosition(get().nodes, position), newId)
        apply(
          { nodes: [...get().nodes, node], edges: get().edges },
          { selectedNodeIds: [node.id], selectedEdgeIds: [] },
        )
      },
      moveNode: (id, position) => apply(graph.moveNode(content(), id, position)),
      resizeNode: (id, size) => apply(graph.resizeNode(content(), id, size)),
      saveMetadata: (id, entries) => apply(graph.updateMetadata(content(), id, entries)),

      applyNodeSelection: (changes) =>
        set({ selectedNodeIds: mergeSelection(get().selectedNodeIds, changes) }),
      applyEdgeSelection: (changes) =>
        set({ selectedEdgeIds: mergeSelection(get().selectedEdgeIds, changes) }),
      focusNodes: (ids) => {
        const known = new Set(get().nodes.map((n) => n.id))
        const nodeIds = ids.filter((id) => known.has(id))
        if (nodeIds.length === 0) return
        set({
          selectedNodeIds: nodeIds,
          selectedEdgeIds: [],
          focusRequest: { id: (get().focusRequest?.id ?? 0) + 1, nodeIds },
        })
      },
      revealNode: (id) => {
        if (!get().nodes.some((n) => n.id === id)) return
        set({
          revealedId: id,
          focusRequest: { id: (get().focusRequest?.id ?? 0) + 1, nodeIds: [id] },
        })
      },
      clearReveal: () => {
        if (get().revealedId !== null) set({ revealedId: null })
      },
      renameProject: (name) => {
        if (!isValidProjectName(name)) return false
        apply({ ...content(), projectName: name })
        return true
      },
      openSidebar: (id) => {
        const { nodes, sidebarId } = get()
        if (!nodes.some((node) => node.id === id) || sidebarId === id) return
        requestSidebarChange({ kind: 'node', id })
      },
      openEdgeSidebar: (id) => {
        const { edges, sidebarEdgeId } = get()
        if (!edges.some((e) => e.id === id) || sidebarEdgeId === id) return
        requestSidebarChange({ kind: 'edge', id })
      },
      saveEdgeLabel: (id, label) => apply(graph.updateEdgeLabel(content(), id, label)),
      closeSidebar: () => requestSidebarChange({ kind: 'close' }),
      setSidebarDirty: (dirty) => {
        if (get().sidebarDirty !== dirty) set({ sidebarDirty: dirty })
      },
      confirmSidebarChange: () => {
        const change = get().pendingSidebarChange
        if (change) showSidebar(change)
      },
      cancelSidebarChange: () => set({ pendingSidebarChange: null }),

      connect: (source, target, sourceHandle, targetHandle) => {
        if (structureLocked()) return
        tryConnect(source, target, { sourceHandle, targetHandle })
      },
      toggleConnectMode: () => {
        if (structureLocked()) return
        set(
          get().connectMode === 'off'
            ? { connectMode: 'pickSource', connectSourceId: null }
            : { connectMode: 'off', connectSourceId: null },
        )
      },
      exitConnectMode: () => set({ connectMode: 'off', connectSourceId: null }),
      clearConnectSource: () => {
        if (get().connectMode === 'pickTarget') set({ connectMode: 'pickSource', connectSourceId: null })
      },
      pickForConnect: (id) => {
        const { connectMode, connectSourceId } = get()
        if (connectMode === 'off' || structureLocked()) return
        if (connectSourceId === null) {
          set({ connectMode: 'pickTarget', connectSourceId: id })
        } else if (connectSourceId === id) {
          set({ connectMode: 'pickSource', connectSourceId: null })
        } else {
          tryConnect(connectSourceId, id, graph.pickSides(get().nodes, connectSourceId, id))
          set({ connectMode: 'pickSource', connectSourceId: null })
        }
      },

      groupSelection: () => {
        if (structureLocked()) return
        const { selectedNodeIds, nodes } = get()
        if (!graph.canGroup(nodes, selectedNodeIds)) return
        const result = graph.groupElements(content(), selectedNodeIds, newId)
        apply(result.content, { selectedNodeIds: [result.groupId], selectedEdgeIds: [] })
      },
      ungroupSelection: () => {
        if (structureLocked()) return
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
        if (structureLocked()) return
        const { selectedNodeIds, selectedEdgeIds } = get()
        if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return
        const next = graph.deleteElements(content(), {
          nodeIds: selectedNodeIds,
          edgeIds: selectedEdgeIds,
        })
        apply(next, { ...pruneUi(next), selectedNodeIds: [], selectedEdgeIds: [] })
      },

      updateDropTarget: (draggedIds) => {
        if (structureLocked()) return
        const { nodes } = get()
        const anchor = topLevelDragged(nodes, draggedIds)[0]
        const target = anchor ? graph.findDropTargetGroup(nodes, anchor.id) : undefined
        const accepted = anchor && !graph.wouldBreakHierarchy(content(), anchor.id, target)
        const next = anchor && accepted && target !== anchor.parentId ? (target ?? null) : null
        if (next !== get().dropTargetId) set({ dropTargetId: next })
      },
      finishDrag: (draggedIds) => {
        if (structureLocked()) {
          // Moving is fine, but membership stays as it is.
          if (get().dropTargetId !== null) set({ dropTargetId: null })
          return
        }
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

      undo: () => restore(undoHistory(get().history, content())),
      redo: () => restore(redoHistory(get().history, content())),
      beginGesture: () => {
        if (get().gesture) return
        set({ history: recordHistory(get().history, content()), gesture: true })
      },
      endGesture: () => {
        if (!get().gesture) return
        const { history } = get()
        const start = history.past.at(-1)
        const unchanged = start !== undefined && sameContent(start, content())
        set({ gesture: false, history: unchanged ? discardLastRecord(history) : history })
      },
      setMode: (mode) => {
        if (get().mode === mode) return
        set(
          mode === 'analyze'
            ? {
                mode,
                analysisPanelVisible: true,
                connectMode: 'off',
                connectSourceId: null,
                dropTargetId: null,
              }
            : { mode },
        )
      },
      setHighlight: (highlight) => {
        if (get().highlight !== highlight) set({ highlight })
      },
      setAnalysisPanelVisible: (visible) => {
        if (get().analysisPanelVisible !== visible) set({ analysisPanelVisible: visible })
      },
      markExported: () => set({ exportedFingerprint: contentFingerprint(content()) }),

      replaceContent: (next) =>
        set({
          nodes: next.nodes,
          edges: next.edges,
          projectName: next.projectName ?? DEFAULT_PROJECT_NAME,
          history: recordHistory(get().history, content()),
          selectedNodeIds: [],
          selectedEdgeIds: [],
          sidebarId: null,
          sidebarEdgeId: null,
          sidebarDirty: false,
          pendingSidebarChange: null,
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
        get().replaceContent({
          nodes: result.model.nodes,
          edges: result.model.edges,
          projectName: result.model.projectName,
        })
        // The project now equals the file: nothing is lost by replacing it again.
        get().markExported()
        set({ notice: { kind: 'success', message: 'Modell importiert.' } })
        return true
      },
      notify: (notice) => set({ notice }),
      dismissNotice: () => set({ notice: null }),
    }
  })
}

/** Same model, ignoring object identity (a "move" onto the same spot is no change). */
function sameContent(a: GraphContent, b: GraphContent): boolean {
  if (a.edges !== b.edges || a.projectName !== b.projectName || a.nodes.length !== b.nodes.length) {
    return false
  }
  return a.nodes.every((n, i) => {
    const m = b.nodes[i]
    return (
      n === m ||
      (n.id === m.id &&
        n.parentId === m.parentId &&
        n.metadata === m.metadata &&
        n.position.x === m.position.x &&
        n.position.y === m.position.y &&
        n.size?.width === m.size?.width &&
        n.size?.height === m.size?.height)
    )
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
