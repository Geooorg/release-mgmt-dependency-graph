import type { Locale } from '../i18n/locale'
import { useLocaleStore } from '../store/localeStore'

/** Switches the language for one test without touching `localStorage`; `setup.ts` resets it afterwards. */
export function setTestLocale(locale: Locale): void {
  useLocaleStore.setState({ locale })
}
