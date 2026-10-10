import { describe, expect, it } from 'vitest'
import { contentFingerprint } from '../model/fingerprint'
import { getAbsolutePosition } from '../model/graph'
import { serializeModel, toModel } from '../model/serialize'
import { setTestLocale } from '../test/locale'
import { box, content, counterIds, edge, group } from '../test/fixtures'
import { createGraphStore, selectSidebarTarget, type GraphStore } from './graphStore'

const twoNodes = () => content([box('a', 0, 0), box('b', 300, 0)])
const withEdgeStore = () => createGraphStore(content([box('a', 0, 0), box('b', 300, 0)], [edge('e', 'a', 'b')]), counterIds())

describe('graphStore', () => {
  describe('nodes', () => {
    it('adds a node centred on the point and selects only it', () => {
      const store = createGraphStore(twoNodes(), counterIds())
      store.getState().applyNodeSelection([{ id: 'a', selected: true }])
      store.getState().addNodeAt({ x: 90, y: 528 })
      const state = store.getState()
      expect(state.nodes).toHaveLength(3)
      expect(state.nodes[2]).toMatchObject({ id: 'id-1', kind: 'node', position: { x: 10, y: 500 } })
      expect(state.selectedNodeIds).toEqual(['id-1'])
    })

    it('shifts a new node away from existing elements instead of stacking on them', () => {
      const store = createGraphStore(twoNodes(), counterIds())
      store.getState().addNodeAt({ x: 90, y: 48 })
      const added = store.getState().nodes[2]
      const overlapsA =
        added.position.x < 160 && added.position.y < 56 && added.position.x + 160 > 0 && added.position.y + 56 > 0
      expect(overlapsA).toBe(false)
    })

    it('renames one element as a single undo step and ignores no-ops', () => {
      const store = createGraphStore(twoNodes(), counterIds())
      store.getState().renameElement('a', ' Neu ')
      expect(store.getState().nodes[0].metadata[0]).toEqual({ key: 'name', value: 'Neu' })
      expect(store.getState().history.past).toHaveLength(1)

      store.getState().renameElement('a', 'Neu')
      expect(store.getState().history.past).toHaveLength(1)

      store.getState().undo()
      expect(store.getState().nodes[0].metadata[0].value).toBe('a')
    })

    it('sets one colour for the whole selection as a single undo step', () => {
      const store = createGraphStore(content([box('a', 0, 0), box('b', 300, 0), group('g', 0, 400, 300, 200)]), counterIds())
      store.getState().applyNodeSelection([
        { id: 'a', selected: true },
        { id: 'g', selected: true },
      ])
      store.getState().setSelectionColor('#ff0000')

      const colors = store.getState().nodes.map((n) => n.metadata.find((m) => m.key === 'color')?.value)
      expect(colors).toEqual(['#ff0000', undefined, '#ff0000'])
      expect(store.getState().history.past).toHaveLength(1)

      store.getState().setSelectionColor(undefined)
      expect(store.getState().nodes.every((n) => n.metadata.every((m) => m.key !== 'color'))).toBe(true)
      store.getState().undo()
      expect(store.getState().nodes[0].metadata.find((m) => m.key === 'color')?.value).toBe('#ff0000')
    })

    it('grows a group when an object is dropped into it, as part of the drop', () => {
      const store = createGraphStore(content([group('g', 0, 0, 300, 200), box('a', 200, 150)]), counterIds())
      store.getState().finishDrag(['a'])

      const state = store.getState()
      const a = state.nodes.find((n) => n.id === 'a')!
      const g = state.nodes.find((n) => n.id === 'g')!
      expect(a.parentId).toBe('g')
      expect(g.size!.width).toBeGreaterThanOrEqual(a.position.x + 160 + 24)
      expect(g.size!.height).toBeGreaterThanOrEqual(a.position.y + 56 + 24)
    })

    it('leaves the group as it is when the dropped object fits', () => {
      const store = createGraphStore(content([group('g', 0, 0, 600, 400), box('a', 100, 100)]), counterIds())
      store.getState().finishDrag(['a'])

      expect(store.getState().nodes.find((n) => n.id === 'g')!.size).toEqual({ width: 600, height: 400 })
    })

    describe('reconnecting a connection', () => {
      const withEdge = () =>
        createGraphStore(
          content([box('a', 0, 0), box('b', 400, 0), box('c', 800, 0)], [{ ...edge('e', 'a', 'b'), metadata: [{ key: 'name', value: 'x' }] }]),
          counterIds(),
        )

      it('moves it to another connector as one undo step', () => {
        const store = withEdge()
        store.getState().reconnectEdge('e', { source: 'a', target: 'b', sourceHandle: 'bottom', targetHandle: 'bottom' })

        expect(store.getState().edges[0]).toEqual({
          id: 'e', source: 'a', target: 'b', sourceHandle: 'bottom', targetHandle: 'bottom', metadata: [{ key: 'name', value: 'x' }],
        })
        expect(store.getState().history.past).toHaveLength(1)
        store.getState().undo()
        expect(store.getState().edges[0].sourceHandle).toBeUndefined()
      })

      it('explains a refused move and leaves everything as it is', () => {
        const store = createGraphStore(
          content([box('a', 0, 0), box('b', 400, 0)], [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')]),
          counterIds(),
        )
        store.getState().reconnectEdge('e2', { source: 'a', target: 'b' })

        expect(store.getState().edges[1]).toEqual(edge('e2', 'b', 'a'))
        expect(store.getState().notice?.message).toEqual({ key: 'notice.connection.duplicate' })
      })

      it('is locked while analysing', () => {
        const store = withEdge()
        store.getState().setMode('analyze')
        store.getState().reconnectEdge('e', { source: 'a', target: 'c' })

        expect(store.getState().edges[0].target).toBe('b')
      })
    })

    describe('connection dropped on a node', () => {
      const pair = () => createGraphStore(content([box('a', 0, 0), box('b', 400, 0), group('g', 0, 300, 300, 200), box('m', 24, 56, 'g')]), counterIds())

      it('connects to the node with the dragged connector and the facing one there', () => {
        const store = pair()
        store.getState().connectToNode('a', 'b', 'top')

        expect(store.getState().edges).toEqual([
          { id: 'id-1', source: 'a', target: 'b', sourceHandle: 'top', targetHandle: 'left' },
        ])
        expect(store.getState().history.past).toHaveLength(1)
      })

      it('picks the facing connector on both sides when it was not dragged from one', () => {
        const store = pair()
        store.getState().connectToNode('a', 'b')

        expect(store.getState().edges[0]).toMatchObject({ sourceHandle: 'right', targetHandle: 'left' })
      })

      it('also works with a group as the target', () => {
        const store = pair()
        store.getState().connectToNode('a', 'g')

        expect(store.getState().edges[0]).toMatchObject({ source: 'a', target: 'g' })
      })

      it('says why a rejected connection is not made, and ignores a drop on the node itself', () => {
        const store = pair()
        store.getState().connectToNode('a', 'a')
        expect(store.getState().notice).toBeNull()

        store.getState().connectToNode('g', 'm')
        expect(store.getState().edges).toEqual([])
        expect(store.getState().notice?.message).toEqual({ key: 'notice.connection.hierarchy' })

        store.getState().connectToNode('a', 'b')
        store.getState().connectToNode('a', 'b')
        expect(store.getState().edges).toHaveLength(1)
      })

      it('is locked while analysing', () => {
        const store = pair()
        store.getState().setMode('analyze')
        store.getState().connectToNode('a', 'b')

        expect(store.getState().edges).toEqual([])
      })
    })

    describe('copy and paste', () => {
      const withGroup = () =>
        createGraphStore(
          content([box('a', 0, 0), box('b', 300, 0), group('g', 0, 400, 300, 200), box('m', 24, 56, 'g')], [edge('e', 'a', 'b')]),
          counterIds(),
        )
      const select = (store: GraphStore, ...ids: string[]) =>
        store.getState().applyNodeSelection(ids.map((id) => ({ id, selected: true })))

      it('copies the selection without changing anything', () => {
        const store = withGroup()
        const before = store.getState().nodes
        select(store, 'a')
        store.getState().copySelection()

        expect(store.getState().clipboard?.entries.map((e) => e.node.id)).toEqual(['a'])
        expect(store.getState().nodes).toBe(before)
        expect(store.getState().history.past).toHaveLength(0)
        expect(store.getState().notice).toMatchObject({
          kind: 'success',
          message: { key: 'notice.copied_one', params: { count: 1 } },
        })
      })

      it('reports the number of copied elements as a plural message', () => {
        const store = withGroup()
        select(store, 'a', 'b')
        store.getState().copySelection()

        expect(store.getState().notice).toMatchObject({
          kind: 'success',
          message: { key: 'notice.copied_other', params: { count: 2 } },
        })
      })

      it('does nothing without a selection', () => {
        const store = withGroup()
        store.getState().copySelection()

        expect(store.getState().clipboard).toBeNull()
      })

      it('pastes new elements with new ids, selects them and keeps the connections as they are', () => {
        const store = withGroup()
        select(store, 'a', 'b')
        store.getState().copySelection()
        store.getState().paste()

        const state = store.getState()
        expect(state.nodes).toHaveLength(6)
        expect(state.nodes.slice(4).map((n) => n.id)).toEqual(['id-1', 'id-2'])
        expect(state.edges).toEqual([edge('e', 'a', 'b')])
        expect(state.selectedNodeIds).toEqual(['id-1', 'id-2'])
        expect(state.history.past).toHaveLength(1)

        state.undo()
        expect(store.getState().nodes).toHaveLength(4)
      })

      it('moves every further paste a bit further', () => {
        const store = withGroup()
        select(store, 'a')
        store.getState().copySelection()
        store.getState().paste()
        store.getState().paste()

        const [first, second] = store.getState().nodes.slice(4)
        expect(first.position).toEqual({ x: 24, y: 24 })
        expect(second.position).toEqual({ x: 48, y: 48 })

        // A new copy starts over: the selection is the last paste (48, 48), the next one lands one step further.
        store.getState().copySelection()
        store.getState().paste()
        expect(store.getState().nodes.at(-1)!.position).toEqual({ x: 72, y: 72 })
      })

      it('copies a group with its content, re-linked', () => {
        const store = withGroup()
        select(store, 'g')
        store.getState().copySelection()
        store.getState().paste()

        const [newGroup, newMember] = store.getState().nodes.slice(4)
        expect(newGroup.kind).toBe('group')
        expect(newMember.parentId).toBe(newGroup.id)
        expect(store.getState().selectedNodeIds).toEqual([newGroup.id])
      })

      it('is locked while analysing, copying still works', () => {
        const store = withGroup()
        select(store, 'a')
        store.getState().setMode('analyze')
        store.getState().copySelection()
        store.getState().paste()

        expect(store.getState().clipboard).not.toBeNull()
        expect(store.getState().nodes).toHaveLength(4)
      })

      it('has nothing to paste without a copy', () => {
        const store = withGroup()
        store.getState().paste()

        expect(store.getState().nodes).toHaveLength(4)
        expect(store.getState().history.past).toHaveLength(0)
      })
    })

    it('stores normalized metadata', () => {
      const store = createGraphStore(twoNodes(), counterIds())
      store.getState().updateMetadata('a', [
        { key: ' name ', value: ' Alpha ' },
        { key: '', value: 'ignored' },
        { key: 'owner', value: '' },
      ])
      expect(store.getState().nodes[0].metadata).toEqual([
        { key: 'name', value: 'Alpha' },
        { key: 'owner', value: '' },
      ])
    })

    it('keeps the edges reference when only a node moves (no false persistence trigger)', () => {
      const store = createGraphStore(content([box('a', 0, 0), box('b', 1, 1)], [edge('e', 'a', 'b')]))
      const edgesBefore = store.getState().edges
      store.getState().moveNode('a', { x: 50, y: 60 })
      expect(store.getState().nodes[0].position).toEqual({ x: 50, y: 60 })
      expect(store.getState().edges).toBe(edgesBefore)
    })
  })

  describe('selection and sidebar', () => {
    const withEdge = () =>
      createGraphStore(content([box('a', 0, 0), box('b', 300, 0)], [edge('e', 'a', 'b')]))
    const target = (store: GraphStore) => selectSidebarTarget(store.getState())

    it('adds and removes selected ids', () => {
      const store = createGraphStore(twoNodes())
      store.getState().applyNodeSelection([{ id: 'a', selected: true }, { id: 'b', selected: true }])
      store.getState().applyNodeSelection([{ id: 'a', selected: false }])
      expect(store.getState().selectedNodeIds).toEqual(['b'])
    })

    it('does not touch nodes/edges when selecting or opening the sidebar', () => {
      const store = createGraphStore(twoNodes())
      const { nodes, edges } = store.getState()
      store.getState().applyNodeSelection([{ id: 'a', selected: true }])
      store.getState().openSidebar('a')
      expect(store.getState().nodes).toBe(nodes)
      expect(store.getState().edges).toBe(edges)
      expect(target(store)).toEqual({ kind: 'node', id: 'a' })
    })

    it('follows the selection: one click shows the element, the next click switches', () => {
      const store = withEdge()
      const s = () => store.getState()
      s().applyNodeSelection([{ id: 'a', selected: true }])
      expect(target(store)).toEqual({ kind: 'node', id: 'a' })
      // React Flow reports a click on another element as deselect + select in one go.
      s().applyNodeSelection([{ id: 'a', selected: false }, { id: 'b', selected: true }])
      expect(target(store)).toEqual({ kind: 'node', id: 'b' })
      s().applyNodeSelection([{ id: 'b', selected: false }])
      s().applyEdgeSelection([{ id: 'e', selected: true }])
      expect(target(store)).toEqual({ kind: 'edge', id: 'e' })
    })

    it('several selected elements give a hint target, none closes the sidebar', () => {
      const store = withEdge()
      store.getState().applyNodeSelection([{ id: 'a', selected: true }, { id: 'b', selected: true }])
      expect(target(store)).toEqual({ kind: 'multiple', count: 2 })
      store.getState().applyEdgeSelection([{ id: 'e', selected: true }])
      expect(target(store)).toEqual({ kind: 'multiple', count: 3 })
      store.getState().applyNodeSelection([{ id: 'a', selected: false }, { id: 'b', selected: false }])
      store.getState().applyEdgeSelection([{ id: 'e', selected: false }])
      expect(target(store)).toEqual({ kind: 'none' })
    })

    it('openSidebar / openEdgeSidebar select exactly that element, exclusive of each other', () => {
      const store = withEdge()
      const s = () => store.getState()
      s().openSidebar('a')
      s().openEdgeSidebar('e')
      expect(s().selectedNodeIds).toEqual([])
      expect(s().selectedEdgeIds).toEqual(['e'])
      s().openSidebar('a')
      expect(s().selectedNodeIds).toEqual(['a'])
      expect(s().selectedEdgeIds).toEqual([])
      s().openEdgeSidebar('e')
      s().closeSidebar()
      expect(target(store)).toEqual({ kind: 'none' })
    })

    it('closing clears the whole selection', () => {
      const store = withEdge()
      store.getState().applyNodeSelection([{ id: 'a', selected: true }, { id: 'b', selected: true }])
      store.getState().closeSidebar()
      expect(store.getState().selectedNodeIds).toEqual([])
    })

    it('ignores openSidebar for unknown ids', () => {
      const store = withEdge()
      store.getState().openSidebar('nope')
      store.getState().openEdgeSidebar('nope')
      expect(target(store)).toEqual({ kind: 'none' })
    })

    it('does not touch the selection state when the same element is opened again or nothing is open', () => {
      const store = withEdge()
      store.getState().closeSidebar()
      const empty = store.getState().selectedNodeIds
      store.getState().closeSidebar()
      expect(store.getState().selectedNodeIds).toBe(empty)
      store.getState().openSidebar('a')
      const selected = store.getState().selectedNodeIds
      store.getState().openSidebar('a')
      expect(store.getState().selectedNodeIds).toBe(selected)
    })

    it('freezes the selection while connecting, so the sidebar neither opens nor switches', () => {
      const store = withEdge()
      const s = () => store.getState()
      s().openSidebar('a')
      s().setTool('connect')
      s().applyNodeSelection([{ id: 'a', selected: false }, { id: 'b', selected: true }])
      s().applyEdgeSelection([{ id: 'e', selected: true }])
      s().openSidebar('b')
      s().openEdgeSidebar('e')
      expect(target(store)).toEqual({ kind: 'node', id: 'a' })
      // The close button still works.
      s().closeSidebar()
      expect(target(store)).toEqual({ kind: 'none' })
      s().setTool('select')
      s().applyNodeSelection([{ id: 'b', selected: true }])
      expect(target(store)).toEqual({ kind: 'node', id: 'b' })
    })

    it('opens for a node that is dragged, switching from the old one in one step', () => {
      const store = withEdge()
      store.getState().openSidebar('a')
      const seen: string[] = []
      store.subscribe((state) => seen.push(selectSidebarTarget(state).kind))
      store.getState().applyNodeSelection([{ id: 'a', selected: false }, { id: 'b', selected: true }])
      expect(seen).toEqual(['node'])
    })
  })

  describe('invalid sidebar draft', () => {
    const withEdge = () =>
      createGraphStore(content([box('a', 0, 0), box('b', 300, 0)], [edge('e', 'a', 'b')]))
    const invalidSidebar = (open: (store: GraphStore) => void = (s) => s.getState().openSidebar('a')) => {
      const store = withEdge()
      open(store)
      store.getState().setSidebarInvalid(true)
      return store
    }
    const target = (store: GraphStore) => selectSidebarTarget(store.getState())

    it('closes and switches right away while the draft is valid', () => {
      const store = withEdge()
      const s = () => store.getState()
      s().openSidebar('a')
      s().openSidebar('b')
      expect(target(store)).toEqual({ kind: 'node', id: 'b' })
      s().openEdgeSidebar('e')
      s().closeSidebar()
      expect(target(store)).toEqual({ kind: 'none' })
      expect(s().pendingSidebarChange).toBeNull()
    })

    it('holds back closing, keeps the sidebar and asks', () => {
      const store = invalidSidebar()
      store.getState().closeSidebar()
      expect(target(store)).toEqual({ kind: 'node', id: 'a' })
      expect(store.getState().pendingSidebarChange).toEqual({ nodeIds: [], edgeIds: [], focus: false })
    })

    it('closes after confirming and forgets the invalid flag', () => {
      const store = invalidSidebar()
      store.getState().closeSidebar()
      store.getState().confirmSidebarChange()
      const s = store.getState()
      expect(target(store)).toEqual({ kind: 'none' })
      expect(s.pendingSidebarChange).toBeNull()
      expect(s.sidebarInvalid).toBe(false)
    })

    it('keeps everything when cancelling', () => {
      const store = invalidSidebar()
      store.getState().closeSidebar()
      store.getState().cancelSidebarChange()
      const s = store.getState()
      expect(target(store)).toEqual({ kind: 'node', id: 'a' })
      expect(s.pendingSidebarChange).toBeNull()
      expect(s.sidebarInvalid).toBe(true)
    })

    it('holds back a click on another element and shows it after confirming', () => {
      const store = invalidSidebar()
      store.getState().applyNodeSelection([{ id: 'a', selected: false }, { id: 'b', selected: true }])
      expect(target(store)).toEqual({ kind: 'node', id: 'a' })
      expect(store.getState().pendingSidebarChange).toEqual({ nodeIds: ['b'], edgeIds: [], focus: false })
      store.getState().confirmSidebarChange()
      expect(target(store)).toEqual({ kind: 'node', id: 'b' })
      expect(store.getState().sidebarInvalid).toBe(false)
      expect(store.getState().pendingSidebarChange).toBeNull()
    })

    it('collects the events of one click on an edge into one held-back change', () => {
      const store = invalidSidebar()
      // Clicking an edge: the node is deselected first, then the edge selected.
      store.getState().applyNodeSelection([{ id: 'a', selected: false }])
      store.getState().applyEdgeSelection([{ id: 'e', selected: true }])
      expect(store.getState().pendingSidebarChange).toEqual({ nodeIds: [], edgeIds: ['e'], focus: false })
      store.getState().confirmSidebarChange()
      expect(target(store)).toEqual({ kind: 'edge', id: 'e' })
    })

    it('does not ask when the selection ends up on the same element again', () => {
      const store = invalidSidebar()
      store.getState().applyNodeSelection([{ id: 'a', selected: false }])
      store.getState().applyNodeSelection([{ id: 'a', selected: true }])
      expect(store.getState().pendingSidebarChange).toBeNull()
      expect(store.getState().sidebarInvalid).toBe(true)
      expect(target(store)).toEqual({ kind: 'node', id: 'a' })
    })

    it('holds back a multi-selection and the focus request of the cycle button', () => {
      const store = invalidSidebar()
      store.getState().applyNodeSelection([{ id: 'b', selected: true }])
      expect(store.getState().pendingSidebarChange).toEqual({ nodeIds: ['a', 'b'], edgeIds: [], focus: false })
      store.getState().cancelSidebarChange()
      store.getState().focusNodes(['b'])
      expect(store.getState().focusRequest).toBeNull()
      store.getState().confirmSidebarChange()
      expect(target(store)).toEqual({ kind: 'node', id: 'b' })
      expect(store.getState().focusRequest).toEqual({ id: 1, nodeIds: ['b'] })
    })

    it('guards the switch between element and edge sidebar in both directions', () => {
      const toEdge = invalidSidebar()
      toEdge.getState().openEdgeSidebar('e')
      expect(target(toEdge)).toEqual({ kind: 'node', id: 'a' })
      toEdge.getState().confirmSidebarChange()
      expect(target(toEdge)).toEqual({ kind: 'edge', id: 'e' })

      const toNode = invalidSidebar((s) => s.getState().openEdgeSidebar('e'))
      toNode.getState().openSidebar('a')
      expect(target(toNode)).toEqual({ kind: 'edge', id: 'e' })
      toNode.getState().cancelSidebarChange()
      toNode.getState().openSidebar('a')
      toNode.getState().confirmSidebarChange()
      expect(target(toNode)).toEqual({ kind: 'node', id: 'a' })
    })

    it('does not ask when the very same element is opened again or the id is unknown', () => {
      const store = invalidSidebar()
      store.getState().openSidebar('a')
      store.getState().openSidebar('ghost')
      store.getState().openEdgeSidebar('ghost')
      expect(store.getState().pendingSidebarChange).toBeNull()
      expect(target(store)).toEqual({ kind: 'node', id: 'a' })
    })

    it('ignores a stale invalid flag while no sidebar is open', () => {
      const store = withEdge()
      store.getState().setSidebarInvalid(true)
      store.getState().openSidebar('a')
      expect(target(store)).toEqual({ kind: 'node', id: 'a' })
      expect(store.getState().pendingSidebarChange).toBeNull()
    })

    it('is UI state only: no model change and no undo step', () => {
      const store = invalidSidebar()
      const { nodes, edges, history } = store.getState()
      store.getState().closeSidebar()
      store.getState().confirmSidebarChange()
      store.getState().setSidebarInvalid(true)
      expect(store.getState().nodes).toBe(nodes)
      expect(store.getState().edges).toBe(edges)
      expect(store.getState().history).toBe(history)
    })

    it('drops the question and the flag when an import replaces the model', () => {
      const store = invalidSidebar()
      store.getState().closeSidebar()
      store.getState().replaceContent(content([box('x', 0, 0)]))
      expect(store.getState().pendingSidebarChange).toBeNull()
      expect(store.getState().sidebarInvalid).toBe(false)
    })

    it('forgets the flag when the shown element vanishes, but keeps it when something else is undone', () => {
      const vanished = invalidSidebar()
      vanished.getState().deleteSelection()
      expect(vanished.getState().sidebarInvalid).toBe(false)

      const kept = invalidSidebar()
      kept.getState().moveNode('b', { x: 1, y: 1 })
      kept.getState().undo()
      expect(target(kept)).toEqual({ kind: 'node', id: 'a' })
      expect(kept.getState().sidebarInvalid).toBe(true)
    })
  })

  describe('live sidebar edits', () => {
    const edit = (store: GraphStore, name: string) =>
      store.getState().updateMetadata('a', [{ key: 'name', value: name }])

    it('every update is an undo step of its own outside of a gesture', () => {
      const store = createGraphStore(twoNodes())
      edit(store, 'x')
      edit(store, 'xy')
      expect(store.getState().history.past).toHaveLength(2)
    })

    it('bundles the updates of one field edit into a single undo step', () => {
      const store = createGraphStore(twoNodes())
      store.getState().beginGesture()
      edit(store, 'x')
      edit(store, 'xy')
      edit(store, 'xyz')
      store.getState().endGesture()
      expect(store.getState().history.past).toHaveLength(1)
      store.getState().undo()
      expect(store.getState().nodes[0].metadata[0].value).toBe('a')
    })

    it('drops an edit that changed nothing (empty gesture)', () => {
      const store = createGraphStore(twoNodes())
      store.getState().beginGesture()
      store.getState().endGesture()
      store.getState().beginGesture()
      store.getState().renameEdge('nope', 'x')
      store.getState().endGesture()
      expect(store.getState().history.past).toHaveLength(0)
    })

    it('undo during an open edit ends it, so the next edit is a step again', () => {
      const store = createGraphStore(twoNodes())
      edit(store, 'x')
      store.getState().beginGesture()
      edit(store, 'xy')
      store.getState().undo()
      expect(store.getState().gesture).toBe(false)
      expect(store.getState().nodes[0].metadata[0].value).toBe('x')
      store.getState().redo()
      expect(store.getState().nodes[0].metadata[0].value).toBe('xy')
    })
  })

  describe('connecting', () => {
    it('adds a directed edge', () => {
      const store = createGraphStore(twoNodes(), counterIds())
      store.getState().connect('a', 'b')
      expect(store.getState().edges).toEqual([{ id: 'id-1', source: 'a', target: 'b' }])
    })

    it('rejects duplicates and tells the user', () => {
      const store = createGraphStore(content([box('a', 0, 0), box('b', 1, 1)], [edge('e', 'a', 'b')]))
      store.getState().connect('a', 'b')
      expect(store.getState().edges).toHaveLength(1)
      expect(store.getState().notice?.kind).toBe('info')
    })

    it('connect tool: pick source, then target creates the edge and stays active', () => {
      const store = createGraphStore(twoNodes(), counterIds())
      const s = () => store.getState()
      s().pickForConnect('a') // ignored with another tool
      expect(s().connectSourceId).toBeNull()
      s().setTool('connect')
      expect(s().tool).toBe('connect')
      expect(s().connectSourceId).toBeNull()
      s().pickForConnect('a')
      expect(s().connectSourceId).toBe('a')
      s().pickForConnect('b')
      expect(s().edges).toEqual([
        { id: 'id-1', source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left' },
      ])
      expect(s().tool).toBe('connect')
      expect(s().connectSourceId).toBeNull()
    })

    it('connect tool: clicking the source again or the empty pane cancels it; switching tools leaves it', () => {
      const store = createGraphStore(twoNodes())
      const s = () => store.getState()
      s().setTool('connect')
      s().pickForConnect('a')
      s().pickForConnect('a')
      expect(s().connectSourceId).toBeNull()
      expect(s().edges).toHaveLength(0)
      s().pickForConnect('a')
      s().clearConnectSource()
      expect(s().connectSourceId).toBeNull()
      s().pickForConnect('a')
      s().setTool('select')
      expect(s().tool).toBe('select')
      expect(s().connectSourceId).toBeNull()
    })
  })

  describe('grouping', () => {
    it('groups the selection and selects the new group', () => {
      const store = createGraphStore(twoNodes(), counterIds())
      store.getState().applyNodeSelection([{ id: 'a', selected: true }, { id: 'b', selected: true }])
      store.getState().groupSelection()
      const { nodes, selectedNodeIds } = store.getState()
      const created = nodes.find((n) => n.kind === 'group')!
      expect(created.id).toBe('id-1')
      expect(nodes.filter((n) => n.parentId === created.id).map((n) => n.id).sort()).toEqual(['a', 'b'])
      expect(selectedNodeIds).toEqual(['id-1'])
    })

    it('does nothing when the selection spans different parents', () => {
      const store = createGraphStore(
        content([group('g', 0, 0, 300, 200), box('in', 10, 10, 'g'), box('out', 500, 0)]),
      )
      store.getState().applyNodeSelection([{ id: 'in', selected: true }, { id: 'out', selected: true }])
      const before = store.getState().nodes
      store.getState().groupSelection()
      expect(store.getState().nodes).toBe(before)
    })

    it('ungroups: children survive on the same screen position and get selected', () => {
      const store = createGraphStore(content([group('g', 100, 100, 300, 200), box('c', 20, 30, 'g')]))
      const before = getAbsolutePosition(store.getState().nodes, 'c')
      store.getState().applyNodeSelection([{ id: 'g', selected: true }])
      store.getState().openSidebar('g')
      store.getState().ungroupSelection()
      const { nodes, selectedNodeIds } = store.getState()
      expect(nodes.map((n) => n.id)).toEqual(['c'])
      expect(getAbsolutePosition(nodes, 'c')).toEqual(before)
      expect(selectedNodeIds).toEqual(['c'])
      // The sidebar follows: the dissolved group is gone, the released child is the single selection.
      expect(selectSidebarTarget(store.getState())).toEqual({ kind: 'node', id: 'c' })
    })
  })

  describe('deleting', () => {
    it('deletes selected nodes with their edges and closes a stale sidebar', () => {
      const store = createGraphStore(content([box('a', 0, 0), box('b', 1, 1)], [edge('e', 'a', 'b')]))
      store.getState().applyNodeSelection([{ id: 'a', selected: true }])
      store.getState().openSidebar('a')
      store.getState().deleteSelection()
      const state = store.getState()
      expect(state.nodes.map((n) => n.id)).toEqual(['b'])
      expect(state.edges).toEqual([])
      expect(selectSidebarTarget(store.getState())).toEqual({ kind: 'none' })
      expect(state.selectedNodeIds).toEqual([])
    })

    it('deleting a group keeps its content', () => {
      const store = createGraphStore(content([group('g', 0, 0, 300, 200), box('c', 20, 30, 'g')]))
      store.getState().applyNodeSelection([{ id: 'g', selected: true }])
      store.getState().deleteSelection()
      expect(store.getState().nodes.map((n) => n.id)).toEqual(['c'])
      expect(store.getState().nodes[0].parentId).toBeUndefined()
    })

    it('deletes selected edges only', () => {
      const store = createGraphStore(content([box('a', 0, 0), box('b', 1, 1)], [edge('e', 'a', 'b')]))
      store.getState().applyEdgeSelection([{ id: 'e', selected: true }])
      store.getState().deleteSelection()
      expect(store.getState().nodes).toHaveLength(2)
      expect(store.getState().edges).toEqual([])
    })
  })

  describe('drag and drop into groups', () => {
    const scene = () =>
      createGraphStore(
        content([group('g', 0, 0, 300, 200), box('in', 20, 40, 'g'), box('out', 600, 50)]),
      )

    it('drops a top-level node into the group under its centre, keeping its screen position', () => {
      const store = scene()
      store.getState().moveNode('out', { x: 100, y: 80 })
      const before = getAbsolutePosition(store.getState().nodes, 'out')
      store.getState().finishDrag(['out'])
      const moved = store.getState().nodes.find((n) => n.id === 'out')!
      expect(moved.parentId).toBe('g')
      expect(getAbsolutePosition(store.getState().nodes, 'out')).toEqual(before)
    })

    it('releases a node dragged out of its group', () => {
      const store = scene()
      store.getState().moveNode('in', { x: 700, y: 40 })
      store.getState().finishDrag(['in'])
      expect(store.getState().nodes.find((n) => n.id === 'in')!.parentId).toBeUndefined()
    })

    it('leaves a node alone that stays in its group', () => {
      const store = scene()
      store.getState().moveNode('in', { x: 40, y: 60 })
      store.getState().finishDrag(['in'])
      expect(store.getState().nodes.find((n) => n.id === 'in')!.parentId).toBe('g')
    })

    it('refuses to drop an element into a group it is connected to, and says why', () => {
      const store = createGraphStore(
        content([group('g', 0, 0, 300, 200), box('out', 600, 50)], [edge('e', 'out', 'g')]),
      )
      store.getState().moveNode('out', { x: 100, y: 80 })
      store.getState().updateDropTarget(['out'])
      expect(store.getState().dropTargetId).toBeNull()
      store.getState().finishDrag(['out'])
      expect(store.getState().nodes.find((n) => n.id === 'out')!.parentId).toBeUndefined()
      expect(store.getState().notice?.kind).toBe('info')
    })

    it('highlights the prospective target group while dragging and clears it afterwards', () => {
      const store = scene()
      store.getState().moveNode('out', { x: 100, y: 80 })
      store.getState().updateDropTarget(['out'])
      expect(store.getState().dropTargetId).toBe('g')
      store.getState().finishDrag(['out'])
      expect(store.getState().dropTargetId).toBeNull()
    })

    it('does not highlight the group a node already belongs to', () => {
      const store = scene()
      store.getState().updateDropTarget(['in'])
      expect(store.getState().dropTargetId).toBeNull()
    })
  })

  describe('project name', () => {
    const named = (projectName?: string) => createGraphStore({ ...twoNodes(), projectName })

    it('defaults to "Release-Management"', () => {
      expect(named().getState().projectName).toBe('Release-Management')
    })

    it('starts with the name of the loaded content', () => {
      expect(named('Mein-Projekt').getState().projectName).toBe('Mein-Projekt')
    })

    it('renames to a valid name', () => {
      const store = named()
      expect(store.getState().renameProject('Alpha_1.0')).toBe(true)
      expect(store.getState().projectName).toBe('Alpha_1.0')
    })

    it('refuses names with other characters, or empty ones', () => {
      const store = named('Alpha')
      for (const bad of ['', 'mit Leerzeichen', 'Müller', 'a/b']) {
        expect(store.getState().renameProject(bad)).toBe(false)
      }
      expect(store.getState().projectName).toBe('Alpha')
      expect(store.getState().history.past).toHaveLength(0)
    })

    it('can be undone and redone', () => {
      const store = named('Alpha')
      store.getState().renameProject('Beta')
      store.getState().undo()
      expect(store.getState().projectName).toBe('Alpha')
      store.getState().redo()
      expect(store.getState().projectName).toBe('Beta')
    })

    it('does not record a rename to the same name', () => {
      const store = named('Alpha')
      expect(store.getState().renameProject('Alpha')).toBe(true)
      expect(store.getState().history.past).toHaveLength(0)
    })

    it('keeps the name when the graph changes and when those changes are undone', () => {
      const store = named('Alpha')
      store.getState().connect('a', 'b')
      store.getState().renameProject('Beta')
      store.getState().undo() // rename
      store.getState().undo() // edge
      expect(store.getState().edges).toEqual([])
      expect(store.getState().projectName).toBe('Alpha')
      store.getState().redo()
      store.getState().redo()
      expect(store.getState().projectName).toBe('Beta')
      expect(store.getState().edges).toHaveLength(1)
    })

    it('takes the name from an import, falls back to the default, and undoes both', () => {
      const store = named('Alpha')
      const withName = JSON.stringify({ version: 1, projectName: 'Importiert', nodes: [], edges: [] })
      const withoutName = JSON.stringify({ version: 1, nodes: [], edges: [] })
      store.getState().importText(withName)
      expect(store.getState().projectName).toBe('Importiert')
      store.getState().importText(withoutName)
      expect(store.getState().projectName).toBe('Release-Management')
      store.getState().undo()
      expect(store.getState().projectName).toBe('Importiert')
      store.getState().undo()
      expect(store.getState().projectName).toBe('Alpha')
    })

    it('rejects an import with an invalid name and keeps the current one', () => {
      const store = named('Alpha')
      const bad = JSON.stringify({ version: 1, projectName: 'mit Leerzeichen', nodes: [], edges: [] })
      expect(store.getState().importText(bad)).toBe(false)
      expect(store.getState().projectName).toBe('Alpha')
    })
  })

  describe('edge names', () => {
    const withEdge = () =>
      createGraphStore(content([box('a', 0, 0), box('b', 300, 0)], [edge('e', 'a', 'b')]))

    it('saves a trimmed name as metadata and can undo it', () => {
      const store = withEdge()
      store.getState().renameEdge('e', '  braucht  ')
      expect(store.getState().edges[0].metadata).toEqual([{ key: 'name', value: 'braucht' }])
      store.getState().undo()
      expect(store.getState().edges[0].metadata).toBeUndefined()
    })

    it('does not record an unchanged name as an undo step', () => {
      const store = withEdge()
      store.getState().renameEdge('e', '   ')
      expect(store.getState().history.past).toHaveLength(0)
    })

    it('closes the edge sidebar when the edge is deleted or undone away', () => {
      const store = withEdge()
      const s = () => store.getState()
      s().openEdgeSidebar('e')
      s().applyEdgeSelection([{ id: 'e', selected: true }])
      s().deleteSelection()
      expect(selectSidebarTarget(store.getState())).toEqual({ kind: 'none' })

      const other = withEdge()
      other.getState().connect('b', 'a')
      const added = other.getState().edges[1].id
      other.getState().openEdgeSidebar(added)
      other.getState().undo()
      expect(selectSidebarTarget(other.getState())).toEqual({ kind: 'none' })
    })

    it('closes the edge sidebar when an import replaces the model', () => {
      const store = withEdge()
      store.getState().openEdgeSidebar('e')
      store.getState().replaceContent(content([box('x', 0, 0)]))
      expect(selectSidebarTarget(store.getState())).toEqual({ kind: 'none' })
    })
  })

  describe('importText', () => {
    const valid = JSON.stringify({
      version: 1,
      nodes: [{ id: 'x', kind: 'node', position: { x: 0, y: 0 }, metadata: [{ key: ' name ', value: ' X ' }] }],
      edges: [],
    })

    it('replaces the model, resets UI state and reports success', () => {
      const store = createGraphStore(twoNodes())
      store.getState().applyNodeSelection([{ id: 'a', selected: true }])
      expect(store.getState().importText(valid)).toBe(true)
      const state = store.getState()
      expect(state.nodes.map((n) => n.id)).toEqual(['x'])
      expect(state.nodes[0].metadata).toEqual([{ key: 'name', value: 'X' }])
      expect(state.selectedNodeIds).toEqual([])
      expect(state.notice).toMatchObject({ kind: 'success' })
    })

    it('keeps the current model and lists the problems for invalid files', () => {
      const store = createGraphStore(twoNodes())
      const before = store.getState().nodes
      const bad = JSON.stringify({ version: 1, nodes: [{ id: 'g', kind: 'group', position: { x: 0, y: 0 } }], edges: [] })
      expect(store.getState().importText(bad)).toBe(false)
      expect(store.getState().nodes).toBe(before)
      expect(store.getState().notice?.kind).toBe('error')
      expect(store.getState().notice?.details?.length).toBeGreaterThan(0)
    })

    it('rejects text that is not JSON at all', () => {
      const store = createGraphStore(twoNodes())
      expect(store.getState().importText('<xml/>')).toBe(false)
      expect(store.getState().notice?.details?.[0]).toMatch(/JSON/)
    })
  })

  describe('texts in the current language', () => {
    it.each([
      ['de', 'Neues Objekt', 'Neue Gruppe'],
      ['en', 'New object', 'New group'],
      ['fr', 'Nouvel objet', 'Nouveau groupe'],
    ] as const)('names new objects and groups in %s', (locale, objectName, groupName) => {
      setTestLocale(locale)
      const store = createGraphStore(twoNodes(), counterIds())
      store.getState().addNodeAt({ x: 90, y: 528 })
      expect(store.getState().nodes[2].metadata[0].value).toBe(objectName)

      store.getState().applyNodeSelection([
        { id: 'a', selected: true },
        { id: 'b', selected: true },
      ])
      store.getState().groupSelection()
      const created = store.getState().nodes.find((n) => n.kind === 'group')
      expect(created?.metadata[0].value).toBe(groupName)
    })

    it('writes the import errors in the language of the moment', () => {
      setTestLocale('en')
      const store = createGraphStore(twoNodes())
      expect(store.getState().importText('<xml/>')).toBe(false)
      expect(store.getState().notice?.details?.[0]).toMatch(/^Not a valid JSON file: /)
      expect(store.getState().notice?.message).toEqual({ key: 'notice.import.failed' })
    })

    it('reports a successful import as a message key', () => {
      const store = createGraphStore(twoNodes())
      store.getState().importText(JSON.stringify({ version: 2, nodes: [], edges: [] }))
      expect(store.getState().notice).toEqual({ kind: 'success', message: { key: 'notice.import.done' } })
    })
  })

  describe('undo / redo', () => {
    const s = (store: ReturnType<typeof createGraphStore>) => store.getState()
    const ids = (store: ReturnType<typeof createGraphStore>) => s(store).nodes.map((n) => n.id)

    it('does nothing when there is no history', () => {
      const store = createGraphStore(twoNodes())
      const before = s(store).nodes
      s(store).undo()
      s(store).redo()
      expect(s(store).nodes).toBe(before)
    })

    it('undoes and redoes adding a node', () => {
      const store = createGraphStore(twoNodes(), counterIds())
      s(store).addNodeAt({ x: 0, y: 500 })
      s(store).undo()
      expect(ids(store)).toEqual(['a', 'b'])
      s(store).redo()
      expect(ids(store)).toEqual(['a', 'b', 'id-1'])
    })

    it('undoes connecting, metadata changes, grouping, ungrouping and deleting', () => {
      const store = createGraphStore(twoNodes(), counterIds())
      s(store).connect('a', 'b')
      s(store).updateMetadata('a', [{ key: 'name', value: 'Renamed' }])
      s(store).applyNodeSelection([{ id: 'a', selected: true }, { id: 'b', selected: true }])
      s(store).groupSelection()
      s(store).ungroupSelection() // a and b stay selected
      s(store).applyNodeSelection([{ id: 'b', selected: false }])
      s(store).deleteSelection()
      expect(ids(store)).toEqual(['b'])

      s(store).undo() // delete
      expect(ids(store).sort()).toEqual(['a', 'b'])
      s(store).undo() // ungroup -> group is back
      expect(s(store).nodes.some((n) => n.kind === 'group')).toBe(true)
      s(store).undo() // group
      expect(s(store).nodes.some((n) => n.kind === 'group')).toBe(false)
      s(store).undo() // metadata
      expect(s(store).nodes.find((n) => n.id === 'a')!.metadata[0].value).toBe('a')
      s(store).undo() // connect
      expect(s(store).edges).toEqual([])
      expect(s(store).history.past).toHaveLength(0)
    })

    it('does not record selection, sidebar or tool changes', () => {
      const store = createGraphStore(twoNodes())
      s(store).applyNodeSelection([{ id: 'a', selected: true }])
      s(store).openSidebar('a')
      s(store).setTool('connect')
      s(store).setMode('analyze')
      s(store).setHighlight('both')
      s(store).setAnalysisPanelVisible(false)
      s(store).setMode('build')
      expect(s(store).history.past).toHaveLength(0)
    })

    it('a new change after undo discards the redo stack', () => {
      const store = createGraphStore(twoNodes(), counterIds())
      s(store).addNodeAt({ x: 0, y: 500 })
      s(store).undo()
      s(store).connect('a', 'b')
      s(store).redo()
      expect(s(store).edges).toHaveLength(1)
      expect(ids(store)).toEqual(['a', 'b'])
    })

    it('bundles a drag gesture into a single undo step', () => {
      const store = createGraphStore(twoNodes())
      s(store).beginGesture()
      for (let x = 1; x <= 20; x++) s(store).moveNode('a', { x, y: x })
      s(store).endGesture()
      expect(s(store).history.past).toHaveLength(1)
      s(store).undo()
      expect(s(store).nodes.find((n) => n.id === 'a')!.position).toEqual({ x: 0, y: 0 })
    })

    it('includes the drop into a group in the same step as the drag', () => {
      const store = createGraphStore(content([group('g', 0, 0, 300, 200), box('out', 600, 50)]))
      s(store).beginGesture()
      s(store).moveNode('out', { x: 100, y: 80 })
      s(store).finishDrag(['out'])
      s(store).endGesture()
      expect(s(store).nodes.find((n) => n.id === 'out')!.parentId).toBe('g')
      s(store).undo()
      const restored = s(store).nodes.find((n) => n.id === 'out')!
      expect(restored.parentId).toBeUndefined()
      expect(restored.position).toEqual({ x: 600, y: 50 })
    })

    it('forgets gestures that changed nothing', () => {
      const store = createGraphStore(twoNodes())
      s(store).beginGesture()
      s(store).moveNode('a', { x: 0, y: 0 })
      s(store).endGesture()
      expect(s(store).history.past).toHaveLength(0)
    })

    it('records moves outside of a gesture one by one (keyboard)', () => {
      const store = createGraphStore(twoNodes())
      s(store).moveNode('a', { x: 5, y: 0 })
      s(store).moveNode('a', { x: 10, y: 0 })
      expect(s(store).history.past).toHaveLength(2)
    })

    it('tidies up UI state that points at vanished elements', () => {
      const store = createGraphStore(twoNodes(), counterIds())
      s(store).addNodeAt({ x: 0, y: 500 }) // selects id-1
      s(store).openSidebar('id-1')
      s(store).undo()
      expect(s(store).selectedNodeIds).toEqual([])
      expect(selectSidebarTarget(store.getState())).toEqual({ kind: 'none' })
    })

    it('makes an import undoable', () => {
      const store = createGraphStore(twoNodes())
      const valid = JSON.stringify({
        version: 1,
        nodes: [{ id: 'x', kind: 'node', position: { x: 0, y: 0 }, metadata: [] }],
        edges: [],
      })
      s(store).importText(valid)
      expect(ids(store)).toEqual(['x'])
      s(store).undo()
      expect(ids(store)).toEqual(['a', 'b'])
    })

    it('caps memory: history never exceeds its limit', () => {
      const store = createGraphStore(twoNodes())
      for (let i = 0; i < 150; i++) s(store).moveNode('a', { x: i + 1, y: 0 })
      expect(s(store).history.past.length).toBeLessThanOrEqual(100)
    })
  })

  describe('connectors', () => {
    it('stores the connectors of a handle-to-handle connection', () => {
      const store = createGraphStore(twoNodes(), counterIds())
      store.getState().connect('a', 'b', 'bottom', 'top')
      expect(store.getState().edges).toEqual([
        { id: 'id-1', source: 'a', target: 'b', sourceHandle: 'bottom', targetHandle: 'top' },
      ])
    })

    it('connect tool attaches the facing sides', () => {
      const store = createGraphStore(twoNodes(), counterIds())
      const s = () => store.getState()
      s().setTool('connect')
      s().pickForConnect('a')
      s().pickForConnect('b')
      expect(s().edges[0]).toMatchObject({ sourceHandle: 'right', targetHandle: 'left' })
    })
  })

  describe('tools', () => {
    it('starts with the select tool and switches between the three exclusively', () => {
      const store = createGraphStore(twoNodes())
      const s = () => store.getState()
      expect(s().tool).toBe('select')
      s().setTool('create')
      expect(s().tool).toBe('create')
      s().setTool('connect')
      expect(s().tool).toBe('connect')
      s().setTool('select')
      expect(s().tool).toBe('select')
    })

    it('drops a picked source when the tool changes and records nothing', () => {
      const store = createGraphStore(twoNodes())
      const s = () => store.getState()
      s().setTool('connect')
      s().pickForConnect('a')
      s().setTool('create')
      expect(s().connectSourceId).toBeNull()
      s().pickForConnect('b')
      expect(s().connectSourceId).toBeNull()
      expect(s().history.past).toHaveLength(0)
    })

    it('keeps the selection free with the create tool', () => {
      const store = withEdgeStore()
      const s = () => store.getState()
      s().setTool('create')
      s().applyNodeSelection([{ id: 'a', selected: true }])
      expect(selectSidebarTarget(store.getState())).toEqual({ kind: 'node', id: 'a' })
      s().openSidebar('b')
      expect(selectSidebarTarget(store.getState())).toEqual({ kind: 'node', id: 'b' })
    })

    it('creates an object in the deepest group at the point, with a relative position, and selects it', () => {
      const store = createGraphStore(content([group('g', 100, 200, 600, 400)]), counterIds())
      store.getState().setTool('create')
      store.getState().addNodeAt({ x: 400, y: 400 })
      const added = store.getState().nodes.find((n) => n.id === 'id-1')!
      expect(added.parentId).toBe('g')
      expect(getAbsolutePosition(store.getState().nodes, 'id-1')).toEqual({ x: 320, y: 372 })
      expect(store.getState().selectedNodeIds).toEqual(['id-1'])
      expect(store.getState().tool).toBe('create')
    })

    it('asks before an invalid sidebar draft is dropped for the new object', () => {
      const store = withEdgeStore()
      const s = () => store.getState()
      s().openSidebar('a')
      s().setSidebarInvalid(true)
      s().addNodeAt({ x: 900, y: 500 })
      expect(s().nodes).toHaveLength(3)
      expect(s().selectedNodeIds).toEqual(['a'])
      expect(s().pendingSidebarChange).toMatchObject({ nodeIds: ['id-1'] })
      s().confirmSidebarChange()
      expect(s().selectedNodeIds).toEqual(['id-1'])
    })
  })

  describe('status', () => {
    it('sets the status as one undo step, also while analysing', () => {
      const store = createGraphStore(twoNodes(), counterIds(), null, { mode: 'analyze' })
      const s = () => store.getState()
      s().setStatus('a', 'fertig')
      expect(s().nodes[0].metadata).toEqual([
        { key: 'name', value: 'a' },
        { key: 'status', value: 'fertig' },
      ])
      expect(s().history.past).toHaveLength(1)
      s().setStatus('a', 'fertig')
      expect(s().history.past).toHaveLength(1)
      s().undo()
      expect(s().nodes[0].metadata).toEqual([{ key: 'name', value: 'a' }])
    })

    it('blocks with a reason and removes the reason with the next status in a single undo step', () => {
      const store = createGraphStore(twoNodes(), counterIds(), null, { mode: 'analyze' })
      const s = () => store.getState()
      s().setBlockReason('a', 'ignored: not blocked yet')
      expect(s().history.past).toHaveLength(0)
      s().setStatus('a', 'blockiert')
      s().setBlockReason('a', ' Freigabe fehlt ')
      expect(s().nodes[0].metadata).toEqual([
        { key: 'name', value: 'a' },
        { key: 'status', value: 'blockiert' },
        { key: 'blockiert_grund', value: 'Freigabe fehlt' },
      ])
      expect(s().history.past).toHaveLength(2)
      s().setStatus('a', 'in Arbeit')
      expect(s().nodes[0].metadata).toEqual([
        { key: 'name', value: 'a' },
        { key: 'status', value: 'in Arbeit' },
      ])
      expect(s().history.past).toHaveLength(3)
      s().undo()
      expect(s().nodes[0].metadata).toEqual([
        { key: 'name', value: 'a' },
        { key: 'status', value: 'blockiert' },
        { key: 'blockiert_grund', value: 'Freigabe fehlt' },
      ])
    })

    it('bundles typing a reason into one undo step with a gesture', () => {
      const store = createGraphStore(twoNodes(), counterIds())
      const s = () => store.getState()
      s().setStatus('a', 'blockiert')
      s().beginGesture()
      s().setBlockReason('a', 'F')
      s().setBlockReason('a', 'Fr')
      s().setBlockReason('a', 'Fre')
      s().endGesture()
      expect(s().history.past).toHaveLength(2)
      s().undo()
      expect(s().nodes[0].metadata).toEqual([
        { key: 'name', value: 'a' },
        { key: 'status', value: 'blockiert' },
      ])
    })
  })

  describe('work mode', () => {
    const analyzing = (initial = content([box('a', 0, 0), box('b', 300, 0)], [edge('e', 'a', 'b')])) => {
      const store = createGraphStore(initial, counterIds(), null, { mode: 'analyze' })
      return { store, s: () => store.getState() }
    }

    it('starts in build mode with the critical path highlight and a visible panel', () => {
      const state = createGraphStore(twoNodes()).getState()
      expect(state.mode).toBe('build')
      expect(state.highlight).toBe('critical')
      expect(state.analysisPanelVisible).toBe(true)
    })

    it('can start in the remembered mode', () => {
      expect(createGraphStore(twoNodes(), undefined, null, { mode: 'analyze' }).getState().mode).toBe('analyze')
    })

    it('switches without touching model, history or selection', () => {
      const store = createGraphStore(twoNodes())
      const s = () => store.getState()
      s().applyNodeSelection([{ id: 'a', selected: true }])
      const { nodes, edges, history } = s()
      s().setMode('analyze')
      expect(s().mode).toBe('analyze')
      s().setMode('build')
      expect(s().mode).toBe('build')
      expect(s().nodes).toBe(nodes)
      expect(s().edges).toBe(edges)
      expect(s().history).toBe(history)
      expect(s().selectedNodeIds).toEqual(['a'])
    })

    it('goes back to the select tool when switching to analysis', () => {
      const store = createGraphStore(twoNodes())
      const s = () => store.getState()
      s().setTool('connect')
      s().pickForConnect('a')
      expect(s().connectSourceId).toBe('a')
      s().setMode('analyze')
      expect(s().tool).toBe('select')
      expect(s().connectSourceId).toBeNull()
    })

    it('shows the panel again on every switch to analysis', () => {
      const store = createGraphStore(twoNodes())
      const s = () => store.getState()
      s().setMode('analyze')
      s().setAnalysisPanelVisible(false)
      expect(s().analysisPanelVisible).toBe(false)
      s().setMode('build')
      s().setMode('analyze')
      expect(s().analysisPanelVisible).toBe(true)
    })

    it('keeps the highlight choice across mode switches', () => {
      const store = createGraphStore(twoNodes())
      store.getState().setHighlight('incoming')
      store.getState().setMode('analyze')
      store.getState().setMode('build')
      expect(store.getState().highlight).toBe('incoming')
    })

    describe('in analysis mode the structure is protected', () => {
      it('does not add objects', () => {
        const { store, s } = analyzing()
        s().addNodeAt({ x: 0, y: 400 })
        expect(s().nodes).toHaveLength(2)
        expect(store.getState().history.past).toHaveLength(0)
      })

      it('does not connect, neither directly nor with the connect tool', () => {
        const { s } = analyzing(content([box('a', 0, 0), box('b', 300, 0), box('c', 600, 0)], []))
        s().connect('a', 'b')
        s().setTool('connect')
        expect(s().tool).toBe('select')
        s().setTool('create')
        expect(s().tool).toBe('select')
        s().pickForConnect('a')
        s().pickForConnect('b')
        expect(s().edges).toEqual([])
        expect(s().tool).toBe('select')
      })

      it('does not delete, group or ungroup', () => {
        const { s } = analyzing(
          content([box('a', 0, 0), box('b', 300, 0), group('g', 0, 200, 300, 200)], [edge('e', 'a', 'b')]),
        )
        s().applyNodeSelection([
          { id: 'a', selected: true },
          { id: 'b', selected: true },
          { id: 'g', selected: true },
        ])
        s().applyEdgeSelection([{ id: 'e', selected: true }])
        const { nodes, edges, history } = s()
        s().deleteSelection()
        s().groupSelection()
        s().ungroupSelection()
        expect(s().nodes).toBe(nodes)
        expect(s().edges).toBe(edges)
        expect(s().history).toBe(history)
        expect(s().selectedNodeIds).toEqual(['a', 'b', 'g'])
      })

      it('moves elements but never re-parents them and shows no drop target', () => {
        const { s } = analyzing(content([group('g', 0, 0, 400, 300), box('a', 500, 50), box('c', 20, 40, 'g')]))
        s().beginGesture()
        s().moveNode('a', { x: 100, y: 100 }) // dropped inside g
        s().moveNode('c', { x: 900, y: 900 }) // dragged out of g
        s().updateDropTarget(['a'])
        expect(s().dropTargetId).toBeNull()
        s().finishDrag(['a', 'c'])
        s().endGesture()
        const byId = (id: string) => s().nodes.find((n) => n.id === id)!
        expect(byId('a').parentId).toBeUndefined()
        expect(byId('a').position).toEqual({ x: 100, y: 100 })
        expect(byId('c').parentId).toBe('g')
        expect(s().history.past).toHaveLength(1)
      })

      it('still allows editing metadata, edge names, the project name, status and undo', () => {
        const { s } = analyzing()
        s().updateMetadata('a', [
          { key: 'name', value: 'A' },
          { key: 'status', value: 'fertig' },
        ])
        s().renameEdge('e', 'braucht')
        expect(s().renameProject('Neu')).toBe(true)
        expect(s().nodes[0].metadata[1]).toEqual({ key: 'status', value: 'fertig' })
        expect(s().edges[0].metadata?.[0].value).toBe('braucht')
        s().undo()
        expect(s().projectName).toBe('Release-Management')
      })

      it('still allows replacing the content by an import', () => {
        const { s } = analyzing()
        s().replaceContent(content([box('x', 0, 0)]))
        expect(s().nodes.map((n) => n.id)).toEqual(['x'])
      })

      it('works as before after switching back to build', () => {
        const { s } = analyzing()
        s().setMode('build')
        s().addNodeAt({ x: 0, y: 400 })
        expect(s().nodes).toHaveLength(3)
      })
    })
  })

  describe('analysis highlight and panel', () => {
    it('are plain UI state and do not touch model or history', () => {
      const store = createGraphStore(twoNodes())
      const { nodes, edges, history } = store.getState()
      store.getState().setMode('analyze')
      store.getState().setHighlight('off')
      store.getState().setAnalysisPanelVisible(false)
      expect(store.getState().highlight).toBe('off')
      expect(store.getState().analysisPanelVisible).toBe(false)
      expect(store.getState().nodes).toBe(nodes)
      expect(store.getState().edges).toBe(edges)
      expect(store.getState().history).toBe(history)
    })
  })

  describe('export fingerprint', () => {
    it('is unknown at first and can be restored from the previous session', () => {
      expect(createGraphStore(twoNodes()).getState().exportedFingerprint).toBeNull()
      expect(
        createGraphStore(twoNodes(), undefined, null, { exportedFingerprint: 'abc' }).getState()
          .exportedFingerprint,
      ).toBe('abc')
    })

    it('markExported remembers the current content; editing and undoing change the comparison', () => {
      const store = createGraphStore(twoNodes(), counterIds())
      const s = () => store.getState()
      s().markExported()
      expect(s().exportedFingerprint).toBe(
        contentFingerprint({ nodes: s().nodes, edges: s().edges, projectName: s().projectName }),
      )
      s().moveNode('a', { x: 5, y: 5 })
      expect(contentFingerprint({ nodes: s().nodes, edges: s().edges, projectName: s().projectName })).not.toBe(
        s().exportedFingerprint,
      )
      s().undo()
      expect(contentFingerprint({ nodes: s().nodes, edges: s().edges, projectName: s().projectName })).toBe(
        s().exportedFingerprint,
      )
    })

    it('is set after a successful import, not after a failed one', () => {
      const store = createGraphStore(twoNodes())
      const s = () => store.getState()
      expect(s().importText('not json')).toBe(false)
      expect(s().exportedFingerprint).toBeNull()

      const exported = serializeModel(toModel(content([box('x', 0, 0)], [])))
      expect(s().importText(exported)).toBe(true)
      expect(s().exportedFingerprint).toBe(
        contentFingerprint({ nodes: s().nodes, edges: s().edges, projectName: s().projectName }),
      )
    })
  })

  describe('revealNode', () => {
    it('requests a view focus and a flash but keeps the selection', () => {
      const store = createGraphStore(twoNodes())
      const s = () => store.getState()
      s().applyNodeSelection([{ id: 'a', selected: true }])
      const { nodes, history } = s()

      s().revealNode('b')
      expect(s().selectedNodeIds).toEqual(['a'])
      expect(s().focusRequest).toEqual({ id: 1, nodeIds: ['b'] })
      expect(s().revealedId).toBe('b')
      expect(s().nodes).toBe(nodes)
      expect(s().history).toBe(history)

      s().clearReveal()
      expect(s().revealedId).toBeNull()
    })

    it('ignores unknown elements', () => {
      const store = createGraphStore(twoNodes())
      store.getState().revealNode('ghost')
      expect(store.getState().focusRequest).toBeNull()
      expect(store.getState().revealedId).toBeNull()
    })
  })

  describe('focusNodes', () => {
    it('selects exactly the given elements and requests a view focus without touching the model or history', () => {
      const store = createGraphStore(content([box('a', 0, 0), box('b', 1, 1), box('c', 2, 2)], [edge('e', 'a', 'b')]))
      const s = () => store.getState()
      s().applyNodeSelection([{ id: 'c', selected: true }])
      s().applyEdgeSelection([{ id: 'e', selected: true }])
      const { nodes, edges, history } = s()

      s().focusNodes(['a', 'b', 'ghost'])
      expect(s().selectedNodeIds).toEqual(['a', 'b'])
      expect(s().selectedEdgeIds).toEqual([])
      expect(s().focusRequest).toEqual({ id: 1, nodeIds: ['a', 'b'] })
      expect(s().nodes).toBe(nodes)
      expect(s().edges).toBe(edges)
      expect(s().history).toBe(history)

      s().focusNodes(['a', 'b'])
      expect(s().focusRequest?.id).toBe(2)
    })

    it('ignores a request without existing elements', () => {
      const store = createGraphStore(twoNodes())
      store.getState().focusNodes(['ghost'])
      expect(store.getState().focusRequest).toBeNull()
    })
  })

  describe('replaceContent', () => {
    it('swaps the model, resets UI state and bumps the revision', () => {
      const store = createGraphStore(twoNodes())
      const s = () => store.getState()
      s().applyNodeSelection([{ id: 'a', selected: true }])
      s().openSidebar('a')
      s().setTool('create')
      s().replaceContent(content([box('x', 0, 0)]))
      expect(s().nodes.map((n) => n.id)).toEqual(['x'])
      expect(s().selectedNodeIds).toEqual([])
      expect(selectSidebarTarget(store.getState())).toEqual({ kind: 'none' })
      expect(s().tool).toBe('select')
      expect(s().contentRevision).toBe(1)
    })
  })
})
