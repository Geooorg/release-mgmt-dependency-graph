import { describe, expect, it } from 'vitest'
import { viewportToReveal } from './reveal'

const pane = { width: 500, height: 400 }
const node = (x: number, y: number) => ({ x, y, width: 160, height: 56 })

describe('viewportToReveal', () => {
  it('leaves the view alone when the element is fully visible', () => {
    expect(viewportToReveal(node(100, 100), { x: 0, y: 0, zoom: 1 }, pane)).toBeNull()
  })

  it('pans just far enough to bring an element beyond the right edge into view', () => {
    // Right edge at 620, must end at 500 - 24 = 476.
    expect(viewportToReveal(node(460, 100), { x: 0, y: 0, zoom: 1 }, pane)).toEqual({ x: -144, y: 0, zoom: 1 })
  })

  it('pans down for an element above the top edge', () => {
    expect(viewportToReveal(node(100, -80), { x: 0, y: 0, zoom: 1 }, pane)).toEqual({ x: 0, y: 104, zoom: 1 })
  })

  it('respects the zoom and the current offset', () => {
    // At zoom 2 the element spans 900..1220 on screen (offset -100).
    expect(viewportToReveal(node(500, 50), { x: -100, y: 0, zoom: 2 }, pane)).toEqual({ x: -844, y: 0, zoom: 2 })
  })

  it('keeps the left edge visible when the element is wider than the pane', () => {
    const wide = { x: 600, y: 100, width: 800, height: 56 }
    expect(viewportToReveal(wide, { x: 0, y: 0, zoom: 1 }, pane)).toEqual({ x: -576, y: 0, zoom: 1 })
  })
})
