import { ReactFlow } from '@xyflow/react'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import type { AppFlowNode, FlowNodeData } from '../flow/types'
import { NODE_SIZE } from '../model/types'
import { nodeTypes } from './nodeTypes'
import { setTestLocale } from '../test/locale'

// React Flow needs a few browser APIs jsdom does not provide.
beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  class DOMMatrixReadOnlyStub {
    m22 = 1
    constructor(transform?: string) {
      const scale = transform?.match(/scale\(([\d.]+)\)/)?.[1]
      if (scale) this.m22 = Number(scale)
    }
  }
  globalThis.ResizeObserver = ResizeObserverStub
  globalThis.DOMMatrixReadOnly = DOMMatrixReadOnlyStub as unknown as typeof DOMMatrixReadOnly
})

function makeData(overrides: Partial<FlowNodeData> = {}): FlowNodeData {
  return {
    name: 'Projekt A',
    id: 'abcdef12-3456-4789-8abc-def012345678',
    isConnectSource: false,
    isDropTarget: false,
    isDependency: false,
    isInCycle: false,
    isRevealed: false,
    ...overrides,
  }
}

function renderNodes(nodes: AppFlowNode[]) {
  return render(
    <div style={{ width: 800, height: 600 }}>
      <ReactFlow nodes={nodes} edges={[]} nodeTypes={nodeTypes} />
    </div>,
  )
}

function box(overrides: Partial<AppFlowNode> & { data?: FlowNodeData } = {}): AppFlowNode {
  return { id: 'b1', type: 'box', position: { x: 0, y: 0 }, data: makeData(), ...overrides } as AppFlowNode
}

function group(overrides: Partial<AppFlowNode> & { data?: FlowNodeData } = {}): AppFlowNode {
  return {
    id: 'g1',
    type: 'group',
    position: { x: 0, y: 200 },
    width: 320,
    height: 200,
    data: makeData({ name: 'Gruppe X' }),
    ...overrides,
  } as AppFlowNode
}

