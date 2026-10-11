import { de } from './de'
import { en } from './en'
import { fr } from './fr'
import type { Locale } from './locale'
import type { Catalog, MessageKey, Params, PluralKey } from './messages'

export interface Translate {
  (key: MessageKey, params?: Params): string
  /** Picks `<key>_<form>` by the plural rules of the locale (`_other` as fallback); `{count}` is filled in. */
  plural(key: PluralKey, count: number, params?: Params): string
}

const CATALOGS: Record<Locale, Catalog> = { de, en, fr }
const PLACEHOLDER = /\{(\w+)\}/g

function format(template: string, params?: Params): string {
  if (!params) return template
  return template.replace(PLACEHOLDER, (match, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  )
}

const cache = new Map<Locale, Translate>()

export function createTranslate(locale: Locale): Translate {
  const cached = cache.get(locale)
  if (cached) return cached

  const catalog = CATALOGS[locale]
  const rules = new Intl.PluralRules(locale)
  // The fallbacks only matter if the types were bypassed; a missing text must never blank the UI.
  const lookup = (key: MessageKey): string => catalog[key] ?? de[key] ?? key

  const translate = (key: MessageKey, params?: Params): string => format(lookup(key), params)
  const plural = (key: PluralKey, count: number, params?: Params): string => {
    const form = `${key}_${rules.select(count)}` as MessageKey
    const chosen = Object.hasOwn(catalog, form) ? form : (`${key}_other` as MessageKey)
    return format(lookup(chosen), { ...params, count })
  }

  const t: Translate = Object.assign(translate, { plural })
  cache.set(locale, t)
  return t
}
