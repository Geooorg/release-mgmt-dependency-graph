import { ReactFlow } from '@xyflow/react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { AppFlowNode, FlowNodeData } from '../flow/types'
import { nodeTypes } from './nodeTypes'
import { NodeNameEditContext, type NodeNameEdit } from './nodeNameEdit'
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

function noteNode(text: string, extra: Partial<AppFlowNode> = {}, data: Partial<FlowNodeData> = {}): AppFlowNode {
  return {
    id: 'n1',
    type: 'note',
    position: { x: 0, y: 0 },
    width: 160,
    height: 120,
    data: {
      name: text,
      id: 'n1',
      isConnectSource: false,
      isDropTarget: false,
      isDependency: false,
      isInCycle: false,
      isRevealed: false,
      color: '#fef08a',
      textColor: '#111827',
      ...data,
    },
    ...extra,
  } as AppFlowNode
}

function setup(node: AppFlowNode, edit: Partial<NodeNameEdit> = {}) {
  const value: NodeNameEdit = { enabled: true, onRename: vi.fn(), ...edit }
  const view = render(
    <NodeNameEditContext value={value}>
      <div style={{ width: 800, height: 600 }}>
        <ReactFlow nodes={[node]} edges={[]} nodeTypes={nodeTypes} />
      </div>
    </NodeNameEditContext>,
  )
  return { value, view }
}

const editor = () => screen.getByLabelText('Notiztext')

describe('NoteNode', () => {
  it('shows the text on a note without connectors, in its colour', () => {
    const { view } = setup(noteNode('Plan B'))

    expect(screen.getByText('Plan B')).toBeInTheDocument()
    expect(view.container.querySelector('.react-flow__handle')).toBeNull()
    const note = view.container.querySelector<HTMLElement>('.note-node')!
    expect(note.style.getPropertyValue('--note-color')).toBe('#fef08a')
    expect(note.style.getPropertyValue('--note-text')).toBe('#111827')
  })

  it('fits as many lines as its height allows and cuts the rest off (CSS line clamp)', () => {
    const { view } = setup(noteNode('x', { height: 120 }))
    // (120 - 2 * 10) / 20 lines
    expect(view.container.querySelector<HTMLElement>('.note-node')!.style.getPropertyValue('--note-lines')).toBe('5')

    view.unmount()
    const taller = setup(noteNode('x', { height: 220 }))
    expect(taller.view.container.querySelector<HTMLElement>('.note-node')!.style.getPropertyValue('--note-lines')).toBe('10')
  })

  it('invites to write while it is empty', () => {
    setup(noteNode(''))

    expect(screen.getByText('Doppelklick zum Schreiben')).toHaveClass('note-node__text--empty')
  })

  it('starts editing on a double click, with the text selected', () => {
    setup(noteNode('Plan B'))
    fireEvent.doubleClick(screen.getByText('Plan B'))

    expect(editor()).toHaveValue('Plan B')
    expect(editor()).toHaveFocus()
    expect((editor() as HTMLTextAreaElement).selectionEnd).toBe('Plan B'.length)
  })

  it('does not edit while another tool needs the clicks', () => {
    setup(noteNode('Plan B'), { enabled: false })
    fireEvent.doubleClick(screen.getByText('Plan B'))

    expect(screen.queryByLabelText('Notiztext')).toBeNull()
  })

  it('confirms with Ctrl+Enter, keeps line breaks and reports the text once', () => {
    const { value } = setup(noteNode('alt'))
    fireEvent.doubleClick(screen.getByText('alt'))
    fireEvent.change(editor(), { target: { value: 'Zeile 1\nZeile 2' } })
    fireEvent.keyDown(editor(), { key: 'Enter', ctrlKey: true })

    expect(value.onRename).toHaveBeenCalledTimes(1)
    expect(value.onRename).toHaveBeenCalledWith('n1', 'Zeile 1\nZeile 2')
    expect(screen.queryByLabelText('Notiztext')).toBeNull()
  })

  it('a plain Enter is a line break, not a confirmation', () => {
    const { value } = setup(noteNode('alt'))
    fireEvent.doubleClick(screen.getByText('alt'))
    fireEvent.keyDown(editor(), { key: 'Enter' })

    expect(value.onRename).not.toHaveBeenCalled()
    expect(editor()).toBeInTheDocument()
  })

  it('confirms on leaving the field, discards on Escape, ignores no change', () => {
    const { value } = setup(noteNode('alt'))
    fireEvent.doubleClick(screen.getByText('alt'))
    fireEvent.change(editor(), { target: { value: 'neu' } })
    fireEvent.blur(editor())
    expect(value.onRename).toHaveBeenCalledWith('n1', 'neu')

    fireEvent.doubleClick(screen.getByText('alt'))
    fireEvent.change(editor(), { target: { value: 'verworfen' } })
    fireEvent.keyDown(editor(), { key: 'Escape' })
    fireEvent.blur(screen.getByText('alt'))
    expect(value.onRename).toHaveBeenCalledTimes(1)

    fireEvent.doubleClick(screen.getByText('alt'))
    fireEvent.blur(editor())
    expect(value.onRename).toHaveBeenCalledTimes(1)
  })

  it('keeps typing away from the canvas shortcuts', () => {
    setup(noteNode('x'))
    fireEvent.doubleClick(screen.getByText('x'))
    const reached = vi.fn()
    document.addEventListener('keydown', reached)
    fireEvent.keyDown(editor(), { key: 'Delete' })
    document.removeEventListener('keydown', reached)

    expect(reached).not.toHaveBeenCalled()
  })

  it('is labelled in English and French', () => {
    setTestLocale('en')
    const en = setup(noteNode(''))
    expect(screen.getByText('Double-click to write')).toBeInTheDocument()
    en.view.unmount()

    setTestLocale('fr')
    setup(noteNode(''))
    expect(screen.getByText('Double-clic pour écrire')).toBeInTheDocument()
  })
})
