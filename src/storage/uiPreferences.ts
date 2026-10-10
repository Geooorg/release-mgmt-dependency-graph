import { DEFAULT_LOCALE, parseLocale, type Locale } from '../i18n/locale'
import { parseWorkMode, type WorkMode } from '../model/workMode'
import { getStorage } from './localStorage'

/** Per-browser UI preferences (JSON object); never part of the model or the export. */
export const UI_KEY = 'release-management.ui.v1'
/** Fingerprint of the content at the last export or import (plain string). */
export const EXPORT_FINGERPRINT_KEY = 'release-management.lastExport.v1'

function readPreferences(storage: Storage | null): Record<string, unknown> {
  try {
    const raw = storage?.getItem(UI_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

/** The mode chosen last in this browser; `build` if none, unreadable or invalid. */
export function loadWorkMode(storage: Storage | null = getStorage()): WorkMode {
  return parseWorkMode(readPreferences(storage).mode)
}

/** Returns false if the mode could not be written (storage missing or blocked). */
export function saveWorkMode(mode: WorkMode, storage: Storage | null = getStorage()): boolean {
  if (!storage) return false
  try {
    storage.setItem(UI_KEY, JSON.stringify({ ...readPreferences(storage), mode }))
    return true
  } catch {
    return false
  }
}

/** The interface language chosen last in this browser; German if none, unreadable or invalid. */
export function loadLocale(storage: Storage | null = getStorage()): Locale {
  return parseLocale(readPreferences(storage).locale ?? DEFAULT_LOCALE)
}

/** Returns false if the locale could not be written (storage missing or blocked). */
export function saveLocale(locale: Locale, storage: Storage | null = getStorage()): boolean {
  if (!storage) return false
  try {
    storage.setItem(UI_KEY, JSON.stringify({ ...readPreferences(storage), locale }))
    return true
  } catch {
    return false
  }
}

export function loadExportFingerprint(storage: Storage | null = getStorage()): string | null {
  try {
    return storage?.getItem(EXPORT_FINGERPRINT_KEY) ?? null
  } catch {
    return null
  }
}

/** Returns false if the fingerprint could not be written (storage missing or blocked). */
export function saveExportFingerprint(fingerprint: string, storage: Storage | null = getStorage()): boolean {
  if (!storage) return false
  try {
    storage.setItem(EXPORT_FINGERPRINT_KEY, fingerprint)
    return true
  } catch {
    return false
  }
}
