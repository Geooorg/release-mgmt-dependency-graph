import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AnalysisPanel } from './AnalysisPanel'
import type { AnalysisEntry, AnalysisPanelProps } from './props'

const entry = (id: string, overrides: Partial<AnalysisEntry> = {}): AnalysisEntry => ({
  id,
  name: `Dienst ${id.toUpperCase()}`,
  status: 'offen',
  ready: false,
  blocked: false,
  ...overrides,
})

function makeProps(overrides: Partial<AnalysisPanelProps> = {}): AnalysisPanelProps {
  return {
    scope: 'selection',
    selectionNames: ['Dienst A'],
    counts: { done: 1, inProgress: 2, open: 3, blocked: 4, ready: 5 },
    criticalPath: {
      steps: [entry('c', { ready: true }), entry('b', { status: 'in Arbeit', blocked: true }), entry('a', { blocked: true })],
      length: 3,
    },
    cycleNames: [],
    blockers: [entry('c', { ready: true }), entry('b', { status: 'in Arbeit', blocked: true })],
    inconsistent: [],
    unknownStatus: [],
    onReveal: vi.fn(),
    onCopy: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
}

describe('AnalysisPanel', () => {
  it('is a labelled region titled with the selection', () => {
    render(<AnalysisPanel {...makeProps()} />)
    expect(screen.getByRole('complementary', { name: 'Release-Analyse' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Analyse: Dienst A')
  })

  it('titles the whole project when nothing is selected and shortens long selections', () => {
    const { rerender } = render(<AnalysisPanel {...makeProps({ scope: 'project', selectionNames: [] })} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Analyse: Gesamtes Projekt')

    rerender(<AnalysisPanel {...makeProps({ selectionNames: ['A', 'B', 'C', 'D', 'E'] })} />)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading).toHaveTextContent('Analyse: A, B, C und 2 weitere')
    expect(heading).toHaveAttribute('title', 'A, B, C, D, E')
  })

  it('shows the project counters', () => {
    render(<AnalysisPanel {...makeProps()} />)
    const counts = within(screen.getByRole('list', { name: 'Projektstand' }))
    expect(counts.getByText('fertig').closest('li')).toHaveTextContent('1 fertig')
    expect(counts.getByText('in Arbeit').closest('li')).toHaveTextContent('2 in Arbeit')
    expect(counts.getByText('offen').closest('li')).toHaveTextContent('3 offen')
    expect(counts.getByText('blockiert').closest('li')).toHaveTextContent('4 blockiert')
    expect(counts.getByText('jetzt umsetzbar').closest('li')).toHaveTextContent('5 jetzt umsetzbar')
  })

  it('lists the critical path as a numbered list in the given order, with status chips', () => {
    const { container } = render(<AnalysisPanel {...makeProps()} />)
    expect(screen.getByRole('heading', { name: 'Kritischer Pfad (3 Schritte)' })).toBeInTheDocument()

    const steps = [...container.querySelectorAll('ol.analysis-list > li')]
    expect(steps.map((li) => li.querySelector('.analysis-item__name')?.textContent)).toEqual([
      'Dienst C',
      'Dienst B',
      'Dienst A',
    ])
    expect(steps[1]).toHaveTextContent('in Arbeit')
    expect(steps[0]).toHaveTextContent('jetzt umsetzbar')
  })

  it('flags blocked entries and highlights those that are ready', () => {
    const { container } = render(<AnalysisPanel {...makeProps()} />)
    const blockers = screen.getByRole('heading', { name: 'Blockierende Objekte (2)' }).closest('section')!

    expect(within(blockers).getByText('jetzt umsetzbar')).toHaveClass('analysis-chip--ready')
    expect(blockers.querySelectorAll('.blocked-flag')).toHaveLength(1)
    expect(container.querySelectorAll('.analysis-panel .blocked-flag').length).toBeGreaterThan(1)
  })

  it('reveals an entry on click', async () => {
    const props = makeProps()
    render(<AnalysisPanel {...props} />)
    const blockers = screen.getByRole('heading', { name: 'Blockierende Objekte (2)' }).closest('section')!

    await userEvent.click(within(blockers).getByRole('button', { name: /Dienst B/ }))
    expect(props.onReveal).toHaveBeenCalledWith('b')
  })

  it('pluralizes a single step and explains an empty path', () => {
    const { rerender } = render(
      <AnalysisPanel {...makeProps({ criticalPath: { steps: [entry('a')], length: 1 } })} />,
    )
    expect(screen.getByRole('heading', { name: 'Kritischer Pfad (1 Schritt)' })).toBeInTheDocument()

    rerender(<AnalysisPanel {...makeProps({ criticalPath: { steps: [], length: 0 } })} />)
    expect(screen.getByRole('heading', { name: 'Kritischer Pfad (0 Schritte)' })).toBeInTheDocument()
    expect(screen.getByText('Kein offener Schritt.')).toBeInTheDocument()
  })

  it('warns instead of listing a path when a cycle is in the way', () => {
    const { container } = render(
      <AnalysisPanel {...makeProps({ criticalPath: null, cycleNames: ['Dienst P', 'Dienst Q'] })} />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Kritischer Pfad nicht berechenbar – Zyklus zwischen Dienst P, Dienst Q.',
    )
    expect(container.querySelector('ol')).toBeNull()
  })

  it('says a selection without open prerequisites can be released', () => {
    render(<AnalysisPanel {...makeProps({ blockers: [] })} />)
    expect(screen.getByText('Keine offenen Voraussetzungen – kann released werden.')).toBeInTheDocument()
  })

  it('splits the whole project into ready and blocked objects', () => {
    render(
      <AnalysisPanel
        {...makeProps({
          scope: 'project',
          selectionNames: [],
          blockers: [entry('c', { ready: true }), entry('b', { blocked: true }), entry('a', { blocked: true })],
        })}
      />,
    )
    const ready = screen.getByRole('heading', { name: 'Jetzt umsetzbar (1)' }).closest('section')!
    const blocked = screen.getByRole('heading', { name: 'Blockiert (2)' }).closest('section')!
    expect(within(ready).getAllByRole('button')).toHaveLength(1)
    expect(within(blocked).getAllByRole('button')).toHaveLength(2)
    expect(screen.queryByRole('heading', { name: /Blockierende Objekte/ })).not.toBeInTheDocument()
  })

  it('has empty states for the project sections', () => {
    render(<AnalysisPanel {...makeProps({ scope: 'project', selectionNames: [], blockers: [] })} />)
    expect(screen.getByText('Keine umsetzbaren Objekte.')).toBeInTheDocument()
    expect(screen.getByText('Keine blockierten Objekte.')).toBeInTheDocument()
  })

  describe('to clarify', () => {
    const inconsistent = [
      { id: 'c', name: 'Dienst C', waitingFor: [{ name: 'Dienst D', status: 'offen' as const }] },
      {
        id: 'x',
        name: 'Dienst X',
        waitingFor: [
          { name: 'Dienst Y', status: 'in Arbeit' as const },
          { name: 'Dienst Z', status: 'offen' as const },
        ],
      },
    ]
    const unknownStatus = [{ id: 'u', name: 'Dienst U', raw: 'erledigt' }]

    it('shows nothing when there is nothing to clarify', () => {
      render(<AnalysisPanel {...makeProps()} />)
      expect(screen.queryByRole('heading', { name: 'Zu klären' })).not.toBeInTheDocument()
      expect(screen.queryByText(/zu klären/)).not.toBeInTheDocument()
    })

    it('lists finished objects with unfinished prerequisites and what they wait for', () => {
      render(<AnalysisPanel {...makeProps({ inconsistent })} />)
      const section = screen.getByRole('heading', { name: 'Zu klären' }).closest('section')!

      expect(within(section).getByRole('heading', { name: 'Fertig trotz offener Voraussetzung (2)' })).toBeInTheDocument()
      expect(within(section).getAllByRole('button').map((b) => b.textContent)).toEqual([
        'Dienst C – wartet auf Dienst D (offen)',
        'Dienst X – wartet auf Dienst Y (in Arbeit), Dienst Z (offen)',
      ])
      expect(within(section).queryByRole('heading', { name: /Unbekannter Status/ })).not.toBeInTheDocument()
    })

    it('lists unknown status values', () => {
      render(<AnalysisPanel {...makeProps({ unknownStatus })} />)
      const section = screen.getByRole('heading', { name: 'Zu klären' }).closest('section')!

      expect(within(section).getByRole('heading', { name: 'Unbekannter Status (1)' })).toBeInTheDocument()
      expect(within(section).getByRole('button')).toHaveTextContent('Dienst U – „erledigt“ (zählt als offen)')
      expect(within(section).queryByRole('heading', { name: /Fertig trotz/ })).not.toBeInTheDocument()
    })

    it('counts all entries in a chip and reveals an entry on click', async () => {
      const props = makeProps({ inconsistent, unknownStatus })
      render(<AnalysisPanel {...props} />)

      const counts = within(screen.getByRole('list', { name: 'Projektstand' }))
      expect(counts.getByText('zu klären').closest('li')).toHaveTextContent('3 zu klären')

      await userEvent.click(screen.getByRole('button', { name: /Dienst X/ }))
      await userEvent.click(screen.getByRole('button', { name: /Dienst U/ }))
      expect(props.onReveal).toHaveBeenNthCalledWith(1, 'x')
      expect(props.onReveal).toHaveBeenNthCalledWith(2, 'u')
    })
  })

  it('copies and closes', async () => {
    const props = makeProps()
    render(<AnalysisPanel {...props} />)

    await userEvent.click(screen.getByRole('button', { name: 'Als Markdown kopieren' }))
    await userEvent.click(screen.getByRole('button', { name: 'Analyse schließen' }))
    expect(props.onCopy).toHaveBeenCalledTimes(1)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})
