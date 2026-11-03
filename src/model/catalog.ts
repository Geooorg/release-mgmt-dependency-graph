import type { MessageKey } from '../i18n/messages'
import { isValidColor } from './metadata'
import { getTypeId } from './typing'
import type { Catalog, FieldDef, GraphContent, IdGenerator, TypeDef } from './types'

/** Keys the app itself uses on elements and connections: a type field may not take them. */
export const RESERVED_FIELD_KEYS: readonly string[] = [
  'name',
  'color',
  'status',
  'blockiert_grund',
  'type',
  'class',
  'entity',
  'version',
  'optional',
]

export type CatalogSide = 'elementTypes' | 'edgeTypes'

export type TypeProblem =
  | 'name.empty'
  | 'name.taken'
  | 'color.invalid'
  | 'field.keyEmpty'
  | 'field.keyReserved'
  | 'field.keyDuplicate'
  | 'field.optionsEmpty'
  | 'field.optionsDuplicate'
  | 'field.defaultInvalid'

/** Catalog keys of the messages for the problems (used by the import and the type dialog). */
export const TYPE_PROBLEM_KEYS: Record<TypeProblem, MessageKey> = {
  'name.empty': 'catalog.problem.name.empty',
  'name.taken': 'catalog.problem.name.taken',
  'color.invalid': 'catalog.problem.color.invalid',
  'field.keyEmpty': 'catalog.problem.field.keyEmpty',
  'field.keyReserved': 'catalog.problem.field.keyReserved',
  'field.keyDuplicate': 'catalog.problem.field.keyDuplicate',
  'field.optionsEmpty': 'catalog.problem.field.optionsEmpty',
  'field.optionsDuplicate': 'catalog.problem.field.optionsDuplicate',
  'field.defaultInvalid': 'catalog.problem.field.defaultInvalid',
}

const norm = (text: string) => text.trim().toLowerCase()

function tidyField(field: FieldDef): FieldDef {
  const standard = field.default?.trim() ?? ''
  return {
    key: field.key.trim(),
    kind: field.kind,
    ...(field.kind === 'select' && { options: (field.options ?? []).map((o) => o.trim()).filter((o) => o !== '') }),
    ...(field.required && { required: true }),
    ...(standard !== '' && { default: standard }),
  }
}

/** The type in canonical form (fixed key order, trimmed texts, no empty optional parts). Does not validate. */
export function tidyType(def: TypeDef): TypeDef {
  return {
    id: def.id,
    name: def.name.trim(),
    ...(def.color !== undefined && def.color.trim() !== '' && { color: def.color.trim().toLowerCase() }),
    ...(def.icon !== undefined && { icon: def.icon }),
    fields: def.fields.map(tidyField),
  }
}

function checkField(field: FieldDef, problems: Set<TypeProblem>): void {
  if (field.kind === 'select') {
    const options = field.options ?? []
    if (options.length === 0) problems.add('field.optionsEmpty')
    else if (new Set(options.map(norm)).size !== options.length) problems.add('field.optionsDuplicate')
    if (field.default !== undefined && field.default !== '' && !options.includes(field.default)) {
      problems.add('field.defaultInvalid')
    }
  } else if (field.kind === 'boolean') {
    if (field.default !== undefined && !['', 'ja', 'nein'].includes(field.default)) problems.add('field.defaultInvalid')
  }
}

/** Problems of one type; `others` is its whole list (the type itself is skipped by id). Expects a tidy type. */
export function checkTypeDef(def: TypeDef, others: readonly TypeDef[]): TypeProblem[] {
  const problems = new Set<TypeProblem>()
  const name = norm(def.name)
  if (name === '') problems.add('name.empty')
  else if (others.some((other) => other.id !== def.id && norm(other.name) === name)) problems.add('name.taken')
  if (def.color !== undefined && !isValidColor(def.color)) problems.add('color.invalid')
  const seen = new Set<string>()
  for (const field of def.fields) {
    const key = norm(field.key)
    if (key === '') problems.add('field.keyEmpty')
    else if (RESERVED_FIELD_KEYS.includes(key)) problems.add('field.keyReserved')
    else if (seen.has(key)) problems.add('field.keyDuplicate')
    seen.add(key)
    checkField(field, problems)
  }
  return [...problems]
}

