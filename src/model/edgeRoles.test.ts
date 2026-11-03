import { describe, expect, it } from 'vitest'
import { box, edge } from '../test/fixtures'
import { findCycles } from './cycles'
import { findDependencies } from './dependency'
import {
  analysisContent,
  arrowHeadFor,
  countEdgeRoles,
  getEdgeRoles,
  hasAnalysisRole,
} from './edgeRoles'
import { analyzeProject } from './releaseAnalysis'
import type { Catalog, EdgeRole, GraphContent, ModelEdge } from './types'

const typed = (id: string, source: string, target: string, typeId: string): ModelEdge => ({
  id,
  source,
  target,
  metadata: [
    { key: 'name', value: '' },
    { key: 'type', value: typeId },
  ],
})
const catalog = (roles: Record<string, EdgeRole[]>): Catalog => ({
  elementTypes: [],
  edgeTypes: Object.entries(roles).map(([id, list]) => ({ id, name: id, fields: [], ...(list.length > 0 && { roles: list }) })),
})

describe('getEdgeRoles', () => {
  const c = catalog({ call: ['dependency', 'flow'], note: [] })

  it('counts an untyped connection as sequence', () => {
    expect(getEdgeRoles(edge('e', 'a', 'b'), c)).toEqual(['sequence'])
    expect(getEdgeRoles(edge('e', 'a', 'b'))).toEqual(['sequence'])
  })

  it('returns the roles of a known type, none for a descriptive one', () => {
    expect(getEdgeRoles(typed('e', 'a', 'b', 'call'), c)).toEqual(['dependency', 'flow'])
    expect(getEdgeRoles(typed('e', 'a', 'b', 'note'), c)).toEqual([])
  })

  it('returns no role for an unknown type', () => {
    expect(getEdgeRoles(typed('e', 'a', 'b', 'gone'), c)).toEqual([])
  })
})

describe('arrowHeadFor / hasAnalysisRole', () => {
  it('uses the open head only for dependency', () => {
    expect(arrowHeadFor(['dependency'])).toBe('open')
    expect(arrowHeadFor(['dependency', 'flow'])).toBe('open')
    expect(arrowHeadFor(['sequence'])).toBe('closed')
    expect(arrowHeadFor(['flow'])).toBe('closed')
    expect(arrowHeadFor([])).toBe('closed')
  })

  it('treats only sequence and dependency as roles of the available analyses', () => {
    expect(hasAnalysisRole(['sequence'])).toBe(true)
    expect(hasAnalysisRole(['dependency', 'flow'])).toBe(true)
    expect(hasAnalysisRole(['flow'])).toBe(false)
    expect(hasAnalysisRole([])).toBe(false)
  })
})

describe('analysisContent', () => {
  const nodes = [box('a', 0, 0), box('b', 200, 0), box('c', 400, 0)]
  const c = catalog({ seq: ['sequence'], dep: ['dependency'], flow: ['flow'], none: [] })
  const make = (edges: ModelEdge[]): GraphContent => ({ nodes, edges, catalog: c })

  it('returns the very same content when every connection is untyped', () => {
    const plain = make([edge('e1', 'a', 'b'), edge('e2', 'b', 'c')])
    expect(analysisContent(plain, 'status')).toBe(plain)
    expect(analysisContent(plain, 'highlight')).toBe(plain)
  })

  it('status keeps only sequence connections', () => {
    const content = make([edge('e1', 'a', 'b'), typed('e2', 'b', 'c', 'dep'), typed('e3', 'a', 'c', 'flow'), typed('e4', 'a', 'c', 'none')])
    expect(analysisContent(content, 'status').edges.map((e) => e.id)).toEqual(['e1'])
  })

  it('highlight keeps sequence as is and turns dependency around, keeping the id', () => {
    const content = make([edge('e1', 'a', 'b'), typed('e2', 'b', 'c', 'dep'), typed('e3', 'a', 'c', 'flow')])
    const result = analysisContent(content, 'highlight').edges
    expect(result.map((e) => [e.id, e.source, e.target])).toEqual([
      ['e1', 'a', 'b'],
      ['e2', 'c', 'b'],
    ])
  })

  it('treats a connection of an unknown type as no role', () => {
    const content = make([typed('e1', 'a', 'b', 'gone')])
    expect(analysisContent(content, 'status').edges).toEqual([])
    expect(analysisContent(content, 'highlight').edges).toEqual([])
  })

  it('does not report a cycle for mutual calls, but would for mutual sequence connections', () => {
    const calls = make([typed('e1', 'a', 'b', 'dep'), typed('e2', 'b', 'a', 'dep')])
    expect(findCycles(analysisContent(calls, 'status')).edgeIds.size).toBe(0)
    const order = make([edge('e1', 'a', 'b'), edge('e2', 'b', 'a')])
    expect(findCycles(analysisContent(order, 'status')).edgeIds.size).toBe(2)
  })

  it('does not make a dependency connection wait, but finds it in the highlight with the right direction', () => {
    // a calls b: a depends on b, so b is a prerequisite of a
    const content = make([typed('e1', 'a', 'b', 'dep')])
    const status = analyzeProject(analysisContent(content, 'status'))
    expect(status.waitingIds.size).toBe(0)
    const highlight = findDependencies(analysisContent(content, 'highlight'), ['a'], 'prerequisites')
    expect(highlight.prerequisiteIds).toEqual(['b'])
    expect([...highlight.edgeIds]).toEqual(['e1'])
    const impact = findDependencies(analysisContent(content, 'highlight'), ['b'], 'dependents')
    expect(impact.dependentIds).toEqual(['a'])
  })

  it('leaves the results of a plain release project unchanged', () => {
    const plain = make([edge('e1', 'a', 'b'), edge('e2', 'b', 'c')])
    expect(analyzeProject(analysisContent(plain, 'status'))).toEqual(analyzeProject(plain))
  })
})

describe('countEdgeRoles', () => {
  it('counts sequence, dependency and connections without a role of the available analyses', () => {
    const c = catalog({ dep: ['dependency'], flow: ['flow'], none: [] })
    const content: GraphContent = {
      nodes: [box('a', 0, 0), box('b', 100, 0)],
      edges: [edge('e1', 'a', 'b'), typed('e2', 'a', 'b', 'dep'), typed('e3', 'a', 'b', 'flow'), typed('e4', 'a', 'b', 'none'), typed('e5', 'a', 'b', 'gone')],
      catalog: c,
    }
    expect(countEdgeRoles(content)).toEqual({ sequence: 1, dependency: 1, none: 3 })
  })
})
