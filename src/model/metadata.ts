import { COLOR_KEY, NAME_KEY } from './types'
import type { MetadataEntry } from './types'

/**
 * Normalizes user-entered metadata:
 *  - trims key and value of every entry
 *  - drops entries whose trimmed key is empty (value may be empty)
 *  - guarantees a `name` entry at index 0: the first existing `name` entry is moved there,
 *    otherwise `{ key: 'name', value: '' }` is prepended
 *  - keeps the relative order of all other entries; does NOT remove duplicates
 * Pure: never mutates the input.
 */
export function normalizeMetadata(entries: readonly MetadataEntry[]): MetadataEntry[] {
  const cleaned = entries
    .map((entry) => ({ key: entry.key.trim(), value: entry.value.trim() }))
    .filter((entry) => entry.key !== '')
  const nameIndex = cleaned.findIndex((entry) => entry.key === NAME_KEY)
  if (nameIndex === -1) return [{ key: NAME_KEY, value: '' }, ...cleaned]
  return [cleaned[nameIndex], ...cleaned.slice(0, nameIndex), ...cleaned.slice(nameIndex + 1)]
}

/**
 * Distinct keys that occur more than once (compared after trimming, case-sensitive,
 * entries with an empty key ignored), in order of first occurrence.
 */
export function findDuplicateKeys(entries: readonly MetadataEntry[]): string[] {
  // Map keeps insertion order = order of first occurrence.
  const counts = new Map<string, number>()
  for (const entry of entries) {
    const key = entry.key.trim()
    if (key !== '') counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts].filter(([, count]) => count > 1).map(([key]) => key)
}

/** Value of the `name` entry, or '' if there is none. */
export function getName(entries: readonly MetadataEntry[]): string {
  return entries.find((entry) => entry.key === NAME_KEY)?.value ?? ''
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i

/** Is `value` a `#rrggbb` colour? (Only this form is rendered; anything else counts as "no colour".) */
export function isValidColor(value: string): boolean {
  return HEX_COLOR.test(value)
}

/** The element's colour (lower-cased `#rrggbb`), or undefined if unset or invalid. */
export function getColor(entries: readonly MetadataEntry[]): string | undefined {
  const value = entries.find((entry) => entry.key === COLOR_KEY)?.value
  return value !== undefined && isValidColor(value) ? value.toLowerCase() : undefined
}

/** Dark or white text, whichever reads better on the given `#rrggbb` background (YIQ brightness). */
export function getContrastColor(background: string): '#111827' | '#ffffff' {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(background.slice(i, i + 2), 16))
  return (r * 299 + g * 587 + b * 114) / 1000 >= 150 ? '#111827' : '#ffffff'
}
