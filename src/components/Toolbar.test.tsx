import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { setTestLocale } from '../test/locale'
import { Toolbar } from './Toolbar'
import type { ToolbarProps } from './props'

function makeProps(overrides: Partial<ToolbarProps> = {}): ToolbarProps {
  return {
    projectName: 'Release-Management',
    onRenameProject: vi.fn(),
    mode: 'build',
    onModeChange: vi.fn(),
    tool: 'select',
    onToolChange: vi.fn(),
    canGroup: true,
    canUngroup: true,
    canDelete: true,
    canCopy: true,
    canPaste: true,
    canUndo: true,
    canRedo: true,
    highlight: 'critical',
    onHighlightChange: vi.fn(),
    selectionEmpty: false,
    cycleCount: 0,
    onFocusCycle: vi.fn(),
    panelVisible: true,
    onTogglePanel: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onGroup: vi.fn(),
    onUngroup: vi.fn(),
    onDelete: vi.fn(),
    onCopy: vi.fn(),
    onPaste: vi.fn(),
    searchOpen: false,
    onToggleSearch: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
    onPasteJson: vi.fn(),
    locale: 'de',
    onLocaleChange: vi.fn(),
    onHelp: vi.fn(),
    ...overrides,
  }
}

describe('Toolbar', () => {
  it('renders a labelled toolbar with the title and the build mode buttons', () => {
    render(<Toolbar {...makeProps()} />)

    expect(screen.getByRole('toolbar', { name: 'Werkzeuge' })).toBeInTheDocument()
    expect(screen.getByText('Release-Management')).toBeInTheDocument()
    for (const label of [
      'Editieren',
      'Analysieren',
      'Auswählen',
      'Objekt anlegen',
      'Verbinden',
      'Gruppieren',
      'Gruppe auflösen',
      'Löschen',
      'Kopieren',
      'Einfügen',
      'Suchen',
      'Rückgängig',
      'Wiederholen',
      'Export',
      'Import',
      'JSON einfügen',
      'Hilfe',
    ]) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('type', 'button')
    }
    expect(screen.getAllByRole('separator')).toHaveLength(6)
  })

  it('puts help and the language switch in a second row below Export', () => {
    render(<Toolbar {...makeProps()} />)

    const exportBody = screen.getByRole('button', { name: 'Export' }).closest('.toolbar__file-body')
    expect(exportBody).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Hilfe' }).closest('.toolbar__file-body')).toBe(exportBody)
    expect(screen.getByRole('combobox', { name: 'Sprache' }).closest('.toolbar__file-body')).toBe(exportBody)
    expect(screen.getByRole('button', { name: 'Hilfe' }).closest('.toolbar__file-extra')).not.toBeNull()
  })

  it('puts the language switch left of the help button, which is last', () => {
    render(<Toolbar {...makeProps()} />)

    const extra = screen.getByRole('button', { name: 'Hilfe' }).closest('.toolbar__file-extra') as HTMLElement
    const controls = within(extra).getAllByRole('combobox').concat(within(extra).getAllByRole('button'))
    expect(controls.map((el) => el.getAttribute('aria-label'))).toEqual(['Sprache', 'Hilfe'])
    expect(extra.lastElementChild).toContainElement(screen.getByRole('button', { name: 'Hilfe' }))
  })

  it('puts delete right of paste, before undo and redo', () => {
    render(<Toolbar {...makeProps()} />)

    const del = screen.getByRole('button', { name: 'Löschen' })
    const paste = screen.getByRole('button', { name: 'Einfügen' })
    expect(paste.compareDocumentPosition(del)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(del.compareDocumentPosition(screen.getByRole('group', { name: 'Verlauf' }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(screen.getByRole('group', { name: 'Gruppen' })).not.toContainElement(del)
  })

  it('offers the languages in their own names and reports a change', async () => {
    setTestLocale('en')
    const props = makeProps({ locale: 'en' })
    render(<Toolbar {...props} />)

    const select = screen.getByRole('combobox', { name: 'Language' })
    expect(select).toHaveValue('en')
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Deutsch',
      'English',
      'Français',
    ])
    expect(within(select).getAllByRole('option').map((option) => option.getAttribute('lang'))).toEqual(['de', 'en', 'fr'])
    await userEvent.setup().selectOptions(select, 'fr')
    expect(props.onLocaleChange).toHaveBeenCalledWith('fr')
  })

  it('opens the help', async () => {
    const props = makeProps()
    render(<Toolbar {...props} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Hilfe' }))
    expect(props.onHelp).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['en', 'Undo', 'Group', 'Export', 'Edit'],
    ['fr', 'Annuler', 'Regrouper', 'Exporter', 'Éditer'],
  ] as const)('labels the buttons in %s', (locale, undo, group, exportLabel, edit) => {
    setTestLocale(locale)
    render(<Toolbar {...makeProps({ locale })} />)

    for (const name of [undo, group, exportLabel, edit]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('names the cycle button with the plural of the language', () => {
    setTestLocale('en')
    render(<Toolbar {...makeProps({ cycleCount: 2 })} />)
    expect(screen.getByRole('button', { name: '2 cycles' })).toBeInTheDocument()
  })

  it('puts grouping, clipboard and history into a second row below the tool switch', () => {
    render(<Toolbar {...makeProps()} />)
    const tools = screen.getByRole('group', { name: 'Werkzeug' })
    const secondRow = screen.getByRole('group', { name: 'Gruppen' }).parentElement as HTMLElement
    expect(tools.closest('.toolbar__main')).toBe(secondRow.closest('.toolbar__main'))
    for (const name of ['Gruppen', 'Zwischenablage', 'Verlauf']) {
      expect(secondRow).toContainElement(screen.getByRole('group', { name }))
    }
    expect(secondRow).not.toContainElement(tools)
  })

  it('calls the matching handler for every button', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(<Toolbar {...props} />)

    await user.click(screen.getByRole('button', { name: 'Gruppieren' }))
    await user.click(screen.getByRole('button', { name: 'Gruppe auflösen' }))
    await user.click(screen.getByRole('button', { name: 'Löschen' }))
    await user.click(screen.getByRole('button', { name: 'Kopieren' }))
    await user.click(screen.getByRole('button', { name: 'Einfügen' }))
    await user.click(screen.getByRole('button', { name: 'Export' }))
    await user.click(screen.getByRole('button', { name: 'Import' }))
    await user.click(screen.getByRole('button', { name: 'JSON einfügen' }))

    expect(props.onGroup).toHaveBeenCalledTimes(1)
    expect(props.onUngroup).toHaveBeenCalledTimes(1)
    expect(props.onDelete).toHaveBeenCalledTimes(1)
    expect(props.onCopy).toHaveBeenCalledTimes(1)
    expect(props.onPaste).toHaveBeenCalledTimes(1)
    expect(props.onExport).toHaveBeenCalledTimes(1)
    expect(props.onImport).toHaveBeenCalledTimes(1)
    expect(props.onPasteJson).toHaveBeenCalledTimes(1)
  })

  it('has a search button in both modes that shows whether the field is open', async () => {
    const props = makeProps({ searchOpen: true })
    const { rerender } = render(<Toolbar {...props} />)
    const button = () => screen.getByRole('button', { name: 'Suchen' })

    expect(button()).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(button())
    expect(props.onToggleSearch).toHaveBeenCalledTimes(1)

    rerender(<Toolbar {...props} mode="analyze" searchOpen={false} />)
    expect(button()).toHaveAttribute('aria-pressed', 'false')
    await userEvent.hover(button())
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Enter')
  })

  it('disables copy and paste until there is something to copy or paste', async () => {
    render(<Toolbar {...makeProps({ canCopy: false, canPaste: false })} />)

    expect(screen.getByRole('button', { name: 'Kopieren' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Einfügen' })).toBeDisabled()
  })

  it('names the shortcuts of copy and paste', async () => {
    render(<Toolbar {...makeProps()} />)

    await userEvent.hover(screen.getByRole('button', { name: 'Kopieren' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Strg/Cmd + C')
  })

  it('disables group, ungroup and delete unless allowed', async () => {
    const user = userEvent.setup()
    const props = makeProps({ canGroup: false, canUngroup: false, canDelete: false })
    render(<Toolbar {...props} />)

    for (const label of ['Gruppieren', 'Gruppe auflösen', 'Löschen']) {
      expect(screen.getByRole('button', { name: label })).toBeDisabled()
    }
    expect(screen.getByRole('button', { name: 'Objekt anlegen' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Löschen' }))
    expect(props.onDelete).not.toHaveBeenCalled()
  })

  it('enables each action independently', () => {
    render(<Toolbar {...makeProps({ canGroup: true, canUngroup: false, canDelete: true })} />)

    expect(screen.getByRole('button', { name: 'Gruppieren' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Gruppe auflösen' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Löschen' })).toBeEnabled()
  })

  describe('tool switch', () => {
    it('is a labelled group of three buttons with a pressed state, the select tool by default', () => {
      render(<Toolbar {...makeProps()} />)

      const group = screen.getByRole('group', { name: 'Werkzeug' })
      expect(within(group).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
        'Auswählen',
        'Objekt anlegen',
        'Verbinden',
      ])
      expect(screen.getByRole('button', { name: 'Auswählen' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Objekt anlegen' })).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByRole('button', { name: 'Verbinden' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('shows icon and short text on every tool', () => {
      render(<Toolbar {...makeProps()} />)

      const group = screen.getByRole('group', { name: 'Werkzeug' })
      expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual([
        'Auswählen',
        'Objekt',
        'Verbinden',
      ])
      for (const button of within(group).getAllByRole('button')) {
        expect(button.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
      }
    })

    it('presses exactly the active tool', () => {
      render(<Toolbar {...makeProps({ tool: 'create' })} />)

      expect(screen.getByRole('button', { name: 'Auswählen' })).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByRole('button', { name: 'Objekt anlegen' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Verbinden' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('reports the chosen tool', async () => {
      const user = userEvent.setup()
      const props = makeProps()
      render(<Toolbar {...props} />)

      await user.click(screen.getByRole('button', { name: 'Objekt anlegen' }))
      expect(props.onToolChange).toHaveBeenLastCalledWith('create')
      await user.click(screen.getByRole('button', { name: 'Verbinden' }))
      expect(props.onToolChange).toHaveBeenLastCalledWith('connect')
      await user.click(screen.getByRole('button', { name: 'Auswählen' }))
      expect(props.onToolChange).toHaveBeenLastCalledWith('select')
    })

    it('names the shortcut in the tooltips', async () => {
      render(<Toolbar {...makeProps()} />)

      await userEvent.hover(screen.getByRole('button', { name: 'Objekt anlegen' }))
      const tip = await screen.findByRole('tooltip')
      expect(tip).toHaveTextContent('freie Stelle')
      expect(tip).toHaveTextContent('N')
    })

    it('is not offered in the analysis mode', () => {
      render(<Toolbar {...makeProps({ mode: 'analyze' })} />)

      expect(screen.queryByRole('group', { name: 'Werkzeug' })).not.toBeInTheDocument()
    })
  })

  describe('undo / redo', () => {
    it('are disabled when there is nothing to undo or redo', () => {
      render(<Toolbar {...makeProps({ canUndo: false, canRedo: false })} />)

      expect(screen.getByRole('button', { name: 'Rückgängig' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Wiederholen' })).toBeDisabled()
    })

    it('call their handlers', async () => {
      const props = makeProps()
      render(<Toolbar {...props} />)

      await userEvent.click(screen.getByRole('button', { name: 'Rückgängig' }))
      await userEvent.click(screen.getByRole('button', { name: 'Wiederholen' }))

      expect(props.onUndo).toHaveBeenCalledTimes(1)
      expect(props.onRedo).toHaveBeenCalledTimes(1)
    })

    it('are not offered in the analysis mode', () => {
      render(<Toolbar {...makeProps({ mode: 'analyze' })} />)

      expect(screen.queryByRole('button', { name: 'Rückgängig' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Wiederholen' })).not.toBeInTheDocument()
      expect(screen.queryByText('Verlauf')).not.toBeInTheDocument()
    })
  })

  describe('mode switch', () => {
    it('shows a decorative icon in front of each mode', () => {
      render(<Toolbar {...makeProps()} />)

      for (const name of ['Editieren', 'Analysieren']) {
        expect(screen.getByRole('button', { name }).querySelector('svg[aria-hidden="true"]')).not.toBeNull()
      }
    })

    it('is a labelled group of two pressed-state buttons', () => {
      render(<Toolbar {...makeProps({ mode: 'build' })} />)

      const group = screen.getByRole('group', { name: 'Arbeitsmodus' })
      expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Editieren', 'Analysieren'])
      expect(screen.getByRole('button', { name: 'Editieren' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Analysieren' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('reflects the analysis mode', () => {
      render(<Toolbar {...makeProps({ mode: 'analyze' })} />)

      expect(screen.getByRole('button', { name: 'Editieren' })).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByRole('button', { name: 'Analysieren' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('reports the chosen mode', async () => {
      const props = makeProps()
      render(<Toolbar {...props} />)

      await userEvent.click(screen.getByRole('button', { name: 'Analysieren' }))
      expect(props.onModeChange).toHaveBeenLastCalledWith('analyze')
      await userEvent.click(screen.getByRole('button', { name: 'Editieren' }))
      expect(props.onModeChange).toHaveBeenLastCalledWith('build')
    })

    it('explains both modes in tooltips', async () => {
      render(<Toolbar {...makeProps()} />)

      await userEvent.hover(screen.getByRole('button', { name: 'Analysieren' }))
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Die Struktur ist gesperrt')
    })

    it('comes right after the project name, before every other section', () => {
      render(<Toolbar {...makeProps()} />)

      const buttons = screen.getAllByRole('button').map((b) => b.textContent || b.getAttribute('aria-label'))
      expect(buttons.slice(0, 4)).toEqual(['Release-Management', 'Editieren', 'Analysieren', 'Auswählen'])
    })
  })

  describe('build mode', () => {
    it('shows the structure sections and no analysis controls', () => {
      render(<Toolbar {...makeProps({ mode: 'build' })} />)

      for (const name of ['Erstellen', 'Gruppen', 'Zwischenablage', 'Verlauf', 'Datei']) {
        expect(screen.getByRole('group', { name })).toBeInTheDocument()
      }
      expect(screen.queryByRole('group', { name: 'Analyse' })).not.toBeInTheDocument()
      expect(screen.queryByRole('combobox', { name: 'Hervorhebung' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Panel' })).not.toBeInTheDocument()
    })
  })

  describe('analysis mode', () => {
    const analyze = (overrides: Partial<ToolbarProps> = {}) => makeProps({ mode: 'analyze', ...overrides })

    it('hides every structure tool', () => {
      render(<Toolbar {...analyze()} />)

      for (const name of ['Objekt anlegen', 'Verbinden', 'Gruppieren', 'Gruppe auflösen', 'Löschen']) {
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
      }
      expect(screen.queryByRole('group', { name: 'Erstellen' })).not.toBeInTheDocument()
      expect(screen.queryByRole('group', { name: 'Gruppen' })).not.toBeInTheDocument()
      expect(screen.queryByRole('group', { name: 'Zwischenablage' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Kopieren' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Einfügen' })).not.toBeInTheDocument()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('keeps the file section but hides the history', () => {
      render(<Toolbar {...analyze()} />)

      expect(screen.getByRole('group', { name: 'Datei' })).toBeInTheDocument()
      expect(screen.queryByRole('group', { name: 'Verlauf' })).not.toBeInTheDocument()
      for (const name of ['Export', 'Import']) {
        expect(screen.getByRole('button', { name })).toBeEnabled()
      }
    })

    it('offers the five highlights, critical path first', () => {
      render(<Toolbar {...analyze()} />)

      const select = screen.getByRole('combobox', { name: 'Hervorhebung' })
      expect(within(select).getAllByRole('option').map((o) => [(o as HTMLOptionElement).value, o.textContent])).toEqual([
        ['critical', 'Kritischer Pfad'],
        ['outgoing', '→ Voraussetzungen'],
        ['incoming', '← Betroffene'],
        ['both', '↔ Beide'],
        ['off', 'Keine'],
      ])
      expect(select).toHaveValue('critical')
    })

    it('reports a changed highlight and shows the current one', async () => {
      const props = analyze()
      const { rerender } = render(<Toolbar {...props} />)

      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Hervorhebung' }), 'both')
      expect(props.onHighlightChange).toHaveBeenLastCalledWith('both')

      rerender(<Toolbar {...props} highlight="off" />)
      expect(screen.getByRole('combobox', { name: 'Hervorhebung' })).toHaveValue('off')
    })

    it('has a panel toggle with pressed state', async () => {
      const props = analyze({ panelVisible: false })
      const { rerender } = render(<Toolbar {...props} />)
      const button = screen.getByRole('button', { name: 'Panel' })
      expect(button).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByRole('group', { name: 'Analyse' })).toContainElement(button)

      await userEvent.click(button)
      expect(props.onTogglePanel).toHaveBeenCalledTimes(1)

      rerender(<Toolbar {...props} panelVisible />)
      expect(screen.getByRole('button', { name: 'Panel' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('explains the highlight and the panel in tooltips', async () => {
      render(<Toolbar {...analyze()} />)

      await userEvent.hover(screen.getByRole('combobox', { name: 'Hervorhebung' }))
      expect(await screen.findByRole('tooltip')).toHaveTextContent('längste Kette')
      await userEvent.unhover(screen.getByRole('combobox', { name: 'Hervorhebung' }))
      await userEvent.hover(screen.getByRole('button', { name: 'Panel' }))
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Release-Analyse-Panel')
    })

    it('tells the user to select something for a dependency highlight without selection', () => {
      const { rerender } = render(<Toolbar {...analyze({ highlight: 'outgoing', selectionEmpty: true })} />)
      expect(screen.getByRole('status')).toHaveTextContent('Objekt markieren')

      rerender(<Toolbar {...analyze({ highlight: 'outgoing', selectionEmpty: false })} />)
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('needs no selection for the critical path or without highlight', () => {
      const { rerender } = render(<Toolbar {...analyze({ highlight: 'critical', selectionEmpty: true })} />)
      expect(screen.queryByRole('status')).not.toBeInTheDocument()

      rerender(<Toolbar {...analyze({ highlight: 'off', selectionEmpty: true })} />)
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  describe('file section', () => {
    it('is the last group in both modes', () => {
      for (const mode of ['build', 'analyze'] as const) {
        const { unmount } = render(<Toolbar {...makeProps({ mode })} />)
        const groups = screen.getAllByRole('group')
        expect(groups.at(-1)).toHaveAccessibleName('Datei')
        expect(within(groups.at(-1)!).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
          'Export',
              'Import',
          'JSON einfügen',
        ])
        unmount()
      }
    })

    it('says that importing asks first and warns about unexported changes', async () => {
      render(<Toolbar {...makeProps()} />)

      await userEvent.hover(screen.getByRole('button', { name: 'Import' }))
      expect(await screen.findByRole('tooltip')).toHaveTextContent('nicht exportierten Änderungen')
    })
  })

  describe('cycle warning', () => {
    it('is absent without cycles', () => {
      render(<Toolbar {...makeProps({ cycleCount: 0 })} />)
      expect(screen.queryByRole('button', { name: /Zyklus|Zyklen/ })).not.toBeInTheDocument()
    })

    it('is shown in both modes', () => {
      for (const mode of ['build', 'analyze'] as const) {
        const { unmount } = render(<Toolbar {...makeProps({ mode, cycleCount: 3 })} />)
        expect(screen.getByRole('button', { name: /3 Zyklen/ })).toBeInTheDocument()
        unmount()
      }
    })

    it('shows the number of cycles and jumps to the next one on click', async () => {
      const props = makeProps({ cycleCount: 2 })
      render(<Toolbar {...props} />)

      const button = screen.getByRole('button', { name: /2 Zyklen/ })
      await userEvent.click(button)
      expect(props.onFocusCycle).toHaveBeenCalledTimes(1)
    })

    it('uses the singular for one cycle and explains itself in a tooltip', async () => {
      render(<Toolbar {...makeProps({ cycleCount: 1 })} />)

      const button = screen.getByRole('button', { name: /1 Zyklus/ })
      await userEvent.hover(button)
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Zyklische Abhängigkeiten verhindern')
    })
  })

  describe('icons and tooltips', () => {
    const iconButtons = ['Rückgängig', 'Wiederholen', 'Gruppieren', 'Gruppe auflösen']

    it('shows the four icon buttons without visible text but with an accessible name', () => {
      render(<Toolbar {...makeProps()} />)

      for (const name of iconButtons) {
        const button = screen.getByRole('button', { name })
        expect(button).toHaveTextContent('')
        expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
      }
    })

    it('explains undo with its shortcut on hover', async () => {
      render(<Toolbar {...makeProps()} />)

      await userEvent.hover(screen.getByRole('button', { name: 'Rückgängig' }))

      const tip = await screen.findByRole('tooltip')
      expect(tip).toHaveTextContent('Letzte Änderung rückgängig machen')
      expect(tip).toHaveTextContent('Strg/Cmd + Z')
    })

    it('explains redo with its shortcut on hover', async () => {
      render(<Toolbar {...makeProps()} />)

      await userEvent.hover(screen.getByRole('button', { name: 'Wiederholen' }))

      expect(await screen.findByRole('tooltip')).toHaveTextContent('Strg/Cmd + Umschalt + Z')
    })

    it('explains group and ungroup on hover', async () => {
      render(<Toolbar {...makeProps()} />)

      await userEvent.hover(screen.getByRole('button', { name: 'Gruppieren' }))
      expect(await screen.findByRole('tooltip')).toHaveTextContent('zu einer Gruppe')

      await userEvent.unhover(screen.getByRole('button', { name: 'Gruppieren' }))
      await userEvent.hover(screen.getByRole('button', { name: 'Gruppe auflösen' }))
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Inhalt bleibt erhalten')
    })

    it('tells why a disabled button is unavailable', async () => {
      render(<Toolbar {...makeProps({ canGroup: false, canUngroup: false, canUndo: false })} />)

      await userEvent.hover(screen.getByRole('button', { name: 'Gruppieren' }).parentElement!)
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Zuerst ein oder mehrere Objekte markieren')
    })

    it('does not show the "unavailable" hint while the action is possible', async () => {
      render(<Toolbar {...makeProps()} />)

      await userEvent.hover(screen.getByRole('button', { name: 'Rückgängig' }))

      expect(await screen.findByRole('tooltip')).not.toHaveTextContent('nichts rückgängig')
    })

    it('also explains the text buttons', async () => {
      render(<Toolbar {...makeProps()} />)

      await userEvent.hover(screen.getByRole('button', { name: 'Export' }))
      expect(await screen.findByRole('tooltip')).toHaveTextContent('JSON')
    })

    it('names the export formats in the Export tooltip and explains the JSON paste button', async () => {
      render(<Toolbar {...makeProps()} />)

      await userEvent.hover(screen.getByRole('button', { name: 'Export' }))
      expect(await screen.findByRole('tooltip')).toHaveTextContent(/JSON-Datei.*SVG.*Zwischenablage/)
      await userEvent.unhover(screen.getByRole('button', { name: 'Export' }))

      await userEvent.hover(screen.getByRole('button', { name: 'JSON einfügen' }))
      expect(await screen.findByText(/eingefügtem JSON-Text/)).toBeInTheDocument()
    })

    it('has no button to show the JSON any more', () => {
      render(<Toolbar {...makeProps()} />)

      expect(screen.queryByRole('button', { name: 'JSON anzeigen' })).not.toBeInTheDocument()
    })

    it('groups the buttons into labelled sections', () => {
      render(<Toolbar {...makeProps()} />)

      for (const name of ['Erstellen', 'Verlauf', 'Gruppen', 'Datei']) {
        expect(screen.getByRole('group', { name })).toBeInTheDocument()
      }
      const history = screen.getByRole('group', { name: 'Verlauf' })
      expect(history.querySelectorAll('button')).toHaveLength(2)
    })
  })
})
