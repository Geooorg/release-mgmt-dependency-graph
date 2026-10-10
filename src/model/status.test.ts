import { describe, expect, it } from 'vitest'
import { getStatus, parseStatus, STATUS_VALUES } from './status'

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

  it('does not match a differently spelled key', () => {
    expect(getStatus([{ key: 'Status', value: 'fertig' }])).toBe('offen')
  })
})
