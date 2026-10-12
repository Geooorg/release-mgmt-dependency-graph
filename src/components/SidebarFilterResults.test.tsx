import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SidebarFilterResults } from './SidebarFilterResults'
import type { SidebarFilterProps } from './props'
import { setTestLocale } from '../test/locale'

function makeProps(overrides: Partial<SidebarFilterProps> = {}): SidebarFilterProps {
  return {
    results: [
      { id: 'a', name: 'Service A', color: '#ff0000', key: 'team', value: 'Backend' },
      { id: 'b', name: 'Service B', key: 'Team', value: 'backend' },
    ],
    selectedIds: [],
    hasQuery: true,
    onPick: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
}

describe('SidebarFilterResults', () => {
  it('lists every hit with its name and the matching entry, and counts them', () => {
    render(<SidebarFilterResults {...makeProps()} />)

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Service A')
    expect(items[0]).toHaveTextContent('team = Backend')
    expect(items[1]).toHaveTextContent('Team = backend')
    expect(screen.getByRole('status')).toHaveTextContent('2 Treffer')
  })

  it('picks a hit on click', async () => {
    const props = makeProps()
    render(<SidebarFilterResults {...props} />)

    await userEvent.click(screen.getByRole('button', { name: 'Service B auswählen' }))
    expect(props.onPick).toHaveBeenCalledWith('b')
  })

  it('marks the selected hits', () => {
    render(<SidebarFilterResults {...makeProps({ selectedIds: ['b'] })} />)

    expect(screen.getByRole('button', { name: 'Service A auswählen' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Service B auswählen' })).toHaveAttribute('aria-current', 'true')
  })

  it('shows a hint before a key is entered and "none" when nothing matches', () => {
    const { rerender } = render(<SidebarFilterResults {...makeProps({ results: [], hasQuery: false })} />)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.getByText(/Schlüssel eingeben/)).toBeInTheDocument()

    rerender(<SidebarFilterResults {...makeProps({ results: [], hasQuery: true })} />)
    expect(screen.getByRole('status')).toHaveTextContent('Keine Treffer')
  })

  it('closes with the close button', async () => {
    const props = makeProps()
    render(<SidebarFilterResults {...props} />)

    const header = screen.getByRole('heading', { name: 'Filter' }).parentElement as HTMLElement
    await userEvent.click(within(header).getByRole('button', { name: 'Schließen' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})

describe('SidebarFilterResults language', () => {
  it('translates in English', () => {
    setTestLocale('en')
    render(<SidebarFilterResults {...makeProps({ results: [makeProps().results[0]] })} />)

    expect(screen.getByRole('status')).toHaveTextContent('1 match')
    expect(screen.getByRole('button', { name: 'Select Service A' })).toBeInTheDocument()
  })
})
