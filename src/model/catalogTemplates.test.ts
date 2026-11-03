import { describe, expect, it } from 'vitest'
import { checkTypeDef } from './catalog'
import {
  TEMPLATE_IDS,
  catalogFileName,
  parseCatalogText,
  serializeCatalog,
  templateCatalog,
} from './catalogTemplates'
import { createTranslate } from '../i18n/translate'

const t = createTranslate('de')

describe('templates', () => {
  it.each(TEMPLATE_IDS)('template %s is valid and has unique ids', (id) => {
    const catalog = templateCatalog(id)
    for (const side of ['elementTypes', 'edgeTypes'] as const) {
      for (const type of catalog[side]) expect(checkTypeDef(type, catalog[side])).toEqual([])
    }
    const ids = [...catalog.elementTypes, ...catalog.edgeTypes].map((type) => type.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(catalog.elementTypes.length).toBeGreaterThan(0)
  })
})

describe('catalog file', () => {
  it('survives a roundtrip', () => {
    const catalog = templateCatalog('it-services')
    const parsed = parseCatalogText(serializeCatalog(catalog), t)
    expect(parsed).toEqual({ ok: true, catalog })
  })

  it('rejects invalid JSON, a wrong version and a broken catalog', () => {
    expect(parseCatalogText('{', t).ok).toBe(false)
    expect(parseCatalogText(JSON.stringify({ catalogVersion: 2, catalog: {} }), t).ok).toBe(false)
    const broken = { catalogVersion: 1, catalog: { elementTypes: [{ id: 'a', name: '', fields: [] }], edgeTypes: [] } }
    expect(parseCatalogText(JSON.stringify(broken), t).ok).toBe(false)
  })

  it('reports errors in the language of t', () => {
    const result = parseCatalogText('{"catalogVersion":2}', createTranslate('en'))
    expect(result).toEqual({ ok: false, errors: ['Not a catalog file (expected catalogVersion 1).'] })
  })
})

describe('catalogFileName', () => {
  it('uses local time', () => {
    expect(catalogFileName(new Date(2026, 10, 3, 9, 5, 7))).toBe('Katalog_2026-11-03_090507.json')
  })
})
