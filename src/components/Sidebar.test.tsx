import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { MetadataEntry } from '../model/types'
import { Sidebar } from './Sidebar'
import type { SidebarElement, SidebarProps } from './props'

// Small faithful fakes so these tests do not depend on the real model/metadata implementation.
vi.mock('../model/metadata', () => {
  type Entry = { key: string; value: string }
  return {
    normalizeMetadata: (entries: readonly Entry[]): Entry[] => {
      const cleaned = entries
        .map((entry) => ({ key: entry.key.trim(), value: entry.value.trim() }))
        .filter((entry) => entry.key !== '')
      const nameIndex = cleaned.findIndex((entry) => entry.key === 'name')
      if (nameIndex === -1) return [{ key: 'name', value: '' }, ...cleaned]
      return [cleaned[nameIndex], ...cleaned.filter((_, index) => index !== nameIndex)]
    },
    findDuplicateKeys: (entries: readonly Entry[]): string[] => {
      const seen = new Set<string>()
      const duplicates = new Set<string>()
      for (const entry of entries) {
        const key = entry.key.trim()
        if (key === '') continue
        if (seen.has(key)) duplicates.add(key)
        seen.add(key)
      }
      return [...duplicates]
    },
    getName: (entries: readonly Entry[]): string =>
      entries.find((entry) => entry.key === 'name')?.value ?? '',
  }
})

const ID_A = '11111111-aaaa-4aaa-8aaa-111111111111'
const ID_B = '22222222-bbbb-4bbb-8bbb-222222222222'

function makeElement(overrides: Partial<SidebarElement> = {}): SidebarElement {
  return {
    id: ID_A,
    kind: 'node',
    metadata: [
      { key: 'name', value: 'Projekt A' },
      { key: 'owner', value: 'Team 1' },
    ],
    ...overrides,
  }
}

