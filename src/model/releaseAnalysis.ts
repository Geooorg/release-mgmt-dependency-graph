import { findCycles } from './cycles'
import { buildEffectiveGraph, type EffectiveGraph } from './effectiveGraph'
import { displayName } from './metadata'
import { DEFAULT_PROJECT_NAME } from './projectName'
import { getStatusInfo, type Status, type StatusInfo } from './status'
import type { GraphContent, ModelNode } from './types'

/**
 * Release analysis on top of the effective dependency graph (see `buildEffectiveGraph`).
 * `A -> B` means "A depends on B", so the successors of a vertex are its prerequisites.
 * Everything is pure, deterministic (ties are broken by node order) and iterative, so large
 * graphs cannot overflow the stack.
 *
 * Only objects (`kind: 'node'`) carry a status and count as work. A group without objects is a
 * vertex of the graph (its edges must not get lost) but has no work of its own, so it is
 * transparent: never open, never a blocker, not counted.
 */

export interface StatusCounts {
  /** Number of objects. */
  total: number
  done: number
  inProgress: number
  open: number
  /** Unfinished objects with an unfinished transitive prerequisite. */
  blocked: number
  /** Finished objects with an unfinished transitive prerequisite (a contradiction). */
  inconsistent: number
  /** Objects whose status value is none of the three (counted as `offen`). */
  unknownStatus: number
  /** Unfinished objects that can be worked on right now. */
  ready: number
}

export interface ProjectAnalysis {
  /** Effective status of every object. */
  statusById: Map<string, Status>
  /** Status with its raw value of every object (to tell "not set" and "unknown" from a real `offen`). */
  statusInfoById: Map<string, StatusInfo>
  /** Objects whose status value is unknown, with the raw value, in node order. */
  unknownStatusIds: Map<string, string>
  /** Unfinished objects with an unfinished transitive prerequisite, plus groups containing such an object. */
  blockedIds: Set<string>
  /** Finished objects with an unfinished transitive prerequisite (objects only; groups are in `inconsistentMembers`). */
  inconsistentIds: Set<string>
  /**
   * Per blocked or inconsistent object: the direct prerequisites through which the waiting comes
   * (unfinished, or finished but themselves waiting), in node order.
   */
  blockingDirect: Map<string, string[]>
  /** Per group: the blocked objects inside (any depth), in node order. */
  blockedMembers: Map<string, string[]>
  /** Per group: the inconsistent objects inside (any depth), in node order. */
  inconsistentMembers: Map<string, string[]>
  /** Unfinished objects without any unfinished transitive prerequisite. */
  readyIds: Set<string>
  /** Per group: finished and total objects inside (any depth). */
  groupProgress: Map<string, { done: number; total: number }>
  counts: StatusCounts
}

export interface Blocker {
  id: string
  status: Status
  /** Not blocked itself: can be worked on right now. */
  ready: boolean
  /** Shortest number of steps from the selection (0 for the whole project). */
  distance: number
}

export interface CriticalPath {
  /** In release order: what has to be done first comes first, the selected object comes last. */
  nodeIds: string[]
  /** Explicit edges that produce the steps of the path. */
  edgeIds: string[]
  /** Number of unfinished objects on the path. */
  length: number
}

export interface SelectionAnalysis {
  /** `project`: nothing (known) selected, the whole project is analysed. */
  scope: 'selection' | 'project'
  /** The selected elements that exist, in the given order. */
  selectedIds: string[]
  /** Unfinished prerequisites of the selection (the unfinished objects of the project in `project` scope). */
  blockers: Blocker[]
  /** Null when the relevant part contains a cycle (the longest chain is not defined then). */
  criticalPath: CriticalPath | null
  /** Objects of the cycles that are part of the relevant graph; empty if there are none. */
  cycleIds: string[]
  /** Finished objects of the relevant graph (selection and its prerequisites) with an unfinished prerequisite. */
  inconsistent: InconsistentObject[]
  /** Objects of the relevant graph whose status value is unknown (they count as `offen`). */
  unknownStatus: { id: string; raw: string }[]
}

export interface InconsistentObject {
  id: string
  /** Direct prerequisites through which the contradiction comes, in node order. */
  waitingFor: string[]
}

interface Prepared {
  graph: EffectiveGraph
  indexOf: Map<string, number>
  /** Direct prerequisites per vertex index, ascending. */
  succ: number[][]
  pred: number[][]
  isObject: boolean[]
  info: (StatusInfo | undefined)[]
  status: (Status | undefined)[]
  /** Unfinished object. */
  open: boolean[]
  /** Some unfinished vertex is reachable via one or more steps (a vertex of a cycle can reach itself). */
  blocked: boolean[]
  /** Finished object with an unfinished vertex reachable via one or more steps. */
  inconsistent: boolean[]
}

