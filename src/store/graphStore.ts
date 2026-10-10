import { createStore, type StoreApi } from 'zustand/vanilla'
import { contentFingerprint } from '../model/fingerprint'
import { copyElements, pasteElements, type ElementClipboard } from '../model/clipboard'
import * as graph from '../model/graph'
import { growGroupsToFit } from '../model/groupGrowth'
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
import { isSameTarget, sidebarTarget, type SidebarTarget } from '../model/sidebarTarget'
import {
  DEFAULT_HIGHLIGHT,
  DEFAULT_TOOL,
  DEFAULT_WORK_MODE,
  type Highlight,
  type Tool,
  type WorkMode,
} from '../model/workMode'
import type { ConnectionCheck } from '../model/graph'
import type { Status } from '../model/status'
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

/**
 * A selection change that waits for the user to decide about an invalid sidebar draft. The sidebar
 * follows the selection, so every way of switching or closing it is a new selection.
 */
export interface SidebarChange {
  nodeIds: string[]
  edgeIds: string[]
  /** Also ask the canvas to show the nodes once the change goes through. */
  focus: boolean
}

export interface GraphState {
  // --- model (single source of truth, persisted) ---
  nodes: ModelNode[]
  edges: ModelEdge[]
  /** Always set; `A-Z a-z 0-9 - _ .` only. */
  projectName: string

  // --- UI state (never persisted, never triggers a save) ---
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  /** The open sidebar form holds an invalid draft (duplicate field names) that is not in the model (reported by the form). */
  sidebarInvalid: boolean
  /** Selection change (switch or close of the sidebar) held back because of an invalid draft; asked about in a dialog. */
  pendingSidebarChange: SidebarChange | null
  /** Build mode tool (select, create, connect); always `select` while analysing. */
  tool: Tool
  /** Connect tool: the picked source, waiting for the target; null = the source is still to be picked. */
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
  /** Copied objects and groups (no connections); null = nothing copied yet. Not persisted, no undo step. */
  clipboard: ElementClipboard | null
  /** How often the current clipboard was pasted: every paste lands a bit further down and right. */
  pasteRound: number

  /** Adds an object centred on this canvas point (member of the group there, if any) and selects it. */
  addNodeAt: (center: Point) => void
  moveNode: (id: string, position: Point) => void
  resizeNode: (id: string, size: Size) => void
  /** Live sidebar edit: stores the normalized entries right away. */
  updateMetadata: (id: string, entries: readonly MetadataEntry[]) => void
  /** Sets only the name (inline editing on the canvas); one undo step. */
  renameElement: (id: string, name: string) => void
  /** Sets (or with undefined removes) the colour of every selected object and group; one undo step. */
  setSelectionColor: (color: string | undefined) => void
  /** Sets the status of an object (also in analysis mode); one undo step. */
  setStatus: (id: string, status: Status) => void
  /** Sets the reason of a blocked object (trimmed, blank removes it); no-op for other objects. Also in analysis mode. */
  setBlockReason: (id: string, reason: string) => void

  applyNodeSelection: (changes: readonly Selection[]) => void
  applyEdgeSelection: (changes: readonly Selection[]) => void
  /** Selects exactly these (existing) elements and asks the canvas to show them. UI state only. */
  focusNodes: (ids: readonly string[]) => void
  /** Brings one element into view and flashes it; selection, sidebar and model stay untouched. UI state only. */
  revealNode: (id: string) => void
  clearReveal: () => void
  /** Returns false (and changes nothing) if `name` is not a valid project name. */
  renameProject: (name: string) => boolean
  /** Selects exactly this element, which opens its sidebar (no-op with the connect tool). Asks first if the draft is invalid. */
  openSidebar: (id: string) => void
  /** Selects exactly this edge, which opens its sidebar (no-op with the connect tool). Asks first if the draft is invalid. */
  openEdgeSidebar: (id: string) => void
  /** Live sidebar edit of an edge name (the caption); one undo step per edit. */
  renameEdge: (id: string, name: string) => void
  /** Clears the selection, which closes the sidebar. Asks first (see `pendingSidebarChange`) if the draft is invalid. */
  closeSidebar: () => void
  setSidebarInvalid: (invalid: boolean) => void
  /** Carries out the held-back change and discards the invalid draft. */
  confirmSidebarChange: () => void
  /** Keeps the sidebar and its draft as they are. */
  cancelSidebarChange: () => void

