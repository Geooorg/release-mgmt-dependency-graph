import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/translate'
import { fullContent } from '../test/rdfFixtures'
import { toTriples } from '../model/rdfExport'
import { modelFromTriples } from '../model/rdfImport'
import { parseModelJson, serializeModel, toModel } from '../model/serialize'
import { exportTurtle, looksLikeJson, parseTurtle, triplesToTurtle, turtleToModelJson } from './rdfIo'

const t = createTranslate('de')

describe('looksLikeJson', () => {
  it.each([
    ['{"version":5}', true],
    ['  \n{', true],
    ['﻿{"a":1}', true],
    ['@prefix rm: <urn:x:> .', false],
    ['', false],
  ])('%j -> %s', (text, expected) => {
    expect(looksLikeJson(text)).toBe(expected)
  })
})

describe('exportTurtle', () => {
  it('writes prefixes and the project resource', async () => {
    const turtle = await exportTurtle(fullContent())
    expect(turtle).toContain('@prefix rm: <urn:release-management:vocab:>')
    expect(turtle).toContain('rm:schemaVersion 5')
    expect(turtle).toContain('rm:Project')
  })

  it('is deterministic', async () => {
    expect(await exportTurtle(fullContent())).toBe(await exportTurtle(fullContent()))
  })
})

describe('Turtle text round trip', () => {
  it('reads back the triples of the written file as the same model', async () => {
    const content = fullContent()
    const parsed = await parseTurtle(await triplesToTurtle(toTriples(content)))
    if (!parsed.ok) throw new Error(parsed.reason)
    const result = modelFromTriples(parsed.triples, t)
    const expected = parseModelJson(serializeModel(toModel(content)))
    expect(result).toEqual(expected)
    expect(result.ok).toBe(true)
  })

  it('survives newlines, quotes, backslashes, tabs and non-ASCII text', async () => {
    const content = fullContent()
    const result = await turtleToModelJson(await exportTurtle(content), t)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const reread = parseModelJson(result.json)
    expect(reread).toEqual(parseModelJson(serializeModel(toModel(content))))
  })
})

describe('turtleToModelJson', () => {
  it('reports a syntax error with the parser reason', async () => {
    const result = await turtleToModelJson('<urn:a> <urn:b> .', t)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatch(/^Die Datei ist kein gültiges Turtle: .*line 1/i)
  })

  it('rejects valid Turtle that is not a project of this tool', async () => {
    const result = await turtleToModelJson('<urn:a> <urn:b> "c" .', t)
    expect(result).toEqual({ ok: false, errors: [t('rdf.error.notThisTool')] })
  })

  it('rejects an empty file', async () => {
    expect(await turtleToModelJson('', t)).toEqual({ ok: false, errors: [t('rdf.error.notThisTool')] })
  })
})

describe('parseTurtle', () => {
  it('keeps datatypes and ignores language tags in the value', async () => {
    const parsed = await parseTurtle('<urn:a> <urn:n> 3 ; <urn:l> "hi"@en ; <urn:d> 1.5e0 .')
    if (!parsed.ok) throw new Error(parsed.reason)
    const objects = parsed.triples.map((triple) => triple.object)
    expect(objects[0]).toMatchObject({ termType: 'Literal', value: '3', datatype: 'http://www.w3.org/2001/XMLSchema#integer' })
    expect(objects[1]).toMatchObject({ termType: 'Literal', value: 'hi' })
    expect(objects[2]).toMatchObject({ termType: 'Literal', datatype: 'http://www.w3.org/2001/XMLSchema#double' })
  })
})
