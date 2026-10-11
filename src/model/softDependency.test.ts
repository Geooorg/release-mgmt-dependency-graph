import { describe, expect, it } from 'vitest'
import { isOptionalKey, isSoftEdge, SOFT_KEY, SOFT_VALUE, withSoftEntry } from './softDependency'

describe('isSoftEdge', () => {
  it('reads the optional entry: key case-insensitive, value `ja` trimmed and case-insensitive', () => {
    expect(SOFT_KEY).toBe('optional')
    expect(SOFT_VALUE).toBe('ja')
    expect(isSoftEdge({ metadata: [{ key: 'optional', value: 'ja' }] })).toBe(true)
    expect(isSoftEdge({ metadata: [{ key: 'name', value: 'x' }, { key: ' Optional ', value: ' JA ' }] })).toBe(true)
  })

  it('is false without metadata, without the entry or with any other value', () => {
    expect(isSoftEdge({})).toBe(false)
    expect(isSoftEdge({ metadata: [{ key: 'name', value: 'optional' }] })).toBe(false)
    expect(isSoftEdge({ metadata: [{ key: 'optional', value: 'nein' }] })).toBe(false)
    expect(isSoftEdge({ metadata: [{ key: 'optional', value: '' }] })).toBe(false)
  })
})

describe('isOptionalKey', () => {
  it('matches the key ignoring case and surrounding blanks', () => {
    expect(isOptionalKey('optional')).toBe(true)
    expect(isOptionalKey(' OPTIONAL')).toBe(true)
    expect(isOptionalKey('optionally')).toBe(false)
  })
})

describe('withSoftEntry', () => {
  it('puts the canonical entry right after name and replaces every existing one', () => {
    const entries = [
      { key: 'name', value: 'n' },
      { key: 'owner', value: 'x' },
      { key: 'Optional', value: 'nein' },
    ]
    expect(withSoftEntry(entries, true)).toEqual([
      { key: 'name', value: 'n' },
      { key: 'optional', value: 'ja' },
      { key: 'owner', value: 'x' },
    ])
  })

  it('removes every optional entry when not soft', () => {
    expect(withSoftEntry([{ key: 'name', value: 'n' }, { key: 'optional', value: 'ja' }], false)).toEqual([
      { key: 'name', value: 'n' },
    ])
  })

  it('puts the entry first when there is no name', () => {
    expect(withSoftEntry([], true)).toEqual([{ key: 'optional', value: 'ja' }])
  })
})
