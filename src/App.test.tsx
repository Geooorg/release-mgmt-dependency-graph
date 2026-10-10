import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createDefaultContent } from './model/defaultModel'
import { contentFingerprint } from './model/fingerprint'
import { emptyHistory } from './model/history'
import { serializeModel, toModel } from './model/serialize'
import { downloadTextFile, pickTextFile } from './storage/fileIO'
import { EXPORT_FINGERPRINT_KEY, UI_KEY } from './storage/uiPreferences'
import { graphStore } from './store/appStore'

vi.mock('./storage/fileIO', () => ({
  downloadTextFile: vi.fn(),
  pickTextFile: vi.fn(() => Promise.resolve(null)),
}))

// React Flow needs a few browser APIs jsdom does not provide.
beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  class DOMMatrixReadOnlyStub {
    m22 = 1
  }
  globalThis.ResizeObserver = ResizeObserverStub
  globalThis.DOMMatrixReadOnly = DOMMatrixReadOnlyStub as unknown as typeof DOMMatrixReadOnly
})

beforeEach(() => {
  vi.mocked(downloadTextFile).mockReset()
  vi.mocked(pickTextFile).mockReset().mockResolvedValue(null)
  act(() => {
    graphStore.getState().setTool('select')
    graphStore.getState().replaceContent(createDefaultContent())
    graphStore.setState({ history: emptyHistory, gesture: false, sidebarInvalid: false, pendingSidebarChange: null })
    graphStore.getState().setMode('build')
    graphStore.getState().setHighlight('critical')
    graphStore.getState().setAnalysisPanelVisible(true)
  })
})

const select = (...ids: string[]) =>
  act(() => graphStore.getState().applyNodeSelection(ids.map((id) => ({ id, selected: true }))))
const open = (id: string) => act(() => graphStore.getState().openSidebar(id))
const dialog = () => screen.queryByRole('dialog', { name: 'Änderungen verwerfen' })
const sidebar = () => screen.queryByRole('complementary', { name: 'Metadaten' })
const nameOf = (index: number) => graphStore.getState().nodes[index].metadata[0].value

describe('App: the sidebar follows the selection', () => {
  it('is closed without a selection and shows the selected element', () => {
    render(<App />)
    const [first, second] = graphStore.getState().nodes
    expect(sidebar()).toBeNull()

    select(first.id)
    expect(screen.getByLabelText('Name')).toHaveValue('Projekt A')

    // A click on another element: deselect the old one, select the new one.
    act(() =>
      graphStore.getState().applyNodeSelection([
        { id: first.id, selected: false },
        { id: second.id, selected: true },
      ]),
    )
    expect(screen.getByLabelText('Name')).toHaveValue('Projekt B')
    expect(screen.getByLabelText('UUID')).toHaveValue(second.id)
  })

  it('shows a hint for several selected elements and closes when the selection is cleared', () => {
    render(<App />)
    const [first, second] = graphStore.getState().nodes

    select(first.id, second.id)
    expect(screen.getByText('2 Elemente markiert – zum Bearbeiten genau eines auswählen.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Name')).toBeNull()

    act(() =>
      graphStore.getState().applyNodeSelection([
        { id: first.id, selected: false },
        { id: second.id, selected: false },
      ]),
    )
    expect(sidebar()).toBeNull()
  })

  it('shows an edge with its label field when only the edge is selected', () => {
    render(<App />)
    const [edge] = graphStore.getState().edges

    act(() => graphStore.getState().applyEdgeSelection([{ id: edge.id, selected: true }]))

    expect(screen.getByRole('heading', { name: 'Verbindung' })).toBeInTheDocument()
    expect(screen.getByLabelText('UUID')).toHaveValue(edge.id)
  })

  it('works in the analysis mode too', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Analysieren' }))

    select(graphStore.getState().nodes[0].id)

    expect(screen.getByLabelText('Name')).toHaveValue('Projekt A')
  })

  it('does not open or switch while connecting', async () => {
    render(<App />)
    const [first, second] = graphStore.getState().nodes
    select(first.id)
    await userEvent.click(screen.getByRole('button', { name: 'Verbinden' }))

    act(() =>
      graphStore.getState().applyNodeSelection([
        { id: first.id, selected: false },
        { id: second.id, selected: true },
      ]),
    )
    open(second.id)

    expect(screen.getByLabelText('Name')).toHaveValue('Projekt A')
  })

  it('the close button closes the sidebar and clears the selection', async () => {
    render(<App />)
    const [first] = graphStore.getState().nodes
    select(first.id)

    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))

    expect(sidebar()).toBeNull()
    expect(graphStore.getState().selectedNodeIds).toEqual([])
  })

  it('Esc clears the selection and with it the sidebar, after connect mode and panel', async () => {
    render(<App />)
    select(graphStore.getState().nodes[0].id)

    await userEvent.keyboard('{Escape}')

    expect(sidebar()).toBeNull()
  })

  it('Esc inside a field does not close the sidebar', async () => {
    render(<App />)
    select(graphStore.getState().nodes[0].id)
    await userEvent.click(screen.getByLabelText('Name'))

    await userEvent.keyboard('{Escape}')

    expect(sidebar()).not.toBeNull()
  })

  it('closes when the shown element disappears (delete, undo) and keeps the sidebar consistent after import', async () => {
    render(<App />)
    const [first] = graphStore.getState().nodes
    select(first.id)
    act(() => graphStore.getState().deleteSelection())
    expect(sidebar()).toBeNull()

    act(() => graphStore.getState().addNodeAt({ x: 0, y: 600 }))
    expect(screen.getByLabelText('Name')).toHaveValue('Neues Objekt')
    act(() => graphStore.getState().undo())
    expect(sidebar()).toBeNull()

    select(graphStore.getState().nodes[0].id)
    act(() => graphStore.getState().replaceContent(createDefaultContent()))
    expect(sidebar()).toBeNull()
  })

  it('a double click (openSidebar) still works and is a no-op for the element that is shown already', () => {
    render(<App />)
    const [first] = graphStore.getState().nodes
    select(first.id)
    const selection = graphStore.getState().selectedNodeIds

    open(first.id)

    expect(graphStore.getState().selectedNodeIds).toBe(selection)
    expect(screen.getByLabelText('Name')).toHaveValue('Projekt A')
  })
})

