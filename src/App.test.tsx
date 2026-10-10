import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { graphStore } from './store/appStore'

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
  act(() => {
    graphStore.getState().closeSidebar()
    graphStore.getState().cancelSidebarChange()
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
