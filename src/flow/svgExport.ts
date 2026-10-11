import { getBezierPath, Position } from '@xyflow/react'
import { getSize, pickSides, sortParentsFirst } from '../model/graph'
import { displayName, getColor, getContrastColor, getEdgeName, getName } from '../model/metadata'
import { DEFAULT_PROJECT_NAME } from '../model/projectName'
import { analyzeProject } from '../model/releaseAnalysis'
import { isSoftEdge } from '../model/softDependency'
import { DEFAULT_COLOR, GROUP_HEADER_HEIGHT, NOTE_DEFAULT_COLOR } from '../model/types'
import type { GraphContent, HandleSide, ModelNode, Point } from '../model/types'

/*
 * The graph as a standalone SVG document: the same look as the canvas (boxes, translucent groups,
 * bezier connections with arrows and captions, status marks), without selection, highlights and
 * cycle colouring. Pure: the geometry comes from the model, text is measured by an estimate because
 * no browser is involved.
 */

const PADDING = 32
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
const EDGE_COLOR = '#2563eb'
const SUCCESS = '#16a34a'
const DANGER = '#dc2626'
const WAITING = '#4338ca'
const PROGRESS = '#d97706'
const OPEN = '#6b7280'
const UNKNOWN_FILL = '#fef3c7'
const UNKNOWN_TEXT = '#b45309'
const MARK_RADIUS = 9
/** Rough width of one character of the 14 px labels; there is no layout engine to ask. */
const CHAR_WIDTH = 7.4
const LABEL_CHAR_WIDTH = 7
const BOX_PADDING = 14
const GROUP_PADDING_X = 12
const NOTE_PADDING = 10
const NOTE_LINE_HEIGHT = 20

const SIDE_POSITION: Record<HandleSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
}

interface Rect {
  node: ModelNode
  x: number
  y: number
  width: number
  height: number
}

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const num = (value: number): string => String(Math.round(value * 100) / 100)

/** Escapes text for XML and drops the control characters XML 1.0 cannot carry at all. */
function escapeXml(text: string): string {
  // Everything below U+0020 except tab, line feed and carriage return is not allowed in XML 1.0.
  const printable = Array.from(text)
    .filter((char) => char.charCodeAt(0) >= 0x20 || char === '\t' || char === '\n' || char === '\r')
    .join('')
  return printable.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Shortens `text` with an ellipsis so that it roughly fits `width` px. */
function fit(text: string, width: number, charWidth: number): string {
  const chars = Array.from(text)
  const max = Math.max(1, Math.floor(width / charWidth))
  return chars.length <= max ? text : `${chars.slice(0, Math.max(1, max - 1)).join('')}…`
}

/** The group title colour of the canvas: the element colour mixed 70:30 with black. */
function darken(color: string): string {
  const channels = [1, 3, 5].map((i) => Math.round(parseInt(color.slice(i, i + 2), 16) * 0.7))
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/**
 * The text of a note as lines for a box of `columns` characters and `maxLines` lines: line breaks are
 * kept, long lines wrap at spaces (a word longer than a line is cut), and what does not fit ends in "…".
 */
function wrapNote(text: string, columns: number, maxLines: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    let line = ''
    for (const word of paragraph.split(' ')) {
      let rest = Array.from(word)
      // A word that is longer than a line is cut where the line ends.
      while (rest.length > columns) {
        if (line !== '') {
          lines.push(line)
          line = ''
        }
        lines.push(rest.slice(0, columns).join(''))
        rest = rest.slice(columns)
      }
      const piece = rest.join('')
      if (line === '') line = piece
      else if (Array.from(line).length + 1 + rest.length <= columns) line = `${line} ${piece}`
      else {
        lines.push(line)
        line = piece
      }
    }
    lines.push(line)
  }
  if (lines.length <= maxLines) return lines
  const shown = lines.slice(0, maxLines)
  shown[maxLines - 1] = fit(`${shown[maxLines - 1]}…`, columns * CHAR_WIDTH, CHAR_WIDTH).replace(/…?$/, '…')
  return shown
}

function absoluteRects(nodes: readonly ModelNode[]): Map<string, Rect> {
  const rects = new Map<string, Rect>()
  for (const node of sortParentsFirst(nodes)) {
    const parent = node.parentId === undefined ? undefined : rects.get(node.parentId)
    const { width, height } = getSize(node)
    rects.set(node.id, {
      node,
      x: node.position.x + (parent?.x ?? 0),
      y: node.position.y + (parent?.y ?? 0),
      width,
      height,
    })
  }
  return rects
}

function handlePoint(rect: Rect, side: HandleSide): Point {
  switch (side) {
    case 'top':
      return { x: rect.x + rect.width / 2, y: rect.y }
    case 'right':
      return { x: rect.x + rect.width, y: rect.y + rect.height / 2 }
    case 'bottom':
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height }
    case 'left':
      return { x: rect.x, y: rect.y + rect.height / 2 }
  }
}

