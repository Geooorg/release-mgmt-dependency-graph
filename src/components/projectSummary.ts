export interface ProjectCounts {
  objects: number
  groups: number
  connections: number
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** "5 Objekte, 2 Gruppen, 7 Verbindungen"; objects are always named (even 0), groups and connections only when there are any. */
export function projectSummary(counts: ProjectCounts): string {
  return [
    plural(counts.objects, 'Objekt', 'Objekte'),
    ...(counts.groups > 0 ? [plural(counts.groups, 'Gruppe', 'Gruppen')] : []),
    ...(counts.connections > 0 ? [plural(counts.connections, 'Verbindung', 'Verbindungen')] : []),
  ].join(', ')
}
