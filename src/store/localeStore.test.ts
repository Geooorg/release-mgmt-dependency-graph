import { afterEach, describe, expect, it } from 'vitest'
import { loadLocale } from '../storage/uiPreferences'
import { getLocale, setLocale, useLocaleStore } from './localeStore'

afterEach(() => {
  window.localStorage.clear()
})

describe('localeStore', () => {
  it('starts with German', () => {
    expect(getLocale()).toBe('de')
  })

  it('changes and persists the locale', () => {
    setLocale('fr')
    expect(useLocaleStore.getState().locale).toBe('fr')
    expect(loadLocale()).toBe('fr')
  })
})