describe('App: changes are applied at once', () => {
  it('shows a typed name in the model immediately, without any Save', async () => {
    render(<App />)
    select(graphStore.getState().nodes[0].id)

    await userEvent.type(screen.getByLabelText('Name'), '2')

    expect(nameOf(0)).toBe('Projekt A2')
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('keeps typed trailing spaces in the field while the model holds the trimmed name', async () => {
    render(<App />)
    select(graphStore.getState().nodes[0].id)

    await userEvent.type(screen.getByLabelText('Name'), ' Neu  ')

    expect(screen.getByLabelText('Name')).toHaveValue('Projekt A Neu  ')
    expect(nameOf(0)).toBe('Projekt A Neu')
  })

  it('keeps a new row with a still empty key, then stores it once it has a key', async () => {
    render(<App />)
    select(graphStore.getState().nodes[0].id)

    await userEvent.click(screen.getByRole('button', { name: 'Feld hinzufügen' }))
    expect(screen.getAllByLabelText('Feldname')).toHaveLength(1)
    expect(graphStore.getState().nodes[0].metadata).toHaveLength(1)

    await userEvent.type(screen.getByLabelText('Wert'), 'v')
    await userEvent.type(screen.getByLabelText('Feldname'), 'owner')

    expect(screen.getByLabelText('Feldname')).toHaveValue('owner')
    expect(graphStore.getState().nodes[0].metadata).toContainEqual({ key: 'owner', value: 'v' })
  })

  it('applies the status choice and the edge name at once', async () => {
    render(<App />)
    select(graphStore.getState().nodes[0].id)
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'fertig')
    expect(graphStore.getState().nodes[0].metadata).toContainEqual({ key: 'status', value: 'fertig' })

    const [edge] = graphStore.getState().edges
    act(() => graphStore.getState().openEdgeSidebar(edge.id))
    await userEvent.type(screen.getByLabelText('Name'), ' braucht ')
    expect(graphStore.getState().edges[0].metadata).toEqual([{ key: 'name', value: 'braucht' }])
    expect(screen.getByLabelText('Name')).toHaveValue(' braucht ')
  })

  it('bundles the keystrokes of one field into one undo step; leaving the field ends it', async () => {
    render(<App />)
    select(graphStore.getState().nodes[0].id)
    const steps = () => graphStore.getState().history.past.length

    await userEvent.type(screen.getByLabelText('Name'), 'abc')
    expect(steps()).toBe(1)
    expect(graphStore.getState().gesture).toBe(true)

    await userEvent.tab() // leaves the field
    expect(graphStore.getState().gesture).toBe(false)

    await userEvent.type(screen.getByLabelText('Name'), 'd')
    expect(steps()).toBe(2)
  })

  it('undo reverts the whole field edit and the form shows the reverted text', async () => {
    render(<App />)
    select(graphStore.getState().nodes[0].id)
    await userEvent.type(screen.getByLabelText('Name'), 'abc')
    await userEvent.tab()

    act(() => graphStore.getState().undo())
    expect(nameOf(0)).toBe('Projekt A')
    expect(screen.getByLabelText('Name')).toHaveValue('Projekt A')

    act(() => graphStore.getState().redo())
    expect(screen.getByLabelText('Name')).toHaveValue('Projekt Aabc')
  })

  it('ends an open edit when the selection moves to another element', async () => {
    render(<App />)
    const [first, second] = graphStore.getState().nodes
    select(first.id)
    await userEvent.type(screen.getByLabelText('Name'), 'x')
    expect(graphStore.getState().gesture).toBe(true)

    act(() =>
      graphStore.getState().applyNodeSelection([
        { id: first.id, selected: false },
        { id: second.id, selected: true },
      ]),
    )

    expect(graphStore.getState().gesture).toBe(false)
    expect(graphStore.getState().history.past).toHaveLength(1)
    expect(screen.getByLabelText('Name')).toHaveValue('Projekt B')
  })

  it('does not ask when switching or closing with a valid draft', async () => {
    render(<App />)
    const [first, second] = graphStore.getState().nodes
    select(first.id)
    await userEvent.type(screen.getByLabelText('Name'), '2')

    open(second.id)
    expect(dialog()).toBeNull()
    expect(screen.getByLabelText('Name')).toHaveValue('Projekt B')
    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(dialog()).toBeNull()
    expect(sidebar()).toBeNull()
    expect(nameOf(0)).toBe('Projekt A2')
  })
})

describe('App: invalid sidebar draft', () => {
  const makeDuplicate = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Feld hinzufügen' }))
    await userEvent.type(screen.getByLabelText('Feldname'), 'nam')
    await userEvent.type(screen.getByLabelText('Feldname'), 'e')
  }

  it('shows the error, keeps the last valid state in the model, and asks before closing', async () => {
    render(<App />)
    const [first] = graphStore.getState().nodes
    select(first.id)
    await userEvent.type(screen.getByLabelText('Name'), '2')
    await makeDuplicate()

    expect(screen.getByRole('alert')).toHaveTextContent('Doppelte Feldnamen: name')
    expect(nameOf(0)).toBe('Projekt A2')

    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    const asking = dialog()
    expect(asking).toHaveTextContent('Ungültige Änderungen an „Projekt A2“ verwerfen? (doppelter Feldname)')
    await userEvent.click(within(asking!).getByRole('button', { name: 'Abbrechen' }))

    expect(dialog()).toBeNull()
    expect(screen.getByLabelText('Feldname')).toHaveValue('name')
    expect(graphStore.getState().selectedNodeIds).toEqual([first.id])
  })

  it('discards the invalid draft and closes on "Verwerfen"; the model keeps its last valid state', async () => {
    render(<App />)
    select(graphStore.getState().nodes[0].id)
    await makeDuplicate()

    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    await userEvent.click(within(dialog()!).getByRole('button', { name: 'Verwerfen' }))

    expect(sidebar()).toBeNull()
    // "nam" was valid and is kept; the duplicate "name" never reached the model.
    expect(graphStore.getState().nodes[0].metadata).toEqual([
      { key: 'name', value: 'Projekt A' },
      { key: 'nam', value: '' },
    ])
  })

  it('asks before another element is shown, then shows it after "Verwerfen"', async () => {
    render(<App />)
    const [first, second] = graphStore.getState().nodes
    select(first.id)
    await makeDuplicate()

    act(() =>
      graphStore.getState().applyNodeSelection([
        { id: first.id, selected: false },
        { id: second.id, selected: true },
      ]),
    )
    expect(dialog()).not.toBeNull()
    expect(screen.getByLabelText('Feldname')).toHaveValue('name')

    await userEvent.click(within(dialog()!).getByRole('button', { name: 'Verwerfen' }))
    expect(screen.getByLabelText('Name')).toHaveValue('Projekt B')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('does not ask once the duplicate is fixed', async () => {
    render(<App />)
    select(graphStore.getState().nodes[0].id)
    await makeDuplicate()
    await userEvent.type(screen.getByLabelText('Feldname'), '2')

    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))

    expect(dialog()).toBeNull()
    expect(sidebar()).toBeNull()
  })
})

