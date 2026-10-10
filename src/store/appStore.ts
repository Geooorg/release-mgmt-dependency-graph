import { useStore } from 'zustand'
import { createDefaultContent } from '../model/defaultModel'
import type { GraphContent } from '../model/types'
import { loadStoredContent, saveContent } from '../storage/localStorage'
import {
  loadExportFingerprint,
  loadWorkMode,
  saveExportFingerprint,
  saveWorkMode,
} from '../storage/uiPreferences'
import { createGraphStore, type GraphState, type Notice } from './graphStore'
import { connectPersistence } from './persistence'

/** Previous session's model if there is one, otherwise the two-node starter graph. */
function bootstrap(): { content: GraphContent; notice: Notice | null; persistNow: boolean } {
  const stored = loadStoredContent()
  switch (stored.status) {
    case 'loaded':
      return { content: stored.content, notice: null, persistNow: false }
    case 'invalid':
      return {
        content: createDefaultContent(),
        persistNow: true,
        notice: {
          kind: 'error',
          message: 'Das gespeicherte Modell war ungültig und wurde nicht geladen.',
          details: stored.errors,
        },
      }
    case 'unavailable':
      return {
        content: createDefaultContent(),
        persistNow: false,
        notice: {
          kind: 'error',
          message: 'Der Browser-Speicher ist nicht verfügbar – Änderungen gehen beim Neuladen verloren. Nutze Export.',
        },
      }
    case 'empty':
      return { content: createDefaultContent(), notice: null, persistNow: true }
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
      message: 'Speichern im Browser-Speicher fehlgeschlagen (voll oder blockiert). Bitte Export nutzen.',
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
