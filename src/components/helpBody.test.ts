import { describe, expect, it } from 'vitest'
import { parseHelpBody } from './helpBody'

describe('parseHelpBody', () => {
  it('turns lines into paragraphs and groups consecutive "- " lines into one list', () => {
    expect(parseHelpBody('Intro\n- eins\n- zwei\nSchluss')).toEqual([
      { kind: 'paragraph', text: 'Intro' },
      { kind: 'list', items: ['eins', 'zwei'] },
      { kind: 'paragraph', text: 'Schluss' },
    ])
  })

  it('ignores blank lines and trims', () => {
    expect(parseHelpBody('\n  - a  \n\n- b\n')).toEqual([{ kind: 'list', items: ['a', 'b'] }])
  })
})