describe('App: work modes', () => {
  const switchTo = (name: 'Editieren' | 'Analysieren') =>
    userEvent.click(screen.getByRole('button', { name }))

  it('starts in build mode: structure tools, no analysis panel', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: 'Editieren' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Objekt anlegen' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: /Release-Analyse/ })).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Hervorhebung' })).toBeNull()
  })

  it('analysis mode swaps the tools, shows the panel and remembers the mode in this browser', async () => {
    render(<App />)
    await switchTo('Analysieren')

    expect(screen.queryByRole('button', { name: 'Objekt anlegen' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Löschen' })).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Hervorhebung' })).toHaveValue('critical')
    expect(screen.getByRole('button', { name: 'Panel' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.querySelector('.analysis-panel')).not.toBeNull()
    expect(JSON.parse(localStorage.getItem(UI_KEY)!)).toEqual({ mode: 'analyze' })

    await switchTo('Editieren')
    expect(document.querySelector('.analysis-panel')).toBeNull()
    expect(JSON.parse(localStorage.getItem(UI_KEY)!)).toEqual({ mode: 'build' })
  })

  it('hides and shows the panel with the toolbar toggle, and keeps the highlight', async () => {
    render(<App />)
    await switchTo('Analysieren')

    await userEvent.click(screen.getByRole('button', { name: 'Panel' }))
    expect(document.querySelector('.analysis-panel')).toBeNull()
    expect(screen.getByRole('button', { name: 'Panel' })).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(screen.getByRole('button', { name: 'Panel' }))
    expect(document.querySelector('.analysis-panel')).not.toBeNull()
  })

  it('does not delete with the Delete key in analysis mode', async () => {
    render(<App />)
    const before = graphStore.getState().nodes.length
    act(() => graphStore.getState().applyNodeSelection([{ id: graphStore.getState().nodes[0].id, selected: true }]))
    await switchTo('Analysieren')

    await userEvent.keyboard('{Delete}')
    expect(graphStore.getState().nodes).toHaveLength(before)
  })
})

