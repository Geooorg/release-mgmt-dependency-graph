/**
 * Copies `text` to the clipboard; resolves with whether it worked. The Clipboard API only exists in
 * secure contexts (https, localhost) and may be denied, so a plain `http://` intranet host falls
 * back to the legacy selection copy. Must be called from a user-gesture handler.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Denied: try the fallback below.
  }
  return copyViaSelection(text)
}

function copyViaSelection(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.append(area)
  area.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
  }
}
