import type { Rect, Viewport } from '@xyflow/react'

/** Distance kept between a revealed element and the pane edge, in screen pixels. */
export const REVEAL_MARGIN = 24

/** Shift along one axis that brings [start, end] into [margin, size - margin]; the start wins if it does not fit. */
function shiftInto(start: number, end: number, size: number, margin: number): number {
  let shift = 0
  if (end > size - margin) shift = size - margin - end
  if (start + shift < margin) shift = margin - start
  return shift
}

/**
 * Viewport that pans `bounds` (flow coordinates) just far enough to be fully visible in the pane,
 * or null if it already is. Zoom stays; the smallest move keeps the view calm.
 */
export function viewportToReveal(
  bounds: Rect,
  viewport: Viewport,
  pane: { width: number; height: number },
  margin = REVEAL_MARGIN,
): Viewport | null {
  const left = bounds.x * viewport.zoom + viewport.x
  const top = bounds.y * viewport.zoom + viewport.y
  const dx = shiftInto(left, left + bounds.width * viewport.zoom, pane.width, margin)
  const dy = shiftInto(top, top + bounds.height * viewport.zoom, pane.height, margin)
  if (dx === 0 && dy === 0) return null
  return { x: viewport.x + dx, y: viewport.y + dy, zoom: viewport.zoom }
}
