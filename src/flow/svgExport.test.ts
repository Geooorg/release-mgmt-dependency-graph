import { describe, expect, it } from 'vitest'
import { buildSvg } from './svgExport'
import type { GraphContent, ModelEdge, ModelNode } from '../model/types'

const node = (id: string, name: string, x: number, y: number, extra: Partial<ModelNode> = {}): ModelNode => ({
  id,
  kind: 'node',
  position: { x, y },
  metadata: [{ key: 'name', value: name }],
  ...extra,
})
const group = (id: string, name: string, x: number, y: number, width: number, height: number, extra: Partial<ModelNode> = {}): ModelNode => ({
  id,
  kind: 'group',
  position: { x, y },
  size: { width, height },
  metadata: [{ key: 'name', value: name }],
  ...extra,
})
const edge = (id: string, source: string, target: string, extra: Partial<ModelEdge> = {}): ModelEdge => ({ id, source, target, ...extra })

function parse(svg: string): Document {
  return new DOMParser().parseFromString(svg, 'image/svg+xml')
}

describe('buildSvg: notes', () => {
  const sticky = (id: string, text: string, extra: Partial<ModelNode> = {}): ModelNode =>
    node(id, text, 0, 0, { kind: 'note', ...extra })
  const lines = (doc: Document, id: string) => [...doc.querySelectorAll(`[data-id="${id}"] text`)].map((t) => t.textContent)

  it('draws a note in its colour with the text line by line, no connectors, above groups', () => {
    const doc = parse(
      buildSvg({
        nodes: [group('g', 'G', 0, 0, 400, 300), sticky('n', 'Erste Zeile\nZweite Zeile', { position: { x: 20, y: 60 }, parentId: 'g', metadata: [{ key: 'name', value: 'Erste Zeile\nZweite Zeile' }, { key: 'color', value: '#fda4af' }] })],
        edges: [],
      }),
    )

    expect(doc.querySelector('parsererror')).toBeNull()
    expect(doc.querySelector('[data-id="n"] path')?.getAttribute('fill')).toBe('#fda4af')
    expect(lines(doc, 'n')).toEqual(['Erste Zeile', 'Zweite Zeile'])
    const order = [...doc.querySelectorAll('[data-kind]')].map((el) => el.getAttribute('data-id'))
    expect(order).toEqual(['g', 'n'])
  })

  it('uses sticky-note yellow without a colour and draws an empty note without text', () => {
    const doc = parse(buildSvg({ nodes: [sticky('n', '')], edges: [] }))

    expect(doc.querySelector('[data-id="n"] path')?.getAttribute('fill')).toBe('#fef08a')
    expect(lines(doc, 'n')).toEqual([])
  })

  it('wraps long lines at spaces and cuts the text off with an ellipsis when the note is full', () => {
    const text = 'eins zwei drei vier fünf sechs sieben acht neun zehn elf zwölf dreizehn vierzehn fünfzehn sechzehn'
    const doc = parse(buildSvg({ nodes: [sticky('n', text, { size: { width: 160, height: 76 } })], edges: [] }))
    const shown = lines(doc, 'n')

    // (76 - 20) / 20 = 2 lines of about 18 characters
    expect(shown).toHaveLength(2)
    expect(shown[1]).toMatch(/…$/)
    expect(shown.join(' ')).not.toContain('sechzehn')
  })

  it('cuts a word that is longer than a line, and keeps its size without text overflow', () => {
    const doc = parse(buildSvg({ nodes: [sticky('n', 'x'.repeat(60), { size: { width: 160, height: 120 } })], edges: [] }))

    expect(lines(doc, 'n').length).toBeLessThanOrEqual(5)
    expect(lines(doc, 'n').every((line) => line!.length <= 19)).toBe(true)
  })

  it('does not draw connections for a note and escapes its text', () => {
    const doc = parse(buildSvg({ nodes: [sticky('n', '<b> & "x"')], edges: [] }))

    expect(doc.querySelector('parsererror')).toBeNull()
    expect(lines(doc, 'n')).toEqual(['<b> & "x"'])
  })
})

