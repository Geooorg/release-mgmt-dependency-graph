import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { box, content } from '../test/fixtures'
import { createGraphStore } from './graphStore'
import { connectPersistence } from './persistence'

describe('connectPersistence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const setup = (saveResult = true) => {
    const store = createGraphStore(content([box('a', 0, 0)]))
    const save = vi.fn(() => saveResult)
    const onError = vi.fn()
    const dispose = connectPersistence(store, { save, debounceMs: 100, onError })
    return { store, save, onError, dispose }
  }

  it('saves once after a burst of changes (debounced)', () => {
    const { store, save } = setup()
    store.getState().moveNode('a', { x: 1, y: 1 })
    store.getState().moveNode('a', { x: 2, y: 2 })
    store.getState().moveNode('a', { x: 3, y: 3 })
    expect(save).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({
      nodes: [expect.objectContaining({ id: 'a', position: { x: 3, y: 3 } })],
      edges: [],
      projectName: 'Release-Management',
    })
  })

  it('saves when only the project name changes, and includes it', () => {
    const { store, save } = setup()
    store.getState().renameProject('Neu-Name')
    vi.advanceTimersByTime(100)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ projectName: 'Neu-Name' }))
  })

  it('does not save for UI-only changes', () => {
    const { store, save } = setup()
    store.getState().applyNodeSelection([{ id: 'a', selected: true }])
    store.getState().openSidebar('a')
    store.getState().setTool('connect')
    vi.advanceTimersByTime(1000)
    expect(save).not.toHaveBeenCalled()
  })

  it('flushes pending changes when the page is hidden', () => {
    const { store, save } = setup()
    store.getState().moveNode('a', { x: 9, y: 9 })
    window.dispatchEvent(new Event('pagehide'))
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('flushes on dispose and stops listening afterwards', () => {
    const { store, save, dispose } = setup()
    store.getState().moveNode('a', { x: 9, y: 9 })
    dispose()
    expect(save).toHaveBeenCalledTimes(1)
    store.getState().moveNode('a', { x: 10, y: 10 })
    vi.advanceTimersByTime(1000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('reports a failing save only once until it succeeds again', () => {
    const { store, onError } = setup(false)
    store.getState().moveNode('a', { x: 1, y: 1 })
    vi.advanceTimersByTime(100)
    store.getState().moveNode('a', { x: 2, y: 2 })
    vi.advanceTimersByTime(100)
    expect(onError).toHaveBeenCalledTimes(1)
  })
})
