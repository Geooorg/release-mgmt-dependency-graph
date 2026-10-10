import { getViewportForBounds, type Rect, type Viewport } from '@xyflow/react'

/** Free width below which an overlay is ignored: centering in a sliver would be worse than being covered. */
export const MIN_FREE_WIDTH = 240

interface Box {
  left: number
  right: number
}

/**
 * Width at the left edge of the pane covered by an overlay (the analysis panel), in screen pixels.
 * 0 when there is no overlay, it does not touch the left part of the pane, or too little room would
 * be left beside it.
 */
export function coveredLeftWidth(pane: Box, overlay: Box | undefined, minFree = MIN_FREE_WIDTH): number {
  if (!overlay || overlay.left >= pane.right || overlay.right <= pane.left) return 0
  const covered = Math.min(overlay.right, pane.right) - pane.left
  return pane.right - pane.left - covered < minFree ? 0 : covered
}

/** Viewport that centers `bounds` in the part of the pane right of `coveredLeft`. */
export function viewportForFocus(
  bounds: Rect,
  pane: { width: number; height: number },
  coveredLeft: number,
  zoom: { min: number; max: number },
  padding: number,
): Viewport {
  const viewport = getViewportForBounds(bounds, pane.width - coveredLeft, pane.height, zoom.min, zoom.max, padding)
  return { ...viewport, x: viewport.x + coveredLeft }
}
