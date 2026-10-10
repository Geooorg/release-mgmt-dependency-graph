import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROJECT_NAME,
  MAX_PROJECT_NAME_LENGTH,
  isValidProjectName,
  sanitizeProjectName,
} from './projectName'

describe('DEFAULT_PROJECT_NAME', () => {
  it('is "Release-Management" and itself valid', () => {
    expect(DEFAULT_PROJECT_NAME).toBe('Release-Management')
    expect(isValidProjectName(DEFAULT_PROJECT_NAME)).toBe(true)
  })
})

describe('isValidProjectName', () => {
  it('accepts letters, digits, hyphen, underscore and dot', () => {
    for (const ok of ['A', 'z', '0', 'Release-Management', 'my_project.v2', 'a.b-c_d', '..', 'ABCxyz0189']) {
      expect(isValidProjectName(ok)).toBe(true)
    }
  })

  it('rejects everything else', () => {
    for (const bad of [
      '',
      ' ',
      'a b',
      ' a',
      'a ',
      'Müller',
      'a/b',
      'a\\b',
      'a:b',
      'a*b',
      'a?b',
      'a<b',
      'a"b',
      'a|b',
      'a,b',
      'a+b',
      'a\nb',
      'a\tb',
      '日本語',
      'emoji😀',
    ]) {
      expect(isValidProjectName(bad)).toBe(false)
    }
  })

  it('limits the length so the file name stays usable', () => {
    expect(isValidProjectName('a'.repeat(MAX_PROJECT_NAME_LENGTH))).toBe(true)
    expect(isValidProjectName('a'.repeat(MAX_PROJECT_NAME_LENGTH + 1))).toBe(false)
  })
})

describe('sanitizeProjectName', () => {
  it('removes disallowed characters and keeps the rest in order', () => {
    expect(sanitizeProjectName('Mein Projekt!')).toBe('MeinProjekt')
    expect(sanitizeProjectName('a/b\\c:d')).toBe('abcd')
    expect(sanitizeProjectName('Müller_2026')).toBe('Mller_2026')
    expect(sanitizeProjectName('ok-name_1.0')).toBe('ok-name_1.0')
  })

  it('truncates to the maximum length', () => {
    expect(sanitizeProjectName('a'.repeat(500))).toHaveLength(MAX_PROJECT_NAME_LENGTH)
  })

  it('may return an empty string', () => {
    expect(sanitizeProjectName('äöü !?')).toBe('')
  })
})
