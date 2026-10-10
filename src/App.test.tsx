import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createDefaultContent } from './model/defaultModel'
import { contentFingerprint } from './model/fingerprint'
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
    graphStore.getState().closeSidebar()
    graphStore.getState().cancelSidebarChange()
    graphStore.getState().setMode('build')
    graphStore.getState().setHighlight('critical')
    graphStore.getState().setAnalysisPanelVisible(true)
  })
})

const open = (id: string) => act(() => graphStore.getState().openSidebar(id))
const dialog = () => screen.queryByRole('dialog', { name: 'Änderungen verwerfen' })

describe('App: unsaved sidebar changes', () => {
  it('asks before closing a dirty sidebar and keeps it open on "Abbrechen"', async () => {
    render(<App />)
    const [first] = graphStore.getState().nodes
    open(first.id)
    await userEvent.type(screen.getByLabelText('Name'), '2')

    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    const asking = dialog()
    expect(asking).toHaveTextContent('Ungespeicherte Änderungen an „Projekt A“ verwerfen?')
    await userEvent.click(within(asking!).getByRole('button', { name: 'Abbrechen' }))

    expect(dialog()).toBeNull()
    expect(screen.getByLabelText('Name')).toHaveValue('Projekt A2')
    expect(graphStore.getState().sidebarId).toBe(first.id)
  })

  it('discards the edits and closes on "Verwerfen"', async () => {
    render(<App />)
    const [first] = graphStore.getState().nodes
    open(first.id)
    await userEvent.type(screen.getByLabelText('Name'), '2')

    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    await userEvent.click(within(dialog()!).getByRole('button', { name: 'Verwerfen' }))

    expect(screen.queryByRole('complementary', { name: 'Metadaten' })).toBeNull()
    expect(graphStore.getState().nodes[0].metadata[0].value).toBe('Projekt A')
  })

  it('asks before another element is opened, then shows it after "Verwerfen"', async () => {
    render(<App />)
    const [first, second] = graphStore.getState().nodes
    open(first.id)
    await userEvent.type(screen.getByLabelText('Name'), '2')

    open(second.id)
    expect(dialog()).not.toBeNull()
    expect(screen.getByLabelText('Name')).toHaveValue('Projekt A2')

    await userEvent.click(within(dialog()!).getByRole('button', { name: 'Verwerfen' }))
    expect(screen.getByLabelText('Name')).toHaveValue('Projekt B')
  })

  it('does not ask after saving or without edits', async () => {
    render(<App />)
    const [first, second] = graphStore.getState().nodes
    open(first.id)
    await userEvent.type(screen.getByLabelText('Name'), '2')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    open(second.id)
    expect(dialog()).toBeNull()
    expect(screen.getByLabelText('Name')).toHaveValue('Projekt B')
    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(dialog()).toBeNull()
    expect(screen.queryByRole('complementary', { name: 'Metadaten' })).toBeNull()
  })

  it('asks for an edge sidebar too', async () => {
    render(<App />)
    const [edge] = graphStore.getState().edges
    act(() => graphStore.getState().openEdgeSidebar(edge.id))
    await userEvent.type(screen.getByLabelText('Label'), 'x')

    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(dialog()).toHaveTextContent('Ungespeicherte Änderungen an „Verbindung“ verwerfen?')
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
