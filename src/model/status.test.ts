import { describe, expect, it } from 'vitest'
import {
  findBlockReasonEntry,
  findStatusEntry,
  getBlockReason,
  getStatus,
  getStatusInfo,
  isBlockReasonKey,
  isStatusKey,
  parseStatus,
  STATUS_VALUES,
  withBlockReasonEntry,
  withStatusEntry,
} from './status'

describe('parseStatus', () => {
  it('accepts the four values in this order, trimmed and case-insensitive', () => {
    expect(STATUS_VALUES).toEqual(['offen', 'in Arbeit', 'blockiert', 'fertig'])
    expect(parseStatus('offen')).toBe('offen')
    expect(parseStatus('  FERTIG ')).toBe('fertig')
    expect(parseStatus('In arbeit')).toBe('in Arbeit')
    expect(parseStatus(' Blockiert')).toBe('blockiert')
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

describe('block reason', () => {
  it('recognises the key trimmed and case-insensitive, first entry wins', () => {
    expect(isBlockReasonKey('blockiert_grund')).toBe(true)
    expect(isBlockReasonKey('  Blockiert_Grund ')).toBe(true)
    expect(isBlockReasonKey('blockiert')).toBe(false)
    expect(isBlockReasonKey('blockiert_grund2')).toBe(false)
    const entries = [
      { key: 'name', value: 'A' },
      { key: 'BLOCKIERT_GRUND', value: 'x' },
      { key: 'blockiert_grund', value: 'y' },
    ]
    expect(findBlockReasonEntry(entries)).toBe(entries[1])
    expect(getBlockReason(entries)).toBe('x')
  })

  it('returns the trimmed reason, undefined when missing or blank', () => {
    expect(getBlockReason([{ key: 'blockiert_grund', value: '  Freigabe fehlt ' }])).toBe('Freigabe fehlt')
    expect(getBlockReason([{ key: 'blockiert_grund', value: '   ' }])).toBeUndefined()
    expect(getBlockReason([{ key: 'name', value: 'A' }])).toBeUndefined()
  })
})

describe('withStatusEntry', () => {
  const base = [
    { key: 'name', value: 'A' },
    { key: 'color', value: '#16a34a' },
    { key: 'owner', value: 'X' },
  ]

  it('inserts a new entry after name and colour', () => {
    expect(withStatusEntry(base, 'in Arbeit')).toEqual([base[0], base[1], { key: 'status', value: 'in Arbeit' }, base[2]])
  })

  it('replaces the first status entry in place, canonically', () => {
    const entries = [base[0], { key: ' Status ', value: 'x' }, base[2]]
    expect(withStatusEntry(entries, 'fertig')).toEqual([base[0], { key: 'status', value: 'fertig' }, base[2]])
  })

  it('keeps the reason while blocked', () => {
    const entries = [base[0], { key: 'status', value: 'blockiert' }, { key: 'blockiert_grund', value: 'Freigabe' }]
    expect(withStatusEntry(entries, 'blockiert')).toEqual(entries)
  })

  it('drops every block reason when the status becomes anything else', () => {
    const entries = [
      base[0],
      { key: 'status', value: 'blockiert' },
      { key: 'blockiert_grund', value: 'Freigabe' },
      base[2],
      { key: ' Blockiert_Grund', value: 'doppelt' },
    ]
    expect(withStatusEntry(entries, 'in Arbeit')).toEqual([base[0], { key: 'status', value: 'in Arbeit' }, base[2]])
  })
})

describe('withBlockReasonEntry', () => {
  const blocked = [
    { key: 'name', value: 'A' },
    { key: 'color', value: '#16a34a' },
    { key: 'status', value: 'blockiert' },
    { key: 'owner', value: 'X' },
  ]

  it('inserts the reason right after the status entry', () => {
    expect(withBlockReasonEntry(blocked, 'Freigabe fehlt')).toEqual([
      blocked[0],
      blocked[1],
      blocked[2],
      { key: 'blockiert_grund', value: 'Freigabe fehlt' },
      blocked[3],
    ])
  })

  it('replaces the first reason in place with the canonical key and removes later ones', () => {
    const entries = [
      blocked[0],
      blocked[2],
      blocked[3],
      { key: ' Blockiert_Grund ', value: 'alt' },
      { key: 'blockiert_grund', value: 'noch einer' },
    ]
    expect(withBlockReasonEntry(entries, ' neu ')).toEqual([
      blocked[0],
      blocked[2],
      blocked[3],
      { key: 'blockiert_grund', value: 'neu' },
    ])
  })

  it('removes the entry for a blank reason', () => {
    const entries = [...blocked, { key: 'blockiert_grund', value: 'alt' }]
    expect(withBlockReasonEntry(entries, '   ')).toEqual(blocked)
    expect(withBlockReasonEntry(blocked, '')).toEqual(blocked)
  })
})
