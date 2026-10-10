export const HELP_SECTIONS = [
  'start',
  'objects',
  'connect',
  'sidebar',
  'status',
  'analysis',
  'search',
  'clipboard',
  'file',
  'shortcuts',
] as const
export type HelpSection = (typeof HELP_SECTIONS)[number]

export type HelpBlock = { kind: 'paragraph'; text: string } | { kind: 'list'; items: string[] }

/** Help texts are plain lines: "- " starts a list item (consecutive ones form one list), anything else is a paragraph. */
export function parseHelpBody(body: string): HelpBlock[] {
  const blocks: HelpBlock[] = []
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (line === '') continue
    if (line.startsWith('- ')) {
      const item = line.slice(2).trim()
      const last = blocks[blocks.length - 1]
      if (last?.kind === 'list') last.items.push(item)
      else blocks.push({ kind: 'list', items: [item] })
    } else {
      blocks.push({ kind: 'paragraph', text: line })
    }
  }
  return blocks
}
