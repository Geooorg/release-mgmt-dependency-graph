import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar } from './Toolbar'
import type { ToolbarProps } from './props'

function makeProps(overrides: Partial<ToolbarProps> = {}): ToolbarProps {
  return {
    projectName: 'Release-Management',
    onRenameProject: vi.fn(),
    mode: 'build',
    onModeChange: vi.fn(),
    connectMode: 'off',
    canGroup: true,
    canUngroup: true,
    canDelete: true,
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
    onAddNode: vi.fn(),
    onToggleConnect: vi.fn(),
    onGroup: vi.fn(),
    onUngroup: vi.fn(),
    onDelete: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
    ...overrides,
  }
}

describe('Toolbar', () => {
  it('renders a labelled toolbar with the title and the build mode buttons', () => {
    render(<Toolbar {...makeProps()} />)

    expect(screen.getByRole('toolbar', { name: 'Werkzeuge' })).toBeInTheDocument()
    expect(screen.getByText('Release-Management')).toBeInTheDocument()
    for (const label of [
      'Aufbauen',
      'Analysieren',
      'Objekt anlegen',
      'Verbinden',
      'Gruppieren',
      'Gruppe auflösen',
      'Löschen',
      'Rückgängig',
      'Wiederholen',
      'Export',
      'Import',
    ]) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('type', 'button')
    }
    expect(screen.getAllByRole('separator')).toHaveLength(4)
  })

  it('calls the matching handler for every button', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(<Toolbar {...props} />)

    await user.click(screen.getByRole('button', { name: 'Objekt anlegen' }))
    await user.click(screen.getByRole('button', { name: 'Verbinden' }))
    await user.click(screen.getByRole('button', { name: 'Gruppieren' }))
    await user.click(screen.getByRole('button', { name: 'Gruppe auflösen' }))
    await user.click(screen.getByRole('button', { name: 'Löschen' }))
    await user.click(screen.getByRole('button', { name: 'Export' }))
    await user.click(screen.getByRole('button', { name: 'Import' }))

    expect(props.onAddNode).toHaveBeenCalledTimes(1)
    expect(props.onToggleConnect).toHaveBeenCalledTimes(1)
    expect(props.onGroup).toHaveBeenCalledTimes(1)
    expect(props.onUngroup).toHaveBeenCalledTimes(1)
    expect(props.onDelete).toHaveBeenCalledTimes(1)
    expect(props.onExport).toHaveBeenCalledTimes(1)
    expect(props.onImport).toHaveBeenCalledTimes(1)
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

  it('shows the connect toggle as not pressed and no hint when off', () => {
    render(<Toolbar {...makeProps({ connectMode: 'off' })} />)

    expect(screen.getByRole('button', { name: 'Verbinden' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows a source hint while picking the source', () => {
    render(<Toolbar {...makeProps({ connectMode: 'pickSource' })} />)

    expect(screen.getByRole('button', { name: 'Verbinden' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Quelle wählen …')
  })

  it('shows a target hint while picking the target', () => {
    render(<Toolbar {...makeProps({ connectMode: 'pickTarget' })} />)

    expect(screen.getByRole('button', { name: 'Verbinden' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Ziel wählen …')
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
  })

  describe('mode switch', () => {
    it('is a labelled group of two pressed-state buttons', () => {
      render(<Toolbar {...makeProps({ mode: 'build' })} />)

      const group = screen.getByRole('group', { name: 'Arbeitsmodus' })
      expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Aufbauen', 'Analysieren'])
      expect(screen.getByRole('button', { name: 'Aufbauen' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Analysieren' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('reflects the analysis mode', () => {
      render(<Toolbar {...makeProps({ mode: 'analyze' })} />)

      expect(screen.getByRole('button', { name: 'Aufbauen' })).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByRole('button', { name: 'Analysieren' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('reports the chosen mode', async () => {
      const props = makeProps()
      render(<Toolbar {...props} />)

      await userEvent.click(screen.getByRole('button', { name: 'Analysieren' }))
      expect(props.onModeChange).toHaveBeenLastCalledWith('analyze')
      await userEvent.click(screen.getByRole('button', { name: 'Aufbauen' }))
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
      expect(buttons.slice(0, 4)).toEqual(['Release-Management', 'Aufbauen', 'Analysieren', 'Objekt anlegen'])
    })
  })

  describe('build mode', () => {
    it('shows the structure sections and no analysis controls', () => {
      render(<Toolbar {...makeProps({ mode: 'build' })} />)

      for (const name of ['Erstellen', 'Gruppen', 'Verlauf', 'Datei']) {
        expect(screen.getByRole('group', { name })).toBeInTheDocument()
      }
      expect(screen.queryByRole('group', { name: 'Analyse' })).not.toBeInTheDocument()
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
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
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('keeps history and file sections', () => {
      render(<Toolbar {...analyze()} />)

      for (const name of ['Verlauf', 'Datei']) {
        expect(screen.getByRole('group', { name })).toBeInTheDocument()
      }
      for (const name of ['Rückgängig', 'Wiederholen', 'Export', 'Import']) {
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
        expect(within(groups.at(-1)!).getAllByRole('button').map((b) => b.textContent)).toEqual(['Export', 'Import'])
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
