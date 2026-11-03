import Ajv2020 from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import schema from '../../public/catalog.schema.json'
import { TEMPLATE_IDS, serializeCatalog, templateCatalog } from './catalogTemplates'

const validate = new Ajv2020({ allErrors: true }).compile(schema)

describe('catalog.schema.json', () => {
  it.each(TEMPLATE_IDS)('accepts the exported template %s', (id) => {
    expect(validate(JSON.parse(serializeCatalog(templateCatalog(id))))).toBe(true)
  })

  it('rejects a file without a catalog', () => {
    expect(validate({ catalogVersion: 1 })).toBe(false)
  })

  it('accepts roles and rejects an unknown role', () => {
    const file = (roles: unknown) => ({
      catalogVersion: 1,
      catalog: { elementTypes: [], edgeTypes: [{ id: 'e1', name: 'Aufruf', roles, fields: [] }] },
    })
    expect(validate(file(['flow']))).toBe(true)
    expect(validate(file(['magic']))).toBe(false)
  })
})
