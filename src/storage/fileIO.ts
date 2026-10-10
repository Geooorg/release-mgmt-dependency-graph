/** Triggers a browser download of `text` as a file. */
export function downloadTextFile(filename: string, text: string, mimeType = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Opens the native file picker and resolves with the file's text, or null if the user cancels.
 * Must be called from a user-gesture handler (browsers block programmatic file pickers otherwise).
 */
export function pickTextFile(accept = '.json,application/json'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      file.text().then(resolve, () => resolve(null))
    })
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}
