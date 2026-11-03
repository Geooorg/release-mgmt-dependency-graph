import { describe, expect, it } from 'vitest'
import { box, counterIds } from '../test/fixtures'
import {
  addType,
  checkTypeDef,
  countUsage,
  findType,
  mergeCatalog,
  removeType,
  replaceType,
  tidyType,
  uniqueName,
  withFreshIds,
} from './catalog'
import { EMPTY_CATALOG } from './types'
import type { Catalog, TypeDef } from './types'

const def = (over: Partial<TypeDef> = {}): TypeDef => ({ id: 't1', name: 'Service', fields: [], ...over })
const catalogOf = (...types: TypeDef[]): Catalog => ({ ...EMPTY_CATALOG, elementTypes: types })

describe('checkTypeDef', () => {
  it('accepts a plain type', () => {
    expect(checkTypeDef(def(), [])).toEqual([])
  })

  it('rejects an empty name', () => {
    expect(checkTypeDef(def({ name: '  ' }), [])).toEqual(['name.empty'])
  })

  it('rejects a name another type already has, ignoring case and spaces, but not its own', () => {
    expect(checkTypeDef(def({ id: 't2', name: ' service ' }), [def()])).toEqual(['name.taken'])
    expect(checkTypeDef(def(), [def()])).toEqual([])
  })

  it('rejects an invalid colour', () => {
    expect(checkTypeDef(def({ color: 'red' }), [])).toEqual(['color.invalid'])
  })

  it('rejects empty, reserved and duplicate field keys', () => {
    const fields = [
      { key: ' ', kind: 'text' as const },
      { key: 'Status', kind: 'text' as const },
      { key: 'owner', kind: 'text' as const },
      { key: 'OWNER', kind: 'text' as const },
    ]
    expect(checkTypeDef(def({ fields }), [])).toEqual(['field.keyEmpty', 'field.keyReserved', 'field.keyDuplicate'])
  })

  it('needs options for a select, without duplicates, and a default among them', () => {
    const select = (options: string[] | undefined, standard?: string) =>
      def({ fields: [{ key: 'env', kind: 'select', options, default: standard }] })
    expect(checkTypeDef(select(undefined), [])).toEqual(['field.optionsEmpty'])
    expect(checkTypeDef(select(['prod', 'Prod']), [])).toEqual(['field.optionsDuplicate'])
    expect(checkTypeDef(select(['prod', 'test'], 'dev'), [])).toEqual(['field.defaultInvalid'])
    expect(checkTypeDef(select(['prod', 'test'], 'test'), [])).toEqual([])
  })

  it('allows only ja, nein or nothing as boolean default', () => {
    const flag = (standard: string) => def({ fields: [{ key: 'tls', kind: 'boolean', default: standard }] })
    expect(checkTypeDef(flag('ja'), [])).toEqual([])
    expect(checkTypeDef(flag('vielleicht'), [])).toEqual(['field.defaultInvalid'])
  })
})

describe('tidyType', () => {
  it('trims, lower-cases the colour, drops empty options, defaults and colours', () => {
    const tidy = tidyType(
      def({
        name: ' Service ',
        color: '#AABBCC',
        fields: [{ key: ' env ', kind: 'select', options: [' prod ', ''], default: ' ', required: false }],
      }),
    )
    expect(tidy).toEqual({
      id: 't1',
      name: 'Service',
      color: '#aabbcc',
      fields: [{ key: 'env', kind: 'select', options: ['prod'] }],
    })
    expect('color' in tidyType(def({ color: '' }))).toBe(false)
  })
})

