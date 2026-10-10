import { describe, expect, it } from 'vitest'
import { serializeModel, toModel } from '../model/serialize'
import { box, content, edge, memoryStorage } from '../test/fixtures'
import { CORRUPT_KEY, loadStoredContent, saveContent, STORAGE_KEY } from './localStorage'

const sample = content([box('a', 0, 0), box('b', 200, 0)], [edge('e', 'a', 'b')])

describe('localStorage persistence', () => {
  it('reports "empty" when nothing is stored', () => {
    expect(loadStoredContent(memoryStorage())).toEqual({ status: 'empty' })
  })

  it('round-trips a model', () => {
    const storage = memoryStorage()
    expect(saveContent(sample, storage)).toBe(true)
    expect(storage.getItem(STORAGE_KEY)).toBe(serializeModel(toModel(sample)))
    const loaded = loadStoredContent(storage)
    expect(loaded.status).toBe('loaded')
    if (loaded.status === 'loaded') {
      expect(loaded.content.nodes.map((n) => n.id)).toEqual(['a', 'b'])
      expect(loaded.content.edges).toEqual(sample.edges)
    }
  })

  it('quarantines invalid data instead of overwriting it', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: '{"version": 99}' })
    const loaded = loadStoredContent(storage)
    expect(loaded.status).toBe('invalid')
    expect(storage.getItem(CORRUPT_KEY)).toBe('{"version": 99}')
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('quarantines unparsable JSON', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: 'not json' })
    expect(loadStoredContent(storage).status).toBe('invalid')
  })

  it('degrades gracefully when storage is unavailable or throws', () => {
    expect(loadStoredContent(null)).toEqual({ status: 'unavailable' })
    expect(saveContent(sample, null)).toBe(false)
    const throwing = {
      ...memoryStorage(),
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      },
    } as Storage
    expect(saveContent(sample, throwing)).toBe(false)
  })
})
