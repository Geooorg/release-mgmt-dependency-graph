import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { de } from '../i18n/de'
import { en } from '../i18n/en'
import { fr } from '../i18n/fr'
import { setTestLocale } from '../test/locale'
import { HELP_SECTIONS } from './helpBody'
import { HelpDialog } from './HelpDialog'

describe('HelpDialog', () => {
  it('renders nothing while closed', () => {
    render(<HelpDialog open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('heading', { hidden: true })).not.toBeInTheDocument()
  })

  it('shows every section of the German help by default', () => {
    render(<HelpDialog open onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog', { name: 'Hilfe' })
    for (const section of HELP_SECTIONS) {
      expect(within(dialog).getByRole('heading', { level: 3, name: de[`help.${section}.title`] })).toBeInTheDocument()
    }
    expect(within(dialog).getAllByRole('listitem').length).toBeGreaterThan(20)
  })

  it.each([
    ['en', en, 'Help'],
    ['fr', fr, 'Aide'],
  ] as const)('shows the %s texts', (locale, catalog, title) => {
    setTestLocale(locale)
    render(<HelpDialog open onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog', { name: title })
    for (const section of HELP_SECTIONS) {
      expect(within(dialog).getByRole('heading', { level: 3, name: catalog[`help.${section}.title`] })).toBeInTheDocument()
    }
  })

  it('closes with the button and with Esc', async () => {
    const onClose = vi.fn()
    render(<HelpDialog open onClose={onClose} />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Schließen' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
