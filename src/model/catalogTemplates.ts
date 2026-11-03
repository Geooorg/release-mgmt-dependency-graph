import { createTranslate, type Translate } from '../i18n/translate'
import { parseCatalog } from './catalogParse'
import type { Catalog, TypeDef } from './types'

export const CATALOG_FILE_VERSION = 1

export const TEMPLATE_IDS = ['it-services', 'dataflow'] as const
export type TemplateId = (typeof TEMPLATE_IDS)[number]

const TEMPLATES: Record<TemplateId, Catalog> = {
  'it-services': {
    elementTypes: [
      { id: 'svc', name: 'Service', color: '#2563eb', icon: 'service', fields: [] },
      { id: 'db', name: 'Datenbank', color: '#7c3aed', icon: 'database', fields: [] },
      { id: 'queue', name: 'Queue', color: '#d97706', icon: 'queue', fields: [] },
      { id: 'ext', name: 'Externes System', color: '#6b7280', icon: 'external', fields: [] },
    ],
    edgeTypes: [
      { id: 'call', name: 'Aufruf', color: '#2563eb', roles: ['dependency', 'flow'], fields: [] },
    ],
  },
  dataflow: {
    elementTypes: [
      { id: 'proc', name: 'Prozess', color: '#2563eb', icon: 'process', fields: [] },
      { id: 'store', name: 'Datenspeicher', color: '#7c3aed', icon: 'storage', fields: [] },
      { id: 'actor', name: 'Externe Entität', color: '#6b7280', icon: 'user', fields: [] },
    ],
    edgeTypes: [
      { id: 'flow', name: 'Datenfluss', color: '#dc2626', roles: ['flow'], fields: [] },
    ],
  },
}

/** A template as a catalog with fixed ids; apply it through `withFreshIds` or `mergeCatalog`. */
export function templateCatalog(id: TemplateId): Catalog {
  return TEMPLATES[id]
}

/** The catalog as a standalone file (pretty-printed, trailing newline). */
export function serializeCatalog(catalog: Catalog): string {
  const strip = (types: readonly TypeDef[]) =>
    types.map((type) => ({ ...type, fields: type.fields.map((field) => ({ ...field })) }))
  const file = {
    catalogVersion: CATALOG_FILE_VERSION,
    catalog: { elementTypes: strip(catalog.elementTypes), edgeTypes: strip(catalog.edgeTypes) },
  }
  return `${JSON.stringify(file, null, 2)}\n`
}

export type CatalogParseResult = { ok: true; catalog: Catalog } | { ok: false; errors: string[] }

/** Reads a catalog file; the errors are written in the language of `t`. */
export function parseCatalogText(text: string, t: Translate = createTranslate('de')): CatalogParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    return { ok: false, errors: [t('parse.json', { reason: error instanceof Error ? error.message : String(error) })] }
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { catalogVersion?: unknown }).catalogVersion !== CATALOG_FILE_VERSION
  ) {
    return { ok: false, errors: [t('parse.catalogFile.version', { expected: CATALOG_FILE_VERSION })] }
  }
  const errors: string[] = []
  const catalog = parseCatalog((parsed as { catalog?: unknown }).catalog, true, (message) => errors.push(message), t)
  return errors.length > 0 ? { ok: false, errors } : { ok: true, catalog }
}

/** `Katalog_<YYYY-MM-DD>_<HHmmss>.json` in local time. */
export function catalogFileName(date: Date = new Date()): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, '0')
  const day = `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `Katalog_${day}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.json`
}
