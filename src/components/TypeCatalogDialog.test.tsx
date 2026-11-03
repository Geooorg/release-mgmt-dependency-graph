import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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
    expect(within(confirm).getByText(/2 Element\(e\) verwenden/)).toBeInTheDocument()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Typ löschen' }))
    expect(props.onRemove).toHaveBeenCalledWith('elementTypes', 't1')
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
})