describe('App: import warning', () => {
  const importDialog = () => screen.queryByRole('dialog', { name: 'Projekt ersetzen?' })
  const importFile = serializeModel(toModel({ nodes: [], edges: [], projectName: 'Datei' }))

  beforeEach(() => {
    act(() => graphStore.getState().replaceContent(createDefaultContent()))
    localStorage.removeItem(EXPORT_FINGERPRINT_KEY)
    act(() => graphStore.setState({ exportedFingerprint: null }))
  })

  it('names the project and warns that unexported changes are lost', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))

    expect(importDialog()).toHaveTextContent('Der Import ersetzt das aktuelle Projekt „Release-Management“ (2 Objekte, 1 Verbindung).')
    expect(within(importDialog()!).getByRole('alert')).toHaveTextContent('noch nicht exportiert')
  })

  it('cancelling leaves everything as it is', async () => {
    render(<App />)
    const { nodes } = graphStore.getState()
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    await userEvent.click(within(importDialog()!).getByRole('button', { name: 'Abbrechen' }))

    expect(importDialog()).toBeNull()
    expect(pickTextFile).not.toHaveBeenCalled()
    expect(graphStore.getState().nodes).toBe(nodes)
  })

  it('"Ohne Export importieren" picks the file without exporting and replaces the project', async () => {
    vi.mocked(pickTextFile).mockResolvedValueOnce(importFile)
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    await userEvent.click(within(importDialog()!).getByRole('button', { name: 'Ohne Export importieren' }))

    expect(downloadTextFile).not.toHaveBeenCalled()
    expect(pickTextFile).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(graphStore.getState().projectName).toBe('Datei'))
    expect(importDialog()).toBeNull()
  })

  it('"Exportieren und importieren" exports first, then picks the file in the same click', async () => {
    const order: string[] = []
    vi.mocked(downloadTextFile).mockImplementation(() => void order.push('export'))
    vi.mocked(pickTextFile).mockImplementationOnce(() => {
      order.push('pick')
      return Promise.resolve(importFile)
    })
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    await userEvent.click(within(importDialog()!).getByRole('button', { name: 'Exportieren und importieren' }))

    expect(order).toEqual(['export', 'pick'])
    expect(vi.mocked(downloadTextFile).mock.calls[0][0]).toMatch(/^Release-Management_\d{4}-\d{2}-\d{2}_\d{6}\.json$/)
    await vi.waitFor(() => expect(graphStore.getState().projectName).toBe('Datei'))
  })

  it('keeps the project when the file selection is cancelled (the export stays)', async () => {
    render(<App />)
    const { nodes } = graphStore.getState()
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    await userEvent.click(within(importDialog()!).getByRole('button', { name: 'Exportieren und importieren' }))

    expect(downloadTextFile).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(pickTextFile).toHaveBeenCalledTimes(1))
    expect(graphStore.getState().nodes).toBe(nodes)
  })

  it('an invalid file is rejected with the error list and the project stays', async () => {
    vi.mocked(pickTextFile).mockResolvedValueOnce('{"version": 99}')
    render(<App />)
    const { nodes } = graphStore.getState()
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    await userEvent.click(within(importDialog()!).getByRole('button', { name: 'Ohne Export importieren' }))

    await vi.waitFor(() => expect(graphStore.getState().notice?.kind).toBe('error'))
    expect(graphStore.getState().nodes).toBe(nodes)
  })

  it('after an export the dialog says the state is exported; an edit makes it unsaved again', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Export' }))
    expect(localStorage.getItem(EXPORT_FINGERPRINT_KEY)).toBe(contentFingerprint(graphStore.getState()))

    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(importDialog()).toHaveTextContent('Der aktuelle Stand wurde bereits exportiert.')
    expect(within(importDialog()!).queryByRole('alert')).toBeNull()
    await userEvent.click(within(importDialog()!).getByRole('button', { name: 'Abbrechen' }))

    act(() => graphStore.getState().moveNode(graphStore.getState().nodes[0].id, { x: 999, y: 999 }))
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(within(importDialog()!).getByRole('alert')).toBeInTheDocument()
  })

  it('works from the analysis mode too', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Analysieren' }))
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(importDialog()).not.toBeNull()
  })
})

describe('App: colour of a multi selection', () => {
  const colorOf = (index: number) => graphStore.getState().nodes[index].metadata.find((m) => m.key === 'color')?.value

  it('colours every selected element at once, as one undo step', () => {
    render(<App />)
    const [first, second] = graphStore.getState().nodes
    select(first.id, second.id)
    const before = graphStore.getState().history.past.length

    fireEvent.change(screen.getByLabelText('Farbe (color) für alle 2 Elemente'), { target: { value: '#ff0000' } })

    expect(colorOf(0)).toBe('#ff0000')
    expect(colorOf(1)).toBe('#ff0000')
    expect(graphStore.getState().history.past).toHaveLength(before + 1)
    expect(screen.getByLabelText('Farbe (color) für alle 2 Elemente')).toHaveValue('#ff0000')

    act(() => graphStore.getState().endGesture())
    act(() => graphStore.getState().undo())
    expect(colorOf(0)).toBeUndefined()
    expect(colorOf(1)).toBeUndefined()
  })

  it('shows that the colours differ and resets all of them', async () => {
    render(<App />)
    const [first, second] = graphStore.getState().nodes
    act(() => {
      graphStore.getState().updateMetadata(first.id, [...first.metadata, { key: 'color', value: '#00ff00' }])
    })
    select(first.id, second.id)

    expect(screen.getByText('verschieden')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }))

    expect(colorOf(0)).toBeUndefined()
    expect(colorOf(1)).toBeUndefined()
  })

  it('does not ignore the single selection: one element still gets the normal form', () => {
    render(<App />)
    select(graphStore.getState().nodes[0].id)

    expect(screen.queryByLabelText(/für alle/)).toBeNull()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })
})

describe('App: a group grows with a new object', () => {
  it('grows when an object is created in a full group, as one undo step', () => {
    render(<App />)
    const frame = { x: 2000, y: 2000 }
    act(() => {
      graphStore.getState().replaceContent({
        nodes: [
          { id: 'g', kind: 'group', position: frame, size: { width: 208, height: 136 }, metadata: [{ key: 'name', value: 'G' }] },
          { id: 'm', kind: 'node', parentId: 'g', position: { x: 24, y: 56 }, metadata: [{ key: 'name', value: 'M' }] },
        ],
        edges: [],
      })
      graphStore.setState({ history: emptyHistory })
      graphStore.getState().setTool('create')
    })

    act(() => graphStore.getState().addNodeAt({ x: frame.x + 100, y: frame.y + 80 }))

    const state = graphStore.getState()
    const group = state.nodes.find((n) => n.id === 'g')!
    expect(state.nodes).toHaveLength(3)
    expect(group.size!.width * group.size!.height).toBeGreaterThan(208 * 136)
    expect(state.history.past).toHaveLength(1)

    act(() => state.undo())
    expect(graphStore.getState().nodes.find((n) => n.id === 'g')!.size).toEqual({ width: 208, height: 136 })
  })
})

