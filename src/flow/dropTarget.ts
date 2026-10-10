export interface Point {
  x: number
  y: number
}

/** Where a mouse or touch gesture ended, in client coordinates. */
export function pointOfEvent(event: MouseEvent | TouchEvent): Point {
  const source = 'changedTouches' in event ? event.changedTouches[0] : event
  return { x: source.clientX, y: source.clientY }
}

/**
 * The element a dragged connection was dropped on, anywhere on its body (not only on a connector):
 * the topmost node under the pointer. Dropping on the node the drag started from, or on empty
 * canvas, finds nothing. `elementsAt` is `document.elementsFromPoint`, topmost first.
 */
export function nodeIdAtPoint(
  point: Point,
  fromId: string,
  elementsAt: (x: number, y: number) => readonly Element[] = (x, y) => document.elementsFromPoint(x, y),
): string | undefined {
  for (const element of elementsAt(point.x, point.y)) {
    const node = element.closest<HTMLElement>('.react-flow__node')
    if (node === null) continue
    const id = node.dataset.id
    return id === undefined || id === fromId ? undefined : id
  }
  return undefined
}
