import { create } from 'zustand'
import type { Locale } from '../i18n/locale'
import { loadLocale, saveLocale } from '../storage/uiPreferences'

interface LocaleState {
  locale: Locale
  setLocale: (locale: Locale) => void
}

/** UI state only: never recorded for undo, never exported. A failed save just means the choice is not remembered. */
export const useLocaleStore = create<LocaleState>((set) => ({
  locale: loadLocale(),
  setLocale: (locale) => {
    set({ locale })
    saveLocale(locale)
  },
}))

export const getLocale = (): Locale => useLocaleStore.getState().locale
export const setLocale = (locale: Locale): void => useLocaleStore.getState().setLocale(locale)