function extend(bounds: Bounds, x: number, y: number, margin = 0): void {
  bounds.minX = Math.min(bounds.minX, x - margin)
  bounds.minY = Math.min(bounds.minY, y - margin)
  bounds.maxX = Math.max(bounds.maxX, x + margin)
  bounds.maxY = Math.max(bounds.maxY, y + margin)
}

function hourglass(cx: number, cy: number): string {
  return (
    `<path d="M${num(cx - 3.5)} ${num(cy - 4.5)}h7l-3.5 4.5zM${num(cx - 3.5)} ${num(cy + 4.5)}h7l-3.5-4.5z" ` +
    `fill="none" stroke="${WAITING}" stroke-width="1.6" stroke-linejoin="round"/>`
  )
}

function flag(cx: number, cy: number): string {
  return (
    `<path d="M${num(cx - 3)} ${num(cy + 5)}V${num(cy - 5)}h6l-2 2.5 2 2.5h-6" ` +
    `fill="none" stroke="${DANGER}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`
  )
}

/** A white disc with a coloured ring, the base of the flag and the hourglass. */
function badge(cx: number, cy: number, ring: string, glyph: string): string {
  return (
    `<circle cx="${num(cx)}" cy="${num(cy)}" r="${MARK_RADIUS}" fill="#ffffff" stroke="${ring}" stroke-width="2"/>${glyph}`
  )
}

