import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/translate'
import { projectSummary } from './projectSummary'

describe('projectSummary', () => {
  it.each([
    ['de', { objects: 5, groups: 2, connections: 7 }, '5 Objekte, 2 Gruppen, 7 Verbindungen'],
    ['de', { objects: 1, groups: 1, connections: 1 }, '1 Objekt, 1 Gruppe, 1 Verbindung'],
    ['de', { objects: 0, groups: 0, connections: 0 }, '0 Objekte'],
    ['en', { objects: 5, groups: 2, connections: 7 }, '5 objects, 2 groups, 7 connections'],
    ['en', { objects: 1, groups: 0, connections: 1 }, '1 object, 1 connection'],
    ['fr', { objects: 0, groups: 2, connections: 1 }, '0 objet, 2 groupes, 1 liaison'],
  ] as const)('%s: %j', (locale, counts, expected) => {
    expect(projectSummary(counts, createTranslate(locale))).toBe(expected)
  })
})
