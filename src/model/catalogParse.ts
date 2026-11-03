import type { Translate } from '../i18n/translate'
import { TYPE_PROBLEM_KEYS, checkTypeDef, tidyType } from './catalog'
import type { CatalogSide } from './catalog'
import { EMPTY_CATALOG, FIELD_KINDS, ICON_KEYS } from './types'
import type { Catalog, FieldDef, IconKey, TypeDef } from './types'

type Report = (message: string) => void

const SIDES: readonly CatalogSide[] = ['elementTypes', 'edgeTypes']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function parseField(value: unknown): FieldDef | undefined {
  if (!isRecord(value) || typeof value.key !== 'string') return undefined
  if (!(FIELD_KINDS as readonly unknown[]).includes(value.kind)) return undefined
  const options = value.options
  if (options !== undefined && !(Array.isArray(options) && options.every((o) => typeof o === 'string'))) return undefined
  if (value.required !== undefined && typeof value.required !== 'boolean') return undefined
  if (value.default !== undefined && typeof value.default !== 'string') return undefined
  return {
    key: value.key,
    kind: value.kind as FieldDef['kind'],
    ...(options !== undefined && { options: options as string[] }),
    ...(value.required !== undefined && { required: value.required }),
    ...(value.default !== undefined && { default: value.default }),
  }
}

function parseTypeDef(value: unknown): TypeDef | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id === '' || typeof value.name !== 'string') {
    return undefined
  }
  if (value.color !== undefined && typeof value.color !== 'string') return undefined
  if (value.icon !== undefined && !(ICON_KEYS as readonly unknown[]).includes(value.icon)) return undefined
  if (!Array.isArray(value.fields)) return undefined
  const fields = value.fields.map(parseField)
  if (fields.some((field) => field === undefined)) return undefined
  return tidyType({
    id: value.id,
    name: value.name,
    ...(value.color !== undefined && { color: value.color }),
    ...(value.icon !== undefined && { icon: value.icon as IconKey }),
    fields: fields as FieldDef[],
  })
}

/**
 * Reads an untrusted catalog and reports every problem. `required`: a missing catalog is an error
 * (schema version 5); otherwise it counts as empty. A type that refers to nothing is never checked here.
 */
export function parseCatalog(raw: unknown, required: boolean, report: Report, t: Translate): Catalog {
  if (raw === undefined) {
    if (required) report(t('parse.catalog.missing'))
    return EMPTY_CATALOG
  }
  if (!isRecord(raw)) {
    report(t('parse.catalog.notObject'))
    return EMPTY_CATALOG
  }
  const result: Record<CatalogSide, TypeDef[]> = { elementTypes: [], edgeTypes: [] }
  const seenIds = new Set<string>()
  for (const side of SIDES) {
    const list = raw[side]
    if (list === undefined) continue
    if (!Array.isArray(list)) {
      report(t('parse.catalog.notList', { side }))
      continue
    }
    list.forEach((value, index) => {
      const where = `${side}[${index + 1}]`
      const def = parseTypeDef(value)
      if (def === undefined) {
        report(t('parse.catalog.malformed', { where }))
        return
      }
      if (seenIds.has(def.id)) report(t('parse.catalog.idTaken', { where, id: JSON.stringify(def.id) }))
      seenIds.add(def.id)
      result[side].push(def)
    })
    for (const [index, def] of result[side].entries()) {
      for (const problem of checkTypeDef(def, result[side])) {
        report(t('parse.catalog.problem', { where: `${side}[${index + 1}]`, reason: t(TYPE_PROBLEM_KEYS[problem]) }))
      }
    }
  }
  return result
}
