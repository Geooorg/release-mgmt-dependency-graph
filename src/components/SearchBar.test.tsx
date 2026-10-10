import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SearchBar } from './SearchBar'
import type { SearchBarProps } from './props'

function makeProps(overrides: Partial<SearchBarProps> = {}): SearchBarProps {
  return { onSearch: vi.fn(() => ({ count: 3, position: 1 })), onClose: vi.fn(), ...overrides }
}

const field = () => screen.getByRole('textbox', { name: 'Suchen nach Name' })

describe('SearchBar', () => {
  it('takes the focus and starts empty without a status', () => {
    render(<SearchBar {...makeProps()} />)

    expect(field()).toHaveFocus()
    expect(field()).toHaveValue('')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('searches on Enter, not while typing', async () => {
    const props = makeProps()
    render(<SearchBar {...props} />)

    await userEvent.type(field(), 'serv')
    expect(props.onSearch).not.toHaveBeenCalled()

    await userEvent.keyboard('{Enter}')
    expect(props.onSearch).toHaveBeenCalledWith('serv')
    expect(screen.getByRole('status')).toHaveTextContent('Treffer 1 von 3')
  })

  it('searches again with the same text on every further Enter and shows the new position', async () => {
    const onSearch = vi
      .fn()
      .mockReturnValueOnce({ count: 2, position: 1 })
      .mockReturnValueOnce({ count: 2, position: 2 })
    render(<SearchBar {...makeProps({ onSearch })} />)

    await userEvent.type(field(), 'a{Enter}')
    await userEvent.keyboard('{Enter}')

    expect(onSearch).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('status')).toHaveTextContent('Treffer 2 von 2')
  })

  it('says so when nothing matches', async () => {
    render(<SearchBar {...makeProps({ onSearch: vi.fn(() => ({ count: 0, position: 0 })) })} />)

    await userEvent.type(field(), 'xyz{Enter}')

    expect(screen.getByRole('status')).toHaveTextContent('Kein Treffer')
  })

  it('forgets the status when the text changes', async () => {
    render(<SearchBar {...makeProps()} />)
    await userEvent.type(field(), 'a{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('Treffer')

    await userEvent.type(field(), 'b')

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('does not search an empty text', async () => {
    const props = makeProps()
    render(<SearchBar {...props} />)

    await userEvent.type(field(), '   {Enter}')

    expect(props.onSearch).not.toHaveBeenCalled()
  })

  it('closes with Escape and with the button, and keeps keys away from the canvas', async () => {
    const props = makeProps()
    render(<SearchBar {...props} />)
    const outer = vi.fn()
    document.addEventListener('keydown', outer)

    await userEvent.keyboard('{Delete}n{Escape}')
    document.removeEventListener('keydown', outer)
    await userEvent.click(screen.getByRole('button', { name: 'Suche schließen' }))

    expect(props.onClose).toHaveBeenCalledTimes(2)
    expect(outer).not.toHaveBeenCalled()
  })

  it('is a search landmark', () => {
    render(<SearchBar {...makeProps()} />)

    expect(screen.getByRole('search')).toBeInTheDocument()
    fireEvent.keyDown(field(), { key: 'a' })
  })
})