function prepare(content: GraphContent): Prepared {
  const graph = buildEffectiveGraph(content)
  const { vertices } = graph
  const indexOf = new Map(vertices.map((id, i) => [id, i]))
  const kinds = new Map(content.nodes.map((n) => [n.id, n]))
  const succ = vertices.map((id) => (graph.successors.get(id) ?? []).map((to) => indexOf.get(to) as number))
  const pred: number[][] = vertices.map(() => [])
  succ.forEach((list, from) => list.forEach((to) => pred[to].push(from)))

  const isObject = vertices.map((id) => kinds.get(id)?.kind === 'node')
  const info = vertices.map((id, i) => (isObject[i] ? getStatusInfo(kinds.get(id)?.metadata ?? []) : undefined))
  const status = info.map((entry) => entry?.status)
  const open = status.map((s) => s !== undefined && s !== 'fertig')

  // Multi-source walk against the arrows from every unfinished vertex. Seeds are marked only when
  // they are reached from another vertex, so a lone unfinished object is not blocked by itself.
  const blocked = vertices.map(() => false)
  const queued = [...open]
  const queue: number[] = []
  open.forEach((isOpen, i) => isOpen && queue.push(i))
  for (let head = 0; head < queue.length; head++) {
    for (const p of pred[queue[head]]) {
      blocked[p] = true
      if (!queued[p]) {
        queued[p] = true
        queue.push(p)
      }
    }
  }
  const inconsistent = vertices.map((_, i) => status[i] === 'fertig' && blocked[i])
  return { graph, indexOf, succ, pred, isObject, info, status, open, blocked, inconsistent }
}

/** Direct prerequisites of a vertex that are unfinished or finished but waiting themselves. */
function waitingOn(p: Prepared, i: number): string[] {
  return p.succ[i].filter((w) => p.open[w] || p.blocked[w]).map((w) => p.graph.vertices[w])
}

/** Ancestor group ids of an element, nearest first; a corrupt parent loop ends the walk. */
function ancestorsOf(byId: ReadonlyMap<string, ModelNode>, node: ModelNode): string[] {
  const result: string[] = []
  const seen = new Set([node.id])
  for (let parent = node.parentId; parent !== undefined && !seen.has(parent); parent = byId.get(parent)?.parentId) {
    seen.add(parent)
    result.push(parent)
  }
  return result
}

export function analyzeProject(content: GraphContent): ProjectAnalysis {
  const p = prepare(content)
  const { vertices } = p.graph
  const byId = new Map(content.nodes.map((n) => [n.id, n]))

  const statusById = new Map<string, Status>()
  const statusInfoById = new Map<string, StatusInfo>()
  const unknownStatusIds = new Map<string, string>()
  const blockedIds = new Set<string>()
  const inconsistentIds = new Set<string>()
  const readyIds = new Set<string>()
  const blockingDirect = new Map<string, string[]>()
  const counts: StatusCounts = {
    total: 0,
    done: 0,
    inProgress: 0,
    open: 0,
    blocked: 0,
    inconsistent: 0,
    unknownStatus: 0,
    ready: 0,
  }

  vertices.forEach((id, i) => {
    const status = p.status[i]
    const info = p.info[i]
    if (!p.isObject[i] || status === undefined || info === undefined) return
    statusById.set(id, status)
    statusInfoById.set(id, info)
    if (!info.known && info.raw !== undefined) {
      unknownStatusIds.set(id, info.raw)
      counts.unknownStatus++
    }
    counts.total++
    if (status === 'fertig') counts.done++
    else if (status === 'in Arbeit') counts.inProgress++
    else counts.open++
    if (p.inconsistent[i]) {
      inconsistentIds.add(id)
      counts.inconsistent++
      blockingDirect.set(id, waitingOn(p, i))
    } else if (p.blocked[i]) {
      blockedIds.add(id)
      counts.blocked++
      blockingDirect.set(id, waitingOn(p, i))
    } else if (p.open[i]) {
      readyIds.add(id)
      counts.ready++
    }
  })

  const groupProgress = new Map<string, { done: number; total: number }>()
  const blockedMembers = new Map<string, string[]>()
  const inconsistentMembers = new Map<string, string[]>()
  const addMember = (members: Map<string, string[]>, groupId: string, id: string) => {
    const list = members.get(groupId)
    if (list) list.push(id)
    else members.set(groupId, [id])
  }
  for (const node of content.nodes) {
    if (node.kind === 'group') groupProgress.set(node.id, { done: 0, total: 0 })
  }
  for (const node of content.nodes) {
    if (node.kind !== 'node') continue
    for (const groupId of ancestorsOf(byId, node)) {
      const progress = groupProgress.get(groupId)
      if (progress) {
        progress.total++
        if (statusById.get(node.id) === 'fertig') progress.done++
      }
      if (blockedIds.has(node.id)) addMember(blockedMembers, groupId, node.id)
      if (inconsistentIds.has(node.id)) addMember(inconsistentMembers, groupId, node.id)
    }
  }
  for (const groupId of blockedMembers.keys()) blockedIds.add(groupId)

  return {
    statusById,
    statusInfoById,
    unknownStatusIds,
    blockedIds,
    inconsistentIds,
    blockingDirect,
    blockedMembers,
    inconsistentMembers,
    readyIds,
    groupProgress,
    counts,
  }
}

