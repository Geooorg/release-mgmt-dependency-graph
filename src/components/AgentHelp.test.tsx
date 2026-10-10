import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { STORAGE_KEY } from '../storage/localStorage'
import { AgentHelp } from './AgentHelp'

describe('AgentHelp', () => {
  it('has the page title and the sections for agents', () => {
    render(<AgentHelp />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Agent-Hilfe: Release-Management')
    for (const name of [
      'Datenmodell',
      'JSON-Schema',
      'Schnellster Weg für Massenänderungen',
      'JSON als Text lesen und importieren (ohne Datei)',
      'UI-Bedienung (nur wenn nötig)',
      'Stolpersteine bei Chrome-Steuerung (execute_javascript)',
      'Kantenrichtung',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
  })

  it('names the real storage key and the layout measures from the model', () => {
    const { container } = render(<AgentHelp />)
    const text = container.textContent ?? ''

    expect(text).toContain(STORAGE_KEY)
    expect(text).toContain('160x56')
    expect(text).toContain('(24,56)')
    expect(text).toContain('208x136')
    expect(text).toContain('24 + n*160 + (n-1)*24 + 24')
  })

  it('names the controls of the JSON text dialogs as the app labels them', () => {
    const { container } = render(<AgentHelp />)
    const text = container.textContent ?? ''

    for (const label of ['JSON anzeigen', 'JSON einfügen', 'Projekt-JSON (schreibgeschützt)', 'JSON-Text', 'Importieren']) {
      expect(text).toContain(label)
    }
  })

  it('links the JSON schema under the base path', () => {
    render(<AgentHelp />)

    expect(screen.getByRole('link', { name: 'graph.schema.json' })).toHaveAttribute('href', '/graph.schema.json')
  })

  it('states the edge direction the app uses', () => {
    const { container } = render(<AgentHelp />)

    expect(container.textContent).toMatch(/source = abhängige Einheit, target = Einheit, von der sie abhängt/)
  })
})
