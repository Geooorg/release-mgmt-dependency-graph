import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { MetadataEntry } from '../model/types'
import { setTestLocale } from '../test/locale'
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
    selectionCount: 1,
    onChange: vi.fn(),
    onEditStart: vi.fn(),
    onEditEnd: vi.fn(),
    onClose: vi.fn(),
    onInvalidChange: vi.fn(),
    ...overrides,
  }
}

/** Plays the owner: keeps the metadata it was told about, like the store does, and lets a test change it from outside. */
function renderControlled(
  initial: MetadataEntry[],
  overrides: Partial<SidebarProps> = {},
  kind: SidebarElement['kind'] = 'node',
) {
  const controls: { setMetadata: (metadata: MetadataEntry[]) => void } = { setMetadata: () => {} }
  const onChange = vi.fn()
  function Owner() {
    const [metadata, setMetadata] = useState(initial)
    useEffect(() => {
      controls.setMetadata = setMetadata
    }, [])
    return (
      <Sidebar
        {...makeProps({
          ...overrides,
          element: makeElement({ kind, metadata }),
          onChange: (next) => {
            onChange(next)
            setMetadata(next)
          },
        })}
      />
    )
  }
  render(<Owner />)
  return { onChange, setMetadata: (metadata: MetadataEntry[]) => act(() => controls.setMetadata(metadata)) }
}

function keyInputs(): HTMLInputElement[] {
  return screen.queryAllByLabelText<HTMLInputElement>('Feldname')
}

function valueInputs(): HTMLInputElement[] {
  return screen.queryAllByLabelText<HTMLInputElement>('Wert')
}