/**
 * Per vertex: the number of unfinished objects on the longest chain of prerequisites below it
 * (Infinity if the vertex lies on, or depends on, a cycle). Kahn's algorithm, prerequisites first.
 */
function chainDepths(p: Prepared): number[] {
  const count = p.succ.length
  const depth = new Array<number>(count).fill(Infinity)
  const waiting = p.succ.map((list) => list.length)
  const queue: number[] = []
  waiting.forEach((n, i) => n === 0 && queue.push(i))
  for (let head = 0; head < queue.length; head++) {
    const v = queue[head]
    let longest = 0
    for (const w of p.succ[v]) longest = Math.max(longest, depth[w] + (p.open[w] ? 1 : 0))
    depth[v] = longest
    for (const dependent of p.pred[v]) {
      if (--waiting[dependent] === 0) queue.push(dependent)
    }
  }
  return depth
}

/** Longest chain of unfinished work reachable from the candidates (acyclic scope only). */
function longestChain(p: Prepared, depth: readonly number[], candidates: readonly number[]): CriticalPath {
  const weight = (i: number) => (p.open[i] ? 1 : 0)
  if (candidates.length === 0) return { nodeIds: [], edgeIds: [], length: 0 }
  let start = candidates[0]
  for (const c of candidates) {
    if (depth[c] + weight(c) > depth[start] + weight(start)) start = c
  }
  const length = depth[start] + weight(start)
  if (length === 0) return { nodeIds: [], edgeIds: [], length: 0 }

  const { vertices } = p.graph
  const walk = [start]
  for (let current = start; depth[current] > 0; ) {
    // succ is ascending: the first best prerequisite wins ties.
    const next = p.succ[current].find((w) => depth[w] + weight(w) === depth[current]) as number
    walk.push(next)
    current = next
  }
  const nodeIds = walk.map((i) => vertices[i]).reverse()
  const edgeIds = new Set<string>()
  for (let k = 0; k + 1 < nodeIds.length; k++) {
    for (const id of p.graph.edgeIdsOf(nodeIds[k + 1], nodeIds[k])) edgeIds.add(id)
  }
  return { nodeIds, edgeIds: [...edgeIds], length }
}

/**
 * What stands between the selection and its release: unfinished transitive prerequisites and the
 * critical path (the longest chain of unfinished work, finished objects weigh 0). A selected group
 * starts at all its members. Nothing selected = the whole project.
 */
export function analyzeSelection(content: GraphContent, startIds: readonly string[]): SelectionAnalysis {
  const p = prepare(content)
  const { vertices } = p.graph
  const known = new Set(content.nodes.map((n) => n.id))
  const selectedIds = startIds.filter((id) => known.has(id))
  const startSet = new Set<number>()
  for (const id of selectedIds) {
    for (const leaf of p.graph.leavesOf(id)) startSet.add(p.indexOf.get(leaf) as number)
  }
  const whole = startSet.size === 0
  const starts = whole ? vertices.map((_, i) => i) : [...startSet].sort((a, b) => a - b)

  // Shortest distance from the starts; `below` marks vertices reached by one or more steps.
  const distance = new Array<number>(vertices.length).fill(-1)
  const below = vertices.map(() => false)
  const queue = [...starts]
  starts.forEach((s) => (distance[s] = 0))
  for (let head = 0; head < queue.length; head++) {
    const v = queue[head]
    for (const w of p.succ[v]) {
      below[w] = true
      if (distance[w] === -1) {
        distance[w] = distance[v] + 1
        queue.push(w)
      }
    }
  }

  const depth = chainDepths(p)
  const blockers = vertices
    .map((_, i) => i)
    .filter((i) => p.open[i] && distance[i] !== -1 && (whole || !startSet.has(i)))
    .sort((a, b) => {
      const readyA = !p.blocked[a]
      const readyB = !p.blocked[b]
      if (readyA !== readyB) return readyA ? -1 : 1
      return depth[a] === depth[b] ? a - b : depth[a] < depth[b] ? -1 : 1
    })
    .map((i) => ({
      id: vertices[i],
      status: p.status[i] as Status,
      ready: !p.blocked[i],
      distance: distance[i],
    }))

  const inScope = new Set(vertices.filter((_, i) => distance[i] !== -1))
  const cycleIds = findCycles(content, p.graph)
    .cycles.flat()
    .filter((id) => inScope.has(id))
    .sort((a, b) => (p.indexOf.get(a) as number) - (p.indexOf.get(b) as number))

  let criticalPath: CriticalPath | null = null
  if (cycleIds.length === 0) {
    // A start that another start depends on is covered by that start's chain.
    const roots = starts.filter((s) => !below[s])
    criticalPath = longestChain(p, depth, roots.length > 0 ? roots : starts)
  }

  const inScopeIndices = vertices.map((_, i) => i).filter((i) => distance[i] !== -1)
  const inconsistent = inScopeIndices
    .filter((i) => p.inconsistent[i])
    .map((i) => ({ id: vertices[i], waitingFor: waitingOn(p, i) }))
  const unknownStatus = inScopeIndices.flatMap((i) => {
    const info = p.info[i]
    return info && !info.known && info.raw !== undefined ? [{ id: vertices[i], raw: info.raw }] : []
  })

  return {
    scope: whole ? 'project' : 'selection',
    selectedIds,
    blockers,
    criticalPath,
    cycleIds,
    inconsistent,
    unknownStatus,
  }
}

