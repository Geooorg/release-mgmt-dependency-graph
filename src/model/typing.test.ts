import { describe, expect, it } from 'vitest'
import {
  getTypeId,
  missingRequired,
  resolveColor,
  resolveType,
  withFieldValue,
  withTypeDefaults,
  withTypeEntry,
} from './typing'
import type { MetadataEntry, TypeDef } from './types'

const e = (key: string, value: string): MetadataEntry => ({ key, value })
const service: TypeDef = {
  id: 't1',
  name: 'Service',
  color: '#10b981',
  fields: [
    { key: 'owner', kind: 'text', required: true },
    { key: 'env', kind: 'select', options: ['prod', 'test'], default: 'test' },
  ],
}
const objectEntries = [e('name', 'A'), e('status', 'offen'), e('class', 'x'), e('entity', ''), e('version', ''), e('frei', '1')]

describe('getTypeId / resolveType', () => {
  it('reads the id, treats blank as none', () => {
    expect(getTypeId([e('name', 'A'), e('type', ' t1 ')])).toBe('t1')
    expect(getTypeId([e('name', 'A'), e('type', ' ')])).toBeUndefined()
    expect(getTypeId([e('name', 'A')])).toBeUndefined()
  })

  it('tells none, known and unknown apart', () => {
    expect(resolveType([e('name', 'A')], [service])).toEqual({ state: 'none' })
    expect(resolveType([e('name', 'A'), e('type', 't1')], [service])).toEqual({ state: 'known', def: service })
    expect(resolveType([e('name', 'A'), e('type', 'gone')], [service])).toEqual({ state: 'unknown', id: 'gone' })
  })
})

describe('withTypeEntry', () => {
  it('puts type behind status and in front of class', () => {
    expect(withTypeEntry(objectEntries, 't1').map((x) => x.key)).toEqual(
      ['name', 'status', 'type', 'class', 'entity', 'version', 'frei'],
    )
  })

  it('puts type behind name and optional on a connection', () => {
    expect(withTypeEntry([e('name', ''), e('optional', 'ja')], 't1').map((x) => x.key)).toEqual(['name', 'optional', 'type'])
  })

  it('replaces in place and removes with undefined', () => {
    const typed = withTypeEntry(objectEntries, 't1')
    expect(withTypeEntry(typed, 't2')).toContainEqual(e('type', 't2'))
    expect(withTypeEntry(typed, undefined)).toEqual(objectEntries)
  })
})

describe('withTypeDefaults / withFieldValue', () => {
  it('restores catalog order when an existing field is later in the catalog than a missing one', () => {
    const result = withTypeDefaults([e('name', 'A'), e('env', 'prod'), e('frei', '1')], service)
    expect(result).toEqual([e('name', 'A'), e('owner', ''), e('env', 'prod'), e('frei', '1')])
  })

  it('leaves the content unchanged when nothing is missing and the order is right', () => {
    const entries = [e('name', 'A'), e('owner', 'Anna'), e('env', 'prod'), e('frei', '1')]
    expect(withTypeDefaults(entries, service)).toEqual(entries)
  })

  it('pulls a field that sits behind a free entry into the field block, keeping its value', () => {
    const result = withTypeDefaults([e('name', 'A'), e('frei', '1'), e('owner', 'Anna')], service)
    expect(result).toEqual([e('name', 'A'), e('owner', 'Anna'), e('env', 'test'), e('frei', '1')])
  })

  it('adds missing fields with their default behind the version, keeps existing values', () => {
    const entries = withTypeDefaults([...withTypeEntry(objectEntries, 't1').slice(0, 6), e('owner', 'Anna')], service)
    expect(entries.map((x) => x.key)).toEqual(['name', 'status', 'type', 'class', 'entity', 'version', 'owner', 'env'])
    expect(entries.find((x) => x.key === 'owner')?.value).toBe('Anna')
    expect(entries.find((x) => x.key === 'env')?.value).toBe('test')
  })

  it('writes a field value in place or at the end of the fixed entries', () => {
    expect(withFieldValue(objectEntries, 'owner', 'Anna').map((x) => x.key)).toEqual(
      ['name', 'status', 'class', 'entity', 'version', 'owner', 'frei'],
    )
    expect(withFieldValue([e('name', 'A'), e('owner', 'x')], 'owner', 'y')).toEqual([e('name', 'A'), e('owner', 'y')])
  })
})

describe('resolveColor', () => {
  it('prefers the element colour, then the type colour', () => {
    expect(resolveColor([e('name', 'A'), e('color', '#FF0000'), e('type', 't1')], [service])).toBe('#ff0000')
    expect(resolveColor([e('name', 'A'), e('type', 't1')], [service])).toBe('#10b981')
    expect(resolveColor([e('name', 'A'), e('type', 'gone')], [service])).toBeUndefined()
  })
})

describe('missingRequired', () => {
  it('lists required fields whose value is empty or absent', () => {
    expect(missingRequired([e('name', 'A')], service)).toEqual(['owner'])
    expect(missingRequired([e('name', 'A'), e('owner', ' ')], service)).toEqual(['owner'])
    expect(missingRequired([e('name', 'A'), e('owner', 'Anna')], service)).toEqual([])
  })
})
