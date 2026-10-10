import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ToolHint } from './ToolHint'

describe('ToolHint', () => {
  it('shows nothing for the select tool', () => {
    render(<ToolHint tool="select" sourcePicked={false} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('explains the create tool', () => {
    render(<ToolHint tool="create" sourcePicked={false} />)
    expect(screen.getByRole('status')).toHaveTextContent('Auf eine freie Stelle klicken')
  })

  it('asks for the source, then for the target, with the connect tool', () => {
    const { rerender } = render(<ToolHint tool="connect" sourcePicked={false} />)
    expect(screen.getByRole('status')).toHaveTextContent('Quelle anklicken …')
    rerender(<ToolHint tool="connect" sourcePicked />)
    expect(screen.getByRole('status')).toHaveTextContent('Ziel anklicken …')
  })
})
