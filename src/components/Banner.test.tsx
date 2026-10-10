import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Banner } from './Banner'
import { setTestLocale } from '../test/locale'

describe('Banner', () => {
  it('renders nothing without a message', () => {
    const { container } = render(<Banner message={null} kind="info" onDismiss={vi.fn()} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('uses role alert for errors', () => {
    render(<Banner message="Import fehlgeschlagen" kind="error" onDismiss={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Import fehlgeschlagen')
    expect(screen.getByRole('alert')).toHaveClass('banner--error')
  })

  it.each(['info', 'success'] as const)('uses role status for %s', (kind) => {
    render(<Banner message="Alles gut" kind={kind} onDismiss={vi.fn()} />)

    expect(screen.getByRole('status')).toHaveTextContent('Alles gut')
    expect(screen.getByRole('status')).toHaveClass(`banner--${kind}`)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lists details when given', () => {
    render(
      <Banner
        message="Ungültige Datei"
        kind="error"
        details={['Knoten 3 fehlt', 'Kante 7 ist ungültig']}
        onDismiss={vi.fn()}
      />,
    )

    const items = screen.getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(['Knoten 3 fehlt', 'Kante 7 ist ungültig'])
  })

  it('renders no list for missing or empty details', () => {
    const { rerender } = render(<Banner message="Hinweis" kind="info" onDismiss={vi.fn()} />)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()

    rerender(<Banner message="Hinweis" kind="info" details={[]} onDismiss={vi.fn()} />)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('calls onDismiss from the dismiss button', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<Banner message="Hinweis" kind="info" onDismiss={onDismiss} />)

    await user.click(screen.getByRole('button', { name: 'Meldung schließen' }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

describe('Banner language', () => {
  it.each([
    ['en', 'Close message'],
    ['fr', 'Fermer le message'],
  ] as const)('labels the close button in %s', (locale, name) => {
    setTestLocale(locale)
    render(<Banner message="x" kind="info" onDismiss={vi.fn()} />)
    expect(screen.getByRole('button', { name })).toBeInTheDocument()
  })
})
