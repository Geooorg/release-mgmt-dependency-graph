import { describe, expect, it } from 'vitest'
import { nodeIdAtPoint, pointOfEvent } from './dropTarget'

function node(id: string) {
  const element = document.createElement('div')
  element.className = 'react-flow__node'
  element.dataset.id = id
  const inner = document.createElement('span')
  element.append(inner)
  return { element, inner }
}

const at = (...elements: Element[]) => () => elements

describe('nodeIdAtPoint', () => {
  it('finds the node under the pointer, also when the pointer is over something inside it', () => {
    const b = node('b')

    expect(nodeIdAtPoint({ x: 1, y: 2 }, 'a', at(b.inner, b.element))).toBe('b')
  })

  it('asks for the pointer position', () => {
    const b = node('b')
    const seen: [number, number][] = []

    nodeIdAtPoint({ x: 7, y: 9 }, 'a', (x, y) => (seen.push([x, y]), [b.element]))

    expect(seen).toEqual([[7, 9]])
  })

  it('takes the topmost node, e.g. a member in front of its group', () => {
    const member = node('m')
    const group = node('g')

    expect(nodeIdAtPoint({ x: 0, y: 0 }, 'a', at(member.element, group.element))).toBe('m')
  })

  it('skips things that are no node, like the connection line', () => {
    const line = document.createElement('svg')
    const b = node('b')

    expect(nodeIdAtPoint({ x: 0, y: 0 }, 'a', at(line, b.element))).toBe('b')
  })

  it('finds nothing on the node the drag started on, even when another one lies behind it', () => {
    const from = node('a')
    const behind = node('b')

    expect(nodeIdAtPoint({ x: 0, y: 0 }, 'a', at(from.element, behind.element))).toBeUndefined()
  })

  it('finds nothing on empty canvas', () => {
    expect(nodeIdAtPoint({ x: 0, y: 0 }, 'a', at(document.createElement('div')))).toBeUndefined()
    expect(nodeIdAtPoint({ x: 0, y: 0 }, 'a', at())).toBeUndefined()
  })
})

describe('pointOfEvent', () => {
  it('reads a mouse event', () => {
    expect(pointOfEvent(new MouseEvent('mouseup', { clientX: 12, clientY: 34 }))).toEqual({ x: 12, y: 34 })
  })

  it('reads the finger that was lifted from a touch event', () => {
    const touch = { clientX: 5, clientY: 6 }
    const event = { changedTouches: [touch] } as unknown as TouchEvent

    expect(pointOfEvent(event)).toEqual({ x: 5, y: 6 })
  })
})
