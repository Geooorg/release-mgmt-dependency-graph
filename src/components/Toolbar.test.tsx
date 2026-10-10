import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar } from './Toolbar'
import type { ToolbarProps } from './props'

function makeProps(overrides: Partial<ToolbarProps> = {}): ToolbarProps {
  return {
    connectMode: 'off',
    canGroup: true,
    canUngroup: true,
    canDelete: true,
    onAddNode: vi.fn(),
    onToggleConnect: vi.fn(),
    onGroup: vi.fn(),
    onUngroup: vi.fn(),
    onDelete: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
    ...overrides,
  }
}

describe('Toolbar', () => {
  it('renders a labelled toolbar with the app title and all buttons', () => {
    render(<Toolbar {...makeProps()} />)

    expect(screen.getByRole('toolbar', { name: 'Werkzeuge' })).toBeInTheDocument()
    expect(screen.getByText('Release-Management')).toBeInTheDocument()
    for (const label of [
      'Objekt anlegen',
      'Verbinden',
      'Gruppieren',
      'Gruppe auflösen',
      'Löschen',
      'Export',
      'Import',
    ]) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('type', 'button')
    }
    expect(screen.getAllByRole('separator')).toHaveLength(2)
  })

  it('calls the matching handler for every button', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(<Toolbar {...props} />)

    await user.click(screen.getByRole('button', { name: 'Objekt anlegen' }))
    await user.click(screen.getByRole('button', { name: 'Verbinden' }))
    await user.click(screen.getByRole('button', { name: 'Gruppieren' }))
    await user.click(screen.getByRole('button', { name: 'Gruppe auflösen' }))
    await user.click(screen.getByRole('button', { name: 'Löschen' }))
    await user.click(screen.getByRole('button', { name: 'Export' }))
    await user.click(screen.getByRole('button', { name: 'Import' }))

    expect(props.onAddNode).toHaveBeenCalledTimes(1)
    expect(props.onToggleConnect).toHaveBeenCalledTimes(1)
    expect(props.onGroup).toHaveBeenCalledTimes(1)
    expect(props.onUngroup).toHaveBeenCalledTimes(1)
    expect(props.onDelete).toHaveBeenCalledTimes(1)
    expect(props.onExport).toHaveBeenCalledTimes(1)
    expect(props.onImport).toHaveBeenCalledTimes(1)
  })

  it('disables group, ungroup and delete unless allowed', async () => {
    const user = userEvent.setup()
    const props = makeProps({ canGroup: false, canUngroup: false, canDelete: false })
    render(<Toolbar {...props} />)

    for (const label of ['Gruppieren', 'Gruppe auflösen', 'Löschen']) {
      expect(screen.getByRole('button', { name: label })).toBeDisabled()
    }
    expect(screen.getByRole('button', { name: 'Objekt anlegen' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Löschen' }))
    expect(props.onDelete).not.toHaveBeenCalled()
  })

  it('enables each action independently', () => {
    render(<Toolbar {...makeProps({ canGroup: true, canUngroup: false, canDelete: true })} />)

    expect(screen.getByRole('button', { name: 'Gruppieren' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Gruppe auflösen' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Löschen' })).toBeEnabled()
  })

  it('shows the connect toggle as not pressed and no hint when off', () => {
    render(<Toolbar {...makeProps({ connectMode: 'off' })} />)

    expect(screen.getByRole('button', { name: 'Verbinden' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows a source hint while picking the source', () => {
    render(<Toolbar {...makeProps({ connectMode: 'pickSource' })} />)

    expect(screen.getByRole('button', { name: 'Verbinden' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Quelle wählen …')
  })

  it('shows a target hint while picking the target', () => {
    render(<Toolbar {...makeProps({ connectMode: 'pickTarget' })} />)

    expect(screen.getByRole('button', { name: 'Verbinden' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Ziel wählen …')
  })
})