  /** An existing connection was dragged to another connector or element (it keeps its id and name); one undo step. */
  reconnectEdge: (edgeId: string, ends: { source: string; target: string } & graph.EdgeHandles) => void
  /** A dragged connection was dropped on the body of `targetId`: connects with the connector it was dragged from (if any) and the facing one there. */
  connectToNode: (sourceId: string, targetId: string, sourceHandle?: HandleSide) => void
  connect: (
    source: string,
    target: string,
    sourceHandle?: HandleSide,
    targetHandle?: HandleSide,
  ) => void
  /** Switches the tool (leaving `connect` drops a picked source); only `select` is possible while analysing. */
  setTool: (tool: Tool) => void
  /** Connect tool: first click picks the source, the second connects it to the target (same element again cancels). */
  pickForConnect: (id: string) => void
  /** Connect tool: forget the picked source (click on the empty pane). */
  clearConnectSource: () => void

  /** Copies the selected objects and groups (with the content of groups, without connections). */
  copySelection: () => void
  /** Pastes the clipboard as new elements with new ids, selects them; one undo step. */
  paste: () => void
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
  /** Switching to analysis resets the tool to `select` and shows the panel; no undo step. */
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

/** Distance between a copy and the original (one grid step, as elsewhere on the canvas). */
const PASTE_STEP = 24

const CONNECTION_MESSAGES: Record<Exclude<ConnectionCheck, { ok: true }>['reason'], string> = {
  'unknown-node': 'Das Element existiert nicht mehr.',
  self: 'Ein Element kann nicht mit sich selbst verbunden werden.',
  duplicate: 'Diese Verbindung existiert bereits.',
  hierarchy: 'Eine Gruppe kann nicht mit ihrem eigenen Inhalt verbunden werden.',
}

export type GraphStore = StoreApi<GraphState>

/** What the sidebar shows right now: derived from the selection, not kept separately. */
export const selectSidebarTarget = (state: GraphState): SidebarTarget =>
  sidebarTarget(state.selectedNodeIds, state.selectedEdgeIds)

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
      const { selectedNodeIds, selectedEdgeIds, connectSourceId } = get()
      const hasNode = (id: string | null) => id !== null && next.nodes.some((n) => n.id === id)
      const sourceGone = connectSourceId !== null && !hasNode(connectSourceId)
      return {
        ...withSelection(
          selectedNodeIds.filter(hasNode),
          selectedEdgeIds.filter((id) => next.edges.some((e) => e.id === id)),
        ),
        connectSourceId: sourceGone ? null : connectSourceId,
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

    /**
     * The new selection as UI state. The sidebar follows the selection, so a changed target also
     * ends the old form: its invalid draft and any held-back change are gone.
     */
    const withSelection = (nodeIds: string[], edgeIds: string[]): Partial<GraphState> => {
      const { selectedNodeIds, selectedEdgeIds, sidebarInvalid } = get()
      const same = isSameTarget(
        sidebarTarget(selectedNodeIds, selectedEdgeIds),
        sidebarTarget(nodeIds, edgeIds),
      )
      return {
        selectedNodeIds: nodeIds,
        selectedEdgeIds: edgeIds,
        sidebarInvalid: same ? sidebarInvalid : false,
        pendingSidebarChange: null,
      }
    }

    const focusFor = (nodeIds: string[]): Partial<GraphState> => ({
      focusRequest: { id: (get().focusRequest?.id ?? 0) + 1, nodeIds },
    })

    /** An invalid draft in the open form is never dropped silently: leaving it waits for the dialog. */
    const requestSelection = (nodeIds: string[], edgeIds: string[], focus = false) => {
      const { selectedNodeIds, selectedEdgeIds, sidebarInvalid } = get()
      const current = sidebarTarget(selectedNodeIds, selectedEdgeIds)
      // The flag only counts while a form is actually shown.
      const leaving =
        sidebarInvalid &&
        (current.kind === 'node' || current.kind === 'edge') &&
        !isSameTarget(current, sidebarTarget(nodeIds, edgeIds))
      if (leaving) set({ pendingSidebarChange: { nodeIds, edgeIds, focus } })
      else set({ ...withSelection(nodeIds, edgeIds), ...(focus && focusFor(nodeIds)) })
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
      sidebarInvalid: false,
      pendingSidebarChange: null,
      tool: DEFAULT_TOOL,
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
      clipboard: null,
      pasteRound: 0,

      addNodeAt: (center) => {
        if (structureLocked()) return
        const { content: next, nodeId } = placement.addNodeAtPoint(content(), center, newId)
        apply(next)
        // Via the request: an invalid sidebar draft is still asked about before the new object takes over.
        requestSelection([nodeId], [])
      },
      moveNode: (id, position) => apply(graph.moveNode(content(), id, position)),
      resizeNode: (id, size) => apply(graph.resizeNode(content(), id, size)),
      updateMetadata: (id, entries) => apply(graph.updateMetadata(content(), id, entries)),
      renameElement: (id, name) => apply(graph.renameElement(content(), id, name)),
      setSelectionColor: (color) => apply(graph.setColor(content(), get().selectedNodeIds, color)),
      setStatus: (id, status) => apply(graph.setStatus(content(), id, status)),
      setBlockReason: (id, reason) => apply(graph.setBlockReason(content(), id, reason)),

      // The selection is frozen while connecting: clicks pick source and target there and must not
      // switch the sidebar. A change that is held back (see `requestSelection`) is extended, not replaced:
      // one click arrives as several events (deselect the old, select the new element).
      applyNodeSelection: (changes) => {
        if (get().tool === 'connect') return
        const { pendingSidebarChange: held, selectedNodeIds, selectedEdgeIds } = get()
        requestSelection(
          mergeSelection(held?.nodeIds ?? selectedNodeIds, changes),
          held?.edgeIds ?? selectedEdgeIds,
        )
      },
      applyEdgeSelection: (changes) => {
        if (get().tool === 'connect') return
        const { pendingSidebarChange: held, selectedNodeIds, selectedEdgeIds } = get()
        requestSelection(
          held?.nodeIds ?? selectedNodeIds,
          mergeSelection(held?.edgeIds ?? selectedEdgeIds, changes),
        )
      },
      focusNodes: (ids) => {
        const known = new Set(get().nodes.map((n) => n.id))
        const nodeIds = ids.filter((id) => known.has(id))
        if (nodeIds.length === 0) return
        requestSelection(nodeIds, [], true)
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
        const { nodes, tool, selectedNodeIds, selectedEdgeIds } = get()
        if (tool === 'connect' || !nodes.some((node) => node.id === id)) return
        if (isSameTarget(sidebarTarget(selectedNodeIds, selectedEdgeIds), { kind: 'node', id })) return
        requestSelection([id], [])
      },
      openEdgeSidebar: (id) => {
        const { edges, tool, selectedNodeIds, selectedEdgeIds } = get()
        if (tool === 'connect' || !edges.some((e) => e.id === id)) return
        if (isSameTarget(sidebarTarget(selectedNodeIds, selectedEdgeIds), { kind: 'edge', id })) return
        requestSelection([], [id])
      },
      renameEdge: (id, name) => apply(graph.renameEdge(content(), id, name)),
      closeSidebar: () => {
        const { selectedNodeIds, selectedEdgeIds } = get()
        if (selectedNodeIds.length + selectedEdgeIds.length > 0) requestSelection([], [])
      },
      setSidebarInvalid: (invalid) => {
        if (get().sidebarInvalid !== invalid) set({ sidebarInvalid: invalid })
      },
      confirmSidebarChange: () => {
        const change = get().pendingSidebarChange
        if (!change) return
        set({ ...withSelection(change.nodeIds, change.edgeIds), ...(change.focus && focusFor(change.nodeIds)) })
      },
      cancelSidebarChange: () => set({ pendingSidebarChange: null }),

      connect: (source, target, sourceHandle, targetHandle) => {
        if (structureLocked()) return
        tryConnect(source, target, { sourceHandle, targetHandle })
      },
      reconnectEdge: (edgeId, ends) => {
        if (structureLocked()) return
        const check = graph.checkReconnection(content(), edgeId, ends.source, ends.target)
        if (!check.ok) {
          set({ notice: { kind: 'info', message: CONNECTION_MESSAGES[check.reason] } })
          return
        }
        apply(graph.reconnectEdge(content(), edgeId, ends))
      },
      connectToNode: (sourceId, targetId, sourceHandle) => {
        if (structureLocked() || sourceId === targetId) return
        const facing = graph.pickSides(get().nodes, sourceId, targetId)
        tryConnect(sourceId, targetId, { sourceHandle: sourceHandle ?? facing.sourceHandle, targetHandle: facing.targetHandle })
      },
      setTool: (tool) => {
        if (tool !== 'select' && structureLocked()) return
        if (get().tool === tool) return
        set({ tool, connectSourceId: null })
      },
      clearConnectSource: () => {
        if (get().connectSourceId !== null) set({ connectSourceId: null })
      },
      pickForConnect: (id) => {
        const { tool, connectSourceId } = get()
        if (tool !== 'connect' || structureLocked()) return
        if (connectSourceId === null) {
          set({ connectSourceId: id })
        } else if (connectSourceId === id) {
          set({ connectSourceId: null })
        } else {
          tryConnect(connectSourceId, id, graph.pickSides(get().nodes, connectSourceId, id))
          set({ connectSourceId: null })
        }
      },

      copySelection: () => {
        const copied = copyElements(content(), get().selectedNodeIds)
        if (!copied) return
        const count = copied.entries.length
        set({
          clipboard: copied,
          pasteRound: 0,
          notice: { kind: 'success', message: `${count} ${count === 1 ? 'Element' : 'Elemente'} kopiert.` },
        })
      },
      paste: () => {
        const { clipboard, pasteRound } = get()
        if (structureLocked() || !clipboard) return
        const step = PASTE_STEP * (pasteRound + 1)
        const result = pasteElements(content(), clipboard, { x: step, y: step }, newId)
        apply(result.content, { pasteRound: pasteRound + 1 })
        requestSelection(result.rootIds, [])
      },
      groupSelection: () => {
        if (structureLocked()) return
        const { selectedNodeIds, nodes } = get()
        if (!graph.canGroup(nodes, selectedNodeIds)) return
        const result = graph.groupElements(content(), selectedNodeIds, newId)
        apply(result.content, withSelection([result.groupId], []))
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
        apply(
          next,
          withSelection([...selectedNodeIds.filter((id) => !groupIds.has(id)), ...released], get().selectedEdgeIds),
        )
      },
      deleteSelection: () => {
        if (structureLocked()) return
        const { selectedNodeIds, selectedEdgeIds } = get()
        if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return
        const next = graph.deleteElements(content(), {
          nodeIds: selectedNodeIds,
          edgeIds: selectedEdgeIds,
        })
        apply(next, { ...pruneUi(next), ...withSelection([], []) })
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
          else {
            next = graph.reparent(next, node.id, target)
            // Dropped into a group: the group grows if the element does not fit.
            if (target !== undefined) next = growGroupsToFit(next, node.id)
          }
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
                tool: DEFAULT_TOOL,
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
          ...withSelection([], []),
          tool: DEFAULT_TOOL,
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
