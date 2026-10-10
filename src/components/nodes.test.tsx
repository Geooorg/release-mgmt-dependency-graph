import { ReactFlow } from '@xyflow/react'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import type { AppFlowNode, FlowNodeData } from '../flow/types'
import { NODE_SIZE } from '../model/types'
import { nodeTypes } from './nodeTypes'

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

  it('renders a box node with name, fixed size and both handles', () => {
    const { container } = renderNodes([box()])

    const node = container.querySelector<HTMLElement>('.box-node')
    expect(node).not.toBeNull()
    expect(node).toHaveTextContent('Projekt A')
    expect(node).toHaveStyle({ width: `${NODE_SIZE.width}px`, height: `${NODE_SIZE.height}px` })
    expect(node?.querySelector('.react-flow__handle-left.target')).not.toBeNull()
    expect(node?.querySelector('.react-flow__handle-right.source')).not.toBeNull()
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

  it('renders a group node with header label and handles', () => {
    const { container } = renderNodes([group()])

    const node = container.querySelector<HTMLElement>('.group-node')
    expect(node).not.toBeNull()
    expect(node?.querySelector('.group-node__header')).toHaveTextContent('Gruppe X')
    expect(node?.querySelector('.react-flow__handle-left.target')).not.toBeNull()
    expect(node?.querySelector('.react-flow__handle-right.source')).not.toBeNull()
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
})
