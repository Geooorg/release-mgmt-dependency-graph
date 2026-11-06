import { describe, expect, it } from 'vitest'
import {
  FIXED_FIELDS,
  NS,
  fieldPredicate,
  flag,
  idToIri,
  integer,
  iriToId,
  numeric,
  rm,
  text,
} from './rdfTerms'

const UUID = '3f2b8a52-9d0e-4c1a-8b6f-0a1b2c3d4e5f'

describe('idToIri / iriToId', () => {
  it('writes a UUID as a urn:uuid IRI', () => {
    expect(idToIri(UUID)).toEqual({ termType: 'NamedNode', value: `urn:uuid:${UUID}` })
  })

  it('writes any other id percent-encoded under the tool namespace', () => {
    expect(idToIri('a b/ü').value).toBe('urn:release-management:id:a%20b%2F%C3%BC')
  })

  it.each([UUID, 'plain', 'a b/ü', 'x#y', '', 'urn:uuid:not-a-uuid'])('maps %j back to itself', (id) => {
    expect(iriToId(idToIri(id).value)).toBe(id)
  })

  it('returns a foreign IRI unchanged', () => {
    expect(iriToId('https://example.org/thing')).toBe('https://example.org/thing')
  })

  it('survives a broken percent sequence', () => {
    expect(iriToId('urn:release-management:id:%E0%A4%A')).toBe('%E0%A4%A')
  })
})

describe('fieldPredicate', () => {
  it('appends the percent-encoded key as a fragment of the type IRI', () => {
    expect(fieldPredicate('t-svc', 'Owner Team').value).toBe('urn:release-management:id:t-svc#Owner%20Team')
    expect(fieldPredicate(UUID, 'Tier').value).toBe(`urn:uuid:${UUID}#Tier`)
  })
})

describe('literals', () => {
  it('types integers, other numbers and flags', () => {
    expect(integer(3)).toEqual({ termType: 'Literal', value: '3', datatype: `${NS.xsd}integer` })
    expect(numeric(120)).toEqual(integer(120))
    expect(numeric(56.5)).toEqual({ termType: 'Literal', value: '56.5', datatype: `${NS.xsd}double` })
    expect(numeric(-0.25).datatype).toBe(`${NS.xsd}double`)
    expect(numeric(1e21)).toEqual({ termType: 'Literal', value: '1e+21', datatype: `${NS.xsd}double` })
    expect(flag(true)).toEqual({ termType: 'Literal', value: 'true', datatype: `${NS.xsd}boolean` })
    expect(text('x').datatype).toBe(`${NS.xsd}string`)
  })

  it('builds vocabulary IRIs', () => {
    expect(rm('Project').value).toBe('urn:release-management:vocab:Project')
  })
})

describe('FIXED_FIELDS', () => {
  const keys = (owner: keyof typeof FIXED_FIELDS) => FIXED_FIELDS[owner].map((field) => field.key)

  it('lists the fixed entries of each owner in canonical order', () => {
    expect(keys('node')).toEqual(['name', 'color', 'status', 'blockiert_grund', 'type', 'class', 'entity', 'version'])
    expect(keys('group')).toEqual(['name', 'color'])
    expect(keys('note')).toEqual(['name', 'color'])
    expect(keys('edge')).toEqual(['name', 'optional', 'type'])
  })

  it('maps the name to rdfs:label', () => {
    expect(FIXED_FIELDS.node[0].predicate).toBe(`${NS.rdfs}label`)
  })

  it('uses distinct predicates within an owner', () => {
    for (const owner of ['node', 'group', 'note', 'edge'] as const) {
      const predicates = FIXED_FIELDS[owner].map((field) => field.predicate)
      expect(new Set(predicates).size).toBe(predicates.length)
    }
  })
})
