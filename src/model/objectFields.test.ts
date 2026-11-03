import { describe, expect, it } from 'vitest'
import {
  CLASS_KEY,
  DEFAULT_CLASS,
  DEFAULT_ENTITY,
  DEFAULT_VERSION,
  ENTITY_KEY,
  getClass,
  getEntity,
  getVersion,
  VERSION_KEY,
  withClassEntry,
  withEntityEntry,
  withObjectFields,
  withVersionEntry,
} from './objectFields'

const name = { key: 'name', value: 'A' }

describe('constants', () => {
  it('has the Java root type as default class and an empty entity', () => {
    expect(CLASS_KEY).toBe('class')
    expect(ENTITY_KEY).toBe('entity')
    expect(DEFAULT_CLASS).toBe('java.lang.Object')
    expect(DEFAULT_ENTITY).toBe('')
    expect(VERSION_KEY).toBe('version')
    expect(DEFAULT_VERSION).toBe('')
  })
})

describe('getClass / getEntity', () => {
  it('read the stored values', () => {
    const entries = [name, { key: 'class', value: 'de.mecom.Release' }, { key: 'entity', value: 'rel' }]
    expect(getClass(entries)).toBe('de.mecom.Release')
    expect(getEntity(entries)).toBe('rel')
  })

  it('fall back to the defaults when the entry is missing', () => {
    expect(getClass([name])).toBe('java.lang.Object')
    expect(getEntity([name])).toBe('')
  })

  it('keep an empty stored class empty (the user cleared it)', () => {
    expect(getClass([name, { key: 'class', value: '' }])).toBe('')
  })
})

describe('getVersion', () => {
  it('reads the stored value and falls back to empty', () => {
    expect(getVersion([name, { key: 'version', value: '1.2' }])).toBe('1.2')
    expect(getVersion([name])).toBe('')
  })
})

describe('withObjectFields', () => {
  it('appends the three entries with their defaults after name', () => {
    expect(withObjectFields([name])).toEqual([
      name,
      { key: 'class', value: 'java.lang.Object' },
      { key: 'entity', value: '' },
      { key: 'version', value: '' },
    ])
  })

  it('places them after name, color, status and blockiert_grund but before free fields', () => {
    const entries = [
      name,
      { key: 'color', value: '#112233' },
      { key: 'status', value: 'blockiert' },
      { key: 'blockiert_grund', value: 'x' },
      { key: 'owner', value: 'me' },
    ]
    expect(withObjectFields(entries).map((e) => e.key)).toEqual([
      'name',
      'color',
      'status',
      'blockiert_grund',
      'class',
      'entity',
      'version',
      'owner',
    ])
  })

  it('adds only the missing one and keeps existing values and positions', () => {
    const onlyClass = [name, { key: 'class', value: 'a.B' }, { key: 'owner', value: 'me' }]
    expect(withObjectFields(onlyClass)).toEqual([
      name,
      { key: 'class', value: 'a.B' },
      { key: 'entity', value: '' },
      { key: 'version', value: '' },
      { key: 'owner', value: 'me' },
    ])
    const onlyEntity = [name, { key: 'entity', value: 'e' }]
    expect(withObjectFields(onlyEntity)).toEqual([
      name,
      { key: 'class', value: 'java.lang.Object' },
      { key: 'entity', value: 'e' },
      { key: 'version', value: '' },
    ])
  })

  it('returns the very same array when all entries exist', () => {
    const entries = [name, { key: 'entity', value: '' }, { key: 'class', value: '' }, { key: 'version', value: '' }]
    expect(withObjectFields(entries)).toBe(entries)
  })

  it('does not mutate its input', () => {
    const entries = [name]
    withObjectFields(entries)
    expect(entries).toEqual([name])
  })
})

describe('withClassEntry / withEntityEntry / withVersionEntry', () => {
  it('replace the value in place', () => {
    const entries = [name, { key: 'class', value: 'a.B' }, { key: 'entity', value: 'e' }, { key: 'owner', value: 'me' }]
    expect(withClassEntry(entries, 'c.D')).toEqual([name, { key: 'class', value: 'c.D' }, { key: 'entity', value: 'e' }, { key: 'owner', value: 'me' }])
    expect(withEntityEntry(entries, 'f')).toEqual([name, { key: 'class', value: 'a.B' }, { key: 'entity', value: 'f' }, { key: 'owner', value: 'me' }])
  })

  it('insert a missing entry at the canonical place', () => {
    expect(withClassEntry([name, { key: 'owner', value: 'me' }], 'a.B').map((e) => e.key)).toEqual(['name', 'class', 'owner'])
    expect(withEntityEntry([name, { key: 'class', value: 'a.B' }, { key: 'owner', value: 'me' }], 'e').map((e) => e.key)).toEqual([
      'name',
      'class',
      'entity',
      'owner',
    ])
  })

  it('place version behind class and entity', () => {
    expect(withVersionEntry([name, { key: 'class', value: 'a.B' }, { key: 'entity', value: 'e' }, { key: 'owner', value: 'me' }], '2').map((e) => e.key)).toEqual([
      'name',
      'class',
      'entity',
      'version',
      'owner',
    ])
    expect(withVersionEntry([name, { key: 'version', value: '1' }], '2')).toEqual([name, { key: 'version', value: '2' }])
  })
})
