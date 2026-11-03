import { getColor } from './metadata'
import { CLASS_KEY, ENTITY_KEY, VERSION_KEY } from './objectFields'
import { isOptionalKey } from './softDependency'
import { isBlockReasonKey, isStatusKey } from './status'
import { COLOR_KEY, NAME_KEY, TYPE_KEY } from './types'
import type { MetadataEntry, TypeDef } from './types'

/**
 * An element's type is the metadata entry `type` holding a type id. Like `status` and `class` it is an
 * ordinary entry; read and write it only here. Order: name, color, status, blockiert_grund, optional,
 * type, class, entity, version, type fields, free fields.
 */
export type ResolvedType =
  | { state: 'none' }
  | { state: 'known'; def: TypeDef }
  | { state: 'unknown'; id: string }

const OBJECT_TAIL: readonly string[] = [CLASS_KEY, ENTITY_KEY, VERSION_KEY]

function isLeadingKey(key: string): boolean {
  return (
    key === NAME_KEY ||
    key === COLOR_KEY ||
    key === TYPE_KEY ||
    OBJECT_TAIL.includes(key) ||
    isStatusKey(key) ||
    isBlockReasonKey(key) ||
    isOptionalKey(key)
  )
}

/** Length of the run of fixed entries at the start; type fields go right behind it. */
function leadingEnd(entries: readonly MetadataEntry[]): number {
  let at = 0
  while (at < entries.length && isLeadingKey(entries[at].key)) at += 1
  return at
}

/** The (trimmed) type id, or undefined when there is no entry or it is blank. */
export function getTypeId(entries: readonly MetadataEntry[]): string | undefined {
  const value = entries.find((entry) => entry.key === TYPE_KEY)?.value.trim()
  return value === undefined || value === '' ? undefined : value
}

export function resolveType(entries: readonly MetadataEntry[], types: readonly TypeDef[]): ResolvedType {
  const id = getTypeId(entries)
  if (id === undefined) return { state: 'none' }
  const def = types.find((type) => type.id === id)
  return def === undefined ? { state: 'unknown', id } : { state: 'known', def }
}

/**
 * The entries with `type` set (in place, or in front of class/entity/version); `undefined` removes it.
 * Values of type fields stay either way. Not normalized.
 */
export function withTypeEntry(entries: readonly MetadataEntry[], typeId: string | undefined): MetadataEntry[] {
  if (typeId === undefined) return entries.filter((entry) => entry.key !== TYPE_KEY)
  if (entries.some((entry) => entry.key === TYPE_KEY)) {
    return entries.map((entry) => (entry.key === TYPE_KEY ? { key: TYPE_KEY, value: typeId } : entry))
  }
  const run = leadingEnd(entries)
  const firstTail = entries.findIndex((entry, i) => i < run && OBJECT_TAIL.includes(entry.key))
  const at = firstTail === -1 ? run : firstTail
  return [...entries.slice(0, at), { key: TYPE_KEY, value: typeId }, ...entries.slice(at)]
}

/** The entries plus every field of `def` that is missing, with its default (empty without one). Existing values stay. */
export function withTypeDefaults(entries: readonly MetadataEntry[], def: TypeDef): MetadataEntry[] {
  const missing = def.fields
    .filter((field) => !entries.some((entry) => entry.key === field.key))
    .map((field) => ({ key: field.key, value: field.default ?? '' }))
  if (missing.length === 0) return [...entries]
  // Behind the type's own fields that already follow the fixed entries, so the field order stays stable.
  let at = leadingEnd(entries)
  while (at < entries.length && def.fields.some((field) => field.key === entries[at].key)) at += 1
  return [...entries.slice(0, at), ...missing, ...entries.slice(at)]
}

/** The entries with the field `key` set (in place, or behind the fixed entries). Not normalized. */
export function withFieldValue(entries: readonly MetadataEntry[], key: string, value: string): MetadataEntry[] {
  if (entries.some((entry) => entry.key === key)) {
    return entries.map((entry) => (entry.key === key ? { key, value } : entry))
  }
  const at = leadingEnd(entries)
  return [...entries.slice(0, at), { key, value }, ...entries.slice(at)]
}

/** Own colour, else the colour of a known type, else undefined (the caller falls back to its default). */
export function resolveColor(entries: readonly MetadataEntry[], types: readonly TypeDef[]): string | undefined {
  const own = getColor(entries)
  if (own !== undefined) return own
  const resolved = resolveType(entries, types)
  return resolved.state === 'known' ? resolved.def.color?.toLowerCase() : undefined
}

/** Keys of required fields of `def` whose value is missing or blank. */
export function missingRequired(entries: readonly MetadataEntry[], def: TypeDef): string[] {
  return def.fields
    .filter((field) => field.required)
    .filter((field) => (entries.find((entry) => entry.key === field.key)?.value.trim() ?? '') === '')
    .map((field) => field.key)
}
