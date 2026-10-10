import { describe, expect, it } from 'vitest'
import { getAbsolutePosition } from '../model/graph'
import { box, content, counterIds, edge, group } from '../test/fixtures'
import { createGraphStore } from './graphStore'

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
      expect(s().edges).toEqual([{ id: 'id-1', source: 'a', target: 'b' }])
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
