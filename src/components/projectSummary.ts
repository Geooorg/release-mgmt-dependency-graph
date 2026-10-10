import type { Translate } from '../i18n/translate'

export interface ProjectCounts {
  objects: number
  groups: number
  connections: number
}

/** "5 objects, 2 groups, 7 connections"; objects are always named (even 0), groups and connections only when there are any. */
export function projectSummary(counts: ProjectCounts, t: Translate): string {
  return [
    t.plural('summary.objects', counts.objects),
    ...(counts.groups > 0 ? [t.plural('summary.groups', counts.groups)] : []),
    ...(counts.connections > 0 ? [t.plural('summary.connections', counts.connections)] : []),
  ].join(', ')
}