describe('catalog operations', () => {
  it('adds a type with a fresh id and rejects a taken name', () => {
    const ids = counterIds()
    const added = addType(EMPTY_CATALOG, 'elementTypes', 'Service', ids)
    expect(added?.catalog.elementTypes).toHaveLength(1)
    expect(findType(added!.catalog, 'elementTypes', added!.id)?.name).toBe('Service')
    expect(addType(added!.catalog, 'elementTypes', 'service', ids)).toBeUndefined()
  })

  it('does not touch the other list', () => {
    const added = addType(EMPTY_CATALOG, 'edgeTypes', 'Datenfluss', counterIds())
    expect(added?.catalog.elementTypes).toBe(EMPTY_CATALOG.elementTypes)
  })

  it('suggests a unique name', () => {
    expect(uniqueName([], 'Neuer Typ')).toBe('Neuer Typ')
    expect(uniqueName([def({ name: 'Neuer Typ' }), def({ id: 'x', name: 'neuer typ 2' })], 'Neuer Typ')).toBe('Neuer Typ 3')
  })

  it('replaces a type by id, keeps the same catalog for invalid or unchanged input', () => {
    const catalog = catalogOf(def())
    const renamed = replaceType(catalog, 'elementTypes', def({ name: 'Dienst' }))
    expect(renamed.elementTypes[0].name).toBe('Dienst')
    expect(replaceType(catalog, 'elementTypes', def({ name: '' }))).toBe(catalog)
    expect(replaceType(catalog, 'elementTypes', def())).toBe(catalog)
    expect(replaceType(catalog, 'elementTypes', def({ id: 'unknown' }))).toBe(catalog)
  })

  it('removes a type by id', () => {
    const catalog = catalogOf(def(), def({ id: 't2', name: 'DB' }))
    expect(removeType(catalog, 'elementTypes', 't1').elementTypes.map((t) => t.id)).toEqual(['t2'])
    expect(removeType(catalog, 'elementTypes', 'unknown')).toBe(catalog)
  })

  it('merges by name: existing names are skipped, new types get fresh ids', () => {
    const merged = mergeCatalog(catalogOf(def()), catalogOf(def({ id: 'a', name: 'service' }), def({ id: 'b', name: 'Queue' })), counterIds())
    expect(merged.elementTypes.map((t) => t.name)).toEqual(['Service', 'Queue'])
    expect(merged.elementTypes[1].id).not.toBe('b')
  })

  it('gives every type a fresh id', () => {
    const fresh = withFreshIds(catalogOf(def()), counterIds())
    expect(fresh.elementTypes[0].id).not.toBe('t1')
    expect(fresh.elementTypes[0].name).toBe('Service')
  })
})

describe('countUsage', () => {
  it('counts the objects and connections that use a type', () => {
    const typed = { ...box('a', 0, 0), metadata: [{ key: 'name', value: 'A' }, { key: 'type', value: 't1' }] }
    const content = {
      nodes: [typed, box('b', 100, 0)],
      edges: [{ id: 'e', source: 'a', target: 'b', metadata: [{ key: 'name', value: '' }, { key: 'type', value: 'e1' }] }],
    }
    expect(countUsage(content, 'elementTypes', 't1')).toBe(1)
    expect(countUsage(content, 'edgeTypes', 'e1')).toBe(1)
    expect(countUsage(content, 'elementTypes', 'other')).toBe(0)
  })
})

describe('connection roles', () => {
  const edgeType = (roles?: TypeDef['roles']): TypeDef => ({ id: 'e1', name: 'Aufruf', fields: [], ...(roles && { roles }) })

  it('tidies roles into canonical order without duplicates and drops an empty list', () => {
    expect(tidyType(edgeType(['flow', 'dependency', 'flow'])).roles).toEqual(['dependency', 'flow'])
    expect('roles' in tidyType(edgeType([]))).toBe(false)
  })

  it('accepts every combination except sequence together with dependency', () => {
    expect(checkTypeDef(edgeType(['sequence', 'flow']), [], 'edgeTypes')).toEqual([])
    expect(checkTypeDef(edgeType(['dependency', 'flow']), [], 'edgeTypes')).toEqual([])
    expect(checkTypeDef(edgeType(['sequence', 'dependency']), [], 'edgeTypes')).toEqual(['roles.conflict'])
  })

  it('rejects roles on an element type but only when the side is known', () => {
    expect(checkTypeDef(edgeType(['flow']), [], 'elementTypes')).toEqual(['roles.onElementType'])
    expect(checkTypeDef(edgeType(['flow']), [])).toEqual([])
  })

  it('keeps roles through replaceType and refuses a conflicting update', () => {
    const catalog: Catalog = { elementTypes: [], edgeTypes: [edgeType()] }
    const updated = replaceType(catalog, 'edgeTypes', edgeType(['dependency', 'flow']))
    expect(updated.edgeTypes[0].roles).toEqual(['dependency', 'flow'])
    expect(replaceType(catalog, 'edgeTypes', edgeType(['sequence', 'dependency']))).toBe(catalog)
  })

  it('refuses roles on a new element type via replaceType', () => {
    const catalog: Catalog = { elementTypes: [{ id: 't1', name: 'Service', fields: [] }], edgeTypes: [] }
    expect(replaceType(catalog, 'elementTypes', { id: 't1', name: 'Service', fields: [], roles: ['flow'] })).toBe(catalog)
  })
})