function statusMark(cx: number, cy: number, status: string, known: boolean): string {
  const base = (fill: string) =>
    `<circle cx="${num(cx)}" cy="${num(cy)}" r="${MARK_RADIUS}" fill="${fill}" stroke="#ffffff" stroke-width="2"/>`
  if (!known) {
    return (
      base(UNKNOWN_FILL) +
      `<text x="${num(cx)}" y="${num(cy)}" dy="0.35em" text-anchor="middle" font-size="12" font-weight="700" fill="${UNKNOWN_TEXT}">?</text>`
    )
  }
  if (status === 'fertig') {
    return (
      base(SUCCESS) +
      `<path d="M${num(cx - 4)} ${num(cy)}l3 3 5-6" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
    )
  }
  if (status === 'in Arbeit') {
    return (
      base('#ffffff') +
      `<circle cx="${num(cx)}" cy="${num(cy)}" r="5" fill="none" stroke="${PROGRESS}" stroke-width="1.8"/>` +
      `<path d="M${num(cx)} ${num(cy - 5)}a5 5 0 0 1 0 10z" fill="${PROGRESS}"/>`
    )
  }
  return base('#ffffff') + `<circle cx="${num(cx)}" cy="${num(cy)}" r="5" fill="none" stroke="${OPEN}" stroke-width="1.8"/>`
}

/** The graph as the text of an SVG file. An empty graph yields a small blank image. */
export function buildSvg(content: GraphContent): string {
  const rects = absoluteRects(content.nodes)
  const analysis = analyzeProject(content)
  const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const rect of rects.values()) {
    // The marks overhang the corners of an element.
    extend(bounds, rect.x - MARK_RADIUS - 2, rect.y - MARK_RADIUS - 2)
    extend(bounds, rect.x + rect.width + 4, rect.y + rect.height + 4)
  }

  const groups: string[] = []
  const boxes: string[] = []
  for (const node of sortParentsFirst(content.nodes)) {
    const rect = rects.get(node.id)!
    const color = getColor(node.metadata) ?? DEFAULT_COLOR
    const blocked = analysis.blockedIds.has(node.id)
    const waiting = !blocked && analysis.waitingIds.has(node.id)

    if (node.kind === 'group') {
      const hasFlag = blocked || waiting
      const offset = hasFlag ? 2 * MARK_RADIUS + 6 : 0
      const name = getName(node.metadata).trim()
      const title = fit(name || displayName(node), rect.width - 2 * GROUP_PADDING_X - offset, CHAR_WIDTH)
      const cy = rect.y + GROUP_HEADER_HEIGHT / 2
      groups.push(
        `<g data-id="${escapeXml(node.id)}" data-kind="group">` +
          `<rect x="${num(rect.x + 1)}" y="${num(rect.y + 1)}" width="${num(rect.width - 2)}" height="${num(rect.height - 2)}" rx="10" fill="${color}" fill-opacity="0.08" stroke="${color}" stroke-width="2"/>` +
          (blocked ? badge(rect.x + GROUP_PADDING_X + MARK_RADIUS, cy, DANGER, flag(rect.x + GROUP_PADDING_X + MARK_RADIUS, cy)) : '') +
          (waiting ? badge(rect.x + GROUP_PADDING_X + MARK_RADIUS, cy, WAITING, hourglass(rect.x + GROUP_PADDING_X + MARK_RADIUS, cy)) : '') +
          `<text x="${num(rect.x + GROUP_PADDING_X + offset)}" y="${num(cy)}" dy="0.35em" font-size="14" font-weight="700" fill="${darken(color)}"${name ? '' : ' font-style="italic"'}>${escapeXml(title)}</text>` +
          `</g>`,
      )
      continue
    }

    if (node.kind === 'note') {
      const fill = getColor(node.metadata) ?? NOTE_DEFAULT_COLOR
      const text = getName(node.metadata).trim()
      const lines = text === '' ? [] : wrapNote(text, Math.max(1, Math.floor((rect.width - 2 * NOTE_PADDING) / CHAR_WIDTH)), Math.max(1, Math.floor((rect.height - 2 * NOTE_PADDING) / NOTE_LINE_HEIGHT)))
      const { x, y, width, height } = rect
      boxes.push(
        `<g data-id="${escapeXml(node.id)}" data-kind="note">` +
          `<path d="M${num(x)} ${num(y)}H${num(x + width)}V${num(y + height - 14)}a14 14 0 0 1-14 14H${num(x)}z" fill="${fill}" stroke="#000000" stroke-opacity="0.12"/>` +
          lines
            .map(
              (line, index) =>
                `<text x="${num(x + NOTE_PADDING)}" y="${num(y + NOTE_PADDING + NOTE_LINE_HEIGHT * index + NOTE_LINE_HEIGHT / 2)}" dy="0.35em" xml:space="preserve" font-size="14" fill="${getContrastColor(fill)}">${escapeXml(line)}</text>`,
            )
            .join('') +
          `</g>`,
      )
      continue
    }

    const name = getName(node.metadata).trim()
    const label = fit(name || displayName(node), rect.width - 2 * BOX_PADDING, CHAR_WIDTH)
    const info = analysis.statusInfoById.get(node.id)
    const status = analysis.statusById.get(node.id)
    const mark =
      status === undefined || status === 'blockiert'
        ? ''
        : statusMark(rect.x + rect.width - 4, rect.y + rect.height - 4, status, info?.known ?? true)
    boxes.push(
      `<g data-id="${escapeXml(node.id)}" data-kind="node">` +
        `<rect x="${num(rect.x + 1)}" y="${num(rect.y + 1)}" width="${num(rect.width - 2)}" height="${num(rect.height - 2)}" rx="8" fill="${color}" stroke="${color}" stroke-width="2"/>` +
        `<text x="${num(rect.x + rect.width / 2)}" y="${num(rect.y + rect.height / 2)}" dy="0.35em" text-anchor="middle" font-size="14" font-weight="${name ? 600 : 400}"${name ? '' : ' font-style="italic" opacity="0.7"'} fill="${getContrastColor(color)}">${escapeXml(label)}</text>` +
        (blocked ? badge(rect.x + 3, rect.y + 3, DANGER, flag(rect.x + 3, rect.y + 3)) : '') +
        (waiting ? badge(rect.x + 3, rect.y + 3, WAITING, hourglass(rect.x + 3, rect.y + 3)) : '') +
        mark +
        `</g>`,
    )
  }

  const edges: string[] = []
  for (const edge of content.edges) {
    const source = rects.get(edge.source)
    const target = rects.get(edge.target)
    if (source === undefined || target === undefined) continue
    const facing = edge.sourceHandle && edge.targetHandle ? undefined : pickSides(content.nodes, edge.source, edge.target)
    const sourceSide = edge.sourceHandle ?? facing!.sourceHandle
    const targetSide = edge.targetHandle ?? facing!.targetHandle
    const from = handlePoint(source, sourceSide)
    const to = handlePoint(target, targetSide)
    const [path, labelX, labelY] = getBezierPath({
      sourceX: from.x,
      sourceY: from.y,
      sourcePosition: SIDE_POSITION[sourceSide],
      targetX: to.x,
      targetY: to.y,
      targetPosition: SIDE_POSITION[targetSide],
    })
    // The control points enclose the curve, so they are a safe (slightly generous) bound.
    const numbers = (path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi) ?? []).map(Number)
    for (let i = 0; i + 1 < numbers.length; i += 2) extend(bounds, numbers[i], numbers[i + 1])

    const soft = isSoftEdge(edge)
    const caption = getEdgeName(edge)
    let label = ''
    if (caption) {
      const text = fit(caption, 240, LABEL_CHAR_WIDTH)
      const width = Array.from(text).length * LABEL_CHAR_WIDTH + 12
      extend(bounds, labelX - width / 2, labelY - 11)
      extend(bounds, labelX + width / 2, labelY + 11)
      label =
        `<rect x="${num(labelX - width / 2)}" y="${num(labelY - 11)}" width="${num(width)}" height="22" rx="4" fill="#ffffff" fill-opacity="0.92" stroke="${EDGE_COLOR}"/>` +
        `<text x="${num(labelX)}" y="${num(labelY)}" dy="0.35em" text-anchor="middle" font-size="13" font-weight="600" fill="${EDGE_COLOR}">${escapeXml(text)}</text>`
    }
    edges.push(
      `<g data-id="${escapeXml(edge.id)}" data-kind="edge"${soft ? ' data-soft="true"' : ''}>` +
        `<path d="${path}" fill="none" stroke="${EDGE_COLOR}" stroke-width="2"${soft ? ' stroke-dasharray="1 6" stroke-linecap="round"' : ''} marker-end="url(#arrow)"/>` +
        label +
        `</g>`,
    )
  }

  const empty = !Number.isFinite(bounds.minX)
  const minX = empty ? 0 : Math.floor(bounds.minX - PADDING)
  const minY = empty ? 0 : Math.floor(bounds.minY - PADDING)
  const width = empty ? 64 : Math.ceil(bounds.maxX + PADDING - minX)
  const height = empty ? 64 : Math.ceil(bounds.maxY + PADDING - minY)
  const title = escapeXml(content.projectName ?? DEFAULT_PROJECT_NAME)

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}" font-family="${FONT}">`,
    `<title>${title}</title>`,
    `<defs><marker id="arrow" viewBox="-10 -10 20 20" markerWidth="20" markerHeight="20" markerUnits="userSpaceOnUse" orient="auto" refX="0" refY="0"><polygon points="-10,-8 0,0 -10,8" fill="${EDGE_COLOR}" stroke="${EDGE_COLOR}" stroke-width="2" stroke-linejoin="round"/></marker></defs>`,
    `<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#ffffff"/>`,
    ...groups,
    ...edges,
    ...boxes,
    `</svg>`,
    '',
  ].join('\n')
}
