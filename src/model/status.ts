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

/** Whether a metadata key is the status key (trimmed, case-insensitive: `Status` and ` STATUS ` count). */
export function isStatusKey(key: string): boolean {
  return key.trim().toLowerCase() === STATUS_KEY
}

/** The first status entry; later ones are ignored. */
export function findStatusEntry(entries: readonly MetadataEntry[]): MetadataEntry | undefined {
  return entries.find((entry) => isStatusKey(entry.key))
}

export interface StatusInfo {
  /** Effective status: missing, empty and unknown values count as `offen`. */
  status: Status
  /** Trimmed raw value; undefined when there is no entry or its value is empty. */
  raw: string | undefined
  /** False only if a value is present but none of the three statuses. */
  known: boolean
}

/** The only place that evaluates the status entry of an element. */
export function getStatusInfo(entries: readonly MetadataEntry[]): StatusInfo {
  const raw = findStatusEntry(entries)?.value.trim()
  if (raw === undefined || raw === '') return { status: DEFAULT_STATUS, raw: undefined, known: true }
  const status = parseStatus(raw)
  return { status: status ?? DEFAULT_STATUS, raw, known: status !== undefined }
}

/** The element's status; a missing or unknown value counts as `offen`. */
export function getStatus(entries: readonly MetadataEntry[]): Status {
  return getStatusInfo(entries).status
}
