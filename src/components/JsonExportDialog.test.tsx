import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { JsonExportDialog } from './JsonExportDialog'
import type { JsonExportDialogProps } from './props'

const JSON_TEXT = '{\n  "version": 1\n}'

function makeProps(overrides: Partial<JsonExportDialogProps> = {}): JsonExportDialogProps {
  return {
    open: true,
    json: JSON_TEXT,
    onCopy: vi.fn(() => Promise.resolve(true)),
    onClose: vi.fn(),
    ...overrides,
  }
}

describe('JsonExportDialog', () => {
  it('shows the JSON in a read-only, preselected text box', () => {
    render(<JsonExportDialog {...makeProps()} />)

    const area = screen.getByRole('textbox', { name: 'Projekt-JSON (schreibgeschützt)' })
    expect(screen.getByRole('dialog', { name: 'Projekt als JSON' })).toBeInTheDocument()
    expect(area).toHaveValue(JSON_TEXT)
    expect(area).toHaveAttribute('readonly')
    expect(area).toHaveFocus()
    expect((area as HTMLTextAreaElement).selectionStart).toBe(0)
    expect((area as HTMLTextAreaElement).selectionEnd).toBe(JSON_TEXT.length)
  })

  it('renders nothing while closed', () => {
    render(<JsonExportDialog {...makeProps({ open: false })} />)

    expect(screen.queryByRole('textbox', { hidden: true })).not.toBeInTheDocument()
  })

  it('copies and confirms', async () => {
    const props = makeProps()
    render(<JsonExportDialog {...props} />)

    await userEvent.click(screen.getByRole('button', { name: 'In Zwischenablage kopieren' }))

    expect(props.onCopy).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('status')).toHaveTextContent('In die Zwischenablage kopiert.')
  })

  it('tells how to copy by hand when the clipboard is not available', async () => {
    render(<JsonExportDialog {...makeProps({ onCopy: vi.fn(() => Promise.resolve(false)) })} />)

    await userEvent.click(screen.getByRole('button', { name: 'In Zwischenablage kopieren' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Kopieren nicht möglich')
    expect(screen.getByRole('textbox')).toHaveFocus()
  })

  it('closes by button and by Escape', async () => {
    const props = makeProps()
    const { container } = render(<JsonExportDialog {...props} />)

    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    const event = new Event('cancel', { cancelable: true })
    fireEvent(container.querySelector('dialog')!, event)

    expect(props.onClose).toHaveBeenCalledTimes(2)
    expect(event.defaultPrevented).toBe(true)
  })
})