describe('App: rename on the canvas', () => {
  const label = (text: string) => screen.getByText(text, { selector: '.box-node__label, .group-node__label' })

  it('renames by double click without opening the sidebar, as one undo step', async () => {
    render(<App />)
    const before = graphStore.getState().history.past.length

    fireEvent.doubleClick(label('Projekt A'))
    await userEvent.keyboard('Umbenannt{Enter}')

    expect(nameOf(0)).toBe('Umbenannt')
    expect(label('Umbenannt')).toBeInTheDocument()
    expect(graphStore.getState().history.past).toHaveLength(before + 1)
    expect(sidebar()).toBeNull()

    act(() => graphStore.getState().undo())
    expect(nameOf(0)).toBe('Projekt A')
  })

  it('shows the new name in an open sidebar', async () => {
    render(<App />)
    const [first] = graphStore.getState().nodes
    select(first.id)

    fireEvent.doubleClick(label('Projekt A'))
    await userEvent.keyboard('Neu{Enter}')

    expect(screen.getByLabelText('Name')).toHaveValue('Neu')
  })

  it('is off while another tool is active', () => {
    render(<App />)
    act(() => graphStore.getState().setTool('create'))

    fireEvent.doubleClick(label('Projekt A'))

    expect(screen.queryByLabelText('Name', { selector: '.node-name-input' })).toBeNull()
  })
})

describe('App: search by name', () => {
  const searchButton = () => screen.getByRole('button', { name: 'Suchen' })
  const field = () => screen.getByRole('textbox', { name: 'Suchen nach Name' })
  const selected = () => graphStore.getState().selectedNodeIds
  const idsWhere = (prefix: string) =>
    graphStore.getState().nodes.filter((n) => n.metadata[0].value.toLowerCase().startsWith(prefix)).map((n) => n.id)

  beforeEach(() => {
    act(() => {
      graphStore.getState().replaceContent({
        nodes: [
          { id: 'a', kind: 'node', position: { x: 0, y: 0 }, metadata: [{ key: 'name', value: 'Service A' }] },
          { id: 'g', kind: 'group', position: { x: 0, y: 300 }, size: { width: 300, height: 200 }, metadata: [{ key: 'name', value: 'Backend' }] },
          { id: 'b', kind: 'node', position: { x: 400, y: 0 }, metadata: [{ key: 'name', value: 'service b' }] },
          { id: 'c', kind: 'node', position: { x: 800, y: 0 }, metadata: [{ key: 'name', value: 'SERVICE C' }] },
        ],
        edges: [],
      })
      graphStore.getState().closeSidebar()
    })
  })

  it('opens and closes the field with the magnifier button', async () => {
    render(<App />)
    expect(screen.queryByRole('search')).toBeNull()

    await userEvent.click(searchButton())
    expect(field()).toHaveFocus()

    await userEvent.click(searchButton())
    expect(screen.queryByRole('search')).toBeNull()
  })

  it('selects the first hit on Enter, then the next ones, then round again', async () => {
    render(<App />)
    await userEvent.click(searchButton())
    await userEvent.type(field(), 'SERV')

    const visited: string[][] = []
    for (let i = 0; i < 4; i++) {
      await userEvent.keyboard('{Enter}')
      visited.push(selected())
    }

    expect(visited).toEqual([['a'], ['b'], ['c'], ['a']])
    expect(idsWhere('serv')).toEqual(['a', 'b', 'c'])
  })

  it('finds groups too and starts over with a changed text', async () => {
    render(<App />)
    await userEvent.click(searchButton())
    await userEvent.type(field(), 'service{Enter}{Enter}')
    expect(selected()).toEqual(['b'])

    await userEvent.clear(field())
    await userEvent.type(field(), 'back{Enter}')
    expect(selected()).toEqual(['g'])
  })

  it('reports the position and says so when nothing matches, leaving the selection alone', async () => {
    render(<App />)
    await userEvent.click(searchButton())

    await userEvent.type(field(), 'service{Enter}{Enter}')
    expect(screen.getByRole('search')).toHaveTextContent('Treffer 2 von 3')

    await userEvent.clear(field())
    await userEvent.type(field(), 'nichts{Enter}')
    expect(screen.getByRole('search')).toHaveTextContent('Kein Treffer')
    expect(selected()).toEqual(['b'])
  })

  it('starts at the first hit again after the field was closed and reopened', async () => {
    render(<App />)
    await userEvent.click(searchButton())
    await userEvent.type(field(), 'service{Enter}{Enter}')
    expect(selected()).toEqual(['b'])

    await userEvent.click(searchButton())
    await userEvent.click(searchButton())
    await userEvent.type(field(), 'service{Enter}')

    expect(selected()).toEqual(['a'])
  })

  it('works while analysing and closes with Escape', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Analysieren' }))
    await userEvent.click(searchButton())
    await userEvent.type(field(), 'back{Enter}')
    expect(selected()).toEqual(['g'])

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('search')).toBeNull()
  })
})

