import { describe, expect, it } from 'vitest'
import { switchType } from './typedDraft'
import type { SidebarTyping } from './props'

const e = (key: string, value: string) => ({ key, value })
const typing: SidebarTyping = {
  choices: [],
  fieldsOf: (id) =>
    id === 't1'
      ? [{ key: 'owner', kind: 'text', options: [], required: false, default: '' }]
      : id === 't2'
        ? [{ key: 'env', kind: 'select', options: ['prod'], required: false, default: 'prod' }]
        : undefined,
}

describe('switchType', () => {
  it('moves values of the old type to free rows and fills the new fields from defaults', () => {
    const next = switchType({ typeId: 't1', typed: { owner: 'Anna' }, rows: [] }, 't2', typing)
    expect(next.typeId).toBe('t2')
    expect(next.typed).toEqual({ env: 'prod' })
    expect(next.rows).toEqual([e('owner', 'Anna')])
  })

  it('adopts a free row with the same key as the value of the new field', () => {
    const next = switchType({ typeId: '', typed: {}, rows: [e('owner', 'Bernd'), e('x', '1')] }, 't1', typing)
    expect(next.typed).toEqual({ owner: 'Bernd' })
    expect(next.rows).toEqual([e('x', '1')])
  })

  it('removing the type turns every typed value into a free row', () => {
    const next = switchType({ typeId: 't1', typed: { owner: 'Anna' }, rows: [] }, '', typing)
    expect(next).toEqual({ typeId: '', typed: {}, rows: [e('owner', 'Anna')] })
  })
})
