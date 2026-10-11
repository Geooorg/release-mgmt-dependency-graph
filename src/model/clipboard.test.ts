import { describe, expect, it } from 'vitest'
import { box, content, counterIds, edge, group, note } from '../test/fixtures'
import { copyElements, pasteElements } from './clipboard'
import { getAbsolutePosition } from './graph'
import type { GraphContent } from './types'

const OFFSET = { x: 24, y: 24 }
const find = (c: GraphContent, id: string) => c.nodes.find((n) => n.id === id)!
const names = (c: GraphContent) => c.nodes.map((n) => n.metadata[0].value)

describe('copyElements', () => {
  it('copies the listed objects and groups', () => {
    const c = content([box('a', 0, 0), box('b', 300, 0), group('g', 0, 200, 300, 200)])
    const clip = copyElements(c, ['a', 'g'])

    expect(clip?.entries.map((e) => e.node.id)).toEqual(['a', 'g'])
  })

  it('takes the content of a copied group along, parents first', () => {
    const c = content([
      box('a', 0, 0),
      group('outer', 0, 200, 600, 400),
      group('inner', 24, 56, 300, 200, 'outer'),
      box('m', 24, 56, 'inner'),
    ])
    const ids = copyElements(c, ['outer'])?.entries.map((e) => e.node.id)

    expect(ids).toEqual(['outer', 'inner', 'm'])
  })

  it('does not take a member along when only the member is listed, nor twice when both are', () => {
    const c = content([group('g', 0, 0, 400, 300), box('m', 24, 56, 'g'), box('n', 224, 56, 'g')])

    expect(copyElements(c, ['m'])?.entries.map((e) => e.node.id)).toEqual(['m'])
    expect(copyElements(c, ['g', 'm'])?.entries.map((e) => e.node.id)).toEqual(['g', 'm', 'n'])
  })

  it('remembers the canvas position of every copied element', () => {
    const c = content([group('g', 100, 200, 400, 300), box('m', 24, 56, 'g')])

    expect(copyElements(c, ['m'])?.entries[0].absolute).toEqual({ x: 124, y: 256 })
  })

  it('has nothing to copy for an empty or unknown list', () => {
    const c = content([box('a', 0, 0)])

    expect(copyElements(c, [])).toBeUndefined()
    expect(copyElements(c, ['nope'])).toBeUndefined()
  })
})

describe('pasteElements', () => {
  it('adds copies with new ids, the same metadata and a shifted position', () => {
    const c = content([box('a', 100, 100)])
    const result = pasteElements(c, copyElements(c, ['a'])!, OFFSET, counterIds())

    expect(result.rootIds).toEqual(['id-1'])
    expect(result.count).toBe(1)
    expect(find(result.content, 'id-1')).toEqual({
      id: 'id-1',
      kind: 'node',
      position: { x: 124, y: 124 },
      metadata: [{ key: 'name', value: 'a' }],
    })
    expect(find(result.content, 'a')).toBe(find(c, 'a'))
  })

  it('never reuses an id', () => {
    const c = content([group('g', 0, 0, 400, 300), box('m', 24, 56, 'g')])
    const result = pasteElements(c, copyElements(c, ['g'])!, OFFSET, counterIds())
    const ids = result.content.nodes.map((n) => n.id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(result.count).toBe(2)
  })

  it('copies a group with its content, re-linked to the new group', () => {
    const c = content([group('g', 0, 0, 400, 300), box('m', 24, 56, 'g')])
    const result = pasteElements(c, copyElements(c, ['g'])!, OFFSET, counterIds())

    const [newGroup, newMember] = result.content.nodes.slice(2)
    expect(result.rootIds).toEqual([newGroup.id])
    expect(newGroup).toMatchObject({ kind: 'group', position: { x: 24, y: 24 }, size: { width: 400, height: 300 } })
    expect(newMember.parentId).toBe(newGroup.id)
    expect(newMember.position).toEqual({ x: 24, y: 56 })
  })

  it('does not copy connections, neither the existing nor new ones', () => {
    const c = content([box('a', 0, 0), box('b', 300, 0)], [edge('e', 'a', 'b')])
    const result = pasteElements(c, copyElements(c, ['a', 'b'])!, OFFSET, counterIds())

    expect(result.content.edges).toEqual([edge('e', 'a', 'b')])
    expect(result.content.edges).toBe(c.edges)
  })

  it('keeps the arrangement of several copied elements', () => {
    const c = content([box('a', 0, 0), box('b', 300, 50)])
    const result = pasteElements(c, copyElements(c, ['a', 'b'])!, OFFSET, counterIds())

    expect(result.content.nodes.slice(2).map((n) => n.position)).toEqual([
      { x: 24, y: 24 },
      { x: 324, y: 74 },
    ])
  })

  it('puts a copied member back into its group, which grows when needed', () => {
    const c = content([group('g', 0, 0, 208, 136), box('m', 24, 56, 'g')])
    const result = pasteElements(c, copyElements(c, ['m'])!, { x: 48, y: 48 }, counterIds())
    const copy = find(result.content, result.rootIds[0])
    const grown = find(result.content, 'g')

    expect(copy.parentId).toBe('g')
    expect(grown.size!.width).toBeGreaterThanOrEqual(copy.position.x + 160 + 24)
    expect(grown.size!.height).toBeGreaterThanOrEqual(copy.position.y + 56 + 24)
  })

  it('goes to the top level at the old canvas position when the group is gone', () => {
    const before = content([group('g', 100, 200, 400, 300), box('m', 24, 56, 'g')])
    const clip = copyElements(before, ['m'])!
    const after = content([box('x', 0, 0)])
    const result = pasteElements(after, clip, OFFSET, counterIds())
    const copy = find(result.content, result.rootIds[0])

    expect(copy.parentId).toBeUndefined()
    expect(copy.position).toEqual({ x: 124 + 24, y: 256 + 24 })
    expect(getAbsolutePosition(result.content.nodes, copy.id)).toEqual(copy.position)
  })

  it('can be pasted again and again without clashes', () => {
    const c = content([box('a', 0, 0)])
    const clip = copyElements(c, ['a'])!
    const ids = counterIds()
    const once = pasteElements(c, clip, OFFSET, ids).content
    const twice = pasteElements(once, clip, { x: 48, y: 48 }, ids).content

    expect(twice.nodes.map((n) => n.id)).toEqual(['a', 'id-1', 'id-2'])
    expect(names(twice)).toEqual(['a', 'a', 'a'])
  })

  it('does not mutate the clipboard or the content', () => {
    const c = content([group('g', 0, 0, 400, 300), box('m', 24, 56, 'g')])
    const clip = copyElements(c, ['g'])!
    const frozen = JSON.stringify([c, clip])
    pasteElements(c, clip, OFFSET, counterIds())

    expect(JSON.stringify([c, clip])).toBe(frozen)
  })
})

describe('notes in the clipboard', () => {
  it('are copied and pasted with their text, a new id and the size', () => {
    const original = { ...note('n', 40, 50, 'Plan B'), size: { width: 200, height: 90 } }
    const copied = copyElements(content([original]), ['n'])!
    const pasted = pasteElements(content([original]), copied, { x: 24, y: 24 }, counterIds())

    const added = pasted.content.nodes.find((n) => n.id === pasted.rootIds[0])!
    expect(added).toMatchObject({ kind: 'note', position: { x: 64, y: 74 }, size: { width: 200, height: 90 } })
    expect(added.metadata).toEqual([{ key: 'name', value: 'Plan B' }])
    expect(added.id).not.toBe('n')
  })
})
