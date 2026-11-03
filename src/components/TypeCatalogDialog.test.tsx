import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { tidyType } from '../model/catalog'
import type { TypeDef } from '../model/types'
import { TypeCatalogDialog } from './TypeCatalogDialog'
import type { TypeCatalogDialogProps } from './props'

function makeProps(over: Partial<TypeCatalogDialogProps> = {}): TypeCatalogDialogProps {
  return {
    open: true,
    readOnly: false,
    elementTypes: [{ id: 't1', name: 'Service', fields: [], usage: 2 }],
    edgeTypes: [],
    onAdd: vi.fn(() => 'new'),
    onUpdate: vi.fn(),
    onRemove: vi.fn(),
    problemsOf: () => [],
    templates: [{ id: 'it', label: 'IT-Services' }],
    onTemplate: vi.fn(),
    onImportCatalog: vi.fn(),
    onExportCatalog: vi.fn(),
    importError: null,
    onEditStart: vi.fn(),
    onEditEnd: vi.fn(),
    onClose: vi.fn(),
    ...over,
  }
}

describe('TypeCatalogDialog', () => {
  it('lists the types with their usage and adds a new one', async () => {
    const props = makeProps()
    render(<TypeCatalogDialog {...props} />)
    expect(screen.getByText('Service')).toBeInTheDocument()
    expect(screen.getByText('2 in Verwendung')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Neuer Typ' }))
    expect(props.onAdd).toHaveBeenCalledWith('elementTypes')
  })

  it('applies a valid rename at once', async () => {
    const props = makeProps()
    render(<TypeCatalogDialog {...props} />)
    await userEvent.click(screen.getByText('Service'))
    const name = screen.getByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Dienst')
    expect(props.onUpdate).toHaveBeenLastCalledWith('elementTypes', expect.objectContaining({ id: 't1', name: 'Dienst' }))
  })

  it('does not apply a draft with problems and shows them', async () => {
    const props = makeProps({ problemsOf: (_side, type) => (type.name === '' ? ['Der Name darf nicht leer sein.'] : []) })
    render(<TypeCatalogDialog {...props} />)
    await userEvent.click(screen.getByText('Service'))
    await userEvent.clear(screen.getByLabelText('Name'))
    expect(screen.getByText('Der Name darf nicht leer sein.')).toBeInTheDocument()
    expect(props.onUpdate).not.toHaveBeenCalledWith('elementTypes', expect.objectContaining({ name: '' }))
  })

  it('drops a stale draft when the stored type changes underneath', async () => {
    const props = makeProps({ problemsOf: (_side, type) => (type.name === '' ? ['leer'] : []) })
    const { rerender } = render(<TypeCatalogDialog {...props} />)
    await userEvent.click(screen.getByText('Service'))
    await userEvent.clear(screen.getByLabelText('Name'))
    rerender(<TypeCatalogDialog {...props} elementTypes={[{ id: 't1', name: 'Restored', fields: [], usage: 2 }]} />)
    expect(screen.getByLabelText('Name')).toHaveValue('Restored')
  })

  it('asks before deleting a type that is in use', async () => {
    const props = makeProps()
    render(<TypeCatalogDialog {...props} />)
    await userEvent.click(screen.getByText('Service'))
    await userEvent.click(screen.getByRole('button', { name: 'Typ löschen' }))
    expect(props.onRemove).not.toHaveBeenCalled()
    const confirm = screen.getByRole('dialog', { name: 'Typ löschen?' })
    expect(within(confirm).getByText(/2 Elemente verwenden/)).toBeInTheDocument()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Typ löschen' }))
    expect(props.onRemove).toHaveBeenCalledWith('elementTypes', 't1')
  })

  it('uses the singular for one element in use', async () => {
    render(<TypeCatalogDialog {...makeProps({ elementTypes: [{ id: 't1', name: 'Service', fields: [], usage: 1 }] })} />)
    expect(screen.getByText('1 in Verwendung')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Service'))
    await userEvent.click(screen.getByRole('button', { name: 'Typ löschen' }))
    expect(within(screen.getByRole('dialog', { name: 'Typ löschen?' })).getByText(/1 Element verwendet/)).toBeInTheDocument()
  })

  it('is read-only in analysis mode', () => {
    render(<TypeCatalogDialog {...makeProps({ readOnly: true })} />)
    expect(screen.getByText('Im Analysemodus nur lesbar.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Neuer Typ' })).toBeDisabled()
  })

  it('applies a template at once when the catalog is empty', async () => {
    const props = makeProps({ elementTypes: [] })
    render(<TypeCatalogDialog {...props} />)
    await userEvent.selectOptions(screen.getByLabelText('Vorlage'), 'it')
    expect(props.onTemplate).toHaveBeenCalledWith('it', 'replace')
  })

  it('asks merge, replace or cancel before changing an existing catalog', async () => {
    const props = makeProps()
    render(<TypeCatalogDialog {...props} />)
    await userEvent.selectOptions(screen.getByLabelText('Vorlage'), 'it')
    expect(props.onTemplate).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(props.onTemplate).not.toHaveBeenCalled()
    await userEvent.selectOptions(screen.getByLabelText('Vorlage'), 'it')
    await userEvent.click(screen.getByRole('button', { name: 'Ergänzen' }))
    expect(props.onTemplate).toHaveBeenLastCalledWith('it', 'merge')
    await userEvent.selectOptions(screen.getByLabelText('Vorlage'), 'it')
    await userEvent.click(screen.getByRole('button', { name: 'Ersetzen' }))
    expect(props.onTemplate).toHaveBeenLastCalledWith('it', 'replace')
  })

  it('shows an import error', () => {
    render(<TypeCatalogDialog {...makeProps({ importError: 'kaputt' })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Der Katalog konnte nicht gelesen werden: kaputt')
  })

  it('does not close the type dialog when Esc cancels the delete confirmation', async () => {
    const props = makeProps()
    render(<TypeCatalogDialog {...props} />)
    await userEvent.click(screen.getByText('Service'))
    await userEvent.click(screen.getByRole('button', { name: 'Typ löschen' }))
    const confirm = screen.getByRole('dialog', { name: 'Typ löschen?' })
    fireEvent(confirm, new Event('cancel', { bubbles: true, cancelable: true }))
    expect(props.onClose).not.toHaveBeenCalled()
    expect(props.onRemove).not.toHaveBeenCalled()
  })

  it('closes on the native cancel event of the type dialog', () => {
    const props = makeProps()
    const { container } = render(<TypeCatalogDialog {...props} />)
    const dialog = container.querySelector('dialog.types-dialog')!
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('brackets a typing session as one edit and ends it on blur', async () => {
    const props = makeProps()
    render(<TypeCatalogDialog {...props} />)
    await userEvent.click(screen.getByText('Service'))
    await userEvent.type(screen.getByLabelText('Name'), 'abc')
    expect(props.onEditStart).toHaveBeenCalled()
    expect(props.onEditEnd).not.toHaveBeenCalled()
    await userEvent.tab()
    expect(props.onEditEnd).toHaveBeenCalledTimes(1)
  })

  it('ends a running edit when the dialog closes', async () => {
    const props = makeProps()
    render(<TypeCatalogDialog {...props} />)
    await userEvent.click(screen.getByText('Service'))
    await userEvent.type(screen.getByLabelText('Name'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(props.onEditEnd).toHaveBeenCalledTimes(1)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('treats a checkbox toggle as a step of its own', async () => {
    const props = makeProps({
      elementTypes: [{ id: 't1', name: 'Service', fields: [{ key: 'k', kind: 'text' }], usage: 0 }],
    })
    render(<TypeCatalogDialog {...props} />)
    await userEvent.click(screen.getByText('Service'))
    await userEvent.click(screen.getByLabelText('Pflicht'))
    expect(props.onUpdate).toHaveBeenCalledTimes(1)
    expect(props.onEditStart).not.toHaveBeenCalled()
  })

  it('keeps a trailing comma and space while typing select options', async () => {
    const props = makeProps({
      elementTypes: [{ id: 't1', name: 'Service', fields: [{ key: 'k', kind: 'select', options: [] }], usage: 0 }],
    })
    render(<TypeCatalogDialog {...props} />)
    await userEvent.click(screen.getByText('Service'))
    const options = screen.getByLabelText('Optionen (durch Komma getrennt)')
    await userEvent.type(options, 'a, ')
    expect(options).toHaveValue('a, ')
  })

  it('adds and removes a field', async () => {
    const props = makeProps()
    render(<TypeCatalogDialog {...props} />)
    await userEvent.click(screen.getByText('Service'))
    await userEvent.click(screen.getByRole('button', { name: 'Feld hinzufügen' }))
    expect(screen.getByLabelText('Schlüssel')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Feld entfernen' }))
    expect(screen.queryByLabelText('Schlüssel')).not.toBeInTheDocument()
  })

  describe('typing in a dialog whose owner stores the tidied type', () => {
    function Harness({ onEditStart = vi.fn(), onEditEnd = vi.fn() }: { onEditStart?: () => void; onEditEnd?: () => void }) {
      const [types, setTypes] = useState<TypeDef[]>([
        { id: 't1', name: 'Service', fields: [{ key: 'k', kind: 'select', options: ['x'] }] },
      ])
      return (
        <TypeCatalogDialog
          {...makeProps({
            elementTypes: types.map((type) => ({ ...type, usage: 0 })),
            onUpdate: (_side, type) => setTypes([tidyType(type)]),
            onEditStart,
            onEditEnd,
          })}
        />
      )
    }

    it('keeps the raw text of the options while typing', async () => {
      render(<Harness />)
      await userEvent.click(screen.getByText('Service'))
      const options = screen.getByLabelText('Optionen (durch Komma getrennt)')
      await userEvent.clear(options)
      await userEvent.type(options, 'a, b,')
      expect(options).toHaveValue('a, b,')
    })

    it('keeps a space typed inside the name', async () => {
      render(<Harness />)
      await userEvent.click(screen.getByText('Service'))
      const name = screen.getByLabelText('Name')
      await userEvent.type(name, ' Neu')
      expect(name).toHaveValue('Service Neu')
    })

    it('ends a running edit before a discrete change even without a blur', async () => {
      const onEditStart = vi.fn()
      const onEditEnd = vi.fn()
      render(<Harness onEditStart={onEditStart} onEditEnd={onEditEnd} />)
      await userEvent.click(screen.getByText('Service'))
      await userEvent.type(screen.getByLabelText('Name'), 'X')
      expect(onEditEnd).not.toHaveBeenCalled()
      // fireEvent does not move the focus, so no blur precedes the click
      fireEvent.click(screen.getByLabelText('Pflicht'))
      expect(onEditEnd).toHaveBeenCalledTimes(1)
    })
  })
})