describe('buildSvg', () => {
  it('is well-formed XML with a size, a title and a white background', () => {
    const svg = buildSvg({ nodes: [node('a', 'A', 0, 0), node('b', 'B', 300, 0)], edges: [edge('e', 'a', 'b')], projectName: 'Mein-Projekt' })
    const doc = parse(svg)

    expect(doc.querySelector('parsererror')).toBeNull()
    const root = doc.documentElement
    expect(root.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(Number(root.getAttribute('width'))).toBeGreaterThan(460)
    const [, , viewWidth, viewHeight] = root.getAttribute('viewBox')!.split(' ')
    expect([viewWidth, viewHeight]).toEqual([root.getAttribute('width'), root.getAttribute('height')])
    expect(doc.querySelector('title')?.textContent).toBe('Mein-Projekt')
    expect(svg.startsWith('<?xml')).toBe(true)
  })

  it('draws every element, group and connection once', () => {
    const doc = parse(
      buildSvg({
        nodes: [group('g', 'Gruppe', 0, 0, 320, 200), node('a', 'A', 24, 56, { parentId: 'g' }), node('b', 'B', 400, 56)],
        edges: [edge('e', 'a', 'b')],
      }),
    )

    expect([...doc.querySelectorAll('[data-kind]')].map((el) => `${el.getAttribute('data-kind')}:${el.getAttribute('data-id')}`)).toEqual([
      'group:g',
      'edge:e',
      'node:a',
      'node:b',
    ])
  })

  it('writes names as text, truncated when they do not fit, and escapes markup', () => {
    const doc = parse(buildSvg({ nodes: [node('a', 'Tom & <Jerry>', 0, 0), node('b', 'x'.repeat(80), 300, 0)], edges: [] }))
    const texts = [...doc.querySelectorAll('[data-kind="node"] text')].map((t) => t.textContent)

    expect(texts[0]).toBe('Tom & <Jerry>')
    expect(texts[1]).toMatch(/^x+…$/)
    expect(texts[1]!.length).toBeLessThan(25)
  })

  it('drops characters XML cannot carry', () => {
    const doc = parse(buildSvg({ nodes: [node('a', 'A\u0000\u0008B', 0, 0)], edges: [] }))

    expect(doc.querySelector('parsererror')).toBeNull()
    expect(doc.querySelector('[data-kind="node"] text')?.textContent).toBe('AB')
  })

  it('uses the element colour with a readable text colour, the default blue otherwise', () => {
    const doc = parse(
      buildSvg({
        nodes: [
          node('a', 'A', 0, 0, { metadata: [{ key: 'name', value: 'A' }, { key: 'color', value: '#facc15' }] }),
          node('b', 'B', 300, 0),
        ],
        edges: [],
      }),
    )
    const [yellow, blue] = [...doc.querySelectorAll('[data-kind="node"]')]

    expect(yellow.querySelector('rect')?.getAttribute('fill')).toBe('#facc15')
    expect(yellow.querySelector('text')?.getAttribute('fill')).toBe('#111827')
    expect(blue.querySelector('rect')?.getAttribute('fill')).toBe('#2563eb')
    expect(blue.querySelector('text')?.getAttribute('fill')).toBe('#ffffff')
  })

  it('places a nested element relative to its group', () => {
    const doc = parse(buildSvg({ nodes: [group('g', 'G', 100, 50, 320, 200), node('a', 'A', 24, 56, { parentId: 'g' })], edges: [] }))
    const rect = doc.querySelector('[data-id="a"] rect')!

    // 100 + 24 and 50 + 56, plus the 1 px inset of the stroke.
    expect(rect.getAttribute('x')).toBe('125')
    expect(rect.getAttribute('y')).toBe('107')
  })

  it('shows captions and dots optional connections', () => {
    const doc = parse(
      buildSvg({
        nodes: [node('a', 'A', 0, 0), node('b', 'B', 300, 0), node('c', 'C', 600, 0)],
        edges: [
          edge('e1', 'a', 'b', { metadata: [{ key: 'name', value: 'hängt ab von' }] }),
          edge('e2', 'b', 'c', { metadata: [{ key: 'optional', value: 'ja' }] }),
        ],
      }),
    )

    expect(doc.querySelector('[data-id="e1"] text')?.textContent).toBe('hängt ab von')
    expect(doc.querySelector('[data-id="e1"] path')?.getAttribute('stroke-dasharray')).toBeNull()
    expect(doc.querySelector('[data-id="e2"]')?.getAttribute('data-soft')).toBe('true')
    expect(doc.querySelector('[data-id="e2"] path')?.getAttribute('stroke-dasharray')).toBe('1 6')
  })

  it('ends every connection with an arrow and skips ones with a missing end', () => {
    const doc = parse(buildSvg({ nodes: [node('a', 'A', 0, 0), node('b', 'B', 300, 0)], edges: [edge('e', 'a', 'b'), edge('x', 'a', 'gone')] }))

    expect(doc.querySelectorAll('[data-kind="edge"]')).toHaveLength(1)
    expect(doc.querySelector('[data-id="e"] path')?.getAttribute('marker-end')).toBe('url(#arrow)')
    expect(doc.querySelector('marker#arrow')).not.toBeNull()
  })

  it('draws the status marks, the red flag and the hourglass like the canvas', () => {
    const withStatus = (id: string, status: string, x: number): ModelNode =>
      node(id, id, x, 0, { metadata: [{ key: 'name', value: id }, { key: 'status', value: status }] })
    const doc = parse(
      buildSvg({
        nodes: [withStatus('done', 'fertig', 0), withStatus('blocked', 'blockiert', 300), node('waits', 'waits', 600, 0), node('plain', 'plain', 900, 0)],
        edges: [edge('e', 'blocked', 'waits')],
      }),
    )
    const circles = (id: string) => doc.querySelectorAll(`[data-id="${id}"] circle`).length

    expect(doc.querySelector('[data-id="done"] path[stroke="#ffffff"]')).not.toBeNull()
    // blocked: the flag disc only (no corner mark); waits: hourglass disc + open circle mark (2 circles + ring).
    expect(circles('blocked')).toBe(1)
    expect(doc.querySelector('[data-id="blocked"] path[stroke="#dc2626"]')).not.toBeNull()
    expect(doc.querySelector('[data-id="waits"] path[stroke="#4338ca"]')).not.toBeNull()
    expect(circles('plain')).toBe(2)
  })

  it('marks an unknown status with a question mark', () => {
    const doc = parse(
      buildSvg({ nodes: [node('a', 'A', 0, 0, { metadata: [{ key: 'name', value: 'A' }, { key: 'status', value: 'erledigt' }] })], edges: [] }),
    )

    expect([...doc.querySelectorAll('[data-id="a"] text')].map((t) => t.textContent)).toContain('?')
  })

  it('puts flags into the title row of a group that contains a blocked object', () => {
    const doc = parse(
      buildSvg({
        nodes: [
          group('g', 'Gruppe', 0, 0, 320, 200),
          node('a', 'A', 24, 56, { parentId: 'g', metadata: [{ key: 'name', value: 'A' }, { key: 'status', value: 'blockiert' }] }),
        ],
        edges: [],
      }),
    )

    expect(doc.querySelector('[data-id="g"] path[stroke="#dc2626"]')).not.toBeNull()
    const title = doc.querySelector('[data-id="g"] text')!
    expect(Number(title.getAttribute('x'))).toBeGreaterThan(12)
  })

  it('encloses everything, including connections that swing out and captions', () => {
    const content: GraphContent = {
      nodes: [node('a', 'A', 0, 0), node('b', 'B', 0, 300)],
      // Both leave on the right and enter on the right: the curve bulges beyond both elements.
      edges: [edge('e', 'a', 'b', { sourceHandle: 'right', targetHandle: 'right' })],
    }
    const root = parse(buildSvg(content)).documentElement
    const [minX, , width] = root.getAttribute('viewBox')!.split(' ').map(Number)

    expect(minX).toBeLessThan(0)
    expect(minX + width).toBeGreaterThan(160 + 32)
  })

  it('gives an empty graph a small valid image', () => {
    const doc = parse(buildSvg({ nodes: [], edges: [] }))

    expect(doc.querySelector('parsererror')).toBeNull()
    expect(doc.documentElement.getAttribute('width')).toBe('64')
    expect(doc.querySelector('title')?.textContent).toBe('Release-Management')
  })
})
