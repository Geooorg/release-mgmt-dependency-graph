import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Root } from './Root'
import { setTestLocale } from './test/locale'

vi.mock('./App', () => ({ default: () => <div>Die Anwendung</div> }))

afterEach(() => {
  window.location.hash = ''
})

describe('Root', () => {
  it('shows the application by default', async () => {
    render(<Root />)

    expect(await screen.findByText('Die Anwendung')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('shows the agent help under #/agent-hilfe without loading the application', () => {
    window.location.hash = '#/agent-hilfe'
    render(<Root />)

    expect(screen.getByRole('heading', { level: 1, name: /Agent-Hilfe/ })).toBeInTheDocument()
    expect(screen.queryByText('Die Anwendung')).not.toBeInTheDocument()
  })

  it('follows hash changes', async () => {
    render(<Root />)
    await screen.findByText('Die Anwendung')

    act(() => {
      window.location.hash = '#/agent-hilfe'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })

    expect(screen.getByRole('heading', { level: 1, name: /Agent-Hilfe/ })).toBeInTheDocument()
  })

  it('sets the document language and follows a change', () => {
    setTestLocale('en')
    render(<Root />)
    expect(document.documentElement.lang).toBe('en')

    act(() => setTestLocale('fr'))
    expect(document.documentElement.lang).toBe('fr')
  })
})
