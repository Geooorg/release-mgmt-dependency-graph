import { describe, expect, it } from 'vitest'
import { box, content, group } from '../test/fixtures'
import { getAbsolutePosition } from './graph'
import { growGroupsToFit } from './groupGrowth'
import { GROUP_HEADER_HEIGHT, GROUP_PADDING, NODE_SIZE } from './types'
import type { GraphContent } from './types'

const find = (c: GraphContent, id: string) => c.nodes.find((n) => n.id === id)!

describe('growGroupsToFit', () => {
  it('changes nothing while the member lies inside the usable area', () => {
    const c = content([group('g', 0, 0, 400, 300), box('m', 0, GROUP_HEADER_HEIGHT, 'g'), box('top', 240, 244, 'g')])

    expect(growGroupsToFit(c, 'm')).toBe(c)
    expect(growGroupsToFit(c, 'top')).toBe(c)
  })

  it('changes nothing for an element without a parent or an unknown id', () => {
    const c = content([box('a', 0, 0), group('g', 0, 0, 100, 100)])

    expect(growGroupsToFit(c, 'a')).toBe(c)
    expect(growGroupsToFit(c, 'nope')).toBe(c)
  })

  it('grows to the right and bottom with the padding around the member', () => {
    const c = content([group('g', 100, 100, 300, 200), box('m', 250, 180, 'g')])
    const grown = find(growGroupsToFit(c, 'm'), 'g')

    expect(grown.position).toEqual({ x: 100, y: 100 })
    expect(grown.size).toEqual({
      width: 250 + NODE_SIZE.width + GROUP_PADDING,
      height: 180 + NODE_SIZE.height + GROUP_PADDING,
    })
  })

  it('grows to the left and top without moving any member on screen', () => {
    const c = content([group('g', 100, 100, 300, 200), box('m', -50, 10, 'g'), box('other', 40, 80, 'g')])
    const grown = growGroupsToFit(c, 'm')

    // 50 + 24 to the left, 32 + 24 - 10 = 46 to the top
    expect(find(grown, 'g').position).toEqual({ x: 26, y: 54 })
    expect(find(grown, 'g').size).toEqual({ width: 374, height: 246 })
    expect(find(grown, 'm').position).toEqual({ x: GROUP_PADDING, y: GROUP_HEADER_HEIGHT + GROUP_PADDING })
    for (const id of ['m', 'other']) {
      expect(getAbsolutePosition(grown.nodes, id)).toEqual(getAbsolutePosition(c.nodes, id))
    }
  })

  it('lets the parent grow too when the grown group no longer fits into it', () => {
    const c = content([
      group('outer', 0, 0, 400, 400),
      group('inner', 24, 56, 300, 200, 'outer'),
      box('m', 280, 52, 'inner'),
    ])
    const grown = growGroupsToFit(c, 'm')

    const inner = find(grown, 'inner')
    const outer = find(grown, 'outer')
    expect(inner.size!.width).toBe(280 + NODE_SIZE.width + GROUP_PADDING)
    expect(inner.size!.width).toBe(464)
    expect(outer.size!.width).toBe(24 + 464 + GROUP_PADDING)
    expect(outer.size!.height).toBe(400)
  })

  it('does not touch edges, other elements or the input', () => {
    const edge = { id: 'e', source: 'x', target: 'y' }
    const c = { nodes: [group('g', 0, 0, 100, 100), box('m', 200, 200, 'g'), box('x', 900, 900)], edges: [edge] }
    const frozen = JSON.stringify(c)
    const grown = growGroupsToFit(c, 'm')

    expect(grown.edges).toBe(c.edges)
    expect(find(grown, 'x')).toBe(find(c, 'x'))
    expect(JSON.stringify(c)).toBe(frozen)
  })
})
