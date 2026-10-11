import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { STORAGE_KEY } from '../storage/localStorage'
import { UI_KEY } from '../storage/uiPreferences'
import { setTestLocale } from '../test/locale'
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

    for (const label of ['Exportieren', 'JSON (Zwischenablage)', 'JSON einfügen', 'JSON-Text', 'Importieren']) {
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

  it('describes the language setting in German by default', () => {
    const { container } = render(<AgentHelp />)
    const text = container.textContent ?? ''

    expect(screen.getByRole('heading', { level: 2, name: 'Sprache / Language' })).toBeInTheDocument()
    expect(text).toContain(UI_KEY)
    expect(text).toContain('aria-label="Sprache"')
    expect(text).toContain('aria-label="Hilfe"')
  })

  it.each([
    {
      locale: 'en',
      heading: 'Agent help: Release Management',
      section: 'Language',
      labels: ['Export', 'Undo', 'JSON (clipboard)', 'Paste JSON', 'JSON text', 'Create object', 'Group'],
      hint: 'German (de) is the default',
    },
    {
      locale: 'fr',
      heading: 'Aide pour agents : Release Management',
      section: 'Langue / Language',
      labels: ['Exporter', 'Annuler', 'JSON (presse-papiers)', 'Coller du JSON', 'Texte JSON', 'Créer un objet', 'Regrouper'],
      hint: 'L’allemand (de) est la langue par défaut',
    },
  ] as const)('is written in $locale with the labels of the real interface', ({ locale, heading, section, labels, hint }) => {
    setTestLocale(locale)
    const { container } = render(<AgentHelp />)
    const text = container.textContent ?? ''

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading)
    expect(screen.getByRole('heading', { level: 2, name: section })).toBeInTheDocument()
    for (const label of labels) expect(text).toContain(label)
    expect(text).toContain(hint)
    for (const value of [UI_KEY, 'locale', 'de', 'en', 'fr', STORAGE_KEY, '160x56']) expect(text).toContain(value)
    expect(text).not.toContain('Datenmodell')
  })

  it.each([
    ['de', 'Agent-Hilfe: Release-Management (Vite, localhost:5173)'],
    ['en', 'Agent help: Release Management (Vite, localhost:5173)'],
    ['fr', 'Aide pour agents : Release Management (Vite, localhost:5173)'],
  ] as const)('sets the tab title in %s', (locale, title) => {
    setTestLocale(locale)
    render(<AgentHelp />)
    expect(document.title).toBe(title)
  })
})
