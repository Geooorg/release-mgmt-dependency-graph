import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Tooltip } from './Tooltip'

function setup(props: Partial<Parameters<typeof Tooltip>[0]> = {}, disabled = false) {
  return render(
    <Tooltip text="Macht etwas Nützliches" {...props}>
      <button type="button" disabled={disabled}>
        Knopf
      </button>
    </Tooltip>,
  )
}

describe('Tooltip', () => {
  it('is hidden until the pointer rests on the trigger', async () => {
    setup()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    await userEvent.hover(screen.getByRole('button', { name: 'Knopf' }))

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Macht etwas Nützliches')
  })

  it('hides again when the pointer leaves', async () => {
    setup()
    const button = screen.getByRole('button', { name: 'Knopf' })
    await userEvent.hover(button)
    await screen.findByRole('tooltip')

    await userEvent.unhover(button)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('appears on keyboard focus and closes with Escape', async () => {
    setup()
    await userEvent.tab()
    expect(await screen.findByRole('tooltip')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('describes the trigger for assistive technology without changing its name', async () => {
    setup()
    const button = screen.getByRole('button', { name: 'Knopf' })
    expect(button).not.toHaveAttribute('aria-describedby')

    await userEvent.hover(button)
    const tooltip = await screen.findByRole('tooltip')

    expect(button).toHaveAttribute('aria-describedby', tooltip.id)
    expect(screen.getByRole('button', { name: 'Knopf' })).toBe(button)
  })

  it('shows the shortcut and the hint', async () => {
    setup({ shortcut: 'Strg + Z', hint: 'Gerade nicht verfügbar' })
    await userEvent.hover(screen.getByRole('button', { name: 'Knopf' }))

    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip).toHaveTextContent('Strg + Z')
    expect(tooltip).toHaveTextContent('Gerade nicht verfügbar')
  })

  it('is rendered outside of the trigger container so it is never clipped', async () => {
    const { container } = setup()
    await userEvent.hover(screen.getByRole('button', { name: 'Knopf' }))
    const tooltip = await screen.findByRole('tooltip')

    expect(container.contains(tooltip)).toBe(false)
    expect(document.body.contains(tooltip)).toBe(true)
  })

  it('works for disabled triggers too (hover lands on the wrapper)', async () => {
    const { container } = setup({ hint: 'Nicht verfügbar' }, true)
    await userEvent.hover(container.firstElementChild as Element)

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Nicht verfügbar')
  })
})
