import type { MetadataEntry } from './types'

/** Optional metadata field holding the release status of an object. */
export const STATUS_KEY = 'status'

export const STATUS_VALUES = ['offen', 'in Arbeit', 'fertig'] as const
export type Status = (typeof STATUS_VALUES)[number]

export const DEFAULT_STATUS: Status = 'offen'

/** The status a raw value stands for (trimmed, case-insensitive), or undefined if it is none of the three. */
export function parseStatus(value: string): Status | undefined {
  const wanted = value.trim().toLowerCase()
  return STATUS_VALUES.find((status) => status.toLowerCase() === wanted)
}

/** The element's status; a missing or unknown value counts as `offen`. */
export function getStatus(entries: readonly MetadataEntry[]): Status {
  const value = entries.find((entry) => entry.key === STATUS_KEY)?.value
  return (value !== undefined && parseStatus(value)) || DEFAULT_STATUS
}
