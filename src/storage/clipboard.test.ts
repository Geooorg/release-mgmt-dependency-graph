import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText } from './clipboard'

function stubClipboard(writeText: ((text: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  })
}

function stubExecCommand(result: boolean) {
  const exec = vi.fn(() => result)
  Object.defineProperty(document, 'execCommand', { configurable: true, value: exec })
  return exec
}

describe('copyText', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    stubClipboard(undefined)
  })

  it('uses the Clipboard API when available', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    stubClipboard(writeText)
    const exec = stubExecCommand(true)
    expect(await copyText('abc')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('abc')
    expect(exec).not.toHaveBeenCalled()
  })

  it('falls back to the selection copy when the Clipboard API is denied', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')))
    const exec = stubExecCommand(true)
    expect(await copyText('abc')).toBe(true)
    expect(exec).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('falls back when there is no Clipboard API (plain http)', async () => {
    stubClipboard(undefined)
    stubExecCommand(true)
    expect(await copyText('abc')).toBe(true)
  })

  it('reports failure when nothing works', async () => {
    stubClipboard(undefined)
    stubExecCommand(false)
    expect(await copyText('abc')).toBe(false)
  })
})
