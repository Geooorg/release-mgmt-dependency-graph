import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ExportDialog } from './ExportDialog'
import type { ExportDialogProps } from './props'
import { setTestLocale } from '../test/locale'

function makeProps(overrides: Partial<ExportDialogProps> = {}): ExportDialogProps {
  return {
    open: true,
    svgDisabled: false,
    onExport: vi.fn(() => Promise.resolve(true)),
    onClose: vi.fn(),
    ...overrides,
  }
}

const option = (name: string) => screen.getByRole('radio', { name: new RegExp(`^${name}`) })

describe('ExportDialog', () => {
  it('offers JSON file, SVG and JSON (clipboard), the file preselected', () => {
    render(<ExportDialog {...makeProps()} />)

    expect(screen.getByRole('dialog', { name: 'Exportieren' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual([
      expect.stringContaining('JSON-Datei'),
      expect.stringContaining('SVG'),
      expect.stringContaining('JSON (Zwischenablage)'),
    ])
    expect(option('JSON-Datei')).toBeChecked()
    expect(option('SVG')).not.toBeChecked()
  })

  it('renders nothing while closed', () => {
    render(<ExportDialog {...makeProps({ open: false })} />)

    expect(screen.queryByRole('radio', { hidden: true })).not.toBeInTheDocument()
  })

  it.each([
    ['JSON-Datei', 'json-file'],
    ['SVG', 'svg'],
    ['JSON \\(Zwischenablage\\)', 'json-clipboard'],
  ] as const)('exports "%s" as %s', async (label, format) => {
    const props = makeProps()
    render(<ExportDialog {...props} />)

    await userEvent.click(option(label))
    await userEvent.click(screen.getByRole('button', { name: 'Exportieren' }))

    expect(props.onExport).toHaveBeenCalledWith(format)
  })

  it('closes after a file download', async () => {
    const props = makeProps()
    render(<ExportDialog {...props} />)

    await userEvent.click(screen.getByRole('button', { name: 'Exportieren' }))

    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('stays open after copying, says so and then offers "Schließen"', async () => {
    const props = makeProps()
    render(<ExportDialog {...props} />)

    await userEvent.click(option('JSON \\(Zwischenablage\\)'))
    await userEvent.click(screen.getByRole('button', { name: 'Exportieren' }))

    expect(await screen.findByRole('status')).toHaveTextContent('In die Zwischenablage kopiert.')
    expect(props.onClose).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('tells what to do when the clipboard is not available, and clears the message on another choice', async () => {
    render(<ExportDialog {...makeProps({ onExport: vi.fn(() => Promise.resolve(false)) })} />)

    await userEvent.click(option('JSON \\(Zwischenablage\\)'))
    await userEvent.click(screen.getByRole('button', { name: 'Exportieren' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Kopieren nicht möglich')

    await userEvent.click(option('SVG'))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('disables SVG for an empty graph and says why', async () => {
    const props = makeProps({ svgDisabled: true })
    render(<ExportDialog {...props} />)

    expect(option('SVG')).toBeDisabled()
    expect(screen.getByText('Der Graph ist leer – es gibt nichts zu zeichnen.')).toBeInTheDocument()
    expect(option('JSON-Datei')).toBeEnabled()
  })

  it('starts with the file again every time it opens', async () => {
    const { rerender } = render(<ExportDialog {...makeProps()} />)
    await userEvent.click(option('SVG'))

    rerender(<ExportDialog {...makeProps({ open: false })} />)
    rerender(<ExportDialog {...makeProps()} />)

    expect(option('JSON-Datei')).toBeChecked()
  })

  it('cancels by button and by Escape', async () => {
    const props = makeProps()
    const { container } = render(<ExportDialog {...props} />)

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    const event = new Event('cancel', { cancelable: true })
    fireEvent(container.querySelector('dialog')!, event)

    expect(props.onClose).toHaveBeenCalledTimes(2)
    expect(event.defaultPrevented).toBe(true)
    expect(props.onExport).not.toHaveBeenCalled()
  })
})

describe('ExportDialog language', () => {
  it.each([
    ['en', 'Export', 'JSON file', 'JSON (clipboard)', 'Cancel'],
    ['fr', 'Exporter', 'Fichier JSON', 'JSON (presse-papiers)', 'Annuler'],
  ] as const)('translates the dialog in %s', (locale, title, file, clipboard, cancel) => {
    setTestLocale(locale)
    render(<ExportDialog {...makeProps()} />)

    expect(screen.getByRole('dialog', { name: title, hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: new RegExp(`^${file}`), hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: new RegExp(`^${clipboard.replace(/[()]/g, '\\$&')}`), hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: cancel, hidden: true })).toBeInTheDocument()
  })
})
