import { describe, expect, it } from 'vitest'
import { findDuplicateKeys, getName, normalizeMetadata } from './metadata'
import type { MetadataEntry } from './types'

const entry = (key: string, value: string): MetadataEntry => ({ key, value })

describe('normalizeMetadata', () => {
  it('prepends an empty name entry when there is none', () => {
    expect(normalizeMetadata([])).toEqual([entry('name', '')])
    expect(normalizeMetadata([entry('owner', 'Anna')])).toEqual([
      entry('name', ''),
      entry('owner', 'Anna'),
    ])
  })

  it('trims keys and values', () => {
    expect(normalizeMetadata([entry('  name ', '  Server  '), entry(' owner\t', ' Anna ')])).toEqual([
      entry('name', 'Server'),
      entry('owner', 'Anna'),
    ])
  })

  it('drops entries whose trimmed key is empty but keeps empty values', () => {
    expect(
      normalizeMetadata([
        entry('name', 'A'),
        entry('', 'orphan value'),
        entry('   ', 'also dropped'),
        entry('note', ''),
      ]),
    ).toEqual([entry('name', 'A'), entry('note', '')])
  })

  it('moves the first name entry to index 0 and keeps the order of everything else', () => {
    expect(
      normalizeMetadata([entry('owner', 'Anna'), entry('name', 'A'), entry('env', 'prod')]),
    ).toEqual([entry('name', 'A'), entry('owner', 'Anna'), entry('env', 'prod')])
  })

  it('does not remove duplicates; later name entries stay in place', () => {
    expect(
      normalizeMetadata([
        entry('env', 'a'),
        entry('name', 'first'),
        entry('env', 'b'),
        entry('name', 'second'),
      ]),
    ).toEqual([entry('name', 'first'), entry('env', 'a'), entry('env', 'b'), entry('name', 'second')])
  })

  it('treats the name key case-sensitively', () => {
    expect(normalizeMetadata([entry('Name', 'A')])).toEqual([entry('name', ''), entry('Name', 'A')])
  })

  it('is idempotent', () => {
    const once = normalizeMetadata([entry('x', ' 1 '), entry('name', ' n '), entry('', 'y')])
    expect(normalizeMetadata(once)).toEqual(once)
  })

  it('never mutates its input and returns new entry objects', () => {
    const input = Object.freeze([
      Object.freeze(entry('owner', ' Anna ')),
      Object.freeze(entry('name', 'A')),
    ])
    const result = normalizeMetadata(input)
    expect(input).toEqual([entry('owner', ' Anna '), entry('name', 'A')])
    expect(result).not.toBe(input)
    expect(result[0]).not.toBe(input[1])
  })
})

describe('findDuplicateKeys', () => {
  it('returns [] when all keys are unique', () => {
    expect(findDuplicateKeys([entry('name', 'A'), entry('owner', 'B')])).toEqual([])
    expect(findDuplicateKeys([])).toEqual([])
  })

  it('returns each duplicated key once, in order of first occurrence', () => {
    expect(
      findDuplicateKeys([
        entry('b', '1'),
        entry('a', '1'),
        entry('b', '2'),
        entry('a', '2'),
        entry('b', '3'),
        entry('c', '1'),
      ]),
    ).toEqual(['b', 'a'])
  })

  it('compares after trimming', () => {
    expect(findDuplicateKeys([entry(' a', '1'), entry('a ', '2')])).toEqual(['a'])
  })

  it('is case-sensitive', () => {
    expect(findDuplicateKeys([entry('a', '1'), entry('A', '2')])).toEqual([])
  })

  it('ignores entries with an empty key', () => {
    expect(findDuplicateKeys([entry('', '1'), entry('  ', '2'), entry('', '3')])).toEqual([])
  })
})

describe('getName', () => {
  it('returns the value of the name entry', () => {
    expect(getName([entry('owner', 'Anna'), entry('name', 'Server')])).toBe('Server')
  })

  it("returns '' if there is no name entry", () => {
    expect(getName([])).toBe('')
    expect(getName([entry('owner', 'Anna')])).toBe('')
  })

  it('returns the first name entry if there are several', () => {
    expect(getName([entry('name', 'first'), entry('name', 'second')])).toBe('first')
  })
})
