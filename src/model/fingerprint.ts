import { serializeModel, toModel } from './serialize'
import type { GraphContent } from './types'

const FNV_OFFSET = 0xcbf29ce484222325n
const FNV_PRIME = 0x100000001b3n
const MASK_64 = 0xffffffffffffffffn

/** 64-bit FNV-1a over the UTF-16 code units of `text`; 16 lowercase hex digits. */
function fnv1a64(text: string): string {
  let hash = FNV_OFFSET
  for (let i = 0; i < text.length; i++) {
    hash ^= BigInt(text.charCodeAt(i))
    hash = (hash * FNV_PRIME) & MASK_64
  }
  return hash.toString(16).padStart(16, '0')
}

/**
 * Short, deterministic identity of the exportable content (same canonical JSON as the export file),
 * used to tell whether the current project differs from the last exported or imported state. Not
 * cryptographic: it only has to make an accidental collision after an edit very unlikely.
 */
export function contentFingerprint(content: GraphContent): string {
  return fnv1a64(serializeModel(toModel(content)))
}
