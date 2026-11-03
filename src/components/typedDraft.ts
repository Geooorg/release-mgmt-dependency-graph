import type { MetadataEntry } from '../model/types'
import type { SidebarTyping } from './props'

/** The part of a sidebar draft that belongs to the element's type. */
export interface TypedPart {
  /** Type id, '' = none. */
  typeId: string
  /** Values of the fields of the type, by key. */
  typed: Record<string, string>
  /** Free rows (all other entries) – only the keys and values matter here. */
  rows: MetadataEntry[]
}

/** The draft after choosing `nextId`: old values become free rows, matching free rows become field values, the rest gets defaults. */
export function switchType(part: TypedPart, nextId: string, typing: SidebarTyping): TypedPart {
  const nextFields = nextId === '' ? [] : (typing.fieldsOf(nextId) ?? [])
  const nextKeys = new Set(nextFields.map((field) => field.key))
  const leftOver = Object.entries(part.typed)
    .filter(([key]) => !nextKeys.has(key))
    .map(([key, value]) => ({ key, value }))
  const adopted = new Map(part.rows.filter((row) => nextKeys.has(row.key)).map((row) => [row.key, row.value]))
  const rows = [...part.rows.filter((row) => !nextKeys.has(row.key)), ...leftOver]
  const typed: Record<string, string> = {}
  for (const field of nextFields) {
    typed[field.key] = part.typed[field.key] ?? adopted.get(field.key) ?? field.default
  }
  return { typeId: nextId, typed, rows }
}
