import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ImportDialog } from './ImportDialog'
import type { ImportDialogProps } from './props'

function makeProps(overrides: Partial<ImportDialogProps> = {}): ImportDialogProps {
  return {
    open: true,
    projectName: 'Release-Management',
    counts: { objects: 5, groups: 2, connections: 7 },
    unsaved: true,
    onExportAndImport: vi.fn(),
    onImportWithoutExport: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  }
}

describe('ImportDialog', () => {
  it('names the project that gets replaced and its size', () => {
    render(<ImportDialog {...makeProps()} />)

    expect(screen.getByRole('dialog', { name: 'Projekt ersetzen?' })).toBeInTheDocument()
    expect(
      screen.getByText('Der Import ersetzt das aktuelle Projekt „Release-Management“ (5 Objekte, 2 Gruppen, 7 Verbindungen).'),
    ).toBeInTheDocument()
  })

  it('leaves out groups and connections when there are none', () => {
    render(<ImportDialog {...makeProps({ counts: { objects: 4, groups: 0, connections: 0 } })} />)

    expect(
      screen.getByText('Der Import ersetzt das aktuelle Projekt „Release-Management“ (4 Objekte).'),
    ).toBeInTheDocument()
  })

  it('uses singular forms', () => {
    render(<ImportDialog {...makeProps({ counts: { objects: 1, groups: 1, connections: 1 } })} />)
    expect(screen.getByText(/\(1 Objekt, 1 Gruppe, 1 Verbindung\)/)).toBeInTheDocument()
  })

  it('warns prominently about changes that were never exported', () => {
    render(<ImportDialog {...makeProps({ unsaved: true })} />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Es gibt Änderungen, die noch nicht exportiert wurden. Sie gehen verloren, wenn ohne Export importiert wird.',
    )
    expect(screen.queryByText('Der aktuelle Stand wurde bereits exportiert.')).not.toBeInTheDocument()
  })

  it('reassures when the current state was exported already', () => {
    render(<ImportDialog {...makeProps({ unsaved: false })} />)

    expect(screen.getByText('Der aktuelle Stand wurde bereits exportiert.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('points out that the import can be undone in this session', () => {
    render(<ImportDialog {...makeProps()} />)
    expect(screen.getByText('In dieser Sitzung lässt sich der Import mit „Rückgängig“ zurücknehmen.')).toBeInTheDocument()
  })

  it('calls the matching handler for each of the three buttons', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(<ImportDialog {...props} />)

    await user.click(screen.getByRole('button', { name: 'Exportieren und importieren' }))
    expect(props.onExportAndImport).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Ohne Export importieren' }))
    expect(props.onImportWithoutExport).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(props.onCancel).toHaveBeenCalledTimes(1)
    expect(props.onExportAndImport).toHaveBeenCalledTimes(1)
  })

  it('treats Escape (native cancel event) as cancel', () => {
    const props = makeProps()
    const { container } = render(<ImportDialog {...props} />)

    const event = new Event('cancel', { cancelable: true })
    fireEvent(container.querySelector('dialog')!, event)

    expect(props.onCancel).toHaveBeenCalledTimes(1)
    expect(props.onImportWithoutExport).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('focuses the export button when changes would be lost, otherwise the plain import', () => {
    const { rerender } = render(<ImportDialog {...makeProps({ open: false })} />)
    rerender(<ImportDialog {...makeProps({ open: true, unsaved: true })} />)
    expect(screen.getByRole('button', { name: 'Exportieren und importieren' })).toHaveFocus()

    rerender(<ImportDialog {...makeProps({ open: false })} />)
    rerender(<ImportDialog {...makeProps({ open: true, unsaved: false })} />)
    expect(screen.getByRole('button', { name: 'Ohne Export importieren' })).toHaveFocus()
  })

  it('marks the destructive choice as dangerous only when something would be lost', () => {
    const { rerender } = render(<ImportDialog {...makeProps({ unsaved: true })} />)
    expect(screen.getByRole('button', { name: 'Ohne Export importieren' })).toHaveClass('ui-button--danger')

    rerender(<ImportDialog {...makeProps({ unsaved: false })} />)
    expect(screen.getByRole('button', { name: 'Ohne Export importieren' })).not.toHaveClass('ui-button--danger')
  })
})
