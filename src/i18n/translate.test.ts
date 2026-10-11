import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, LOCALE_NAMES, LOCALES, parseLocale } from './locale'
import { createTranslate } from './translate'

describe('parseLocale', () => {
  it('accepts the known locales and falls back to German', () => {
    for (const locale of LOCALES) expect(parseLocale(locale)).toBe(locale)
    for (const bad of ['', 'es', 'DE', null, undefined, 3, {}]) expect(parseLocale(bad)).toBe(DEFAULT_LOCALE)
    expect(DEFAULT_LOCALE).toBe('de')
  })

  it('names every locale in its own language', () => {
    expect(LOCALE_NAMES).toEqual({ de: 'Deutsch', en: 'English', fr: 'Français' })
  })
})

describe('createTranslate', () => {
  it('returns the text of the locale', () => {
    expect(createTranslate('de')('language.label')).toBe('Sprache')
    expect(createTranslate('en')('language.label')).toBe('Language')
    expect(createTranslate('fr')('language.label')).toBe('Langue')
  })

  it('is memoized per locale', () => {
    expect(createTranslate('en')).toBe(createTranslate('en'))
  })

  it('replaces placeholders, also repeated ones, and keeps unknown ones', () => {
    const t = createTranslate('de')
    expect(t('cycle.count_other', { count: 3 })).toBe('3 Zyklen')
    expect(t('cycle.count_other')).toBe('{count} Zyklen')
    // {padding} occurs three times in the measures text
    const measures = t('agent.model.measures', { padding: '8px' })
    expect(measures).not.toContain('{padding}')
    expect(measures.match(/8px/g)).toHaveLength(3)
  })

  it('does not let a caller param override the count', () => {
    expect(createTranslate('de').plural('cycle.count', 2, { count: 99 })).toBe('2 Zyklen')
  })

  it('picks the plural form of the locale', () => {
    const de = createTranslate('de')
    expect(de.plural('cycle.count', 1)).toBe('1 Zyklus')
    expect(de.plural('cycle.count', 0)).toBe('0 Zyklen')
    expect(de.plural('cycle.count', 2)).toBe('2 Zyklen')
    const en = createTranslate('en')
    expect(en.plural('cycle.count', 1)).toBe('1 cycle')
    expect(en.plural('cycle.count', 5)).toBe('5 cycles')
    const fr = createTranslate('fr')
    expect(fr.plural('cycle.count', 0)).toBe('0 cycle')
    expect(fr.plural('cycle.count', 1)).toBe('1 cycle')
    expect(fr.plural('cycle.count', 2)).toBe('2 cycles')
  })
})
