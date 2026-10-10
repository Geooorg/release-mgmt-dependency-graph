import { describe, expect, it } from 'vitest'
import { contentFingerprint } from '../model/fingerprint'
import { getAbsolutePosition } from '../model/graph'
import { serializeModel, toModel } from '../model/serialize'
import { box, content, counterIds, edge, group } from '../test/fixtures'
import { createGraphStore, type GraphStore } from './graphStore'

const twoNodes = () => content([box('a', 0, 0), box('b', 300, 0)])

describe('graphStore', () => {
  describe('nodes', () => {
    it('adds a node at the position and selects only it', () => {
      const store = createGraphStore(twoNodes(), counterIds())
      store.getState().applyNodeSelection([{ id: 'a', selected: true }])
      store.getState().addNodeAt({ x: 10, y: 500 })
      const state = store.getState()
      expect(state.nodes).toHaveLength(3)
      expect(state.nodes[2]).toMatchObject({ id: 'id-1', kind: 'node', position: { x: 10, y: 500 } })
      expect(state.selectedNodeIds).toEqual(['id-1'])
    })

    it('shifts a new node away from existing elements instead of stacking on them', () => {
      const store = createGraphStore(twoNodes(), counterIds())
      store.getState().addNodeAt({ x: 10, y: 20 })
      const added = store.getState().nodes[2]
      const overlapsA =
        added.position.x < 160 && added.position.y < 56 && added.position.x + 160 > 0 && added.position.y + 56 > 0
      expect(overlapsA).toBe(false)
    })

    it('stores normalized metadata', () => {
      const store = createGraphStore(twoNodes(), counterIds())
      store.getState().saveMetadata('a', [
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
      expect(store.getState().sidebarId).toBe('a')
    })

    it('ignores openSidebar for unknown ids', () => {
      const store = createGraphStore(twoNodes())
      store.getState().openSidebar('nope')
      expect(store.getState().sidebarId).toBeNull()
    })
  })

  describe('unsaved sidebar changes', () => {
    const withEdge = () =>
      createGraphStore(content([box('a', 0, 0), box('b', 300, 0)], [edge('e', 'a', 'b')]))
    const dirtySidebar = (open: (store: GraphStore) => void = (s) => s.getState().openSidebar('a')) => {
      const store = withEdge()
      open(store)
      store.getState().setSidebarDirty(true)
      return store
    }

    it('closes and switches right away while nothing is unsaved', () => {
      const store = withEdge()
      const s = () => store.getState()
      s().openSidebar('a')
      s().openSidebar('b')
      expect(s().sidebarId).toBe('b')
      s().openEdgeSidebar('e')
      expect(s().sidebarEdgeId).toBe('e')
      s().closeSidebar()
      expect(s().sidebarEdgeId).toBeNull()
      expect(s().pendingSidebarChange).toBeNull()
    })

    it('holds back closing, keeps the sidebar and asks', () => {
      const store = dirtySidebar()
      store.getState().closeSidebar()
      expect(store.getState().sidebarId).toBe('a')
      expect(store.getState().pendingSidebarChange).toEqual({ kind: 'close' })
    })

    it('closes after confirming and forgets the unsaved state', () => {
      const store = dirtySidebar()
      store.getState().closeSidebar()
      store.getState().confirmSidebarChange()
      const s = store.getState()
      expect(s.sidebarId).toBeNull()
      expect(s.pendingSidebarChange).toBeNull()
      expect(s.sidebarDirty).toBe(false)
    })

    it('keeps everything when cancelling', () => {
      const store = dirtySidebar()
      store.getState().closeSidebar()
      store.getState().cancelSidebarChange()
      const s = store.getState()
      expect(s.sidebarId).toBe('a')
      expect(s.pendingSidebarChange).toBeNull()
      expect(s.sidebarDirty).toBe(true)
    })

    it('holds back opening another element and opens it after confirming', () => {
      const store = dirtySidebar()
      store.getState().openSidebar('b')
      expect(store.getState().sidebarId).toBe('a')
      expect(store.getState().pendingSidebarChange).toEqual({ kind: 'node', id: 'b' })
      store.getState().confirmSidebarChange()
      expect(store.getState().sidebarId).toBe('b')
      expect(store.getState().sidebarEdgeId).toBeNull()
      expect(store.getState().sidebarDirty).toBe(false)
      expect(store.getState().pendingSidebarChange).toBeNull()
    })

    it('guards the switch between element and edge sidebar in both directions', () => {
      const toEdge = dirtySidebar()
      toEdge.getState().openEdgeSidebar('e')
      expect(toEdge.getState().sidebarEdgeId).toBeNull()
      expect(toEdge.getState().pendingSidebarChange).toEqual({ kind: 'edge', id: 'e' })
      toEdge.getState().confirmSidebarChange()
      expect(toEdge.getState().sidebarEdgeId).toBe('e')
      expect(toEdge.getState().sidebarId).toBeNull()

      const toNode = dirtySidebar((s) => s.getState().openEdgeSidebar('e'))
      toNode.getState().openSidebar('a')
      expect(toNode.getState().sidebarEdgeId).toBe('e')
      toNode.getState().cancelSidebarChange()
      toNode.getState().openSidebar('a')
      toNode.getState().confirmSidebarChange()
      expect(toNode.getState().sidebarId).toBe('a')
      expect(toNode.getState().sidebarEdgeId).toBeNull()
    })

    it('does not ask when the very same element is opened again or the id is unknown', () => {
      const store = dirtySidebar()
      store.getState().openSidebar('a')
      store.getState().openSidebar('ghost')
      store.getState().openEdgeSidebar('ghost')
      expect(store.getState().pendingSidebarChange).toBeNull()
      expect(store.getState().sidebarId).toBe('a')
    })

    it('ignores a stale unsaved flag while no sidebar is open', () => {
      const store = withEdge()
      store.getState().setSidebarDirty(true)
      store.getState().openSidebar('a')
      expect(store.getState().sidebarId).toBe('a')
      expect(store.getState().pendingSidebarChange).toBeNull()
    })

    it('is UI state only: no model change and no undo step', () => {
      const store = dirtySidebar()
      const { nodes, edges, history } = store.getState()
      store.getState().closeSidebar()
      store.getState().confirmSidebarChange()
      store.getState().setSidebarDirty(true)
      expect(store.getState().nodes).toBe(nodes)
      expect(store.getState().edges).toBe(edges)
      expect(store.getState().history).toBe(history)
    })

    it('drops the question and the flag when an import replaces the model', () => {
      const store = dirtySidebar()
      store.getState().closeSidebar()
      store.getState().replaceContent(content([box('x', 0, 0)]))
      expect(store.getState().pendingSidebarChange).toBeNull()
      expect(store.getState().sidebarDirty).toBe(false)
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

    it('connect mode: pick source, then target creates the edge and stays active', () => {
      const store = createGraphStore(twoNodes(), counterIds())
      const s = () => store.getState()
      s().pickForConnect('a') // ignored while off
      expect(s().connectMode).toBe('off')
      s().toggleConnectMode()
      expect(s().connectMode).toBe('pickSource')
      s().pickForConnect('a')
      expect(s().connectMode).toBe('pickTarget')
      expect(s().connectSourceId).toBe('a')
      s().pickForConnect('b')
      expect(s().edges).toEqual([
        { id: 'id-1', source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left' },
      ])
      expect(s().connectMode).toBe('pickSource')
      expect(s().connectSourceId).toBeNull()
    })

    it('connect mode: clicking the source again cancels it; toggling leaves the mode', () => {
      const store = createGraphStore(twoNodes())
      const s = () => store.getState()
      s().toggleConnectMode()
      s().pickForConnect('a')
      s().pickForConnect('a')
      expect(s().connectMode).toBe('pickSource')
      expect(s().edges).toHaveLength(0)
      s().toggleConnectMode()
      expect(s().connectMode).toBe('off')
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
      const { nodes, selectedNodeIds, sidebarId } = store.getState()
      expect(nodes.map((n) => n.id)).toEqual(['c'])
      expect(getAbsolutePosition(nodes, 'c')).toEqual(before)
      expect(selectedNodeIds).toEqual(['c'])
      expect(sidebarId).toBeNull()
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
      expect(state.sidebarId).toBeNull()
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

  describe('edge labels', () => {
    const withEdge = () =>
      createGraphStore(content([box('a', 0, 0), box('b', 300, 0)], [edge('e', 'a', 'b')]))

    it('opens the sidebar for an edge and closes the one for a node (and vice versa)', () => {
      const store = withEdge()
      const s = () => store.getState()
      s().openSidebar('a')
      s().openEdgeSidebar('e')
      expect(s().sidebarEdgeId).toBe('e')
      expect(s().sidebarId).toBeNull()
      s().openSidebar('a')
      expect(s().sidebarId).toBe('a')
      expect(s().sidebarEdgeId).toBeNull()
      s().openEdgeSidebar('e')
      s().closeSidebar()
      expect(s().sidebarEdgeId).toBeNull()
    })

    it('ignores unknown edge ids', () => {
      const store = withEdge()
      store.getState().openEdgeSidebar('nope')
      expect(store.getState().sidebarEdgeId).toBeNull()
    })

    it('saves a trimmed label and can undo it', () => {
      const store = withEdge()
      store.getState().saveEdgeLabel('e', '  braucht  ')
      expect(store.getState().edges[0].label).toBe('braucht')
      store.getState().undo()
      expect(store.getState().edges[0].label).toBeUndefined()
    })

    it('does not record an unchanged label as an undo step', () => {
      const store = withEdge()
      store.getState().saveEdgeLabel('e', '   ')
      expect(store.getState().history.past).toHaveLength(0)
    })

    it('closes the edge sidebar when the edge is deleted or undone away', () => {
      const store = withEdge()
      const s = () => store.getState()
      s().openEdgeSidebar('e')
      s().applyEdgeSelection([{ id: 'e', selected: true }])
      s().deleteSelection()
      expect(s().sidebarEdgeId).toBeNull()

      const other = withEdge()
      other.getState().connect('b', 'a')
      const added = other.getState().edges[1].id
      other.getState().openEdgeSidebar(added)
      other.getState().undo()
      expect(other.getState().sidebarEdgeId).toBeNull()
    })

    it('closes the edge sidebar when an import replaces the model', () => {
      const store = withEdge()
      store.getState().openEdgeSidebar('e')
      store.getState().replaceContent(content([box('x', 0, 0)]))
      expect(store.getState().sidebarEdgeId).toBeNull()
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
      s(store).saveMetadata('a', [{ key: 'name', value: 'Renamed' }])
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

    it('does not record selection, sidebar or connect-mode changes', () => {
      const store = createGraphStore(twoNodes())
      s(store).applyNodeSelection([{ id: 'a', selected: true }])
      s(store).openSidebar('a')
      s(store).toggleConnectMode()
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
      expect(s(store).sidebarId).toBeNull()
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

    it('connect mode attaches the facing sides', () => {
      const store = createGraphStore(twoNodes(), counterIds())
      const s = () => store.getState()
      s().toggleConnectMode()
      s().pickForConnect('a')
      s().pickForConnect('b')
      expect(s().edges[0]).toMatchObject({ sourceHandle: 'right', targetHandle: 'left' })
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

    it('ends the connect mode when switching to analysis', () => {
      const store = createGraphStore(twoNodes())
      const s = () => store.getState()
      s().toggleConnectMode()
      s().pickForConnect('a')
      expect(s().connectMode).toBe('pickTarget')
      s().setMode('analyze')
      expect(s().connectMode).toBe('off')
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

      it('does not connect, neither directly nor in connect mode', () => {
        const { s } = analyzing(content([box('a', 0, 0), box('b', 300, 0), box('c', 600, 0)], []))
        s().connect('a', 'b')
        s().toggleConnectMode()
        expect(s().connectMode).toBe('off')
        s().pickForConnect('a')
        s().pickForConnect('b')
        expect(s().edges).toEqual([])
        expect(s().connectMode).toBe('off')
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

      it('still allows editing metadata, edge labels, the project name, status and undo', () => {
        const { s } = analyzing()
        s().saveMetadata('a', [
          { key: 'name', value: 'A' },
          { key: 'status', value: 'fertig' },
        ])
        s().saveEdgeLabel('e', 'braucht')
        expect(s().renameProject('Neu')).toBe(true)
        expect(s().nodes[0].metadata[1]).toEqual({ key: 'status', value: 'fertig' })
        expect(s().edges[0].label).toBe('braucht')
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
      s().toggleConnectMode()
      s().replaceContent(content([box('x', 0, 0)]))
      expect(s().nodes.map((n) => n.id)).toEqual(['x'])
      expect(s().selectedNodeIds).toEqual([])
      expect(s().sidebarId).toBeNull()
      expect(s().connectMode).toBe('off')
      expect(s().contentRevision).toBe(1)
    })
  })
})
