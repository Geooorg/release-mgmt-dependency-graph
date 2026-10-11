import { Fragment, type ReactNode } from 'react'

const MARKUP = /<(c|l)>(.*?)<\/\1>/g

interface RichTextProps {
  /** Translated text; `<c>…</c>` marks code, `<l>…</l>` the link to `href`. */
  text: string
  href?: string
}

/** Renders the little markup of the agent help catalog entries, so code and links stay out of the translations' grammar. */
export function RichText({ text, href }: RichTextProps) {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(MARKUP)) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const [, tag, content] = match
    parts.push(
      tag === 'c' ? <code key={match.index}>{content}</code> : <a key={match.index} href={href}>{content}</a>,
    )
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <Fragment>{parts}</Fragment>
}
