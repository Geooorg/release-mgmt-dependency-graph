import type { de } from './de'

export type MessageKey = keyof typeof de
export type Catalog = Record<MessageKey, string>

/** Base of a plural pair: `cycle.count` for `cycle.count_one` / `cycle.count_other`. */
export type PluralKey = {
  [K in MessageKey]: K extends `${infer Base}_other` ? Base : never
}[MessageKey]

export type Params = Record<string, string | number>

/** A message that is translated when it is shown, so it follows a language change. */
export interface MessageRef {
  key: MessageKey
  params?: Params
}
