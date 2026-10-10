import { useStore } from 'zustand'
import { createTranslate } from '../i18n/translate'
import { createDefaultContent } from '../model/defaultModel'
import type { GraphContent } from '../model/types'
import { loadStoredContent, saveContent } from '../storage/localStorage'
import {
  loadExportFingerprint,
  loadWorkMode,
  saveExportFingerprint,
  saveWorkMode,
} from '../storage/uiPreferences'
import { getLocale } from './localeStore'
import { createGraphStore, type GraphState, type Notice } from './graphStore'
import { connectPersistence } from './persistence'

/** Previous session's model if there is one, otherwise the two-node starter graph. */
function bootstrap(): { content: GraphContent; notice: Notice | null; persistNow: boolean } {
  const t = createTranslate(getLocale())
  const stored = loadStoredContent(undefined, t)
  switch (stored.status) {
    case 'loaded':
      return { content: stored.content, notice: null, persistNow: false }
    case 'invalid':
      return {
        content: createDefaultContent(undefined, t),
        persistNow: true,
        notice: {
          kind: 'error',
          message: { key: 'notice.stored.invalid' },
          details: stored.errors,
        },
      }
    case 'unavailable':
      return {
        content: createDefaultContent(undefined, t),
        persistNow: false,
        notice: {
          kind: 'error',
          message: { key: 'notice.stored.unavailable' },
        },
      }
    case 'empty':
      return { content: createDefaultContent(undefined, t), notice: null, persistNow: true }
  }
}

const { content, notice, persistNow } = bootstrap()

export const graphStore = createGraphStore(content, undefined, notice, {
  mode: loadWorkMode(),
  exportedFingerprint: loadExportFingerprint(),
})

if (persistNow) saveContent(content)

connectPersistence(graphStore, {
  save: saveContent,
  onError: () =>
    graphStore.getState().notify({
      kind: 'error',
      message: { key: 'notice.save.failed' },
    }),
})

// Per-browser conveniences: the last mode and the state at the last export/import. Failures are harmless.
graphStore.subscribe((state, previous) => {
  if (state.mode !== previous.mode) saveWorkMode(state.mode)
  if (state.exportedFingerprint !== previous.exportedFingerprint && state.exportedFingerprint !== null) {
    saveExportFingerprint(state.exportedFingerprint)
  }
})

export function useGraph<T>(selector: (state: GraphState) => T): T {
  return useStore(graphStore, selector)
}
