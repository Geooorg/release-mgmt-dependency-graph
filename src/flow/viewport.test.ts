import { describe, expect, it } from 'vitest'
import { coveredLeftWidth, viewportForFocus } from './viewport'

const pane = { left: 100, right: 1100 }

describe('coveredLeftWidth', () => {
  it('is 0 without an overlay', () => {
    expect(coveredLeftWidth(pane, undefined)).toBe(0)
  })

  it('measures from the pane edge to the right edge of the overlay', () => {
    expect(coveredLeftWidth(pane, { left: 112, right: 432 })).toBe(332)
  })

  it('ignores an overlay outside the pane', () => {
    expect(coveredLeftWidth(pane, { left: 1200, right: 1500 })).toBe(0)
    expect(coveredLeftWidth(pane, { left: 0, right: 100 })).toBe(0)
  })

  it('ignores an overlay that would leave less than the minimum free width', () => {
    expect(coveredLeftWidth(pane, { left: 112, right: 900 }, 240)).toBe(0)
    expect(coveredLeftWidth(pane, { left: 112, right: 860 }, 240)).toBe(760)
  })
})

describe('viewportForFocus', () => {
  const bounds = { x: 0, y: 0, width: 200, height: 100 }

  it('centers in the whole pane when nothing is covered', () => {
    const viewport = viewportForFocus(bounds, { width: 1000, height: 600 }, 0, { min: 0.1, max: 1 }, 0)
    expect(viewport).toEqual({ x: 400, y: 250, zoom: 1 })
  })

  it('centers in the free part right of the covered width', () => {
    const viewport = viewportForFocus(bounds, { width: 1000, height: 600 }, 400, { min: 0.1, max: 1 }, 0)
    // Free part: 400..1000, its center is 700; the 200 wide bounds start at 600.
    expect(viewport).toEqual({ x: 600, y: 250, zoom: 1 })
  })
})
