import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProjectTitle } from './ProjectTitle'

function setup(name = 'Release-Management') {
  const onRename = vi.fn()
  const view = render(<ProjectTitle name={name} onRename={onRename} />)
  return { onRename, ...view }
}

const input = () => screen.getByRole('textbox', { name: 'Projektname' })
const openEditor = () => userEvent.dblClick(screen.getByRole('button', { name: /Release-Management/ }))

describe('ProjectTitle', () => {
  it('shows the name as a heading', () => {
    setup('Mein-Projekt')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mein-Projekt')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('opens an inline editor with the name selected on double click', async () => {
    setup()
    await openEditor()

    expect(input()).toHaveValue('Release-Management')
    expect(input()).toHaveFocus()
    expect((input() as HTMLInputElement).selectionStart).toBe(0)
    expect((input() as HTMLInputElement).selectionEnd).toBe('Release-Management'.length)
  })

  it('also opens with the keyboard (Enter or F2 on the focused title)', async () => {
    setup()
    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    expect(input()).toBeInTheDocument()
  })

  it('does not open on a single click', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /Release-Management/ }))

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('commits on Enter', async () => {
    const { onRename } = setup()
    await openEditor()

    await userEvent.keyboard('Alpha_1.0{Enter}') // the old name is selected, typing replaces it

    expect(onRename).toHaveBeenCalledWith('Alpha_1.0')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('commits when the field loses focus', async () => {
    const { onRename } = setup()
    await openEditor()
    await userEvent.keyboard('Beta')

    await userEvent.tab()

    expect(onRename).toHaveBeenCalledTimes(1)
    expect(onRename).toHaveBeenCalledWith('Beta')
  })

  it('cancels on Escape without renaming', async () => {
    const { onRename } = setup()
    await openEditor()

    await userEvent.keyboard('Gamma{Escape}')

    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Release-Management/ })).toBeInTheDocument()
  })

  it('does not call onRename when nothing changed', async () => {
    const { onRename } = setup()
    await openEditor()

    await userEvent.keyboard('{Enter}')

    expect(onRename).not.toHaveBeenCalled()
  })

  it('shows the allowed characters while editing', async () => {
    setup()
    await openEditor()

    expect(screen.getByText(/A-Z a-z 0-9 - _ \./)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('rejects disallowed characters as they are typed and says so', async () => {
    const { onRename } = setup()
    await openEditor()

    await userEvent.keyboard('Mein Projekt/ä!{Enter}')

    expect(onRename).toHaveBeenCalledWith('MeinProjekt')
  })

  it('alerts when a typed character was refused and keeps the alert while editing', async () => {
    setup()
    await openEditor()

    await userEvent.keyboard('a ')
    expect(screen.getByRole('alert')).toHaveTextContent('Nicht erlaubt')
    expect(input()).toHaveValue('a')

    await userEvent.keyboard('c')
    expect(screen.getByRole('alert')).toHaveTextContent('Nicht erlaubt')
    expect(input()).toHaveValue('ac')
  })

  it('starts every edit without an old alert', async () => {
    setup()
    await openEditor()
    await userEvent.keyboard('a {Escape}')

    await openEditor()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('strips disallowed characters from pasted text', async () => {
    const { onRename } = setup()
    await openEditor()
    await userEvent.clear(input())

    await userEvent.paste('Hallo Welt, ünd mehr.txt')
    await userEvent.keyboard('{Enter}')

    expect(onRename).toHaveBeenCalledWith('HalloWeltndmehr.txt')
  })

  it('keeps the editor open with a message when the name would be empty', async () => {
    const { onRename } = setup()
    await openEditor()
    await userEvent.clear(input())

    await userEvent.keyboard('{Enter}')

    expect(onRename).not.toHaveBeenCalled()
    expect(input()).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('nicht leer')
  })

  it('an empty name on blur just discards the edit', async () => {
    const { onRename } = setup()
    await openEditor()
    await userEvent.clear(input())

    await userEvent.tab()

    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Release-Management/ })).toBeInTheDocument()
  })

  it('limits the length', async () => {
    setup()
    await openEditor()

    expect(input()).toHaveAttribute('maxlength', '100')
  })

  it('shows the new name after the parent updates it', async () => {
    const { rerender } = setup()
    rerender(<ProjectTitle name="Neu" onRename={vi.fn()} />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Neu')
  })
})
