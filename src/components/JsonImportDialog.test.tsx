import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { JsonImportDialog } from './JsonImportDialog'
import type { JsonImportDialogProps } from './props'
import { setTestLocale } from '../test/locale'

function makeProps(overrides: Partial<JsonImportDialogProps> = {}): JsonImportDialogProps {
  return {
    open: true,
    projectName: 'Release-Management',
    counts: { objects: 5, groups: 2, connections: 7 },
    unsaved: true,
    errors: [],
    onImport: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  }
}

const box = () => screen.getByRole('textbox', { name: 'JSON-Text' })
const importButton = () => screen.getByRole('button', { name: 'Importieren' })

describe('JsonImportDialog', () => {
  it('names the project that gets replaced and focuses the empty text box', () => {
    render(<JsonImportDialog {...makeProps()} />)

    expect(screen.getByRole('dialog', { name: 'JSON einfügen' })).toBeInTheDocument()
    expect(
      screen.getByText('Der Import ersetzt das aktuelle Projekt „Release-Management“ (5 Objekte, 2 Gruppen, 7 Verbindungen).'),
    ).toBeInTheDocument()
    expect(box()).toHaveValue('')
    expect(box()).toHaveFocus()
  })

  it('cannot import an empty text', async () => {
    render(<JsonImportDialog {...makeProps()} />)
    expect(importButton()).toBeDisabled()

    await userEvent.type(box(), '   ')
    expect(importButton()).toBeDisabled()

    await userEvent.type(box(), 'x')
    expect(importButton()).toBeEnabled()
  })

  it('hands the pasted text over unchanged', async () => {
    const props = makeProps()
    render(<JsonImportDialog {...props} />)

    await userEvent.click(box())
    await userEvent.paste('{"version":1}')
    await userEvent.click(importButton())

    expect(props.onImport).toHaveBeenCalledWith('{"version":1}')
  })

  it('warns about unexported changes and marks the import as dangerous', () => {
    const { rerender } = render(<JsonImportDialog {...makeProps({ unsaved: true })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('noch nicht exportiert oder kopiert')
    expect(importButton()).toHaveClass('ui-button--danger')

    rerender(<JsonImportDialog {...makeProps({ unsaved: false })} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Der aktuelle Stand wurde bereits exportiert.')).toBeInTheDocument()
    expect(importButton()).not.toHaveClass('ui-button--danger')
  })

  it('shows the validation errors of the submitted text until it is edited', async () => {
    const props = makeProps({ unsaved: false })
    const { rerender } = render(<JsonImportDialog {...props} />)
    await userEvent.type(box(), 'x')
    await userEvent.click(importButton())

    rerender(<JsonImportDialog {...props} errors={['version fehlt', 'nodes[0].id fehlt']} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Der Text ist kein gültiges Modell. Das aktuelle Projekt blieb unverändert.')
    expect(alert).toHaveTextContent('version fehlt')
    expect(alert).toHaveTextContent('nodes[0].id fehlt')

    await userEvent.type(box(), 'y')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('starts empty each time it is opened', async () => {
    const { rerender } = render(<JsonImportDialog {...makeProps()} />)
    await userEvent.type(box(), 'alt')

    rerender(<JsonImportDialog {...makeProps({ open: false })} />)
    rerender(<JsonImportDialog {...makeProps({ open: true })} />)

    expect(box()).toHaveValue('')
  })

  it('cancels by button and by Escape', async () => {
    const props = makeProps()
    const { container } = render(<JsonImportDialog {...props} />)

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    const event = new Event('cancel', { cancelable: true })
    fireEvent(container.querySelector('dialog')!, event)

    expect(props.onCancel).toHaveBeenCalledTimes(2)
    expect(event.defaultPrevented).toBe(true)
    expect(props.onImport).not.toHaveBeenCalled()
  })
})

describe('JsonImportDialog language', () => {
  it.each([
    ['en', 'Paste JSON', 'JSON text', 'Import', 'Cancel', 'The import replaces the current project “Release-Management” (5 objects, 2 groups, 7 connections).'],
    ['fr', 'Coller du JSON', 'Texte JSON', 'Importer', 'Annuler', 'L’import remplace le projet actuel « Release-Management » (5 objets, 2 groupes, 7 liaisons).'],
  ] as const)('translates the dialog in %s', (locale, title, label, submit, cancel, message) => {
    setTestLocale(locale)
    render(<JsonImportDialog {...makeProps()} />)

    expect(screen.getByRole('dialog', { name: title, hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: label })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: submit, hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: cancel, hidden: true })).toBeInTheDocument()
    expect(screen.getByText(message)).toBeInTheDocument()
  })

  it.each([
    ['en', 'The text is not a valid model.'],
    ['fr', 'Le texte n’est pas un modèle valide.'],
  ] as const)('translates the error heading in %s', async (locale, heading) => {
    setTestLocale(locale)
    render(<JsonImportDialog {...makeProps({ errors: ['x'] })} />)

    await userEvent.type(screen.getByRole('textbox'), '{{')
    await userEvent.click(screen.getByRole('button', { name: /^(Import|Importer)$/, hidden: true }))
    expect(screen.getAllByRole('alert', { hidden: true }).map((el) => el.textContent).join(' ')).toContain(heading)
  })
})