describe('node components', () => {
  it('registers box and group in nodeTypes', () => {
    expect(Object.keys(nodeTypes).sort()).toEqual(['box', 'group'])
  })

  it('renders a box node with name and fixed size', () => {
    const { container } = renderNodes([box()])

    const node = container.querySelector<HTMLElement>('.box-node')
    expect(node).not.toBeNull()
    expect(node).toHaveTextContent('Projekt A')
    expect(node).toHaveStyle({ width: `${NODE_SIZE.width}px`, height: `${NODE_SIZE.height}px` })
    expect(node).not.toHaveClass('box-node--selected')
    expect(node).not.toHaveClass('box-node--connect-source')
  })

  it('falls back to the shortened id for an empty box name', () => {
    renderNodes([box({ data: makeData({ name: '' }) })])

    const label = screen.getByText('abcdef12')
    expect(label).toHaveClass('box-node__label--empty')
  })

  it('marks selected and connect-source boxes', () => {
    const { container } = renderNodes([
      box({ selected: true, data: makeData({ isConnectSource: true }) }),
    ])

    const node = container.querySelector('.box-node')
    expect(node).toHaveClass('box-node--selected')
    expect(node).toHaveClass('box-node--connect-source')
  })

  it('renders a group node with header label', () => {
    const { container } = renderNodes([group()])

    const node = container.querySelector<HTMLElement>('.group-node')
    expect(node).not.toBeNull()
    expect(node?.querySelector('.group-node__header')).toHaveTextContent('Gruppe X')
    expect(node).not.toHaveClass('group-node--drop-target')
  })

  it('falls back to the shortened id for an empty group name', () => {
    renderNodes([group({ data: makeData({ name: '' }) })])

    expect(screen.getByText('abcdef12')).toHaveClass('group-node__label--empty')
  })

  it('shows the resizer only while the group is selected', () => {
    const { container, rerender } = renderNodes([group()])
    expect(container.querySelector('.react-flow__resize-control')).toBeNull()

    rerender(
      <div style={{ width: 800, height: 600 }}>
        <ReactFlow nodes={[group({ selected: true })]} edges={[]} nodeTypes={nodeTypes} />
      </div>,
    )
    expect(container.querySelector('.react-flow__resize-control')).not.toBeNull()
  })

  it('highlights drop target and connect source groups', () => {
    const { container } = renderNodes([
      group({ data: makeData({ isDropTarget: true, isConnectSource: true }) }),
    ])

    const node = container.querySelector('.group-node')
    expect(node).toHaveClass('group-node--drop-target')
    expect(node).toHaveClass('group-node--connect-source')
  })

  it('gives boxes and groups four connectors, one per side', () => {
    const { container } = renderNodes([box(), group()])

    for (const selector of ['.box-node', '.group-node']) {
      const handles = [...(container.querySelector(selector)?.querySelectorAll('.react-flow__handle') ?? [])]
      expect(handles.map((h) => h.getAttribute('data-handleid')).sort()).toEqual([
        'bottom',
        'left',
        'right',
        'top',
      ])
    }
  })

  it('applies the element colour as background and border via CSS variables', () => {
    const { container } = renderNodes([
      box({ data: makeData({ color: '#facc15', textColor: '#111827' }) }),
      group({ data: makeData({ color: '#dc2626', textColor: '#ffffff' }) }),
    ])

    const boxNode = container.querySelector<HTMLElement>('.box-node')!
    expect(boxNode.style.getPropertyValue('--node-color')).toBe('#facc15')
    expect(boxNode.style.getPropertyValue('--node-text')).toBe('#111827')
    expect(container.querySelector<HTMLElement>('.group-node')!.style.getPropertyValue('--node-color')).toBe('#dc2626')
  })

  it('leaves the colour variables unset for the default blue', () => {
    const { container } = renderNodes([box()])

    expect(container.querySelector<HTMLElement>('.box-node')!.style.getPropertyValue('--node-color')).toBe('')
  })

  it('marks elements of the highlighted dependency graph', () => {
    const { container } = renderNodes([
      box({ data: makeData({ isDependency: true }) }),
      group({ data: makeData({ isDependency: true }) }),
    ])

    expect(container.querySelector('.box-node')).toHaveClass('box-node--dependency')
    expect(container.querySelector('.group-node')).toHaveClass('group-node--dependency')
  })

  it('shows a cycle badge on boxes and groups in a cycle only', () => {
    const { container } = renderNodes([
      box({ data: makeData({ isInCycle: true }) }),
      group({ data: makeData({ isInCycle: true }) }),
      box({ id: 'b2', position: { x: 300, y: 0 } }),
    ])

    expect(screen.getAllByLabelText('Teil eines Zyklus')).toHaveLength(2)
    expect(container.querySelector('.box-node .cycle-badge')).toHaveAttribute('title', 'Teil eines Zyklus')
    expect(container.querySelector('.group-node .cycle-badge')).not.toBeNull()
  })

  it('shows the red flag with the reason on blocked boxes only', () => {
    const { container } = renderNodes([
      box({ data: makeData({ blockedTitle: 'Blockiert: Freigabe fehlt', status: 'blockiert' }) }),
      box({ id: 'b2', position: { x: 300, y: 0 } }),
    ])

    const flags = screen.getAllByLabelText('Blockiert: Freigabe fehlt')
    expect(flags).toHaveLength(1)
    expect(flags[0]).toHaveAttribute('title', 'Blockiert: Freigabe fehlt')
    expect(container.querySelectorAll('.blocked-flag')).toHaveLength(1)
    // the flag is the mark of this status: no second mark in the lower corner
    expect(container.querySelectorAll('.status-mark')).toHaveLength(0)
  })

  it('shows the hourglass, not the flag, on a box that waits for a prerequisite', () => {
    const { container } = renderNodes([
      box({ data: makeData({ waitingTitle: 'Wartet auf: Dienst B, Dienst C', status: 'offen', statusKnown: true }) }),
      box({ id: 'b2', position: { x: 300, y: 0 } }),
    ])

    const mark = screen.getByLabelText('Wartet auf: Dienst B, Dienst C')
    expect(mark).toHaveClass('waiting-mark')
    expect(mark).toHaveAttribute('title', 'Wartet auf: Dienst B, Dienst C')
    expect(container.querySelectorAll('.waiting-mark')).toHaveLength(1)
    expect(container.querySelectorAll('.blocked-flag')).toHaveLength(0)
    // the status mark of a waiting object stays
    expect(container.querySelectorAll('.status-mark')).toHaveLength(1)
  })

  it('puts the hourglass of a group into its title', () => {
    const { container } = renderNodes([group({ data: makeData({ waitingTitle: 'Enthält wartende Objekte: X' }) })])

    expect(container.querySelector('.group-node__header .waiting-mark')).toHaveAttribute(
      'aria-label',
      'Enthält wartende Objekte: X',
    )
  })

  it('puts the flag of a group into its title', () => {
    const { container } = renderNodes([
      group({ data: makeData({ blockedTitle: 'Enthält blockierte Objekte: X' }) }),
    ])

    expect(container.querySelector('.group-node__header .blocked-flag')).toHaveAttribute(
      'aria-label',
      'Enthält blockierte Objekte: X',
    )
  })

  it('marks every status of a box (tick, half circle, empty circle, question mark) but not groups', () => {
    const { container } = renderNodes([
      box({ id: 'done', data: makeData({ status: 'fertig' }) }),
      box({ id: 'wip', position: { x: 200, y: 0 }, data: makeData({ status: 'in Arbeit' }) }),
      box({ id: 'open', position: { x: 400, y: 0 }, data: makeData({ status: 'offen', statusRaw: 'offen', statusKnown: true }) }),
      box({ id: 'unset', position: { x: 600, y: 0 }, data: makeData({ status: 'offen', statusKnown: true }) }),
      box({ id: 'odd', position: { x: 800, y: 0 }, data: makeData({ status: 'offen', statusRaw: 'erledigt', statusKnown: false }) }),
      group({ data: makeData({ name: 'Gruppe' }) }),
    ])

    expect(screen.getByLabelText('Status: fertig')).toHaveClass('status-mark--done')
    expect(screen.getByLabelText('Status: in Arbeit')).toHaveClass('status-mark--progress')
    expect(screen.getByLabelText('Status: offen')).toHaveClass('status-mark--open')
    expect(screen.getByLabelText('Status: offen (nicht gesetzt)')).toHaveClass('status-mark--open')
    const unknown = screen.getByLabelText('Status „erledigt“ unbekannt – zählt als offen')
    expect(unknown).toHaveClass('status-mark--unknown')
    expect(unknown).toHaveAttribute('title', 'Status „erledigt“ unbekannt – zählt als offen')
    expect(container.querySelectorAll('.status-mark')).toHaveLength(5)
  })

  it('shows only the tick on a finished box: no flag, hourglass or triangle', () => {
    const { container } = renderNodes([box({ data: makeData({ status: 'fertig' }) })])

    expect(screen.getByLabelText('Status: fertig')).toHaveClass('status-mark--done')
    expect(container.querySelectorAll('.blocked-flag, .waiting-mark, .inconsistent-mark')).toHaveLength(0)
  })

  it('puts flag and hourglass of a group side by side into its title', () => {
    const { container } = renderNodes([
      group({
        data: makeData({
          blockedTitle: 'Enthält blockierte Objekte: X',
          waitingTitle: 'Enthält wartende Objekte: Z',
        }),
      }),
    ])

    expect(container.querySelector('.group-node__header .blocked-flag')).not.toBeNull()
    expect(container.querySelector('.group-node__header .waiting-mark')).not.toBeNull()
  })

  it('keeps flag, status mark and cycle badge apart on one box', () => {
    const { container } = renderNodes([
      box({ data: makeData({ blockedTitle: 'Blockiert: X', isInCycle: true, status: 'fertig' }) }),
    ])

    expect(container.querySelector('.box-node .blocked-flag')).not.toBeNull()
    expect(container.querySelector('.box-node .cycle-badge')).not.toBeNull()
    expect(container.querySelector('.box-node .status-mark')).not.toBeNull()
  })

  it('flashes a revealed element', () => {
    const { container } = renderNodes([
      box({ data: makeData({ isRevealed: true }) }),
      group({ data: makeData({ isRevealed: true }) }),
    ])

    expect(container.querySelector('.box-node')).toHaveClass('box-node--revealed')
    expect(container.querySelector('.group-node')).toHaveClass('group-node--revealed')
  })
})

