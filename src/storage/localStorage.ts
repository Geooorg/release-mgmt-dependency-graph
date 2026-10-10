import { createTranslate, type Translate } from '../i18n/translate'
import { parseModelJson, serializeModel, toModel } from '../model/serialize'
import type { GraphContent } from '../model/types'

export const STORAGE_KEY = 'release-management.graph.v1'
export const CORRUPT_KEY = `${STORAGE_KEY}.corrupt`

export type LoadResult =
  | { status: 'loaded'; content: GraphContent }
  | { status: 'empty' }
  | { status: 'invalid'; errors: string[] }
  | { status: 'unavailable' }

/** `window.localStorage` can throw (blocked cookies, private mode) or be missing. */
export function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/**
 * Reads the model of a previous session. An unparsable/invalid value is moved to
 * `CORRUPT_KEY` (so it is not silently overwritten) and reported as 'invalid' with errors in the language of `t`.
 */
export function loadStoredContent(
  storage: Storage | null = getStorage(),
  t: Translate = createTranslate('de'),
): LoadResult {
  if (!storage) return { status: 'unavailable' }
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return { status: 'empty' }
    const result = parseModelJson(raw, t)
    if (result.ok) {
      const { nodes, edges, projectName } = result.model
      return { status: 'loaded', content: { nodes, edges, projectName } }
    }
    storage.setItem(CORRUPT_KEY, raw)
    storage.removeItem(STORAGE_KEY)
    return { status: 'invalid', errors: result.errors }
  } catch {
    return { status: 'unavailable' }
  }
}

/** Returns false if the model could not be written (storage missing or quota exceeded). */
export function saveContent(content: GraphContent, storage: Storage | null = getStorage()): boolean {
  if (!storage) return false
  try {
    storage.setItem(STORAGE_KEY, serializeModel(toModel(content)))
    return true
  } catch {
    return false
  }
}