function makeProps(overrides: Partial<SidebarProps> = {}): SidebarProps {
  return {
    element: makeElement(),
    onSave: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
}

function keyInputs(): HTMLInputElement[] {
  return screen.queryAllByLabelText<HTMLInputElement>('Feldname')
}

function valueInputs(): HTMLInputElement[] {
  return screen.queryAllByLabelText<HTMLInputElement>('Wert')
}

describe('Sidebar', () => {
  it('renders nothing when there is no element', () => {
    const { container } = render(<Sidebar {...makeProps({ element: null })} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('shows a labelled aside with the heading for the element kind', () => {
    const { rerender } = render(<Sidebar {...makeProps()} />)
    expect(screen.getByRole('complementary', { name: 'Metadaten' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Objekt' })).toBeInTheDocument()

    rerender(<Sidebar {...makeProps({ element: makeElement({ kind: 'group' }) })} />)
    expect(screen.getByRole('heading', { name: 'Gruppe' })).toBeInTheDocument()
  })

  it('shows the UUID as a disabled, read-only field', () => {
    render(<Sidebar {...makeProps()} />)

    const uuid = screen.getByLabelText('UUID')
    expect(uuid).toHaveValue(ID_A)
    expect(uuid).toBeDisabled()
    expect(uuid).toHaveAttribute('readonly')
  })

  it('shows the name field and one row per further entry', () => {
    render(<Sidebar {...makeProps()} />)

    expect(screen.getByLabelText('Name')).toHaveValue('Projekt A')
    expect(keyInputs().map((input) => input.value)).toEqual(['owner'])
    expect(valueInputs().map((input) => input.value)).toEqual(['Team 1'])
    expect(keyInputs()[0]).toHaveAttribute('placeholder', 'Feldname')
    expect(valueInputs()[0]).toHaveAttribute('placeholder', 'Wert')
    // The name key is fixed: there is no key input or remove button for it.
    expect(screen.getAllByRole('button', { name: 'Feld entfernen' })).toHaveLength(1)
  })

  it('shows an empty name field when the element has no name entry', () => {
    render(<Sidebar {...makeProps({ element: makeElement({ metadata: [] }) })} />)

    expect(screen.getByLabelText('Name')).toHaveValue('')
    expect(keyInputs()).toHaveLength(0)
    expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument()
  })

  it('calls onClose from the close button', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(<Sidebar {...props} />)

    const close = screen.getByRole('button', { name: 'Schließen' })
    expect(close).toHaveTextContent('×')
    await user.click(close)

    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('appends an empty row and focuses its key input', async () => {
    const user = userEvent.setup()
    render(<Sidebar {...makeProps()} />)

    await user.click(screen.getByRole('button', { name: 'Feld hinzufügen' }))

    expect(keyInputs()).toHaveLength(2)
    expect(keyInputs()[1]).toHaveValue('')
    expect(valueInputs()[1]).toHaveValue('')
    expect(keyInputs()[1]).toHaveFocus()
  })

  it('removes a row', async () => {
    const user = userEvent.setup()
    render(<Sidebar {...makeProps()} />)

    await user.click(screen.getByRole('button', { name: 'Feld entfernen' }))

    expect(keyInputs()).toHaveLength(0)
    expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument()
  })

  it('saves normalized metadata and re-syncs the draft from it', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<Sidebar {...makeProps({ onSave })} />)

    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), '  Neu  ')
    await user.type(valueInputs()[0], '  ')
    await user.click(screen.getByRole('button', { name: 'Feld hinzufügen' }))
    await user.type(keyInputs()[1], '  stage ')
    await user.type(valueInputs()[1], ' prod ')
    await user.click(screen.getByRole('button', { name: 'Feld hinzufügen' })) // empty row, ignored on save
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const expected: MetadataEntry[] = [
      { key: 'name', value: 'Neu' },
      { key: 'owner', value: 'Team 1' },
      { key: 'stage', value: 'prod' },
    ]
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith(expected)

    // Draft was re-synced: the empty row vanished and values show up trimmed.
    expect(screen.getByLabelText('Name')).toHaveValue('Neu')
    expect(keyInputs().map((input) => input.value)).toEqual(['owner', 'stage'])
    expect(valueInputs().map((input) => input.value)).toEqual(['Team 1', 'prod'])
  })

  it('submits with Enter from an input and keeps that input focused', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<Sidebar {...makeProps({ onSave })} />)

    await user.type(valueInputs()[0], ' 2')
    await user.keyboard('{Enter}')

    expect(onSave).toHaveBeenCalledWith([
      { key: 'name', value: 'Projekt A' },
      { key: 'owner', value: 'Team 1 2' },
    ])
    expect(valueInputs()[0]).toHaveFocus()
  })

  it('shows duplicate keys and does not save', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<Sidebar {...makeProps({ onSave })} />)

    await user.click(screen.getByRole('button', { name: 'Feld hinzufügen' }))
    await user.type(keyInputs()[1], ' owner')
    await user.click(screen.getByRole('button', { name: 'Feld hinzufügen' }))
    await user.type(keyInputs()[2], 'name')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Doppelte Feldnamen: owner, name')
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.queryByText('Gespeichert')).not.toBeInTheDocument()
  })

  it('clears the duplicate alert once the duplicates are fixed and then saves', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<Sidebar {...makeProps({ onSave })} />)

    await user.click(screen.getByRole('button', { name: 'Feld hinzufügen' }))
    await user.type(keyInputs()[1], 'owner')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Doppelte Feldnamen: owner')

    await user.type(keyInputs()[1], '2')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('reports unsaved changes until saved, then confirms until the next edit', async () => {
    const user = userEvent.setup()
    render(<Sidebar {...makeProps()} />)

    expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Name'), '!')
    expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Gespeichert')

    await user.type(screen.getByLabelText('Name'), '?')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument()
  })

  it('no longer reports changes after the edit is reverted', async () => {
    const user = userEvent.setup()
    render(<Sidebar {...makeProps()} />)

    await user.type(screen.getByLabelText('Name'), 'x')
    await user.type(screen.getByLabelText('Name'), '{Backspace}')

    expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument()
  })

  it('resets the draft when a different element is opened', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Sidebar {...makeProps()} />)

    await user.type(screen.getByLabelText('Name'), ' geändert')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('status')).toBeInTheDocument()
    await user.type(valueInputs()[0], ' ungespeichert')

    rerender(
      <Sidebar
        {...makeProps({
          element: makeElement({
            id: ID_B,
            kind: 'group',
            metadata: [
              { key: 'name', value: 'Gruppe B' },
              { key: 'a', value: '1' },
              { key: 'b', value: '2' },
            ],
          }),
        })}
      />,
    )

    expect(screen.getByLabelText('UUID')).toHaveValue(ID_B)
    expect(screen.getByLabelText('Name')).toHaveValue('Gruppe B')
    expect(keyInputs().map((input) => input.value)).toEqual(['a', 'b'])
    expect(valueInputs().map((input) => input.value)).toEqual(['1', '2'])
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument()
  })

  it('keeps the draft when the same element is re-rendered with equal metadata', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Sidebar {...makeProps()} />)

    await user.type(screen.getByLabelText('Name'), ' lokal')
    rerender(<Sidebar {...makeProps({ element: makeElement() })} />)

    expect(screen.getByLabelText('Name')).toHaveValue('Projekt A lokal')
    expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument()
  })

  it('stays clean when the parent echoes the saved metadata back', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const { rerender } = render(<Sidebar {...makeProps({ onSave })} />)

    await user.type(screen.getByLabelText('Name'), ' neu')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const saved = onSave.mock.calls[0][0] as MetadataEntry[]
    rerender(<Sidebar {...makeProps({ onSave, element: makeElement({ metadata: saved }) })} />)

    expect(screen.getByLabelText('Name')).toHaveValue('Projekt A neu')
    expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Gespeichert')
  })

  it('adopts metadata that changed elsewhere for the same element', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Sidebar {...makeProps()} />)

    await user.type(screen.getByLabelText('Name'), ' lokal')
    rerender(
      <Sidebar
        {...makeProps({
          element: makeElement({ metadata: [{ key: 'name', value: 'Extern' }] }),
        })}
      />,
    )

    expect(screen.getByLabelText('Name')).toHaveValue('Extern')
    expect(keyInputs()).toHaveLength(0)
    expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument()
  })

  it('renders the form inside the aside', () => {
    render(<Sidebar {...makeProps()} />)

    const aside = screen.getByRole('complementary', { name: 'Metadaten' })
    expect(within(aside).getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit')
  })
})
