import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'
import type { ConfirmDialogProps } from './props'

function makeProps(overrides: Partial<ConfirmDialogProps> = {}): ConfirmDialogProps {
  return {
    open: true,
    title: 'Objekt löschen?',
    message: 'Das Objekt und seine Verbindungen werden entfernt.',
    confirmLabel: 'Löschen',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  }
}

function getDialog(container: HTMLElement): HTMLDialogElement {
  const dialog = container.querySelector('dialog')
  if (!dialog) throw new Error('no <dialog> rendered')
  return dialog
}

/** Installs showModal/close stubs that behave like the native ones (sets/removes `open`). */
function stubNativeDialog() {
  const showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  const close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { value: showModal, configurable: true })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { value: close, configurable: true })
  return { showModal, close }
}

describe('ConfirmDialog', () => {
  afterEach(() => {
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
  })

  it('shows title, message and both buttons with default cancel label', () => {
    render(<ConfirmDialog {...makeProps()} />)

    expect(screen.getByRole('dialog', { name: 'Objekt löschen?' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Objekt löschen?' })).toBeInTheDocument()
    expect(screen.getByText('Das Objekt und seine Verbindungen werden entfernt.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Löschen' })).toBeInTheDocument()
  })

  it('uses a custom cancel label', () => {
    render(<ConfirmDialog {...makeProps({ cancelLabel: 'Zurück' })} />)

    expect(screen.getByRole('button', { name: 'Zurück' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abbrechen' })).not.toBeInTheDocument()
  })

  it('opens via the open attribute when showModal is unavailable (jsdom)', () => {
    const { container, rerender } = render(<ConfirmDialog {...makeProps({ open: false })} />)
    expect(getDialog(container)).not.toHaveAttribute('open')

    rerender(<ConfirmDialog {...makeProps({ open: true })} />)
    expect(getDialog(container)).toHaveAttribute('open')

    rerender(<ConfirmDialog {...makeProps({ open: false })} />)
    expect(getDialog(container)).not.toHaveAttribute('open')
  })

  it('opens modally with showModal and closes with close when available', () => {
    const { showModal, close } = stubNativeDialog()
    const { container, rerender } = render(<ConfirmDialog {...makeProps({ open: false })} />)
    expect(showModal).not.toHaveBeenCalled()

    rerender(<ConfirmDialog {...makeProps({ open: true })} />)
    expect(showModal).toHaveBeenCalledTimes(1)
    expect(getDialog(container)).toHaveAttribute('open')

    rerender(<ConfirmDialog {...makeProps({ open: true, title: 'Anderer Titel' })} />)
    expect(showModal).toHaveBeenCalledTimes(1)

    rerender(<ConfirmDialog {...makeProps({ open: false })} />)
    expect(close).toHaveBeenCalledTimes(1)
    expect(getDialog(container)).not.toHaveAttribute('open')
  })

  it('calls onConfirm and onCancel from the buttons', async () => {
    const user = userEvent.setup()
    const props = makeProps()
    render(<ConfirmDialog {...props} />)

    await user.click(screen.getByRole('button', { name: 'Löschen' }))
    expect(props.onConfirm).toHaveBeenCalledTimes(1)
    expect(props.onCancel).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(props.onCancel).toHaveBeenCalledTimes(1)
    expect(props.onConfirm).toHaveBeenCalledTimes(1)
  })

  it('treats the native cancel event (Escape) as cancel and leaves closing to the parent', () => {
    const props = makeProps()
    const { container } = render(<ConfirmDialog {...props} />)

    const cancelEvent = new Event('cancel', { cancelable: true })
    fireEvent(getDialog(container), cancelEvent)

    expect(props.onCancel).toHaveBeenCalledTimes(1)
    expect(props.onConfirm).not.toHaveBeenCalled()
    expect(cancelEvent.defaultPrevented).toBe(true)
  })
})
