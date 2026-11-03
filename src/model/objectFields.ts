import { isBlockReasonKey, isStatusKey } from './status'
import { COLOR_KEY, NAME_KEY, TYPE_KEY } from './types'
import type { MetadataEntry } from './types'

/**
 * Every object (kind `node`, not groups or notes) carries the three metadata entries `class`, `entity`
 * and `version`. They have no function yet: `class` names a Java type (a Java object may represent it
 * one day), `entity` and `version` are reserved. Like `color` and `status` they are ordinary entries;
 * the canonical order is name, color, status, blockiert_grund, type, class, entity, version, free fields.
 */
export const CLASS_KEY = 'class'
export const ENTITY_KEY = 'entity'
export const VERSION_KEY = 'version'
export const DEFAULT_CLASS = 'java.lang.Object'
export const DEFAULT_ENTITY = ''
export const DEFAULT_VERSION = ''

/** The object fields in canonical order. */
const OBJECT_KEYS: readonly string[] = [CLASS_KEY, ENTITY_KEY, VERSION_KEY]

/** The class of an object; a missing entry counts as the default (an empty value stays empty). */
export function getClass(entries: readonly MetadataEntry[]): string {
  return entries.find((entry) => entry.key === CLASS_KEY)?.value ?? DEFAULT_CLASS
}

/** The entity of an object; a missing entry counts as empty. */
export function getEntity(entries: readonly MetadataEntry[]): string {
  return entries.find((entry) => entry.key === ENTITY_KEY)?.value ?? DEFAULT_ENTITY
}

/** The version of an object; a missing entry counts as empty. */
export function getVersion(entries: readonly MetadataEntry[]): string {
  return entries.find((entry) => entry.key === VERSION_KEY)?.value ?? DEFAULT_VERSION
}

/** Index right behind the fixed entries that precede the object field `field` (name, colour, status, reason and the object fields before it). */
function insertionIndex(entries: readonly MetadataEntry[], field: string): number {
  const earlier = OBJECT_KEYS.slice(0, OBJECT_KEYS.indexOf(field))
  const isFixed = (key: string) =>
    key === NAME_KEY || key === COLOR_KEY || key === TYPE_KEY || isStatusKey(key) || isBlockReasonKey(key) || earlier.includes(key)
  let at = 0
  while (at < entries.length && isFixed(entries[at].key)) at += 1
  return at
}

function withEntry(entries: readonly MetadataEntry[], key: string, value: string): MetadataEntry[] {
  if (entries.some((entry) => entry.key === key)) {
    return entries.map((entry) => (entry.key === key ? { key, value } : entry))
  }
  const at = insertionIndex(entries, key)
  return [...entries.slice(0, at), { key, value }, ...entries.slice(at)]
}

/** The entries with `class` set (in place, or at its canonical position when missing). Not normalized. */
export function withClassEntry(entries: readonly MetadataEntry[], value: string): MetadataEntry[] {
  return withEntry(entries, CLASS_KEY, value)
}

/** The entries with `entity` set (in place, or at its canonical position when missing). Not normalized. */
export function withEntityEntry(entries: readonly MetadataEntry[], value: string): MetadataEntry[] {
  return withEntry(entries, ENTITY_KEY, value)
}

/** The entries with `version` set (in place, or at its canonical position when missing). Not normalized. */
export function withVersionEntry(entries: readonly MetadataEntry[], value: string): MetadataEntry[] {
  return withEntry(entries, VERSION_KEY, value)
}

/**
 * The entries with `class` (default `java.lang.Object`), `entity` and `version` (default empty) present:
 * only missing ones are added, existing values and positions stay. Nothing missing -> the very same array.
 */
export function withObjectFields(entries: readonly MetadataEntry[]): readonly MetadataEntry[] {
  const has = (key: string) => entries.some((entry) => entry.key === key)
  let result = entries
  if (!has(CLASS_KEY)) result = withClassEntry(result, DEFAULT_CLASS)
  if (!has(ENTITY_KEY)) result = withEntityEntry(result, DEFAULT_ENTITY)
  if (!has(VERSION_KEY)) result = withVersionEntry(result, DEFAULT_VERSION)
  return result
}
