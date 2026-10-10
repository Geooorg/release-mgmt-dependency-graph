import type { GraphContent } from './types'

/** Undo/redo stacks of model snapshots. Snapshots are immutable, so storing references is enough. */
export interface History {
  past: GraphContent[]
  future: GraphContent[]
}

export const HISTORY_LIMIT = 100

export const emptyHistory: History = { past: [], future: [] }

/** Remember `current` as an undo step before it is changed; a new change invalidates redo. */
export function recordHistory(history: History, current: GraphContent): History {
  return { past: [...history.past, current].slice(-HISTORY_LIMIT), future: [] }
}

export function undoHistory(
  history: History,
  current: GraphContent,
): { history: History; content: GraphContent } | undefined {
  const content = history.past.at(-1)
  if (content === undefined) return undefined
  return { content, history: { past: history.past.slice(0, -1), future: [...history.future, current] } }
}

export function redoHistory(
  history: History,
  current: GraphContent,
): { history: History; content: GraphContent } | undefined {
  const content = history.future.at(-1)
  if (content === undefined) return undefined
  return { content, history: { past: [...history.past, current], future: history.future.slice(0, -1) } }
}

/** Drop the newest undo step (a gesture that turned out to change nothing). */
export function discardLastRecord(history: History): History {
  return history.past.length === 0 ? history : { ...history, past: history.past.slice(0, -1) }
}
