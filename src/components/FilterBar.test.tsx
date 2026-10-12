import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FilterBar } from './FilterBar'
import type { FilterBarProps } from './props'
import { setTestLocale } from '../test/locale'

function makeProps(overrides: Partial<FilterBarProps> = {}): FilterBarProps {
  return {
    keyText: '',
    valueText: '',
    count: 0,
    onKeyChange: vi.fn(),
    onValueChange: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
}

const keyField = () => screen.getByRole('textbox', { name: 'Schlüssel' })
const valueField = () => screen.getByRole('textbox', { name: 'Wert' })

describe('FilterBar', () => {
  it('is a labelled search region that takes the focus in the key field', () => {
    render(<FilterBar {...makeProps()} />)

    expect(screen.getByRole('search', { name: 'Nach Metadaten filtern' })).toBeInTheDocument()
    expect(keyField()).toHaveFocus()
  })

  it('shows the given texts and reports every change', async () => {
    const props = makeProps({ keyText: 'team', valueText: 'Back' })
    render(<FilterBar {...props} />)

    expect(keyField()).toHaveValue('team')
    expect(valueField()).toHaveValue('Back')
    await userEvent.type(keyField(), 's')
    expect(props.onKeyChange).toHaveBeenLastCalledWith('teams')
    await userEvent.type(valueField(), 'e')
    expect(props.onValueChange).toHaveBeenLastCalledWith('Backe')
  })

  it('says nothing until there is a key, then counts the hits or reports none', () => {
    const { rerender } = render(<FilterBar {...makeProps()} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()

    rerender(<FilterBar {...makeProps({ keyText: 'team', count: 1 })} />)
    expect(screen.getByRole('status')).toHaveTextContent('1 Treffer')
    rerender(<FilterBar {...makeProps({ keyText: 'team', count: 3 })} />)
    expect(screen.getByRole('status')).toHaveTextContent('3 Treffer')
    rerender(<FilterBar {...makeProps({ keyText: 'team', count: 0 })} />)
    expect(screen.getByRole('status')).toHaveTextContent('Keine Treffer')
  })

  it('closes on Escape without letting the key reach the canvas shortcuts', () => {
    const props = makeProps()
    const onWindowKey = vi.fn()
    window.addEventListener('keydown', onWindowKey)
    render(<FilterBar {...props} />)

    fireEvent.keyDown(keyField(), { key: 'Escape' })
    fireEvent.keyDown(valueField(), { key: 'v' })
    window.removeEventListener('keydown', onWindowKey)

    expect(props.onClose).toHaveBeenCalledTimes(1)
    expect(onWindowKey).not.toHaveBeenCalled()
  })

  it('closes with the close button', async () => {
    const props = makeProps()
    render(<FilterBar {...props} />)

    await userEvent.click(screen.getByRole('button', { name: 'Filter schließen' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})

describe('FilterBar language', () => {
  it.each([
    ['en', 'Key', 'Value', '2 matches'],
    ['fr', 'Clé', 'Valeur', '2 résultats'],
  ] as const)('translates the labels in %s', (locale, key, value, count) => {
    setTestLocale(locale)
    render(<FilterBar {...makeProps({ keyText: 'x', count: 2 })} />)

    expect(screen.getByRole('textbox', { name: key })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: value })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(count)
  })
})