describe('node components language', () => {
  it.each([
    ['en', 'Part of a cycle'],
    ['fr', 'Fait partie d’un cycle'],
  ] as const)('labels the cycle badge in %s', (locale, label) => {
    setTestLocale(locale)
    renderNodes([box({ data: makeData({ isInCycle: true }) })])
    expect(screen.getAllByLabelText(label)).toHaveLength(1)
  })

  it.each([
    ['en', 'Status “erledigt” unknown – counts as open'],
    ['fr', 'Statut « erledigt » inconnu – compte comme ouvert'],
  ] as const)('explains an unknown status in %s', (locale, label) => {
    setTestLocale(locale)
    renderNodes([box({ data: makeData({ status: 'offen', statusRaw: 'erledigt', statusKnown: false }) })])
    expect(screen.getByLabelText(label)).toBeInTheDocument()
  })

  it.each([
    ['en', ['Status: done', 'Status: in progress', 'Status: open', 'Status: open (not set)']],
    ['fr', ['Statut : terminé', 'Statut : en cours', 'Statut : ouvert', 'Statut : ouvert (non défini)']],
  ] as const)('names the status marks in %s', (locale, labels) => {
    setTestLocale(locale)
    renderNodes([
      box({ id: 'f', data: makeData({ status: 'fertig' }) }),
      box({ id: 'w', data: makeData({ status: 'in Arbeit' }) }),
      box({ id: 'o', data: makeData({ status: 'offen', statusRaw: 'offen' }) }),
      box({ id: 'n', data: makeData({ status: 'offen' }) }),
    ])
    for (const label of labels) expect(screen.getByLabelText(label)).toBeInTheDocument()
  })
})
