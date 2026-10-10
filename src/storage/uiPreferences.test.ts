import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../test/fixtures'
import {
  EXPORT_FINGERPRINT_KEY,
  loadExportFingerprint,
  loadWorkMode,
  saveExportFingerprint,
  saveWorkMode,
  UI_KEY,
} from './uiPreferences'

const throwing = {
  ...memoryStorage(),
  getItem: () => {
    throw new DOMException('blocked', 'SecurityError')
  },
  setItem: () => {
    throw new DOMException('full', 'QuotaExceededError')
  },
} as Storage

describe('work mode', () => {
  it('defaults to build when nothing is stored or storage is unavailable', () => {
    expect(loadWorkMode(memoryStorage())).toBe('build')
    expect(loadWorkMode(null)).toBe('build')
    expect(loadWorkMode(throwing)).toBe('build')
  })

  it('round-trips the mode', () => {
    const storage = memoryStorage()
    expect(saveWorkMode('analyze', storage)).toBe(true)
    expect(loadWorkMode(storage)).toBe('analyze')
    expect(saveWorkMode('build', storage)).toBe(true)
    expect(loadWorkMode(storage)).toBe('build')
  })

  it('keeps other stored preferences when saving', () => {
    const storage = memoryStorage({ [UI_KEY]: '{"other":1}' })
    saveWorkMode('analyze', storage)
    expect(JSON.parse(storage.getItem(UI_KEY)!)).toEqual({ other: 1, mode: 'analyze' })
  })

  it('treats invalid values as build', () => {
    for (const raw of ['not json', '[]', 'null', '{"mode":"edit"}', '{"mode":1}', '"analyze"']) {
      expect(loadWorkMode(memoryStorage({ [UI_KEY]: raw }))).toBe('build')
    }
  })

  it('reports failure to save without throwing', () => {
    expect(saveWorkMode('analyze', null)).toBe(false)
    expect(saveWorkMode('analyze', throwing)).toBe(false)
  })
})

describe('export fingerprint', () => {
  it('is null when nothing is stored or storage is unavailable', () => {
    expect(loadExportFingerprint(memoryStorage())).toBeNull()
    expect(loadExportFingerprint(null)).toBeNull()
    expect(loadExportFingerprint(throwing)).toBeNull()
  })

  it('round-trips under its own key', () => {
    const storage = memoryStorage()
    expect(saveExportFingerprint('abc123', storage)).toBe(true)
    expect(storage.getItem(EXPORT_FINGERPRINT_KEY)).toBe('abc123')
    expect(loadExportFingerprint(storage)).toBe('abc123')
  })

  it('reports failure to save without throwing', () => {
    expect(saveExportFingerprint('x', null)).toBe(false)
    expect(saveExportFingerprint('x', throwing)).toBe(false)
  })
})
