import type { GraphContent } from '../model/types'
import type { GraphStore } from './graphStore'

export interface PersistenceOptions {
  /** Returns false if saving failed. */
  save: (content: GraphContent) => boolean
  debounceMs?: number
  onError?: () => void
}

/**
 * Saves the model whenever `nodes` or `edges` change (debounced), and once more when the page
 * is hidden/closed. Pure UI-state changes (selection, sidebar, …) never trigger a save.
 * Returns a disposer that flushes pending changes and detaches everything.
 */
export function connectPersistence(store: GraphStore, options: PersistenceOptions): () => void {
  const { save, debounceMs = 150, onError } = options
  let timer: ReturnType<typeof setTimeout> | undefined
  let dirty = false
  let failureReported = false

  const flush = () => {
    clearTimeout(timer)
    if (!dirty) return
    dirty = false
    const { nodes, edges } = store.getState()
    if (save({ nodes, edges })) {
      failureReported = false
    } else if (!failureReported) {
      failureReported = true
      onError?.()
    }
  }

  const unsubscribe = store.subscribe((state, previous) => {
    if (state.nodes === previous.nodes && state.edges === previous.edges) return
    dirty = true
    clearTimeout(timer)
    timer = setTimeout(flush, debounceMs)
  })

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flush()
  }
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    unsubscribe()
    window.removeEventListener('pagehide', flush)
    document.removeEventListener('visibilitychange', onVisibility)
    flush()
  }
}
