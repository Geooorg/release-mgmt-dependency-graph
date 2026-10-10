import { describe, expect, it } from 'vitest'
import { de } from './de'
import { en } from './en'
import { fr } from './fr'
import type { MessageKey } from './messages'

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)]
    .map((match) => match[1])
    .sort()
    .join(',')

const KEYS = Object.keys(de) as MessageKey[]

describe('catalogs', () => {
  for (const [name, catalog] of [
    ['en', en],
    ['fr', fr],
  ] as const) {
    it(`${name} has exactly the keys of de`, () => {
      expect(Object.keys(catalog).sort()).toEqual([...KEYS].sort())
    })

    it(`${name} has no empty text and the same placeholders as de`, () => {
      for (const key of KEYS) {
        expect(catalog[key].trim(), key).not.toBe('')
        expect(placeholders(catalog[key]), key).toBe(placeholders(de[key]))
      }
    })
  }

  it('every plural form has its _one and _other partner', () => {
    for (const key of KEYS) {
      if (key.endsWith('_one')) expect(KEYS, key).toContain(key.replace(/_one$/, '_other'))
      if (key.endsWith('_other')) expect(KEYS, key).toContain(key.replace(/_other$/, '_one'))
    }
  })
})
