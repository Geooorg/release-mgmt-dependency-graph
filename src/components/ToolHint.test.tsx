import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ToolHint } from './ToolHint'
import { setTestLocale } from '../test/locale'

describe('ToolHint', () => {
  it('shows nothing for the select tool', () => {
    render(<ToolHint tool="select" sourcePicked={false} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('explains the create tool', () => {
    render(<ToolHint tool="create" sourcePicked={false} />)
    expect(screen.getByRole('status')).toHaveTextContent('Auf eine freie Stelle klicken')
  })

  it('explains the frame tool', () => {
    render(<ToolHint tool="box" sourcePicked={false} />)
    expect(screen.getByRole('status')).toHaveTextContent('Rahmen aufziehen')
  })

  it('asks for the source, then for the target, with the connect tool', () => {
    const { rerender } = render(<ToolHint tool="connect" sourcePicked={false} />)
    expect(screen.getByRole('status')).toHaveTextContent('Quelle anklicken …')
    rerender(<ToolHint tool="connect" sourcePicked />)
    expect(screen.getByRole('status')).toHaveTextContent('Ziel anklicken …')
  })
})

describe('ToolHint language', () => {
  it.each([
    ['en', 'Click an empty spot to create an object …', 'Click the source …', 'Click the target …'],
    ['fr', 'Cliquez sur un emplacement libre pour créer un objet …', 'Cliquez sur la source …', 'Cliquez sur la cible …'],
  ] as const)('translates the hints in %s', (locale, create, source, target) => {
    setTestLocale(locale)
    const { rerender } = render(<ToolHint tool="create" sourcePicked={false} />)
    expect(screen.getByRole('status')).toHaveTextContent(create)
    rerender(<ToolHint tool="connect" sourcePicked={false} />)
    expect(screen.getByRole('status')).toHaveTextContent(source)
    rerender(<ToolHint tool="connect" sourcePicked />)
    expect(screen.getByRole('status')).toHaveTextContent(target)
  })
})
