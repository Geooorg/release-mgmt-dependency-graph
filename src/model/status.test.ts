import { describe, expect, it } from 'vitest'
import { findStatusEntry, getStatus, getStatusInfo, isStatusKey, parseStatus, STATUS_VALUES } from './status'

describe('parseStatus', () => {
  it('accepts the three values, trimmed and case-insensitive', () => {
    expect(STATUS_VALUES).toEqual(['offen', 'in Arbeit', 'fertig'])
    expect(parseStatus('offen')).toBe('offen')
    expect(parseStatus('  FERTIG ')).toBe('fertig')
    expect(parseStatus('In arbeit')).toBe('in Arbeit')
  })

  it('returns undefined for anything else', () => {
    expect(parseStatus('')).toBeUndefined()
    expect(parseStatus('erledigt')).toBeUndefined()
  })
})

describe('getStatus', () => {
  it('reads the status entry', () => {
    expect(getStatus([{ key: 'name', value: 'A' }, { key: 'status', value: 'fertig' }])).toBe('fertig')
    expect(getStatus([{ key: 'status', value: ' In Arbeit ' }])).toBe('in Arbeit')
  })

  it('falls back to offen when missing or unknown', () => {
    expect(getStatus([{ key: 'name', value: 'A' }])).toBe('offen')
    expect(getStatus([{ key: 'status', value: 'bald' }])).toBe('offen')
    expect(getStatus([{ key: 'status', value: '' }])).toBe('offen')
  })

  it('finds the key trimmed and case-insensitive', () => {
    expect(getStatus([{ key: 'Status', value: 'fertig' }])).toBe('fertig')
    expect(getStatus([{ key: ' STATUS ', value: 'in Arbeit' }])).toBe('in Arbeit')
  })

  it('does not match other keys', () => {
    expect(getStatus([{ key: 'Zustand', value: 'fertig' }])).toBe('offen')
    expect(getStatus([{ key: 'status2', value: 'fertig' }])).toBe('offen')
  })

  it('uses the first matching entry', () => {
    expect(
      getStatus([
        { key: 'Status', value: 'in Arbeit' },
        { key: 'status', value: 'fertig' },
      ]),
    ).toBe('in Arbeit')
  })
})

describe('isStatusKey / findStatusEntry', () => {
  it('recognises the key regardless of case and surrounding spaces', () => {
    expect(isStatusKey('status')).toBe(true)
    expect(isStatusKey('  Status')).toBe(true)
    expect(isStatusKey('statuses')).toBe(false)
    expect(isStatusKey('')).toBe(false)
  })

  it('returns the first matching entry', () => {
    const entries = [
      { key: 'name', value: 'A' },
      { key: 'STATUS', value: 'x' },
      { key: 'status', value: 'y' },
    ]
    expect(findStatusEntry(entries)).toBe(entries[1])
    expect(findStatusEntry([{ key: 'name', value: 'A' }])).toBeUndefined()
  })
})

describe('getStatusInfo', () => {
  it('reports a known value with its trimmed raw text', () => {
    expect(getStatusInfo([{ key: 'status', value: ' Fertig ' }])).toEqual({
      status: 'fertig',
      raw: 'Fertig',
      known: true,
    })
  })

  it('treats a missing entry and an empty value alike: offen, no raw value, known', () => {
    const expected = { status: 'offen', raw: undefined, known: true }
    expect(getStatusInfo([{ key: 'name', value: 'A' }])).toEqual(expected)
    expect(getStatusInfo([{ key: 'status', value: '' }])).toEqual(expected)
    expect(getStatusInfo([{ key: 'status', value: '   ' }])).toEqual(expected)
  })

  it('flags an unknown value, which still counts as offen', () => {
    expect(getStatusInfo([{ key: 'Status', value: ' erledigt ' }])).toEqual({
      status: 'offen',
      raw: 'erledigt',
      known: false,
    })
  })
})
