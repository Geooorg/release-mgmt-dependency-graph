import { describe, expect, it } from 'vitest'
import { box, content } from '../test/fixtures'
import {
  discardLastRecord,
  emptyHistory,
  HISTORY_LIMIT,
  recordHistory,
  redoHistory,
  undoHistory,
} from './history'

const v = (n: number) => content([box(`n${n}`, n, 0)])

describe('history', () => {
  it('starts empty: nothing to undo or redo', () => {
    expect(undoHistory(emptyHistory, v(0))).toBeUndefined()
    expect(redoHistory(emptyHistory, v(0))).toBeUndefined()
  })

  it('undo returns the recorded state and makes the current one redoable', () => {
    const h = recordHistory(emptyHistory, v(1)) // about to change v1 -> v2
    const undone = undoHistory(h, v(2))!
    expect(undone.content).toBe(h.past[0])
    expect(undone.history.past).toEqual([])
    expect(undone.history.future).toEqual([v(2)])

    const redone = redoHistory(undone.history, undone.content)!
    expect(redone.content).toEqual(v(2))
    expect(redone.history.past).toEqual([v(1)])
    expect(redone.history.future).toEqual([])
  })

  it('walks back through several steps in reverse order', () => {
    let h = emptyHistory
    h = recordHistory(h, v(1))
    h = recordHistory(h, v(2))
    h = recordHistory(h, v(3))
    const first = undoHistory(h, v(4))!
    expect(first.content).toEqual(v(3))
    const second = undoHistory(first.history, first.content)!
    expect(second.content).toEqual(v(2))
  })

  it('a new change clears the redo stack', () => {
    let h = recordHistory(emptyHistory, v(1))
    h = undoHistory(h, v(2))!.history
    expect(h.future).toHaveLength(1)
    h = recordHistory(h, v(1))
    expect(h.future).toEqual([])
  })

  it('caps the number of remembered steps, dropping the oldest', () => {
    let h = emptyHistory
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) h = recordHistory(h, v(i))
    expect(h.past).toHaveLength(HISTORY_LIMIT)
    expect(h.past[0]).toEqual(v(10))
  })

  it('discardLastRecord removes the newest undo step (empty gesture)', () => {
    const h = recordHistory(recordHistory(emptyHistory, v(1)), v(2))
    expect(discardLastRecord(h).past).toEqual([v(1)])
    expect(discardLastRecord(emptyHistory)).toBe(emptyHistory)
  })

  it('never mutates earlier history objects', () => {
    const h = recordHistory(emptyHistory, v(1))
    recordHistory(h, v(2))
    expect(h.past).toEqual([v(1)])
  })
})
