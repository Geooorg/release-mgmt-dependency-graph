import { fireEvent, render, screen, within } from '@testing-library/react'
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
    isValidColor: (value: string): boolean => /^#[0-9a-f]{6}$/i.test(value),
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

  describe('read-only UUID', () => {
    it('is disabled and marked as not editable', () => {
      render(<Sidebar {...makeProps()} />)

      expect(screen.getByLabelText('UUID')).toBeDisabled()
      expect(screen.getByText('nicht editierbar')).toBeInTheDocument()
    })
  })

  describe('colour field', () => {
    const colorInput = () => screen.getByLabelText<HTMLInputElement>(/Farbe/)

    it('offers a colour picker that shows the default when no colour is set', () => {
      render(<Sidebar {...makeProps()} />)

      expect(colorInput()).toHaveAttribute('type', 'color')
      expect(colorInput().value).toBe('#2563eb')
      expect(screen.getByText('Standard')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Zurücksetzen' })).toBeDisabled()
    })

    it('shows the colour of the element', () => {
      render(
        <Sidebar
          {...makeProps({
            element: makeElement({
              metadata: [
                { key: 'name', value: 'A' },
                { key: 'color', value: '#FACC15' },
              ],
            }),
          })}
        />,
      )

      expect(colorInput().value).toBe('#facc15')
      expect(keyInputs()).toHaveLength(0) // not duplicated as a free-form row
    })

    it('saves a chosen colour right after the name', async () => {
      const onSave = vi.fn()
      render(<Sidebar {...makeProps({ onSave })} />)

      fireEvent.input(colorInput(), { target: { value: '#dc2626' } })
      await userEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(onSave).toHaveBeenCalledWith([
        { key: 'name', value: 'Projekt A' },
        { key: 'color', value: '#dc2626' },
        { key: 'owner', value: 'Team 1' },
      ])
    })

    it('resets to the default by removing the field entirely', async () => {
      const onSave = vi.fn()
      render(
        <Sidebar
          {...makeProps({
            onSave,
            element: makeElement({
              metadata: [
                { key: 'name', value: 'A' },
                { key: 'color', value: '#dc2626' },
              ],
            }),
          })}
        />,
      )

      await userEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }))
      await userEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(onSave).toHaveBeenCalledWith([{ key: 'name', value: 'A' }])
    })

    it('treats an unusable stored colour as not set', async () => {
      const onSave = vi.fn()
      render(
        <Sidebar
          {...makeProps({
            onSave,
            element: makeElement({
              metadata: [
                { key: 'name', value: 'A' },
                { key: 'color', value: 'chartreuse' },
              ],
            }),
          })}
        />,
      )

      expect(screen.getByText('Standard')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Save' }))
      expect(onSave).toHaveBeenCalledWith([{ key: 'name', value: 'A' }])
    })

    it('rejects a free-form row that is also called "color"', async () => {
      const onSave = vi.fn()
      render(<Sidebar {...makeProps({ onSave })} />)

      fireEvent.input(colorInput(), { target: { value: '#dc2626' } })
      await userEvent.click(screen.getByRole('button', { name: 'Feld hinzufügen' }))
      await userEvent.type(keyInputs().at(-1)!, 'color')
      await userEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(onSave).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent('Doppelte Feldnamen: color')
    })
  })

  describe('status field', () => {
    const statusSelect = () => screen.getByLabelText<HTMLSelectElement>('Status')
    const withStatus = (value: string, kind: SidebarElement['kind'] = 'node') =>
      makeElement({
        kind,
        metadata: [
          { key: 'name', value: 'A' },
          { key: 'status', value: value },
        ],
      })

    it('offers the three values and shows "offen" when no status is set', () => {
      render(<Sidebar {...makeProps()} />)

      expect(statusSelect().value).toBe('offen')
      expect([...statusSelect().options].map((o) => o.value)).toEqual(['offen', 'in Arbeit', 'fertig'])
    })

    it('does not write a status entry as long as it is untouched', async () => {
      const onSave = vi.fn()
      render(<Sidebar {...makeProps({ onSave })} />)

      await userEvent.click(screen.getByRole('button', { name: 'Save' }))
      expect(onSave.mock.calls[0][0]).not.toContainEqual(expect.objectContaining({ key: 'status' }))
    })

    it('shows the stored status, not as a free-form row', () => {
      render(<Sidebar {...makeProps({ element: withStatus('fertig') })} />)

      expect(statusSelect().value).toBe('fertig')
      expect(keyInputs()).toHaveLength(0)
    })

    it('saves the chosen status after name and colour', async () => {
      const onSave = vi.fn()
      render(<Sidebar {...makeProps({ onSave })} />)

      fireEvent.input(screen.getByLabelText(/Farbe/), { target: { value: '#dc2626' } })
      await userEvent.selectOptions(statusSelect(), 'in Arbeit')
      await userEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(onSave).toHaveBeenCalledWith([
        { key: 'name', value: 'Projekt A' },
        { key: 'color', value: '#dc2626' },
        { key: 'status', value: 'in Arbeit' },
        { key: 'owner', value: 'Team 1' },
      ])
    })

    it('keeps an unknown imported value as an extra option and does not change it', async () => {
      const onSave = vi.fn()
      render(<Sidebar {...makeProps({ onSave, element: withStatus('bald') })} />)

      expect(statusSelect().value).toBe('bald')
      expect([...statusSelect().options].map((o) => o.textContent)).toEqual([
        'offen',
        'in Arbeit',
        'fertig',
        'bald (unbekannt)',
      ])
      await userEvent.click(screen.getByRole('button', { name: 'Save' }))
      expect(onSave).toHaveBeenCalledWith([
        { key: 'name', value: 'A' },
        { key: 'status', value: 'bald' },
      ])
    })

    it('does not offer a status for groups but summarizes their members', () => {
      render(
        <Sidebar
          {...makeProps({
            element: { ...withStatus('fertig', 'group'), progress: { done: 2, total: 5 } },
          })}
        />,
      )

      expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
      expect(screen.getByText('Status aus Mitgliedern: 2 von 5 fertig')).toBeInTheDocument()
    })

    it('says so for a group without members', () => {
      render(
        <Sidebar {...makeProps({ element: makeElement({ kind: 'group', progress: { done: 0, total: 0 } }) })} />,
      )
      expect(screen.getByText('Status aus Mitgliedern: keine Mitglieder')).toBeInTheDocument()
    })
  })

  describe('edge variant', () => {
    const edgeElement = (label = ''): SidebarElement => ({
      id: ID_B,
      kind: 'edge',
      metadata: [{ key: 'label', value: label }],
    })

    it('shows only the read-only UUID and one empty "Label" field', () => {
      render(<Sidebar {...makeProps({ element: edgeElement() })} />)

      expect(screen.getByRole('heading', { name: 'Verbindung' })).toBeInTheDocument()
      expect(screen.getByLabelText('UUID')).toBeDisabled()
      expect(screen.getByLabelText('UUID')).toHaveValue(ID_B)
      expect(screen.getByLabelText('Label')).toHaveValue('')
      expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Farbe/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Feld hinzufügen' })).not.toBeInTheDocument()
    })

    it('shows an existing label', () => {
      render(<Sidebar {...makeProps({ element: edgeElement('braucht') })} />)

      expect(screen.getByLabelText('Label')).toHaveValue('braucht')
    })

    it('saves the trimmed label as the only metadata entry', async () => {
      const onSave = vi.fn()
      render(<Sidebar {...makeProps({ element: edgeElement(), onSave })} />)

      expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument()
      await userEvent.type(screen.getByLabelText('Label'), '  hängt ab von  ')
      expect(screen.getByText('Ungespeicherte Änderungen')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(onSave).toHaveBeenCalledWith([{ key: 'label', value: 'hängt ab von' }])
      expect(screen.getByLabelText('Label')).toHaveValue('hängt ab von')
      expect(screen.getByRole('status')).toHaveTextContent('Gespeichert')
      expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument()
    })

    it('saves an empty label to clear it', async () => {
      const onSave = vi.fn()
      render(<Sidebar {...makeProps({ element: edgeElement('alt'), onSave })} />)

      await userEvent.clear(screen.getByLabelText('Label'))
      await userEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(onSave).toHaveBeenCalledWith([{ key: 'label', value: '' }])
    })

    it('saves on Enter and calls onClose from the close button', async () => {
      const onSave = vi.fn()
      const onClose = vi.fn()
      render(<Sidebar {...makeProps({ element: edgeElement(), onSave, onClose })} />)

      await userEvent.type(screen.getByLabelText('Label'), 'x{Enter}')
      expect(onSave).toHaveBeenCalledWith([{ key: 'label', value: 'x' }])
      await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('starts a fresh draft when another element is opened', async () => {
      const { rerender } = render(<Sidebar {...makeProps({ element: edgeElement() })} />)
      await userEvent.type(screen.getByLabelText('Label'), 'ungespeichert')

      rerender(<Sidebar {...makeProps({ element: { ...edgeElement('zweite'), id: ID_A } })} />)

      expect(screen.getByLabelText('Label')).toHaveValue('zweite')
    })
  })
})
