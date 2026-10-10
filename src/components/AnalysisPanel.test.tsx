import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AnalysisPanel } from './AnalysisPanel'
import type { AnalysisEntry, AnalysisPanelProps, AnalysisSelected } from './props'

const entry = (id: string, overrides: Partial<AnalysisEntry> = {}): AnalysisEntry => ({
  id,
  name: `Dienst ${id.toUpperCase()}`,
  status: 'offen',
  ready: false,
  blocked: false,
  waiting: false,
  ...overrides,
})

function makeProps(overrides: Partial<AnalysisPanelProps> = {}): AnalysisPanelProps {
  return {
    selected: null,
    onStatusChange: vi.fn(),
    onBlockReasonChange: vi.fn(),
    onEditStart: vi.fn(),
    onEditEnd: vi.fn(),
    selfBlocked: [],
    scope: 'selection',
    selectionNames: ['Dienst A'],
    counts: { done: 1, inProgress: 2, open: 3, blocked: 4, waiting: 6, ready: 5 },
    criticalPath: {
      steps: [entry('c', { ready: true }), entry('b', { status: 'in Arbeit', waiting: true }), entry('a', { waiting: true })],
      length: 3,
    },
    cycleNames: [],
    unfinished: [entry('c', { ready: true }), entry('b', { status: 'in Arbeit', waiting: true, waitingFor: ['Dienst C'] })],
    selectionFinished: false,
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
    expect(counts.getByText('wartet').closest('li')).toHaveTextContent('6 wartet')
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

  it('marks waiting entries with the hourglass and highlights those that are ready', () => {
    const { container } = render(<AnalysisPanel {...makeProps()} />)
    const open = screen.getByRole('heading', { name: 'Offene Voraussetzungen (2)' }).closest('section')!

    expect(within(open).getByText('jetzt umsetzbar')).toHaveClass('analysis-chip--ready')
    expect(open.querySelectorAll('.waiting-mark')).toHaveLength(1)
    expect(open.querySelectorAll('.blocked-flag')).toHaveLength(0)
    expect(within(open).getByRole('button', { name: /Dienst B/ })).toHaveTextContent('wartet auf Dienst C')
    expect(container.querySelectorAll('ol.analysis-list .waiting-mark')).toHaveLength(2)
  })

  it('shows the flag and the reason of a blocked entry, or says there is none', () => {
    render(
      <AnalysisPanel
        {...makeProps({
          unfinished: [
            entry('l', { name: 'Lib', status: 'blockiert', blocked: true, reason: 'Freigabe fehlt' }),
            entry('k', { name: 'Kern', status: 'blockiert', blocked: true }),
          ],
        })}
      />,
    )
    const open = screen.getByRole('heading', { name: 'Offene Voraussetzungen (2)' }).closest('section')!
    const [lib, kern] = within(open).getAllByRole('button')
    expect(lib).toHaveTextContent('Lib')
    expect(lib).toHaveTextContent('Freigabe fehlt')
    expect(lib.querySelector('.blocked-flag')).toHaveAttribute('aria-label', 'Blockiert: Freigabe fehlt')
    expect(kern).toHaveTextContent('kein Grund angegeben')
    expect(kern.querySelector('.blocked-flag')).toHaveAttribute('aria-label', 'Blockiert (kein Grund angegeben)')
  })

  it('reveals an entry on click', async () => {
    const props = makeProps()
    render(<AnalysisPanel {...props} />)
    const blockers = screen.getByRole('heading', { name: 'Offene Voraussetzungen (2)' }).closest('section')!

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
    render(<AnalysisPanel {...makeProps({ unfinished: [] })} />)
    expect(screen.getByText('Keine offenen Voraussetzungen – kann released werden.')).toBeInTheDocument()
  })

  it('says a finished selection no longer looks at its prerequisites', () => {
    render(
      <AnalysisPanel
        {...makeProps({ unfinished: [], selectionFinished: true, criticalPath: { steps: [], length: 0 } })}
      />,
    )
    const section = screen.getByRole('heading', { name: 'Offene Voraussetzungen (0)' }).closest('section')!
    expect(within(section).getByText('Fertig – Voraussetzungen werden nicht mehr betrachtet.')).toBeInTheDocument()
    expect(screen.queryByText('Keine offenen Voraussetzungen – kann released werden.')).not.toBeInTheDocument()
  })

  describe('whole project', () => {
    const projectProps = (overrides: Partial<AnalysisPanelProps> = {}) =>
      makeProps({
        scope: 'project',
        selectionNames: [],
        unfinished: [
          entry('l', { name: 'Lib', status: 'blockiert', blocked: true, reason: 'Freigabe fehlt' }),
          entry('c', { ready: true }),
          entry('b', { waiting: true, waitingFor: ['Dienst C', 'Lib'] }),
          entry('a', { waiting: true, waitingFor: ['Dienst B'] }),
        ],
        ...overrides,
      })

    it('splits the project into blocked, ready and waiting objects, in this order', () => {
      render(<AnalysisPanel {...projectProps()} />)
      const blocked = screen.getByRole('heading', { name: 'Blockiert (1)' }).closest('section')!
      const ready = screen.getByRole('heading', { name: 'Jetzt umsetzbar (1)' }).closest('section')!
      const waiting = screen.getByRole('heading', { name: 'Wartet (2)' }).closest('section')!
      expect(within(blocked).getAllByRole('button')).toHaveLength(1)
      expect(within(blocked).getByRole('button')).toHaveTextContent('Freigabe fehlt')
      expect(within(ready).getAllByRole('button')).toHaveLength(1)
      expect(within(waiting).getAllByRole('button').map((b) => b.textContent)).toEqual([
        expect.stringContaining('wartet auf Dienst C, Lib'),
        expect.stringContaining('wartet auf Dienst B'),
      ])
      expect(screen.queryByRole('heading', { name: /Offene Voraussetzungen/ })).not.toBeInTheDocument()

      const order = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
      expect(order).toEqual(['Blockiert (1)', 'Jetzt umsetzbar (1)', 'Wartet (2)', 'Kritischer Pfad (3 Schritte)'])
    })

    it('puts "Zu klären" in front of the lists', () => {
      render(<AnalysisPanel {...projectProps({ unknownStatus: [{ id: 'u', name: 'U', raw: 'x' }] })} />)
      expect(screen.getAllByRole('heading', { level: 3 })[0]).toHaveTextContent('Zu klären')
    })

    it('has empty states for the project sections', () => {
      render(<AnalysisPanel {...makeProps({ scope: 'project', selectionNames: [], unfinished: [] })} />)
      expect(screen.getByText('Keine blockierten Objekte.')).toBeInTheDocument()
      expect(screen.getByText('Keine umsetzbaren Objekte.')).toBeInTheDocument()
      expect(screen.getByText('Keine wartenden Objekte.')).toBeInTheDocument()
    })
  })

  it('cuts a long list of what an entry waits for after five names', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F']
    render(<AnalysisPanel {...makeProps({ unfinished: [entry('x', { waiting: true, waitingFor: names })] })} />)
    expect(screen.getByRole('button', { name: /Dienst X/ })).toHaveTextContent('wartet auf A, B, C, D, E, …')
  })

  describe('selection is blocked itself', () => {
    it('shows nothing otherwise', () => {
      render(<AnalysisPanel {...makeProps()} />)
      expect(screen.queryByRole('region', { name: 'Auswahl ist blockiert' })).not.toBeInTheDocument()
    })

    it('says so at the top, with flag and reason', () => {
      render(
        <AnalysisPanel
          {...makeProps({
            selfBlocked: [
              { id: 'a', name: 'Dienst A', reason: 'Freigabe fehlt' },
              { id: 'b', name: 'Dienst B' },
            ],
          })}
        />,
      )
      const banner = screen.getByRole('region', { name: 'Auswahl ist blockiert' })
      expect(banner).toHaveTextContent('Dienst A ist blockiert – Freigabe fehlt')
      expect(banner).toHaveTextContent('Dienst B ist blockiert – kein Grund angegeben')
      expect(banner.querySelectorAll('.blocked-flag')).toHaveLength(2)
      expect(banner.compareDocumentPosition(screen.getByRole('list', { name: 'Projektstand' }))).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
    })
  })

  describe('legend', () => {
    it('is a collapsed "Zeichen erklärt" at the end of the panel', () => {
      const { container } = render(<AnalysisPanel {...makeProps()} />)
      const legend = container.querySelector('details.analysis-legend')!
      expect(legend).not.toHaveAttribute('open')
      expect(legend.querySelector('summary')).toHaveTextContent('Zeichen erklärt')
      expect(container.querySelector('.analysis-panel__body')!.lastElementChild).toBe(legend)
    })

    it('explains every mark with the same icon as on the box', () => {
      const { container } = render(<AnalysisPanel {...makeProps()} />)
      const legend = container.querySelector('details.analysis-legend')!
      const rows = [...legend.querySelectorAll('li')]
      const textOf = (selector: string) => legend.querySelector(selector)!.closest('li')!.textContent

      expect(rows).toHaveLength(6)
      expect(textOf('.blocked-flag')).toMatch(/Rote Flagge.*blockiert.*manuell/)
      expect(textOf('.waiting-mark')).toMatch(/Sanduhr.*wartet.*Voraussetzung/)
      expect(textOf('.status-mark--done')).toMatch(/Häkchen.*fertig/)
      expect(textOf('.status-mark--progress')).toMatch(/Halbkreis.*in Arbeit/)
      expect(textOf('.status-mark--open')).toMatch(/Kreis.*offen/)
      expect(textOf('.status-mark--unknown')).toMatch(/„\?“.*unbekannt/)
      // decorative: the explanation is the text
      expect([...legend.querySelectorAll('li > span:first-child')].every((el) => el.getAttribute('aria-hidden') === 'true')).toBe(true)
    })
  })

  describe('to clarify', () => {
    const unknownStatus = [
      { id: 'u', name: 'Dienst U', raw: 'erledigt' },
      { id: 'v', name: 'Dienst V', raw: 'bald' },
    ]

    it('shows nothing when there is nothing to clarify', () => {
      render(<AnalysisPanel {...makeProps()} />)
      expect(screen.queryByRole('heading', { name: 'Zu klären' })).not.toBeInTheDocument()
      expect(within(screen.getByRole('list', { name: 'Projektstand' })).queryByText('zu klären')).not.toBeInTheDocument()
    })

    it('lists unknown status values and nothing else', () => {
      render(<AnalysisPanel {...makeProps({ unknownStatus })} />)
      const section = screen.getByRole('heading', { name: 'Zu klären' }).closest('section')!

      expect(within(section).getByRole('heading', { name: 'Unbekannter Status (2)' })).toBeInTheDocument()
      expect(within(section).getAllByRole('button').map((b) => b.textContent)).toEqual([
        'Dienst U – „erledigt“ (zählt als offen)',
        'Dienst V – „bald“ (zählt als offen)',
      ])
      expect(within(section).getAllByRole('heading', { level: 4 })).toHaveLength(1)
    })

    it('counts the entries in a chip and reveals an entry on click', async () => {
      const props = makeProps({ unknownStatus })
      render(<AnalysisPanel {...props} />)

      const counts = within(screen.getByRole('list', { name: 'Projektstand' }))
      expect(counts.getByText('zu klären').closest('li')).toHaveTextContent('2 zu klären')

      await userEvent.click(screen.getByRole('button', { name: /Dienst V/ }))
      expect(props.onReveal).toHaveBeenCalledWith('v')
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

  describe('selection status', () => {
    const selectedNode = (status: string, reason = ''): AnalysisSelected => ({
      id: 'a',
      name: 'Dienst A',
      kind: 'node',
      status,
      reason,
    })

    it('shows no block without a single selected element', () => {
      render(<AnalysisPanel {...makeProps({ selected: null })} />)
      expect(screen.queryByRole('region', { name: 'Auswahl' })).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
    })

    it('names the selected object and offers the four statuses', () => {
      render(<AnalysisPanel {...makeProps({ selected: selectedNode('in Arbeit') })} />)

      const block = screen.getByRole('region', { name: 'Auswahl' })
      expect(block).toHaveTextContent('Auswahl: Dienst A')
      const select = within(block).getByLabelText('Status')
      expect(select).toHaveValue('in Arbeit')
      expect([...(select as HTMLSelectElement).options].map((o) => o.value)).toEqual([
        'offen',
        'in Arbeit',
        'blockiert',
        'fertig',
      ])
    })

    it('shows "offen" when no status is set', () => {
      render(<AnalysisPanel {...makeProps({ selected: selectedNode('') })} />)
      expect(screen.getByLabelText('Status')).toHaveValue('offen')
    })

    it('reports a chosen status', async () => {
      const props = makeProps({ selected: selectedNode('offen') })
      render(<AnalysisPanel {...props} />)

      await userEvent.selectOptions(screen.getByLabelText('Status'), 'fertig')
      expect(props.onStatusChange).toHaveBeenCalledWith('fertig')
    })

    it('offers an unknown value as an extra option and keeps it selected', () => {
      render(<AnalysisPanel {...makeProps({ selected: selectedNode('erledigt') })} />)

      const select = screen.getByLabelText('Status') as HTMLSelectElement
      expect(select).toHaveValue('erledigt')
      expect([...select.options].map((o) => o.textContent)).toContain('erledigt (unbekannt)')
    })

    describe('reason', () => {
      it('is only offered while the object is blocked', () => {
        const { rerender } = render(<AnalysisPanel {...makeProps({ selected: selectedNode('in Arbeit') })} />)
        expect(screen.queryByLabelText('Grund')).not.toBeInTheDocument()

        rerender(<AnalysisPanel {...makeProps({ selected: selectedNode('blockiert', 'Freigabe fehlt') })} />)
        expect(screen.getByLabelText('Grund')).toHaveValue('Freigabe fehlt')
        expect(screen.getByLabelText('Status')).toHaveValue('blockiert')
      })

      it('reports every change at once (live) and brackets the edit', async () => {
        const props = makeProps()
        function Owner() {
          const [reason, setReason] = useState('')
          return (
            <AnalysisPanel
              {...props}
              selected={selectedNode('blockiert', reason)}
              onBlockReasonChange={(r) => {
                props.onBlockReasonChange(r)
                setReason(r.trim())
              }}
            />
          )
        }
        render(<Owner />)

        await userEvent.type(screen.getByLabelText('Grund'), 'Lizenz offen')
        expect(props.onBlockReasonChange).toHaveBeenCalledTimes('Lizenz offen'.length)
        expect(props.onBlockReasonChange).toHaveBeenLastCalledWith('Lizenz offen')
        expect(props.onEditStart).toHaveBeenCalled()
        expect(props.onEditEnd).not.toHaveBeenCalled()

        await userEvent.tab()
        expect(props.onEditEnd).toHaveBeenCalledTimes(1)
      })

      it('keeps what was typed (blanks included) although the owner holds the trimmed text', async () => {
        function Owner() {
          const [reason, setReason] = useState('')
          return (
            <AnalysisPanel
              {...makeProps({ selected: selectedNode('blockiert', reason), onBlockReasonChange: (r) => setReason(r.trim()) })}
            />
          )
        }
        render(<Owner />)
        await userEvent.type(screen.getByLabelText('Grund'), 'Freigabe fehlt ')
        expect(screen.getByLabelText('Grund')).toHaveValue('Freigabe fehlt ')
      })

      it('shows a changed reason from outside (undo)', () => {
        const { rerender } = render(<AnalysisPanel {...makeProps({ selected: selectedNode('blockiert', 'alt') })} />)
        rerender(<AnalysisPanel {...makeProps({ selected: selectedNode('blockiert', 'neu') })} />)
        expect(screen.getByLabelText('Grund')).toHaveValue('neu')
      })

      it('is not offered for a group', () => {
        const group: AnalysisSelected = { id: 'g', name: 'G', kind: 'group', status: 'blockiert', reason: 'x' }
        render(<AnalysisPanel {...makeProps({ selected: group })} />)
        expect(screen.queryByLabelText('Grund')).not.toBeInTheDocument()
      })
    })

    it('shows the progress of a group read-only', () => {
      const group: AnalysisSelected = { id: 'g', name: 'Plattform', kind: 'group', status: '', reason: '', progress: { done: 2, total: 5 } }
      render(<AnalysisPanel {...makeProps({ selected: group })} />)

      const block = screen.getByRole('region', { name: 'Auswahl' })
      expect(block).toHaveTextContent('Auswahl: Plattform')
      expect(block).toHaveTextContent('Status aus Mitgliedern: 2 von 5 fertig')
      expect(within(block).queryByLabelText('Status')).not.toBeInTheDocument()
    })
  })
})
