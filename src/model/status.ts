import type { MessageKey } from '../i18n/messages'
import { COLOR_KEY, NAME_KEY } from './types'
import type { MetadataEntry } from './types'

/** Optional metadata field holding the release status of an object. */
export const STATUS_KEY = 'status'

/** Optional metadata field with the reason for the status `blockiert`; only meaningful with that status. */
export const BLOCK_REASON_KEY = 'blockiert_grund'

/**
 * `blockiert` is set by hand (an external obstacle such as a missing approval). It is not the same
 * as "waits for an unfinished prerequisite", which the release analysis computes.
 */
export const STATUS_VALUES = ['offen', 'in Arbeit', 'blockiert', 'fertig'] as const
export type Status = (typeof STATUS_VALUES)[number]

/** Display names of the statuses; the stored values stay German (they are data). */
export const STATUS_LABEL_KEYS: Record<Status, MessageKey> = {
  offen: 'status.offen',
  'in Arbeit': 'status.in Arbeit',
  blockiert: 'status.blockiert',
  fertig: 'status.fertig',
}

export const DEFAULT_STATUS: Status = 'offen'

/** The status a raw value stands for (trimmed, case-insensitive), or undefined if it is none of the four. */
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
  /** False only if a value is present but none of the four statuses. */
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

/** Whether a metadata key is the block reason key (trimmed, case-insensitive). */
export function isBlockReasonKey(key: string): boolean {
  return key.trim().toLowerCase() === BLOCK_REASON_KEY
}

/** The first block reason entry; later ones are ignored. */
export function findBlockReasonEntry(entries: readonly MetadataEntry[]): MetadataEntry | undefined {
  return entries.find((entry) => isBlockReasonKey(entry.key))
}

/** The trimmed reason of the first block reason entry; undefined if there is none or it is blank. */
export function getBlockReason(entries: readonly MetadataEntry[]): string | undefined {
  const reason = findBlockReasonEntry(entries)?.value.trim()
  return reason === '' ? undefined : reason
}

/**
 * The entries with the status set. The first status entry is replaced in place and its key written
 * canonically (`status`); without one, the entry goes right after `name` and `color`. Any status
 * other than `blockiert` also removes the block reason. Not normalized.
 */
export function withStatusEntry(entries: readonly MetadataEntry[], status: Status): MetadataEntry[] {
  const entry = { key: STATUS_KEY, value: status }
  const kept = status === 'blockiert' ? entries : entries.filter((e) => !isBlockReasonKey(e.key))
  const index = kept.findIndex((e) => isStatusKey(e.key))
  if (index >= 0) return kept.map((e, i) => (i === index ? entry : e))
  let at = 0
  while (at < kept.length && (kept[at].key === NAME_KEY || kept[at].key === COLOR_KEY)) at += 1
  return [...kept.slice(0, at), entry, ...kept.slice(at)]
}

/**
 * The entries with the block reason set (trimmed). The first reason entry is replaced in place and
 * written canonically, later ones are dropped; without one the entry goes right after the status
 * entry (the canonical order is name, color, status, blockiert_grund, free fields). A blank reason
 * removes the entry. Not normalized.
 */
export function withBlockReasonEntry(entries: readonly MetadataEntry[], reason: string): MetadataEntry[] {
  const text = reason.trim()
  const first = entries.findIndex((e) => isBlockReasonKey(e.key))
  const others = entries.filter((e, i) => i !== first && !isBlockReasonKey(e.key))
  if (text === '') return others
  const entry = { key: BLOCK_REASON_KEY, value: text }
  if (first >= 0) {
    return entries.flatMap((e, i) => (i === first ? [entry] : isBlockReasonKey(e.key) ? [] : [e]))
  }
  const statusIndex = others.findIndex((e) => isStatusKey(e.key))
  let at = statusIndex + 1
  if (statusIndex < 0) {
    at = 0
    while (at < others.length && (others[at].key === NAME_KEY || others[at].key === COLOR_KEY)) at += 1
  }
  return [...others.slice(0, at), entry, ...others.slice(at)]
}