describe('Sidebar', () => {
  it('renders nothing when there is no element and fewer than two are selected', () => {
    const { container, rerender } = render(<Sidebar {...makeProps({ element: null, selectionCount: 0 })} />)
    expect(container).toBeEmptyDOMElement()

    rerender(<Sidebar {...makeProps({ element: null, selectionCount: 1 })} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a hint instead of a form when several elements are selected', async () => {
    const props = makeProps({ element: null, selectionCount: 3 })
    render(<Sidebar {...props} />)

    expect(screen.getByText('3 Elemente markiert – zum Bearbeiten genau eines auswählen.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('UUID')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  describe('colour of several selected elements', () => {
    const bulk = (overrides: Partial<NonNullable<SidebarProps['bulkColor']>> = {}) => ({
      count: 3,
      color: '',
      mixed: false,
      onChange: vi.fn(),
      ...overrides,
    })
    const picker = () => screen.getByLabelText('Farbe (color) für alle 3 Elemente')

    it('offers one colour field for all of them next to the hint', () => {
      render(<Sidebar {...makeProps({ element: null, selectionCount: 4, bulkColor: bulk() })} />)

      expect(screen.getByText(/4 Elemente markiert/)).toBeInTheDocument()
      expect(picker()).toHaveAttribute('type', 'color')
      expect(screen.getByText('Standard')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Zurücksetzen' })).toBeDisabled()
    })

    it('has no colour field without a colour control (only connections selected)', () => {
      render(<Sidebar {...makeProps({ element: null, selectionCount: 2 })} />)

      expect(screen.queryByLabelText(/Farbe/)).not.toBeInTheDocument()
    })

    it('shows the shared colour, or that the colours differ', () => {
      const { rerender } = render(
        <Sidebar {...makeProps({ element: null, selectionCount: 3, bulkColor: bulk({ color: '#ff0000' }) })} />,
      )
      expect(picker()).toHaveValue('#ff0000')
      expect(screen.getByText('#ff0000')).toBeInTheDocument()

      rerender(<Sidebar {...makeProps({ element: null, selectionCount: 3, bulkColor: bulk({ mixed: true }) })} />)
      expect(screen.getByText('verschieden')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Zurücksetzen' })).toBeEnabled()
    })

    it('reports a chosen colour inside one edit, and a reset as undefined', async () => {
      const bulkColor = bulk({ color: '#ff0000' })
      const props = makeProps({ element: null, selectionCount: 3, bulkColor })
      render(<Sidebar {...props} />)

      fireEvent.change(picker(), { target: { value: '#00ff00' } })
      expect(props.onEditStart).toHaveBeenCalled()
      expect(bulkColor.onChange).toHaveBeenLastCalledWith('#00ff00')
      expect(props.onEditEnd).not.toHaveBeenCalled()

      await userEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }))
      expect(props.onEditEnd).toHaveBeenCalledTimes(1)
      expect(bulkColor.onChange).toHaveBeenLastCalledWith(undefined)
    })

    it('says "1 Element" for a single colourable element', () => {
      render(<Sidebar {...makeProps({ element: null, selectionCount: 2, bulkColor: bulk({ count: 1 }) })} />)

      expect(screen.getByLabelText('Farbe (color) für 1 Element')).toBeInTheDocument()
    })
  })

  describe('status of several selected objects', () => {
    const bulk = (overrides: Partial<NonNullable<SidebarProps['bulkStatus']>> = {}) => ({
      count: 3,
      status: 'offen',
      mixed: false,
      onChange: vi.fn(),
      ...overrides,
    })
    const select = () => screen.getByLabelText('Status für alle 3 Objekte')

    it('offers one status field for all of them next to the hint', () => {
      render(<Sidebar {...makeProps({ element: null, selectionCount: 4, bulkStatus: bulk({ status: 'fertig' }) })} />)

      expect(screen.getByText(/4 Elemente markiert/)).toBeInTheDocument()
      expect(select()).toHaveValue('fertig')
      expect(within(select()).getAllByRole('option').map((o) => o.textContent)).toEqual([
        'offen',
        'in Arbeit',
        'blockiert',
        'fertig',
      ])
    })

    it('has no status field without a status control (only groups or connections selected)', () => {
      render(<Sidebar {...makeProps({ element: null, selectionCount: 2 })} />)

      expect(screen.queryByLabelText(/Status/)).not.toBeInTheDocument()
    })

    it('shows a disabled placeholder when the statuses differ', () => {
      render(<Sidebar {...makeProps({ element: null, selectionCount: 3, bulkStatus: bulk({ status: '', mixed: true }) })} />)

      expect(select()).toHaveValue('')
      expect(screen.getByRole('option', { name: 'verschieden' })).toBeDisabled()
    })

    it('keeps an unknown shared value as an extra option', () => {
      render(<Sidebar {...makeProps({ element: null, selectionCount: 3, bulkStatus: bulk({ status: 'erledigt' }) })} />)

      expect(select()).toHaveValue('erledigt')
      expect(screen.getByRole('option', { name: 'erledigt (unbekannt)' })).toBeInTheDocument()
    })

    it('reports the chosen status', async () => {
      const bulkStatus = bulk({ status: '', mixed: true })
      render(<Sidebar {...makeProps({ element: null, selectionCount: 3, bulkStatus })} />)

      await userEvent.selectOptions(select(), 'in Arbeit')
      expect(bulkStatus.onChange).toHaveBeenCalledWith('in Arbeit')
    })

    it('says "1 Objekt" for a single object', () => {
      render(<Sidebar {...makeProps({ element: null, selectionCount: 2, bulkStatus: bulk({ count: 1 }) })} />)

      expect(screen.getByLabelText('Status für 1 Objekt')).toBeInTheDocument()
    })
  })

  it('shows a labelled aside with the heading for the element kind', () => {
    const { rerender } = render(<Sidebar {...makeProps()} />)
    expect(screen.getByRole('complementary', { name: 'Metadaten' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Objekt' })).toBeInTheDocument()

    rerender(<Sidebar {...makeProps({ element: makeElement({ kind: 'group' }) })} />)
    expect(screen.getByRole('heading', { name: 'Gruppe' })).toBeInTheDocument()
  })

  it('has no Save button and no unsaved/saved messages: everything is applied right away', async () => {
    render(<Sidebar {...makeProps()} />)

    await userEvent.type(screen.getByLabelText('Name'), '!')
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.queryByText('Ungespeicherte Änderungen')).not.toBeInTheDocument()
    expect(screen.queryByText('Gespeichert')).not.toBeInTheDocument()
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

  it('does not take the focus when it opens', () => {
    const { unmount } = render(<Sidebar {...makeProps()} />)
    expect(document.body).toHaveFocus()
    unmount()

    render(<Sidebar {...makeProps({ element: { id: ID_B, kind: 'edge', metadata: [{ key: 'name', value: '' }] } })} />)
    expect(screen.getByLabelText('Name')).not.toHaveFocus()
  })

  describe('live changes', () => {
    it('applies every change right away, normalized', async () => {
      const user = userEvent.setup()
      const { onChange } = renderControlled([
        { key: 'name', value: 'Projekt A' },
        { key: 'owner', value: 'Team 1' },
      ])

      await user.type(screen.getByLabelText('Name'), 'x')
      expect(onChange).toHaveBeenLastCalledWith([
        { key: 'name', value: 'Projekt Ax' },
        { key: 'owner', value: 'Team 1' },
      ])

      await user.clear(valueInputs()[0])
      await user.type(valueInputs()[0], '  Team 2 ')
      expect(onChange).toHaveBeenLastCalledWith([
        { key: 'name', value: 'Projekt Ax' },
        { key: 'owner', value: 'Team 2' },
      ])
    })

    it('keeps typed trailing and leading spaces in the field while the model holds the trimmed text', async () => {
      const user = userEvent.setup()
      const { onChange } = renderControlled([{ key: 'name', value: 'A' }])

      await user.type(screen.getByLabelText('Name'), ' B ')
      expect(screen.getByLabelText('Name')).toHaveValue('A B ')
      expect(onChange).toHaveBeenLastCalledWith([{ key: 'name', value: 'A B' }])

      await user.clear(screen.getByLabelText('Name'))
      await user.type(screen.getByLabelText('Name'), '  x')
      expect(screen.getByLabelText('Name')).toHaveValue('  x')
      expect(onChange).toHaveBeenLastCalledWith([{ key: 'name', value: 'x' }])
    })

    it('keeps the cursor where it is when typing in the middle of the text', async () => {
      const user = userEvent.setup()
      renderControlled([{ key: 'name', value: 'AB' }])

      const name = screen.getByLabelText<HTMLInputElement>('Name')
      await user.click(name)
      name.setSelectionRange(1, 1)
      await user.keyboard('x ')

      expect(name).toHaveValue('Ax B')
    })

    it('adds an empty row without touching the model, and the row stays while it is being filled in', async () => {
      const user = userEvent.setup()
      const { onChange } = renderControlled([{ key: 'name', value: 'A' }])

      await user.click(screen.getByRole('button', { name: 'Feld hinzufügen' }))
      expect(keyInputs()).toHaveLength(1)
      expect(keyInputs()[0]).toHaveFocus()
      expect(onChange).not.toHaveBeenCalled()

      await user.type(valueInputs()[0], 'prod') // key still empty: nothing to store yet
      expect(onChange).not.toHaveBeenCalled()
      expect(keyInputs()).toHaveLength(1)

      await user.type(keyInputs()[0], '  stage ')
      expect(keyInputs()[0]).toHaveValue('  stage ')
      expect(onChange).toHaveBeenLastCalledWith([
        { key: 'name', value: 'A' },
        { key: 'stage', value: 'prod' },
      ])
    })

    it('keeps a row whose key was cleared in the form but leaves it out of the model', async () => {
      const user = userEvent.setup()
      const { onChange } = renderControlled([
        { key: 'name', value: 'A' },
        { key: 'owner', value: 'T' },
      ])

      await user.clear(keyInputs()[0])
      expect(keyInputs()).toHaveLength(1)
      expect(onChange).toHaveBeenLastCalledWith([{ key: 'name', value: 'A' }])
    })

    it('removes a row', async () => {
      const user = userEvent.setup()
      const { onChange } = renderControlled([
        { key: 'name', value: 'A' },
        { key: 'owner', value: 'T' },
      ])

      await user.click(screen.getByRole('button', { name: 'Feld entfernen' }))

      expect(keyInputs()).toHaveLength(0)
      expect(onChange).toHaveBeenCalledWith([{ key: 'name', value: 'A' }])
    })

    it('does not report a change when nothing differs from what the model holds', async () => {
      const user = userEvent.setup()
      const props = makeProps()
      render(<Sidebar {...props} />)

      await user.type(screen.getByLabelText('Name'), ' ') // only a trailing space
      await user.click(screen.getByRole('button', { name: 'Feld hinzufügen' }))

      expect(props.onChange).not.toHaveBeenCalled()
      expect(props.onEditStart).not.toHaveBeenCalled()
    })

    it('resets the draft when a different element is opened', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<Sidebar {...makeProps()} />)

      await user.type(screen.getByLabelText('Name'), ' geändert')
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
    })

    it('keeps the draft when the owner delivers a new array with the metadata it already holds', async () => {
      const user = userEvent.setup()
      const { setMetadata } = renderControlled([{ key: 'name', value: 'A' }])

      await user.type(screen.getByLabelText('Name'), 'B ')
      setMetadata([{ key: 'name', value: 'AB' }])

      expect(screen.getByLabelText('Name')).toHaveValue('AB ')
    })

    it('adopts metadata that changed from outside (undo, import) but not its own echo', async () => {
      const user = userEvent.setup()
      const { onChange, setMetadata } = renderControlled([{ key: 'name', value: 'A' }])

      await user.type(screen.getByLabelText('Name'), 'B ')
      expect(screen.getByLabelText('Name')).toHaveValue('AB ') // echo of "AB" did not touch the draft

      // Undo from the toolbar: the model goes back, the form follows.
      setMetadata([{ key: 'name', value: 'A' }])
      expect(screen.getByLabelText('Name')).toHaveValue('A')

      // Redo / import with more fields.
      setMetadata([
        { key: 'name', value: 'Neu' },
        { key: 'owner', value: 'T' },
      ])
      expect(screen.getByLabelText('Name')).toHaveValue('Neu')
      expect(keyInputs().map((input) => input.value)).toEqual(['owner'])

      // After adopting, typing applies again.
      await user.type(screen.getByLabelText('Name'), '!')
      expect(onChange).toHaveBeenLastCalledWith([
        { key: 'name', value: 'Neu!' },
        { key: 'owner', value: 'T' },
      ])
    })

    it('adopts an outside change that happens to equal an earlier state of the draft', async () => {
      const user = userEvent.setup()
      const { setMetadata } = renderControlled([{ key: 'name', value: 'A' }])

      await user.type(screen.getByLabelText('Name'), 'B')
      setMetadata([{ key: 'name', value: 'A' }])
      expect(screen.getByLabelText('Name')).toHaveValue('A')
    })
  })

  describe('invalid drafts', () => {
    it('shows duplicate keys right away and does not apply them', async () => {
      const user = userEvent.setup()
      const props = makeProps()
      render(<Sidebar {...props} />)

      await user.click(screen.getByRole('button', { name: 'Feld hinzufügen' }))
      await user.type(keyInputs()[1], ' owne')
      await user.click(screen.getByRole('button', { name: 'Feld hinzufügen' }))
      await user.type(keyInputs()[2], 'nam')
      vi.mocked(props.onChange).mockClear()
      await user.type(keyInputs()[1], 'r')
      await user.type(keyInputs()[2], 'e')

      expect(screen.getByRole('alert')).toHaveTextContent('Doppelte Feldnamen: owner, name')
      expect(props.onChange).not.toHaveBeenCalled()
      expect(props.onInvalidChange).toHaveBeenLastCalledWith(true)
    })

    it('keeps the last valid state in the model, then applies again once the duplicate is fixed', async () => {
      const user = userEvent.setup()
      const { onChange } = renderControlled([
        { key: 'name', value: 'A' },
        { key: 'owner', value: 'T' },
      ])

      await user.click(screen.getByRole('button', { name: 'Feld hinzufügen' }))
      await user.type(keyInputs()[1], 'owne')
      expect(onChange).toHaveBeenLastCalledWith([
        { key: 'name', value: 'A' },
        { key: 'owner', value: 'T' },
        { key: 'owne', value: '' },
      ])
      onChange.mockClear()

      await user.type(keyInputs()[1], 'r')
      expect(screen.getByRole('alert')).toHaveTextContent('Doppelte Feldnamen: owner')
      expect(onChange).not.toHaveBeenCalled()

      await user.type(keyInputs()[1], '2')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(onChange).toHaveBeenLastCalledWith([
        { key: 'name', value: 'A' },
        { key: 'owner', value: 'T' },
        { key: 'owner2', value: '' },
      ])
    })

    it('reports invalid and valid again, and valid when the form goes away', async () => {
      const user = userEvent.setup()
      const onInvalidChange = vi.fn()
      const { rerender } = render(<Sidebar {...makeProps({ onInvalidChange })} />)
      expect(onInvalidChange).toHaveBeenLastCalledWith(false)

      await user.click(screen.getByRole('button', { name: 'Feld hinzufügen' }))
      await user.type(keyInputs()[1], 'owner')
      expect(onInvalidChange).toHaveBeenLastCalledWith(true)
      await user.type(keyInputs()[1], '2')
      expect(onInvalidChange).toHaveBeenLastCalledWith(false)

      await user.clear(keyInputs()[1])
      await user.type(keyInputs()[1], 'owner')
      expect(onInvalidChange).toHaveBeenLastCalledWith(true)
      rerender(<Sidebar {...makeProps({ onInvalidChange, element: null, selectionCount: 0 })} />)
      expect(onInvalidChange).toHaveBeenLastCalledWith(false)
    })

    it('reports valid when another element is opened', async () => {
      const user = userEvent.setup()
      const onInvalidChange = vi.fn()
      const { rerender } = render(<Sidebar {...makeProps({ onInvalidChange })} />)
      await user.click(screen.getByRole('button', { name: 'Feld hinzufügen' }))
      await user.type(keyInputs()[1], 'owner')
      expect(onInvalidChange).toHaveBeenLastCalledWith(true)

      rerender(<Sidebar {...makeProps({ onInvalidChange, element: makeElement({ id: ID_B }) })} />)
      expect(onInvalidChange).toHaveBeenLastCalledWith(false)
    })

    it('a free row called "color" next to a colour is a duplicate', async () => {
      const onChange = vi.fn()
      render(<Sidebar {...makeProps({ onChange })} />)

      fireEvent.input(screen.getByLabelText(/Farbe/), { target: { value: '#dc2626' } })
      expect(onChange).toHaveBeenCalledTimes(1)
      await userEvent.click(screen.getByRole('button', { name: 'Feld hinzufügen' }))
      await userEvent.type(keyInputs().at(-1)!, 'colo')
      onChange.mockClear()
      await userEvent.type(keyInputs().at(-1)!, 'r')

      expect(onChange).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent('Doppelte Feldnamen: color')
    })
  })

  describe('one undo step per edit', () => {
    it('starts an edit with the first change and ends it when the field is left', async () => {
      const user = userEvent.setup()
      const props = makeProps()
      render(<Sidebar {...props} />)

      await user.click(screen.getByLabelText('Name'))
      expect(props.onEditStart).not.toHaveBeenCalled() // focusing alone is no edit
      await user.keyboard('abc')
      expect(props.onChange).toHaveBeenCalledTimes(3)
      expect(props.onEditStart).toHaveBeenCalled()
      expect(props.onEditEnd).not.toHaveBeenCalled()

      await user.tab()
      expect(props.onEditEnd).toHaveBeenCalledTimes(1)
    })

    it('every field edit has its own start and end', async () => {
      const user = userEvent.setup()
      const props = makeProps()
      render(<Sidebar {...props} />)

      await user.type(screen.getByLabelText('Name'), 'a')
      await user.type(valueInputs()[0], 'b')
      await user.tab()

      expect(props.onEditEnd).toHaveBeenCalledTimes(2)
    })

    it('ends the edit when the form goes away mid-edit (another element, closed sidebar)', async () => {
      const user = userEvent.setup()
      const props = makeProps()
      const { rerender } = render(<Sidebar {...props} />)

      await user.type(screen.getByLabelText('Name'), 'a')
      expect(props.onEditEnd).not.toHaveBeenCalled()
      rerender(<Sidebar {...props} element={makeElement({ id: ID_B })} />)
      expect(props.onEditEnd).toHaveBeenCalledTimes(1)

      await user.type(screen.getByLabelText('Name'), 'b')
      rerender(<Sidebar {...props} element={null} selectionCount={0} />)
      expect(props.onEditEnd).toHaveBeenCalledTimes(2)
    })

    it('does not end an edit it never started', () => {
      const props = makeProps()
      const { unmount } = render(<Sidebar {...props} />)
      unmount()
      expect(props.onEditEnd).not.toHaveBeenCalled()
    })

    it('a row removal is a step of its own: an open edit ends first', async () => {
      const props = makeProps()
      render(<Sidebar {...props} />)

      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'x' } }) // edit without a blur
      expect(props.onEditEnd).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Feld entfernen' }))

      expect(props.onEditEnd).toHaveBeenCalledTimes(1)
      expect(vi.mocked(props.onChange).mock.invocationCallOrder[1]).toBeGreaterThan(
        vi.mocked(props.onEditEnd).mock.invocationCallOrder[0],
      )
    })

    it('starts a new edit on the next keystroke even if the owner ended the previous one meanwhile', async () => {
      const user = userEvent.setup()
      const props = makeProps()
      render(<Sidebar {...props} />)

      await user.type(screen.getByLabelText('Name'), 'a')
      const starts = vi.mocked(props.onEditStart).mock.calls.length
      await user.keyboard('b') // same focus, e.g. after an undo from the toolbar
      expect(vi.mocked(props.onEditStart).mock.calls.length).toBe(starts + 1)
    })
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

    it('applies a chosen colour right after the name, as one edit until the picker loses focus', () => {
      const props = makeProps()
      render(<Sidebar {...props} />)

      fireEvent.input(colorInput(), { target: { value: '#dc2626' } })
      expect(props.onChange).toHaveBeenCalledWith([
        { key: 'name', value: 'Projekt A' },
        { key: 'color', value: '#dc2626' },
        { key: 'owner', value: 'Team 1' },
      ])
      fireEvent.input(colorInput(), { target: { value: '#16a34a' } })
      expect(props.onChange).toHaveBeenCalledTimes(2)
      expect(props.onEditEnd).not.toHaveBeenCalled()
      fireEvent.blur(colorInput())
      expect(props.onEditEnd).toHaveBeenCalledTimes(1)
    })

    it('resets to the default by removing the field entirely', async () => {
      const onChange = vi.fn()
      render(
        <Sidebar
          {...makeProps({
            onChange,
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

      expect(onChange).toHaveBeenCalledWith([{ key: 'name', value: 'A' }])
      expect(screen.getByText('Standard')).toBeInTheDocument()
    })

    it('treats an unusable stored colour as not set and drops it with the next edit', async () => {
      const onChange = vi.fn()
      render(
        <Sidebar
          {...makeProps({
            onChange,
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
      expect(onChange).not.toHaveBeenCalled()
      await userEvent.type(screen.getByLabelText('Name'), 'x')
      expect(onChange).toHaveBeenLastCalledWith([{ key: 'name', value: 'Ax' }])
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

    it('offers the four values and shows "offen" when no status is set', () => {
      render(<Sidebar {...makeProps()} />)

      expect(statusSelect().value).toBe('offen')
      expect([...statusSelect().options].map((o) => o.value)).toEqual(['offen', 'in Arbeit', 'blockiert', 'fertig'])
    })

    it('does not write a status entry as long as it is untouched', async () => {
      const onChange = vi.fn()
      render(<Sidebar {...makeProps({ onChange })} />)

      await userEvent.type(screen.getByLabelText('Name'), 'x')
      expect(onChange.mock.calls[0][0]).not.toContainEqual(expect.objectContaining({ key: 'status' }))
    })

    it('shows the stored status, not as a free-form row', () => {
      render(<Sidebar {...makeProps({ element: withStatus('fertig') })} />)

      expect(statusSelect().value).toBe('fertig')
      expect(keyInputs()).toHaveLength(0)
    })

    it('applies the chosen status at once, after name and colour, as a step of its own', async () => {
      const props = makeProps()
      render(<Sidebar {...props} />)

      fireEvent.input(screen.getByLabelText(/Farbe/), { target: { value: '#dc2626' } })
      await userEvent.selectOptions(statusSelect(), 'in Arbeit')

      expect(props.onChange).toHaveBeenLastCalledWith([
        { key: 'name', value: 'Projekt A' },
        { key: 'color', value: '#dc2626' },
        { key: 'status', value: 'in Arbeit' },
        { key: 'owner', value: 'Team 1' },
      ])
      // The colour edit was still open: the status choice ended it first.
      expect(props.onEditEnd).toHaveBeenCalledTimes(1)
    })

    it('keeps an unknown imported value as an extra option and does not change it', async () => {
      const onChange = vi.fn()
      render(<Sidebar {...makeProps({ onChange, element: withStatus('bald') })} />)

      expect(statusSelect().value).toBe('bald')
      expect([...statusSelect().options].map((o) => o.textContent)).toEqual([
        'offen',
        'in Arbeit',
        'blockiert',
        'fertig',
        'bald (unbekannt)',
      ])
      await userEvent.type(screen.getByLabelText('Name'), 'x')
      expect(onChange).toHaveBeenCalledWith([
        { key: 'name', value: 'Ax' },
        { key: 'status', value: 'bald' },
      ])
    })

    it('recognises the key in any case and writes it back as "status" with the next edit', async () => {
      const onChange = vi.fn()
      const element = makeElement({
        metadata: [
          { key: 'name', value: 'A' },
          { key: 'owner', value: 'Team 1' },
          { key: ' STATUS ', value: 'fertig' },
        ],
      })
      render(<Sidebar {...makeProps({ onChange, element })} />)

      expect(statusSelect().value).toBe('fertig')
      expect(keyInputs().map((input) => input.value)).toEqual(['owner'])
      expect(onChange).not.toHaveBeenCalled()

      await userEvent.selectOptions(statusSelect(), 'in Arbeit')
      expect(onChange).toHaveBeenCalledWith([
        { key: 'name', value: 'A' },
        { key: 'status', value: 'in Arbeit' },
        { key: 'owner', value: 'Team 1' },
      ])
    })

    it('treats a typed free-form row "Status" as the status field, which then shows its value', async () => {
      const { onChange } = renderControlled([{ key: 'name', value: 'A' }])

      await userEvent.click(screen.getByRole('button', { name: 'Feld hinzufügen' }))
      await userEvent.type(keyInputs()[0], 'Status')
      await userEvent.type(valueInputs()[0], 'fertig')

      expect(onChange).toHaveBeenLastCalledWith([
        { key: 'name', value: 'A' },
        { key: 'status', value: 'fertig' },
      ])
      expect(statusSelect().value).toBe('fertig')
      // The row stays while it is being typed; no reload under the cursor.
      expect(keyInputs()[0]).toHaveValue('Status')
    })

    it('keeps "Status" as an ordinary row on groups', () => {
      const element = makeElement({
        kind: 'group',
        metadata: [
          { key: 'name', value: 'G' },
          { key: 'Status', value: 'fertig' },
        ],
      })
      render(<Sidebar {...makeProps({ element })} />)

      expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
      expect(keyInputs().map((input) => input.value)).toEqual(['Status'])
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

    describe('reason for a blocked object', () => {
      const reasonField = () => screen.queryByLabelText<HTMLInputElement>('Grund')
      const blocked = (reason?: string): MetadataEntry[] => [
        { key: 'name', value: 'A' },
        { key: 'status', value: 'blockiert' },
        ...(reason === undefined ? [] : [{ key: 'blockiert_grund', value: reason }]),
        { key: 'owner', value: 'Team 1' },
      ]

      it('shows the field "Grund" right under the status only while the status is blockiert', () => {
        const { rerender } = render(<Sidebar {...makeProps({ element: makeElement({ metadata: blocked('Freigabe fehlt') }) })} />)
        expect(statusSelect().value).toBe('blockiert')
        expect(reasonField()).toHaveValue('Freigabe fehlt')
        expect(statusSelect().closest('.sidebar__field')!.nextElementSibling).toContainElement(reasonField())
        // neither the reason nor the key shows up as a free-form row
        expect(keyInputs().map((input) => input.value)).toEqual(['owner'])

        rerender(<Sidebar {...makeProps({ element: makeElement({ id: ID_B, metadata: withStatus('in Arbeit').metadata }) })} />)
        expect(reasonField()).toBeNull()
      })

      it('has no reason field on groups', () => {
        render(<Sidebar {...makeProps({ element: makeElement({ kind: 'group', metadata: blocked('x') }) })} />)
        expect(reasonField()).toBeNull()
      })

      it('appears when blockiert is chosen and takes the reason live, right after the status', async () => {
        const { onChange } = renderControlled([
          { key: 'name', value: 'A' },
          { key: 'owner', value: 'Team 1' },
        ])
        expect(reasonField()).toBeNull()

        await userEvent.selectOptions(statusSelect(), 'blockiert')
        expect(onChange).toHaveBeenLastCalledWith([
          { key: 'name', value: 'A' },
          { key: 'status', value: 'blockiert' },
          { key: 'owner', value: 'Team 1' },
        ])

        await userEvent.type(reasonField()!, 'Freigabe fehlt')
        expect(onChange).toHaveBeenLastCalledWith([
          { key: 'name', value: 'A' },
          { key: 'status', value: 'blockiert' },
          { key: 'blockiert_grund', value: 'Freigabe fehlt' },
          { key: 'owner', value: 'Team 1' },
        ])
        // typing keeps the blanks the user typed, although the model holds the trimmed text
        expect(reasonField()).toHaveValue('Freigabe fehlt')
      })

      it('bundles typing into one edit and does not write an empty reason', async () => {
        const props = makeProps({ element: makeElement({ metadata: blocked() }) })
        const { onChange } = renderControlled(blocked(), props)
        const field = reasonField()!

        await userEvent.click(field)
        await userEvent.type(field, 'ab')
        expect(props.onEditStart).toHaveBeenCalled()
        expect(props.onEditEnd).not.toHaveBeenCalled()
        await userEvent.tab()
        expect(props.onEditEnd).toHaveBeenCalledTimes(1)

        await userEvent.clear(field)
        expect(onChange).toHaveBeenLastCalledWith(blocked())
      })

      it('removes the reason together with the status when another status is chosen (one change)', async () => {
        const { onChange } = renderControlled(blocked('Freigabe fehlt'))

        await userEvent.selectOptions(statusSelect(), 'in Arbeit')
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenLastCalledWith([
          { key: 'name', value: 'A' },
          { key: 'status', value: 'in Arbeit' },
          { key: 'owner', value: 'Team 1' },
        ])
        expect(reasonField()).toBeNull()
      })

      it('reloads the reason after a change from outside (undo)', () => {
        const { setMetadata } = renderControlled(blocked('alt'))
        expect(reasonField()).toHaveValue('alt')
        setMetadata(blocked('neu'))
        expect(reasonField()).toHaveValue('neu')
        setMetadata([{ key: 'name', value: 'A' }, { key: 'status', value: 'offen' }])
        expect(reasonField()).toBeNull()
      })

      it('recognises the key in any case', () => {
        render(
          <Sidebar
            {...makeProps({
              element: makeElement({
                metadata: [
                  { key: 'name', value: 'A' },
                  { key: 'status', value: 'blockiert' },
                  { key: ' Blockiert_Grund ', value: 'Lizenz' },
                ],
              }),
            })}
          />,
        )
        expect(reasonField()).toHaveValue('Lizenz')
        expect(keyInputs()).toHaveLength(0)
      })
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
      metadata: [{ key: 'name', value: label }],
    })

    it('shows only the read-only UUID and the name field every element has', () => {
      render(<Sidebar {...makeProps({ element: edgeElement() })} />)

      expect(screen.getByRole('heading', { name: 'Verbindung' })).toBeInTheDocument()
      expect(screen.getByLabelText('UUID')).toBeDisabled()
      expect(screen.getByLabelText('UUID')).toHaveValue(ID_B)
      expect(screen.getByLabelText('Name')).toHaveValue('')
      expect(screen.queryByLabelText(/Farbe/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Feld hinzufügen' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    })

    it('shows an existing name', () => {
      render(<Sidebar {...makeProps({ element: edgeElement('braucht') })} />)

      expect(screen.getByLabelText('Name')).toHaveValue('braucht')
    })

    it('applies the trimmed name with every keystroke, the field keeps what was typed', async () => {
      const onChange = vi.fn()
      render(<Sidebar {...makeProps({ element: edgeElement(), onChange })} />)

      await userEvent.type(screen.getByLabelText('Name'), '  hängt ab ')

      expect(onChange).toHaveBeenLastCalledWith([{ key: 'name', value: 'hängt ab' }])
      expect(screen.getByLabelText('Name')).toHaveValue('  hängt ab ')
    })

    it('keeps trailing spaces when the owner echoes the name back', async () => {
      const user = userEvent.setup()
      const props = makeProps({ element: edgeElement('a') })
      function Owner() {
        const [label, setLabel] = useState('a')
        return (
          <Sidebar
            {...props}
            element={edgeElement(label)}
            onChange={(entries) => setLabel(entries[0].value)}
          />
        )
      }
      render(<Owner />)

      await user.type(screen.getByLabelText('Name'), ' b ')
      expect(screen.getByLabelText('Name')).toHaveValue('a b ')
    })

    it('clears the name by emptying the field', async () => {
      const onChange = vi.fn()
      render(<Sidebar {...makeProps({ element: edgeElement('alt'), onChange })} />)

      await userEvent.clear(screen.getByLabelText('Name'))

      expect(onChange).toHaveBeenLastCalledWith([{ key: 'name', value: '' }])
    })

    it('adopts a name that changed from outside', () => {
      const { rerender } = render(<Sidebar {...makeProps({ element: edgeElement('alt') })} />)

      rerender(<Sidebar {...makeProps({ element: edgeElement('neu') })} />)

      expect(screen.getByLabelText('Name')).toHaveValue('neu')
    })

    it('Enter does not submit anything; the close button calls onClose', async () => {
      const onClose = vi.fn()
      const props = makeProps({ element: edgeElement(), onClose })
      render(<Sidebar {...props} />)

      await userEvent.type(screen.getByLabelText('Name'), 'x{Enter}')
      expect(props.onChange).toHaveBeenCalledTimes(1)
      await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('ends the edit when leaving the field or when the form goes away', async () => {
      const props = makeProps({ element: edgeElement() })
      const { rerender } = render(<Sidebar {...props} />)

      await userEvent.type(screen.getByLabelText('Name'), 'x')
      await userEvent.tab()
      expect(props.onEditEnd).toHaveBeenCalledTimes(1)

      await userEvent.type(screen.getByLabelText('Name'), 'y')
      rerender(<Sidebar {...props} element={null} selectionCount={0} />)
      expect(props.onEditEnd).toHaveBeenCalledTimes(2)
    })

    it('offers a checkbox to mark the connection as an optional dependency', async () => {
      const onSoftChange = vi.fn()
      const { rerender } = render(<Sidebar {...makeProps({ element: edgeElement(), onSoftChange })} />)

      const box = screen.getByRole('checkbox', { name: 'Optionale Abhängigkeit' })
      expect(box).not.toBeChecked()
      await userEvent.click(box)
      expect(onSoftChange).toHaveBeenLastCalledWith(true)

      rerender(<Sidebar {...makeProps({ element: { ...edgeElement(), soft: true }, onSoftChange })} />)
      expect(screen.getByRole('checkbox', { name: 'Optionale Abhängigkeit' })).toBeChecked()
      await userEvent.click(screen.getByRole('checkbox', { name: 'Optionale Abhängigkeit' }))
      expect(onSoftChange).toHaveBeenLastCalledWith(false)
      expect(screen.getByText(/zählt nicht zum kritischen Pfad/)).toBeInTheDocument()
    })

    it('starts a fresh draft when another element is opened', async () => {
      const { rerender } = render(<Sidebar {...makeProps({ element: edgeElement() })} />)
      await userEvent.type(screen.getByLabelText('Name'), 'entwurf')

      rerender(<Sidebar {...makeProps({ element: { ...edgeElement('zweite'), id: ID_A } })} />)

      expect(screen.getByLabelText('Name')).toHaveValue('zweite')
    })
  })

  describe('languages', () => {
    const bulk = { count: 3, color: '', mixed: true, onChange: vi.fn() }
    const edge: SidebarElement = { id: ID_B, kind: 'edge', metadata: [{ key: 'name', value: '' }] }

    it.each([
      ['en', 'Metadata', 'Object', 'Group', 'Connection', 'Colour (color)', 'Reset', 'Close'],
      ['fr', 'Métadonnées', 'Objet', 'Groupe', 'Liaison', 'Couleur (color)', 'Réinitialiser', 'Fermer'],
    ] as const)('labels the form in %s', (locale, aside, node, group, connection, color, reset, close) => {
      setTestLocale(locale)
      const { rerender } = render(<Sidebar {...makeProps()} />)
      expect(screen.getByRole('complementary', { name: aside })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: node })).toBeInTheDocument()
      expect(screen.getByLabelText(color)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: reset })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: close })).toBeInTheDocument()

      rerender(<Sidebar {...makeProps({ element: makeElement({ kind: 'group' }) })} />)
      expect(screen.getByRole('heading', { name: group })).toBeInTheDocument()

      rerender(<Sidebar {...makeProps({ element: edge })} />)
      expect(screen.getByRole('heading', { name: connection })).toBeInTheDocument()
    })

    it.each([
      ['en', 'Field name', 'Value', 'Remove field', 'Add field', 'not editable'],
      ['fr', 'Nom du champ', 'Valeur', 'Supprimer le champ', 'Ajouter un champ', 'non modifiable'],
    ] as const)('labels the free fields in %s', (locale, key, value, remove, add, readonly) => {
      setTestLocale(locale)
      render(<Sidebar {...makeProps({ element: makeElement({ metadata: [{ key: 'name', value: 'A' }, { key: 'k', value: 'v' }] }) })} />)
      expect(screen.getByLabelText(key)).toHaveValue('k')
      expect(screen.getByLabelText(value)).toHaveValue('v')
      expect(screen.getByRole('button', { name: remove })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: add })).toBeInTheDocument()
      expect(screen.getByText(readonly)).toBeInTheDocument()
    })

    it.each([
      ['en', '3 elements selected – select exactly one to edit.', 'Colour (color) for all 3 elements', 'mixed'],
      ['fr', '3 éléments sélectionnés – n’en choisissez qu’un seul pour le modifier.', 'Couleur (color) pour les 3 éléments', 'différentes'],
    ] as const)('explains a multi-selection in %s', (locale, hint, color, mixed) => {
      setTestLocale(locale)
      render(<Sidebar {...makeProps({ element: null, selectionCount: 3, bulkColor: bulk })} />)
      expect(screen.getByText(hint)).toBeInTheDocument()
      expect(screen.getByLabelText(color)).toBeInTheDocument()
      expect(screen.getByText(mixed)).toBeInTheDocument()
    })

    it.each([
      ['en', 'Colour (color) for 1 element'],
      ['fr', 'Couleur (color) pour 1 élément'],
    ] as const)('uses the singular for one element in %s', (locale, color) => {
      setTestLocale(locale)
      render(<Sidebar {...makeProps({ element: null, selectionCount: 2, bulkColor: { ...bulk, count: 1 } })} />)
      expect(screen.getByLabelText(color)).toBeInTheDocument()
    })

    it.each([
      ['en', 'Duplicate field names: owner', 'Only applied once every field name occurs just once.'],
      ['fr', 'Noms de champ en double : owner', 'Appliqué dès que chaque nom de champ n’apparaît qu’une fois.'],
    ] as const)('reports duplicate field names in %s', async (locale, error, hint) => {
      setTestLocale(locale)
      const user = userEvent.setup()
      render(<Sidebar {...makeProps()} />)
      await user.click(screen.getByRole('button', { name: locale === 'en' ? 'Add field' : 'Ajouter un champ' }))
      await user.type(screen.getAllByRole('textbox', { name: locale === 'en' ? 'Field name' : 'Nom du champ' })[1], 'owner')

      expect(screen.getByRole('alert')).toHaveTextContent(error)
      expect(screen.getByText(hint)).toBeInTheDocument()
    })

    it.each([
      ['en', 'Status', ['open', 'in progress', 'blocked', 'done']],
      ['fr', 'Statut', ['ouvert', 'en cours', 'bloqué', 'terminé']],
    ] as const)('shows translated status names but keeps the German values in %s', (locale, label, names) => {
      setTestLocale(locale)
      render(<Sidebar {...makeProps()} />)
      const select = screen.getByLabelText<HTMLSelectElement>(label)
      expect([...select.options].map((option) => option.value)).toEqual(['offen', 'in Arbeit', 'blockiert', 'fertig'])
      expect([...select.options].map((option) => option.text)).toEqual(names)
    })

    it.each([
      ['en', 'Status from members: 2 of 5 done', 'Status from members: no members'],
      ['fr', 'Statut des membres : 2 sur 5 terminés', 'Statut des membres : aucun membre'],
    ] as const)('summarises the group progress in %s', (locale, some, none) => {
      setTestLocale(locale)
      const group = makeElement({ kind: 'group', progress: { done: 2, total: 5 } })
      const { rerender } = render(<Sidebar {...makeProps({ element: group })} />)
      expect(screen.getByText(some)).toBeInTheDocument()
      rerender(<Sidebar {...makeProps({ element: { ...group, progress: { done: 0, total: 0 } } })} />)
      expect(screen.getByText(none)).toBeInTheDocument()
    })

    it.each([
      ['en', 'Why is the object blocked? (optional)', 'Reason'],
      ['fr', 'Pourquoi l’objet est-il bloqué ? (facultatif)', 'Motif'],
    ] as const)('labels the block reason in %s', (locale, placeholder, label) => {
      setTestLocale(locale)
      const blocked = makeElement({ metadata: [{ key: 'name', value: 'A' }, { key: 'status', value: 'blockiert' }] })
      render(<Sidebar {...makeProps({ element: blocked })} />)
      expect(screen.getByLabelText(label)).toHaveAttribute('placeholder', placeholder)
    })
  })
})