export function findType(catalog: Catalog, side: CatalogSide, id: string): TypeDef | undefined {
  return catalog[side].find((type) => type.id === id)
}

/** `base`, or `base 2`, `base 3` … – the first name no type has yet. */
export function uniqueName(types: readonly TypeDef[], base: string): string {
  const taken = new Set(types.map((type) => norm(type.name)))
  if (!taken.has(norm(base))) return base
  let n = 2
  while (taken.has(norm(`${base} ${n}`))) n += 1
  return `${base} ${n}`
}

/** Appends an empty type. Empty or taken name -> undefined. */
export function addType(
  catalog: Catalog,
  side: CatalogSide,
  name: string,
  newId: IdGenerator,
): { catalog: Catalog; id: string } | undefined {
  const type = tidyType({ id: newId(), name, fields: [] })
  if (checkTypeDef(type, catalog[side]).length > 0) return undefined
  return { catalog: { ...catalog, [side]: [...catalog[side], type] }, id: type.id }
}

/** Replaces the type with the same id by its tidy form. Unknown id, problems or no change -> the same catalog. */
export function replaceType(catalog: Catalog, side: CatalogSide, def: TypeDef): Catalog {
  const list = catalog[side]
  const index = list.findIndex((type) => type.id === def.id)
  if (index === -1) return catalog
  const tidy = tidyType(def)
  if (checkTypeDef(tidy, list).length > 0) return catalog
  if (JSON.stringify(tidy) === JSON.stringify(list[index])) return catalog
  return { ...catalog, [side]: list.map((type, i) => (i === index ? tidy : type)) }
}

/** Removes the type; elements that refer to it keep their `type` entry (they show it as unknown). */
export function removeType(catalog: Catalog, side: CatalogSide, id: string): Catalog {
  if (!catalog[side].some((type) => type.id === id)) return catalog
  return { ...catalog, [side]: catalog[side].filter((type) => type.id !== id) }
}

/** Copies of the types with new ids (a template or file must not bring foreign ids into the project). */
export function withFreshIds(catalog: Catalog, newId: IdGenerator): Catalog {
  const fresh = (types: readonly TypeDef[]) => types.map((type) => ({ ...tidyType(type), id: newId() }))
  return { elementTypes: fresh(catalog.elementTypes), edgeTypes: fresh(catalog.edgeTypes) }
}

/** `current` plus the types of `incoming` whose name `current` does not have yet (new ids). */
export function mergeCatalog(current: Catalog, incoming: Catalog, newId: IdGenerator): Catalog {
  const merge = (own: readonly TypeDef[], other: readonly TypeDef[]) => {
    const names = new Set(own.map((type) => norm(type.name)))
    const added = other.filter((type) => !names.has(norm(type.name))).map((type) => ({ ...tidyType(type), id: newId() }))
    return added.length === 0 ? [...own] : [...own, ...added]
  }
  return {
    elementTypes: merge(current.elementTypes, incoming.elementTypes),
    edgeTypes: merge(current.edgeTypes, incoming.edgeTypes),
  }
}

/** How many elements refer to the type: objects for `elementTypes`, connections for `edgeTypes`. */
export function countUsage(content: GraphContent, side: CatalogSide, id: string): number {
  if (side === 'elementTypes') {
    return content.nodes.filter((node) => node.kind === 'node' && getTypeId(node.metadata) === id).length
  }
  return content.edges.filter((edge) => getTypeId(edge.metadata ?? []) === id).length
}