function stepsText(count: number): string {
  return count === 1 ? '1 Schritt' : `${count} Schritte`
}

/** Markdown report (for the clipboard) of the analysis of a selection or the whole project. */
export function formatAnalysisMarkdown(
  content: GraphContent,
  project: ProjectAnalysis,
  selection: SelectionAnalysis,
): string {
  const byId = new Map(content.nodes.map((n) => [n.id, n]))
  const name = (id: string) => {
    const node = byId.get(id)
    return node ? displayName(node) : id.slice(0, 8)
  }
  const statusOf = (id: string) => project.statusById.get(id) ?? 'offen'
  const entry = (b: Blocker) => `- ${name(b.id)} – ${b.status}${b.ready ? ', jetzt umsetzbar' : ''}`

  const target = selection.scope === 'project' ? 'Gesamtes Projekt' : selection.selectedIds.map(name).join(', ')
  const { counts } = project
  const clarifyCount = selection.inconsistent.length + selection.unknownStatus.length
  const lines = [
    `# Release-Analyse: ${content.projectName ?? DEFAULT_PROJECT_NAME} – ${target}`,
    '',
    `- fertig: ${counts.done}`,
    `- in Arbeit: ${counts.inProgress}`,
    `- offen: ${counts.open}`,
    `- blockiert: ${counts.blocked}`,
    `- jetzt umsetzbar: ${counts.ready}`,
    ...(clarifyCount > 0 ? [`- zu klären: ${clarifyCount}`] : []),
    '',
  ]

  if (clarifyCount > 0) {
    lines.push('## Zu klären', '')
    if (selection.inconsistent.length > 0) {
      lines.push(
        `### Fertig trotz offener Voraussetzung (${selection.inconsistent.length})`,
        '',
        ...selection.inconsistent.map(
          (o) => `- ${name(o.id)} – wartet auf ${o.waitingFor.map((id) => `${name(id)} (${statusOf(id)})`).join(', ')}`,
        ),
        '',
      )
    }
    if (selection.unknownStatus.length > 0) {
      lines.push(
        `### Unbekannter Status (${selection.unknownStatus.length})`,
        '',
        ...selection.unknownStatus.map((o) => `- ${name(o.id)} – „${o.raw}“ (zählt als offen)`),
        '',
      )
    }
  }

  const path = selection.criticalPath
  if (path === null) {
    lines.push(
      '## Kritischer Pfad',
      '',
      `Kritischer Pfad nicht berechenbar – Zyklus zwischen ${selection.cycleIds.map(name).join(', ')}.`,
      '',
    )
  } else if (path.nodeIds.length === 0) {
    lines.push('## Kritischer Pfad (0 Schritte)', '', 'Kein offener Schritt.', '')
  } else {
    lines.push(
      `## Kritischer Pfad (${stepsText(path.length)})`,
      '',
      ...path.nodeIds.map((id, i) => `${i + 1}. ${name(id)} – ${statusOf(id)}`),
      '',
    )
  }

  if (selection.scope === 'project') {
    const ready = selection.blockers.filter((b) => b.ready)
    const blocked = selection.blockers.filter((b) => !b.ready)
    lines.push('## Jetzt umsetzbar', '', ...(ready.length > 0 ? ready.map(entry) : ['Nichts.']), '')
    lines.push('## Blockiert', '', ...(blocked.length > 0 ? blocked.map(entry) : ['Nichts.']), '')
  } else {
    lines.push(
      '## Blockierende Objekte',
      '',
      ...(selection.blockers.length > 0
        ? selection.blockers.map(entry)
        : ['Keine offenen Voraussetzungen – kann released werden.']),
      '',
    )
  }
  return lines.join('\n')
}
