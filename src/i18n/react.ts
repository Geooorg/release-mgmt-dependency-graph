import { useEffect } from 'react'
import { useLocaleStore } from '../store/localeStore'
import type { Locale } from './locale'
import { createTranslate, type Translate } from './translate'

export function useLocale(): Locale {
  return useLocaleStore((state) => state.locale)
}

/** The translate function of the current language (stable per language, so it is safe in dependency lists). */
export function useT(): Translate {
  return createTranslate(useLocale())
}

/** Keeps `<html lang>` in line with the interface language. */
export function useDocumentLanguage(): void {
  const locale = useLocale()
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
}
