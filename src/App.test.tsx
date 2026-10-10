import { act, render, screen, within } from '@testing-library/react'
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

  it('applies the status choice and the edge label at once', async () => {
    render(<App />)
    select(graphStore.getState().nodes[0].id)
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'fertig')
    expect(graphStore.getState().nodes[0].metadata).toContainEqual({ key: 'status', value: 'fertig' })

    const [edge] = graphStore.getState().edges
    act(() => graphStore.getState().openEdgeSidebar(edge.id))
    await userEvent.type(screen.getByLabelText('Label'), ' braucht ')
    expect(graphStore.getState().edges[0].label).toBe('braucht')
    expect(screen.getByLabelText('Label')).toHaveValue(' braucht ')
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
  const switchTo = (name: 'Aufbauen' | 'Analysieren') =>
    userEvent.click(screen.getByRole('button', { name }))

  it('starts in build mode: structure tools, no analysis panel', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: 'Aufbauen' })).toHaveAttribute('aria-pressed', 'true')
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

    await switchTo('Aufbauen')
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
    await userEvent.click(screen.getByRole('button', { name: 'Aufbauen' }))
    expect(pressed('Auswählen')).toBe(true)
  })
})

describe('App: analysis mode layout', () => {
  const switchTo = (name: 'Aufbauen' | 'Analysieren') =>
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

    await switchTo('Aufbauen')
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

    await switchTo('Aufbauen')
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
})