describe('App: copy and paste', () => {
  const copyButton = () => screen.getByRole('button', { name: 'Kopieren' })
  const pasteButton = () => screen.getByRole('button', { name: 'Einfügen' })

  beforeEach(() => {
    act(() => graphStore.setState({ clipboard: null, pasteRound: 0 }))
  })

  it('enables copy with a selection and paste after copying', async () => {
    render(<App />)
    expect(copyButton()).toBeDisabled()
    expect(pasteButton()).toBeDisabled()

    select(graphStore.getState().nodes[0].id)
    expect(copyButton()).toBeEnabled()
    await userEvent.click(copyButton())

    expect(pasteButton()).toBeEnabled()
    expect(await screen.findByText('1 Element kopiert.')).toBeInTheDocument()
  })

  it('pastes a new element with a new id and no connection, selected', async () => {
    render(<App />)
    const { nodes, edges } = graphStore.getState()
    select(nodes[0].id)
    await userEvent.click(copyButton())
    await userEvent.click(pasteButton())

    const state = graphStore.getState()
    expect(state.nodes).toHaveLength(nodes.length + 1)
    const pasted = state.nodes.at(-1)!
    expect(nodes.map((n) => n.id)).not.toContain(pasted.id)
    expect(pasted.metadata[0].value).toBe(nodes[0].metadata[0].value)
    expect(state.edges).toEqual(edges)
    expect(state.selectedNodeIds).toEqual([pasted.id])
  })

  it('works with Strg/Cmd + C and V, but not in a text field', async () => {
    render(<App />)
    const count = graphStore.getState().nodes.length
    select(graphStore.getState().nodes[0].id)

    await userEvent.keyboard('{Control>}c{/Control}')
    expect(graphStore.getState().clipboard).not.toBeNull()
    await userEvent.keyboard('{Control>}v{/Control}')
    expect(graphStore.getState().nodes).toHaveLength(count + 1)

    // In the sidebar's name field the browser keeps its own copy and paste.
    act(() => graphStore.setState({ clipboard: null }))
    await userEvent.click(screen.getByLabelText('Name'))
    await userEvent.keyboard('{Control>}c{/Control}')
    expect(graphStore.getState().clipboard).toBeNull()
  })

  it('is not offered while analysing', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Analysieren' }))

    expect(screen.queryByRole('button', { name: 'Kopieren' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Einfügen' })).toBeNull()
  })
})

describe('App: JSON as text', () => {
  const showDialog = () => screen.queryByRole('dialog', { name: 'Projekt als JSON' })
  const pasteDialog = () => screen.queryByRole('dialog', { name: 'JSON einfügen' })
  const modelJson = (projectName: string) => serializeModel(toModel({ nodes: [], edges: [], projectName }))

  beforeEach(() => {
    act(() => graphStore.getState().replaceContent(createDefaultContent()))
    localStorage.removeItem(EXPORT_FINGERPRINT_KEY)
    act(() => graphStore.setState({ exportedFingerprint: null }))
  })

  it('shows exactly the JSON of the file export, read-only', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Export' }))
    const exported = vi.mocked(downloadTextFile).mock.calls[0][1]

    await userEvent.click(screen.getByRole('button', { name: 'JSON anzeigen' }))

    const area = within(showDialog()!).getByRole('textbox', { name: 'Projekt-JSON (schreibgeschützt)' })
    expect(area).toHaveValue(exported)
    expect(area).toHaveAttribute('readonly')
  })

  it('does not count as exported until it is copied', async () => {
    const user = userEvent.setup()
    const write = vi.spyOn(navigator.clipboard, 'writeText')
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'JSON anzeigen' }))
    expect(graphStore.getState().exportedFingerprint).toBeNull()

    await user.click(within(showDialog()!).getByRole('button', { name: 'In Zwischenablage kopieren' }))

    expect(write).toHaveBeenCalledWith(serializeModel(toModel(graphStore.getState())))
    expect(graphStore.getState().exportedFingerprint).toBe(contentFingerprint(graphStore.getState()))
    expect(await within(showDialog()!).findByRole('status')).toHaveTextContent('kopiert')
  })

  it('imports pasted text, replaces the project and closes', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'JSON einfügen' }))
    expect(within(pasteDialog()!).getByRole('alert')).toHaveTextContent('noch nicht exportiert')

    await user.click(within(pasteDialog()!).getByRole('textbox', { name: 'JSON-Text' }))
    await user.paste(modelJson('Eingefuegt'))
    await user.click(within(pasteDialog()!).getByRole('button', { name: 'Importieren' }))

    expect(graphStore.getState().projectName).toBe('Eingefuegt')
    expect(graphStore.getState().nodes).toEqual([])
    expect(graphStore.getState().exportedFingerprint).toBe(contentFingerprint(graphStore.getState()))
    expect(pasteDialog()).toBeNull()
    expect(pickTextFile).not.toHaveBeenCalled()
  })

  it('keeps the project and explains an invalid text inside the dialog', async () => {
    const user = userEvent.setup()
    render(<App />)
    const { nodes } = graphStore.getState()
    await user.click(screen.getByRole('button', { name: 'JSON einfügen' }))

    await user.click(within(pasteDialog()!).getByRole('textbox', { name: 'JSON-Text' }))
    await user.paste('das ist kein JSON')
    await user.click(within(pasteDialog()!).getByRole('button', { name: 'Importieren' }))

    expect(pasteDialog()).not.toBeNull()
    expect(within(pasteDialog()!).getAllByRole('alert').at(-1)).toHaveTextContent('kein gültiges Modell')
    expect(graphStore.getState().nodes).toBe(nodes)
  })

  it('can be undone and cancelled without a trace', async () => {
    const user = userEvent.setup()
    render(<App />)
    const { nodes } = graphStore.getState()

    await user.click(screen.getByRole('button', { name: 'JSON einfügen' }))
    await user.click(within(pasteDialog()!).getByRole('button', { name: 'Abbrechen' }))
    expect(pasteDialog()).toBeNull()
    expect(graphStore.getState().nodes).toBe(nodes)

    await user.click(screen.getByRole('button', { name: 'JSON einfügen' }))
    await user.click(within(pasteDialog()!).getByRole('textbox', { name: 'JSON-Text' }))
    await user.paste(modelJson('Eingefuegt'))
    await user.click(within(pasteDialog()!).getByRole('button', { name: 'Importieren' }))
    act(() => graphStore.getState().undo())

    expect(graphStore.getState().nodes).toEqual(nodes)
  })

  it('works from the analysis mode too', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Analysieren' }))

    await userEvent.click(screen.getByRole('button', { name: 'JSON anzeigen' }))
    expect(showDialog()).not.toBeNull()
    await userEvent.click(within(showDialog()!).getByRole('button', { name: 'Schließen' }))
    await userEvent.click(screen.getByRole('button', { name: 'JSON einfügen' }))
    expect(pasteDialog()).not.toBeNull()
  })
})

