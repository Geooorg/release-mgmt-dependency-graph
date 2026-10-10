import { ReactFlow } from '@xyflow/react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { AppFlowNode, FlowNodeData } from '../flow/types'
import { NodeNameEditContext, type NodeNameEdit } from './nodeNameEdit'
import { nodeTypes } from './nodeTypes'
import { setTestLocale } from '../test/locale'

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  class DOMMatrixReadOnlyStub {
    m22 = 1
  }
  globalThis.ResizeObserver = ResizeObserverStub
  globalThis.DOMMatrixReadOnly = DOMMatrixReadOnlyStub as unknown as typeof DOMMatrixReadOnly
})

function makeData(name: string, id: string): FlowNodeData {
  return {
    name,
    id,
    isConnectSource: false,
    isDropTarget: false,
    isDependency: false,
    isInCycle: false,
    isRevealed: false,
  }
}

const nodes = [
  { id: 'b1', type: 'box', position: { x: 0, y: 0 }, data: makeData('Projekt A', 'b1') },
  { id: 'abcdef12-3456', type: 'box', position: { x: 0, y: 100 }, data: makeData('', 'abcdef12-3456') },
  { id: 'g1', type: 'group', position: { x: 0, y: 200 }, width: 320, height: 200, data: makeData('Gruppe X', 'g1') },
] as AppFlowNode[]

function setup(edit: Partial<NodeNameEdit> = {}) {
  const value: NodeNameEdit = { enabled: true, onRename: vi.fn(), ...edit }
  render(
    <NodeNameEditContext value={value}>
      <div style={{ width: 800, height: 600 }}>
        <ReactFlow nodes={nodes} edges={[]} nodeTypes={nodeTypes} />
      </div>
    </NodeNameEditContext>,
  )
  return value
}

// jsdom has no layout, so a double click is fired directly (a real mouse-down trips d3-drag there).
// By label: React Flow keeps nodes `visibility: hidden` until they are measured, which jsdom never does.
const editor = () => screen.getByLabelText('Name')

describe('inline name editing', () => {
  it('starts on a double click on the name of an object, with the name selected', async () => {
    setup()
    fireEvent.doubleClick(screen.getByText('Projekt A'))

    expect(editor()).toHaveValue('Projekt A')
    expect(editor()).toHaveFocus()
    expect((editor() as HTMLInputElement).selectionEnd).toBe('Projekt A'.length)
    expect(screen.queryByText('Projekt A')).not.toBeInTheDocument()
  })

  it('also works on the title of a group', async () => {
    const edit = setup()
    fireEvent.doubleClick(screen.getByText('Gruppe X'))
    await userEvent.keyboard('Backend{Enter}')

    expect(edit.onRename).toHaveBeenCalledWith('g1', 'Backend')
  })

  it('confirms with Enter, once', async () => {
    const edit = setup()
    fireEvent.doubleClick(screen.getByText('Projekt A'))
    await userEvent.keyboard('Neu{Enter}')

    expect(edit.onRename).toHaveBeenCalledTimes(1)
    expect(edit.onRename).toHaveBeenCalledWith('b1', 'Neu')
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
  })

  it('confirms when the field loses focus', async () => {
    const edit = setup()
    fireEvent.doubleClick(screen.getByText('Projekt A'))
    await userEvent.keyboard('Neu')
    fireEvent.blur(editor())

    expect(edit.onRename).toHaveBeenCalledWith('b1', 'Neu')
  })

  it('discards with Escape', async () => {
    const edit = setup()
    fireEvent.doubleClick(screen.getByText('Projekt A'))
    await userEvent.keyboard('Neu{Escape}')

    expect(edit.onRename).not.toHaveBeenCalled()
    expect(screen.getByText('Projekt A')).toBeInTheDocument()
  })

  it('does not report an unchanged name', async () => {
    const edit = setup()
    fireEvent.doubleClick(screen.getByText('Projekt A'))
    await userEvent.keyboard('{Enter}')

    expect(edit.onRename).not.toHaveBeenCalled()
  })

  it('edits an unnamed element from an empty field, not from its short id', async () => {
    const edit = setup()
    fireEvent.doubleClick(screen.getByText('abcdef12'))
    expect(editor()).toHaveValue('')

    await userEvent.keyboard('Benannt{Enter}')
    expect(edit.onRename).toHaveBeenCalledWith('abcdef12-3456', 'Benannt')
  })

  it('keeps typing away from the canvas', async () => {
    setup()
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    fireEvent.doubleClick(screen.getByText('Projekt A'))
    await userEvent.keyboard('{Delete}n')
    document.removeEventListener('keydown', outer)

    expect(outer).not.toHaveBeenCalled()
  })

  it('does nothing while another tool needs the clicks', async () => {
    const edit = setup({ enabled: false })
    fireEvent.doubleClick(screen.getByText('Projekt A'))

    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
    expect(edit.onRename).not.toHaveBeenCalled()
  })

  it('marks the field so it neither drags the node nor pans the canvas', async () => {
    setup()
    fireEvent.doubleClick(screen.getByText('Projekt A'))

    expect(editor()).toHaveClass('nodrag', 'nopan')
  })
})

describe('NodeName language', () => {
  it.each([
    ['en', 'Name'],
    ['fr', 'Nom'],
  ] as const)('labels the editor in %s', async (locale, label) => {
    setTestLocale(locale)
    setup()
    fireEvent.doubleClick(screen.getByText('Projekt A'))
    expect(screen.getByLabelText(label)).toBeInTheDocument()
  })
})