describe('App: build tools', () => {
  const tool = () => graphStore.getState().tool
  const pressed = (name: string) =>
    screen.getByRole('button', { name }).getAttribute('aria-pressed') === 'true'

  it('starts with the select tool and switches exclusively with the toolbar', async () => {
    render(<App />)
    expect(tool()).toBe('select')
    expect(pressed('Auswählen')).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: 'Objekt anlegen' }))
    expect(tool()).toBe('create')
    expect([pressed('Auswählen'), pressed('Objekt anlegen'), pressed('Verbinden')]).toEqual([false, true, false])

    await userEvent.click(screen.getByRole('button', { name: 'Verbinden' }))
    expect(tool()).toBe('connect')
    expect([pressed('Auswählen'), pressed('Objekt anlegen'), pressed('Verbinden')]).toEqual([false, false, true])
  })

  it('switches with V, N and C', async () => {
    render(<App />)

    await userEvent.keyboard('n')
    expect(tool()).toBe('create')
    await userEvent.keyboard('c')
    expect(tool()).toBe('connect')
    await userEvent.keyboard('v')
    expect(tool()).toBe('select')
  })

  it('ignores the shortcuts in input fields and with a modifier key', async () => {
    render(<App />)
    select(graphStore.getState().nodes[0].id)

    await userEvent.type(screen.getByLabelText('Name'), 'nc')
    expect(tool()).toBe('select')
    ;(document.activeElement as HTMLElement).blur()
    await userEvent.keyboard('{Control>}c{/Control}')
    expect(tool()).toBe('select')
  })

  it('ignores the shortcuts in the analysis mode', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Analysieren' }))

    await userEvent.keyboard('n')
    expect(tool()).toBe('select')
  })

  it('Esc goes back to the select tool first and keeps the selection', async () => {
    render(<App />)
    const [first] = graphStore.getState().nodes
    select(first.id)
    await userEvent.keyboard('n')

    await userEvent.keyboard('{Escape}')
    expect(tool()).toBe('select')
    expect(graphStore.getState().selectedNodeIds).toEqual([first.id])

    await userEvent.keyboard('{Escape}')
    expect(graphStore.getState().selectedNodeIds).toEqual([])
  })

  it('leaving for the analysis mode returns to the select tool', async () => {
    render(<App />)
    await userEvent.keyboard('c')

    await userEvent.click(screen.getByRole('button', { name: 'Analysieren' }))
    expect(tool()).toBe('select')
    await userEvent.click(screen.getByRole('button', { name: 'Editieren' }))
    expect(pressed('Auswählen')).toBe(true)
  })
})

describe('App: analysis mode layout', () => {
  const switchTo = (name: 'Editieren' | 'Analysieren') =>
    userEvent.click(screen.getByRole('button', { name }))
  const panel = () => screen.queryByRole('complementary', { name: 'Release-Analyse' })

  it('hides the sidebar while analysing, keeps the selection and shows it again in the build mode', async () => {
    render(<App />)
    const [first] = graphStore.getState().nodes
    select(first.id)
    expect(sidebar()).not.toBeNull()

    await switchTo('Analysieren')
    expect(sidebar()).toBeNull()
    expect(panel()).not.toBeNull()
    expect(graphStore.getState().selectedNodeIds).toEqual([first.id])

    await switchTo('Editieren')
    expect(panel()).toBeNull()
    expect(screen.getByLabelText('Name')).toHaveValue('Projekt A')
  })

  it('does not open the sidebar for a selection made while analysing', async () => {
    render(<App />)
    await switchTo('Analysieren')

    select(graphStore.getState().nodes[0].id)
    expect(sidebar()).toBeNull()
    expect(panel()).not.toBeNull()
  })

  it('puts the panel after the canvas, in the column of the sidebar', async () => {
    render(<App />)
    select(graphStore.getState().nodes[0].id)
    await switchTo('Analysieren')

    const workspace = document.querySelector('.workspace')!
    expect([...workspace.children].map((el) => el.className.split(' ')[0])).toEqual(['canvas', 'analysis-panel', 'sidebar'])
  })

  it('shows the status of the selected object and changes it right away, one undo step each', async () => {
    render(<App />)
    const [first] = graphStore.getState().nodes
    select(first.id)
    await switchTo('Analysieren')

    const block = within(panel()!).getByRole('region', { name: 'Auswahl' })
    expect(block).toHaveTextContent('Auswahl: Projekt A')
    await userEvent.selectOptions(within(block).getByLabelText('Status'), 'in Arbeit')
    expect(graphStore.getState().nodes[0].metadata).toContainEqual({ key: 'status', value: 'in Arbeit' })
    await userEvent.selectOptions(within(block).getByLabelText('Status'), 'fertig')
    expect(graphStore.getState().nodes[0].metadata).toContainEqual({ key: 'status', value: 'fertig' })
    expect(graphStore.getState().history.past).toHaveLength(2)

    act(() => graphStore.getState().undo())
    expect(within(block).getByLabelText('Status')).toHaveValue('in Arbeit')
  })

  it('shows the status set in the panel in the sidebar after switching back', async () => {
    render(<App />)
    select(graphStore.getState().nodes[0].id)
    await switchTo('Analysieren')
    await userEvent.selectOptions(within(panel()!).getByLabelText('Status'), 'fertig')

    await switchTo('Editieren')
    expect(screen.getByLabelText('Status')).toHaveValue('fertig')
  })

  it('shows an unknown status as an extra option and does not change it by itself', async () => {
    render(<App />)
    const [first] = graphStore.getState().nodes
    act(() =>
      graphStore.getState().updateMetadata(first.id, [...first.metadata, { key: 'status', value: 'erledigt' }]),
    )
    select(first.id)
    await switchTo('Analysieren')

    const select_ = within(panel()!).getByLabelText('Status') as HTMLSelectElement
    expect(select_).toHaveValue('erledigt')
    expect([...select_.options].map((o) => o.textContent)).toContain('erledigt (unbekannt)')
    expect(graphStore.getState().nodes[0].metadata).toContainEqual({ key: 'status', value: 'erledigt' })
  })

  it('shows only the progress for a group and no other metadata fields', async () => {
    render(<App />)
    select(...graphStore.getState().nodes.map((n) => n.id))
    act(() => graphStore.getState().groupSelection())
    await switchTo('Analysieren')

    const block = within(panel()!).getByRole('region', { name: 'Auswahl' })
    expect(block).toHaveTextContent('Status aus Mitgliedern: 0 von 2 fertig')
    expect(within(block).queryByLabelText('Status')).toBeNull()
    expect(sidebar()).toBeNull()
  })

  it('shows no status block for several selected elements', async () => {
    render(<App />)
    select(...graphStore.getState().nodes.map((n) => n.id))
    await switchTo('Analysieren')

    expect(within(panel()!).queryByRole('region', { name: 'Auswahl' })).toBeNull()
  })

  describe('blocking by hand', () => {
    const metadataOf = (index: number) => graphStore.getState().nodes[index].metadata
    const steps = () => graphStore.getState().history.past.length

    it('blocks from the panel with a reason, flags the selection and undoes status and reason as steps', async () => {
      render(<App />)
      const [first] = graphStore.getState().nodes
      select(first.id)
      await switchTo('Analysieren')
      const block = within(panel()!).getByRole('region', { name: 'Auswahl' })

      expect(within(block).queryByLabelText('Grund')).toBeNull()
      await userEvent.selectOptions(within(block).getByLabelText('Status'), 'blockiert')
      await userEvent.type(within(block).getByLabelText('Grund'), 'Freigabe fehlt')
      await userEvent.tab()

      expect(metadataOf(0)).toEqual([
        { key: 'name', value: 'Projekt A' },
        { key: 'status', value: 'blockiert' },
        { key: 'blockiert_grund', value: 'Freigabe fehlt' },
      ])
      expect(steps()).toBe(2)
      const banner = within(panel()!).getByRole('region', { name: 'Auswahl ist blockiert' })
      expect(banner).toHaveTextContent('Projekt A ist blockiert – Freigabe fehlt')
      // the first object also depends on the second one, which is not finished: the flag says so as well
      expect(document.querySelector('.box-node .blocked-flag')).toHaveAttribute(
        'aria-label',
        'Blockiert: Freigabe fehlt – wartet außerdem auf: Projekt B',
      )
      const counts = within(within(panel()!).getByRole('list', { name: 'Projektstand' }))
      expect(counts.getByText('blockiert').closest('li')).toHaveTextContent('1 blockiert')

      // another status removes the reason; one undo step brings both back
      await userEvent.selectOptions(within(block).getByLabelText('Status'), 'in Arbeit')
      expect(metadataOf(0)).toEqual([
        { key: 'name', value: 'Projekt A' },
        { key: 'status', value: 'in Arbeit' },
      ])
      expect(within(panel()!).queryByRole('region', { name: 'Auswahl ist blockiert' })).toBeNull()
      act(() => graphStore.getState().undo())
      expect(metadataOf(0)).toContainEqual({ key: 'blockiert_grund', value: 'Freigabe fehlt' })
      expect(within(block).getByLabelText('Grund')).toHaveValue('Freigabe fehlt')
    })

    it('makes the object that depends on a blocked one wait, with an hourglass', async () => {
      render(<App />)
      // the default project has an edge from the first to the second object
      const [first, second] = graphStore.getState().nodes
      const edge = graphStore.getState().edges[0]
      const [dependent, prerequisite] = edge.source === first.id ? [first, second] : [second, first]
      act(() => graphStore.getState().setStatus(prerequisite.id, 'blockiert'))
      await switchTo('Analysieren')

      const marks = [...document.querySelectorAll('.box-node .waiting-mark')]
      expect(marks).toHaveLength(1)
      expect(marks[0].getAttribute('aria-label')).toMatch(/^Wartet auf: /)
      expect(document.querySelectorAll('.box-node .blocked-flag')).toHaveLength(1)
      const counts = within(within(panel()!).getByRole('list', { name: 'Projektstand' }))
      expect(counts.getByText('wartet').closest('li')).toHaveTextContent('1 wartet')
      expect(counts.getByText('jetzt umsetzbar').closest('li')).toHaveTextContent('0 jetzt umsetzbar')
      expect(dependent.id).not.toBe(prerequisite.id)
    })
  })

  describe('finished is final', () => {
    it('shows no mark on or above a finished object and says so for a finished selection', async () => {
      render(<App />)
      const [first, second] = graphStore.getState().nodes
      const edge = graphStore.getState().edges[0]
      const [dependent, prerequisite] = edge.source === first.id ? [first, second] : [second, first]
      act(() => graphStore.getState().setStatus(prerequisite.id, 'fertig'))
      select(prerequisite.id)
      await switchTo('Analysieren')

      expect(document.querySelectorAll('.box-node .waiting-mark, .box-node .blocked-flag')).toHaveLength(0)
      expect(document.querySelectorAll('.inconsistent-mark')).toHaveLength(0)
      const counts = within(within(panel()!).getByRole('list', { name: 'Projektstand' }))
      expect(counts.getByText('wartet').closest('li')).toHaveTextContent('0 wartet')
      expect(counts.getByText('jetzt umsetzbar').closest('li')).toHaveTextContent('1 jetzt umsetzbar')
      expect(within(panel()!).getByText('Fertig – Voraussetzungen werden nicht mehr betrachtet.')).toBeInTheDocument()

      select(dependent.id)
      expect(within(panel()!).queryByText(/nicht mehr betrachtet/)).toBeNull()
    })
  })
})
