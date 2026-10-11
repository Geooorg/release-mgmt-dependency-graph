import { createTranslate, type Translate } from '../i18n/translate'
import { stronglyConnectedComponents } from './cycles'
import { buildEffectiveGraph, type EffectiveGraph } from './effectiveGraph'
import { displayName } from './metadata'
import { DEFAULT_PROJECT_NAME } from './projectName'
import { isSoftEdge } from './softDependency'
import { getBlockReason, getStatusInfo, STATUS_LABEL_KEYS, type Status, type StatusInfo } from './status'
import type { GraphContent, ModelNode } from './types'

/**
 * Release analysis on top of the effective dependency graph (see `buildEffectiveGraph`).
 * `A -> B` means "A depends on B", so the successors of a vertex are its prerequisites.
 * Everything is pure, deterministic (ties are broken by node order) and iterative, so large
 * graphs cannot overflow the stack.
 *
 * Terms: an unfinished object (any status but `fertig`) is
 *  - *blocked* when its status is `blockiert` (set by hand, with an optional reason),
 *  - *waiting* when it is not blocked but has an unfinished direct prerequisite (computed),
 *  - *ready* otherwise ("jetzt umsetzbar").
 * A blocked object counts as unfinished, so everything that depends on it waits.
 *
 * "Finished is final": nothing is computed behind an object with the status `fertig`. It was
 * delivered, so what it once needed does not matter to the objects built on it. A finished object
 * therefore never waits, is never listed and never extends a chain, a prerequisite list or a cycle.
 *
 * Only objects (`kind: 'node'`) carry a status and count as work. A group without objects is a
 * vertex of the graph (its edges must not get lost) but has no work of its own, so it is
 * transparent: never unfinished, never blocked or waiting, not counted, and looked through.
 *
 * Soft (optional) edges count like any other edge, except for the critical path: it follows the hard
 * edges only, so a cycle closed or reached by a soft edge does not make it undefined either.
 */

export interface StatusCounts {
  /** Number of objects. */
  total: number
  done: number
  inProgress: number
  open: number
  /** Objects with the status `blockiert` (set by hand), whatever their prerequisites. */
  blocked: number
  /** Unfinished, not blocked objects with an unfinished direct prerequisite. */
  waiting: number
  /** Objects whose status value is none of the four (counted as `offen`). */
  unknownStatus: number
  /** Unfinished, not blocked objects without an unfinished prerequisite: can be worked on right now. */
  ready: number
}

export interface ProjectAnalysis {
  /** Effective status of every object. */
  statusById: Map<string, Status>
  /** Status with its raw value of every object (to tell "not set" and "unknown" from a real `offen`). */
  statusInfoById: Map<string, StatusInfo>
  /** Objects whose status value is unknown, with the raw value, in node order. */
  unknownStatusIds: Map<string, string>
  /** Objects with the status `blockiert`, plus groups containing such an object. */
  blockedIds: Set<string>
  /** Reason of every blocked object that has one (trimmed). */
  blockReasons: Map<string, string>
  /** Unfinished, not blocked objects with an unfinished direct prerequisite, plus groups containing such an object. */
  waitingIds: Set<string>
  /**
   * Per waiting or blocked object that has unfinished prerequisites: the unfinished direct
   * prerequisites (looking through groups without objects, never through finished objects), in node order.
   */
  waitingFor: Map<string, string[]>
  /** Per group: the blocked objects inside (any depth), in node order. */
  blockedMembers: Map<string, string[]>
  /** Per group: the waiting objects inside (any depth), in node order. */
  waitingMembers: Map<string, string[]>
  /** Unfinished, not blocked objects without an unfinished direct prerequisite. */
  readyIds: Set<string>
  /** Per group: finished and total objects inside (any depth). */
  groupProgress: Map<string, { done: number; total: number }>
  counts: StatusCounts
}

export type WorkState = 'blocked' | 'waiting' | 'ready'

/** An unfinished object in the scope of an analysis. */
export interface UnfinishedObject {
  id: string
  status: Status
  /** `blocked`: status `blockiert`; `waiting`: unfinished prerequisite; `ready`: can be worked on right now. */
  state: WorkState
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
  /**
   * Unfinished prerequisites of the selection, reached over unfinished objects only (the unfinished
   * objects of the project in `project` scope): blocked ones first, then ready ones, then waiting ones;
   * each group in release order.
   */
  unfinished: UnfinishedObject[]
  /** Selected objects that are blocked themselves. */
  selectedBlocked: string[]
  /** The selection itself is finished (so its prerequisites are not looked at); never true in `project` scope. */
  selectionFinished: boolean
  /**
   * Along hard edges only (soft ones are left out). Null when the part reached that way contains a
   * cycle of unfinished objects (the longest chain is not defined then).
   */
  criticalPath: CriticalPath | null
  /** Objects of the cycles of unfinished objects (and empty groups) that leave the critical path undefined; empty if there are none. */
  cycleIds: string[]
  /** Objects of the relevant graph (selection and its unfinished prerequisites) whose status value is unknown (they count as `offen`). */
  unknownStatus: { id: string; raw: string }[]
}

/** Blocked objects come first in lists, then the ones that can be worked on, then the waiting ones. */
const STATE_RANK: Record<WorkState, number> = { blocked: 0, ready: 1, waiting: 2 }

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
  /** Finished object: analysis stops here. */
  done: boolean[]
  /** Status `blockiert`. */
  manual: boolean[]
  /** Per unfinished object: its unfinished direct prerequisites, looking through empty groups; ascending. */
  direct: number[][]
  /** Unfinished object with an unfinished direct prerequisite (a vertex of a cycle of unfinished ones waits for itself). */
  waiting: boolean[]
}

/** Unfinished objects reached from `from` without passing a finished object; empty groups are walked through. */
function unfinishedPrerequisites(succ: readonly (readonly number[])[], open: readonly boolean[], done: readonly boolean[], from: number): number[] {
  const found = new Set<number>()
  const seen = new Set<number>()
  const stack = [...succ[from]]
  while (stack.length > 0) {
    const w = stack.pop() as number
    if (seen.has(w)) continue
    seen.add(w)
    if (open[w]) found.add(w)
    else if (!done[w]) stack.push(...succ[w])
  }
  return [...found].sort((a, b) => a - b)
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
  const done = status.map((s) => s === 'fertig')
  const manual = status.map((s) => s === 'blockiert')

  const direct = vertices.map((_, i) => (open[i] ? unfinishedPrerequisites(succ, open, done, i) : []))
  const waiting = direct.map((list) => list.length > 0)
  return { graph, indexOf, succ, pred, isObject, info, status, open, done, manual, direct, waiting }
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
  const blockReasons = new Map<string, string>()
  const waitingIds = new Set<string>()
  const readyIds = new Set<string>()
  const waitingFor = new Map<string, string[]>()
  const counts: StatusCounts = {
    total: 0,
    done: 0,
    inProgress: 0,
    open: 0,
    blocked: 0,
    waiting: 0,
    unknownStatus: 0,
    ready: 0,
  }

  const namesOf = (indices: readonly number[]) => indices.map((w) => vertices[w])
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
    else if (status === 'blockiert') counts.blocked++
    else counts.open++
    if (p.manual[i]) {
      // A blocked object that also waits is shown as blocked only; what it waits for is kept for the tooltip.
      blockedIds.add(id)
      const reason = getBlockReason(byId.get(id)?.metadata ?? [])
      if (reason !== undefined) blockReasons.set(id, reason)
      if (p.waiting[i]) waitingFor.set(id, namesOf(p.direct[i]))
    } else if (p.waiting[i]) {
      waitingIds.add(id)
      counts.waiting++
      waitingFor.set(id, namesOf(p.direct[i]))
    } else if (p.open[i]) {
      readyIds.add(id)
      counts.ready++
    }
  })

  const groupProgress = new Map<string, { done: number; total: number }>()
  const blockedMembers = new Map<string, string[]>()
  const waitingMembers = new Map<string, string[]>()
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
      if (waitingIds.has(node.id)) addMember(waitingMembers, groupId, node.id)
    }
  }
  for (const groupId of blockedMembers.keys()) blockedIds.add(groupId)
  for (const groupId of waitingMembers.keys()) waitingIds.add(groupId)

  return {
    statusById,
    statusInfoById,
    unknownStatusIds,
    blockedIds,
    blockReasons,
    waitingIds,
    waitingFor,
    blockedMembers,
    waitingMembers,
    readyIds,
    groupProgress,
    counts,
  }
}

/**
 * Per vertex: the number of unfinished objects on the longest chain of unfinished prerequisites
 * below it (Infinity if the vertex lies on, or depends on, a cycle of unfinished objects). Finished
 * objects end a chain: they are left out. Kahn's algorithm, prerequisites first.
 */
function chainDepths(p: Prepared): number[] {
  const count = p.succ.length
  const depth = new Array<number>(count).fill(Infinity)
  const pending = p.succ.map((list, i) => (p.done[i] ? 0 : list.filter((w) => !p.done[w]).length))
  const queue: number[] = []
  pending.forEach((n, i) => {
    if (p.done[i]) depth[i] = 0
    else if (n === 0) queue.push(i)
  })
  for (let head = 0; head < queue.length; head++) {
    const v = queue[head]
    let longest = 0
    for (const w of p.succ[v]) {
      if (!p.done[w]) longest = Math.max(longest, depth[w] + (p.open[w] ? 1 : 0))
    }
    depth[v] = longest
    for (const dependent of p.pred[v]) {
      if (!p.done[dependent] && --pending[dependent] === 0) queue.push(dependent)
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
    const next = p.succ[current].find((w) => !p.done[w] && depth[w] + weight(w) === depth[current]) as number
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

/** Vertices on a cycle of unfinished objects and empty groups (a finished object breaks a cycle), in vertex order. */
function openCycleMembers(p: Prepared): number[] {
  const alive = p.succ.map((list, i) => (p.done[i] ? [] : list.filter((w) => !p.done[w])))
  const component = stronglyConnectedComponents(alive)
  const size = new Map<number, number>()
  component.forEach((c) => size.set(c, (size.get(c) ?? 0) + 1))
  return component.flatMap((c, i) => ((size.get(c) ?? 0) > 1 ? [i] : []))
}

/**
 * Shortest distance from the starts (-1 = not reached), never expanding a finished object; `below`
 * marks vertices reached by one or more steps.
 */
function reach(p: Prepared, starts: readonly number[]): { distance: number[]; below: boolean[] } {
  const distance = new Array<number>(p.succ.length).fill(-1)
  const below = p.succ.map(() => false)
  const queue = [...starts]
  starts.forEach((s) => (distance[s] = 0))
  for (let head = 0; head < queue.length; head++) {
    const v = queue[head]
    if (p.done[v]) continue
    for (const w of p.succ[v]) {
      below[w] = true
      if (distance[w] === -1) {
        distance[w] = distance[v] + 1
        queue.push(w)
      }
    }
  }
  return { distance, below }
}

/**
 * What stands between the selection and its release: unfinished transitive prerequisites and the
 * critical path (the longest chain of consecutive unfinished objects). The walk stops at finished
 * objects, also at a finished selection. A selected group starts at all its members. Nothing
 * selected = the whole project.
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

  const reached = reach(p, starts)
  const { distance } = reached

  const depth = chainDepths(p)
  const stateOf = (i: number): WorkState => (p.manual[i] ? 'blocked' : p.waiting[i] ? 'waiting' : 'ready')
  const unfinished = vertices
    .map((_, i) => i)
    .filter((i) => p.open[i] && distance[i] !== -1 && (whole || !startSet.has(i)))
    .sort((a, b) => {
      const rankA = STATE_RANK[stateOf(a)]
      const rankB = STATE_RANK[stateOf(b)]
      if (rankA !== rankB) return rankA - rankB
      return depth[a] === depth[b] ? a - b : depth[a] < depth[b] ? -1 : 1
    })
    .map((i) => ({
      id: vertices[i],
      status: p.status[i] as Status,
      state: stateOf(i),
      distance: distance[i],
    }))
  const selectedBlocked = selectedIds.filter((id) => {
    const index = p.indexOf.get(id)
    return index !== undefined && p.manual[index]
  })

  // Same vertices in the same order as `p`, so the indices carry over.
  const hardEdges = content.edges.filter((e) => !isSoftEdge(e))
  const hard = hardEdges.length === content.edges.length ? p : prepare({ ...content, edges: hardEdges })
  const hardReach = hard === p ? reached : reach(hard, starts)
  const cycleIds = openCycleMembers(hard)
    .filter((i) => hardReach.distance[i] !== -1)
    .map((i) => vertices[i])

  let criticalPath: CriticalPath | null = null
  if (cycleIds.length === 0) {
    // A start that another start depends on is covered by that start's chain.
    const roots = starts.filter((s) => !hardReach.below[s])
    criticalPath = longestChain(hard, hard === p ? depth : chainDepths(hard), roots.length > 0 ? roots : starts)
  }

  const unknownStatus = vertices.flatMap((id, i) => {
    const info = p.info[i]
    return distance[i] !== -1 && info && !info.known && info.raw !== undefined ? [{ id, raw: info.raw }] : []
  })

  return {
    scope: whole ? 'project' : 'selection',
    selectedIds,
    unfinished,
    selectedBlocked,
    selectionFinished: !whole && starts.every((s) => p.done[s]),
    criticalPath,
    cycleIds,
    unknownStatus,
  }
}

const MAX_LISTED_NAMES = 5

/** "A, B, C" with at most five names, then "…". */
export function joinNames(names: readonly string[]): string {
  const shown = names.slice(0, MAX_LISTED_NAMES).join(', ')
  return names.length > MAX_LISTED_NAMES ? `${shown}, …` : shown
}

/** Markdown report (for the clipboard) of the analysis of a selection or the whole project. */
export function formatAnalysisMarkdown(
  content: GraphContent,
  project: ProjectAnalysis,
  selection: SelectionAnalysis,
  t: Translate = createTranslate('de'),
): string {
  const byId = new Map(content.nodes.map((n) => [n.id, n]))
  const name = (id: string) => {
    const node = byId.get(id)
    return node ? displayName(node) : id.slice(0, 8)
  }
  const statusName = (status: Status) => t(STATUS_LABEL_KEYS[status])
  const statusOf = (id: string) => statusName(project.statusById.get(id) ?? 'offen')
  const reasonOf = (id: string) => project.blockReasons.get(id) ?? t('analysis.noReason')
  const waitsFor = (id: string) => t('analysis.waitsFor', { names: joinNames((project.waitingFor.get(id) ?? []).map(name)) })
  const blockedLine = (id: string) => `- ${name(id)} – ${t('analysis.md.blockedDetail', { reason: reasonOf(id) })}`
  const entry = (u: UnfinishedObject) => {
    if (u.state === 'blocked') return blockedLine(u.id)
    if (u.state === 'ready') return `- ${name(u.id)} – ${statusName(u.status)}, ${t('analysis.ready')}`
    return `- ${name(u.id)} – ${statusName(u.status)}, ${waitsFor(u.id)}`
  }

  const target = selection.scope === 'project' ? t('analysis.wholeProject') : selection.selectedIds.map(name).join(', ')
  const { counts } = project
  const clarifyCount = selection.unknownStatus.length
  const countLine = (label: string, count: number) => t('analysis.md.count', { label, count })
  const lines = [
    `# ${t('analysis.md.title', { project: content.projectName ?? DEFAULT_PROJECT_NAME, target })}`,
    '',
    countLine(statusName('fertig'), counts.done),
    countLine(statusName('in Arbeit'), counts.inProgress),
    countLine(statusName('offen'), counts.open),
    countLine(statusName('blockiert'), counts.blocked),
    countLine(t('analysis.waiting'), counts.waiting),
    countLine(t('analysis.ready'), counts.ready),
    ...(clarifyCount > 0 ? [countLine(t('analysis.toClarify'), clarifyCount)] : []),
    '',
  ]

  if (selection.selectedBlocked.length > 0) {
    lines.push(
      `## ${t('analysis.selfBlocked.label')}`,
      '',
      ...selection.selectedBlocked.map((id) => `- ${name(id)} – ${reasonOf(id)}`),
      '',
    )
  }

  if (clarifyCount > 0) {
    lines.push(
      `## ${t('analysis.clarify.title')}`,
      '',
      `### ${t('analysis.unknownStatus.title', { count: clarifyCount })}`,
      '',
      ...selection.unknownStatus.map((o) => `- ${t('analysis.unknownStatus.item', { name: name(o.id), raw: o.raw })}`),
      '',
    )
  }

  const pathLines: string[] = []
  const path = selection.criticalPath
  if (path === null) {
    pathLines.push(
      `## ${t('analysis.criticalPath')}`,
      '',
      t('analysis.criticalPath.cycle', { names: selection.cycleIds.map(name).join(', ') }),
      '',
    )
  } else if (path.nodeIds.length === 0) {
    pathLines.push(
      `## ${t('analysis.criticalPath.steps', { steps: t.plural('analysis.steps', 0) })}`,
      '',
      t('analysis.criticalPath.empty'),
      '',
    )
  } else {
    pathLines.push(
      `## ${t('analysis.criticalPath.steps', { steps: t.plural('analysis.steps', path.length) })}`,
      '',
      ...path.nodeIds.map((id, i) => `${i + 1}. ${name(id)} – ${statusOf(id)}`),
      '',
    )
  }

  if (selection.scope === 'project') {
    const inState = (state: WorkState) => selection.unfinished.filter((u) => u.state === state)
    const section = (title: string, items: string[]) =>
      lines.push(`## ${title}`, '', ...(items.length > 0 ? items : [t('analysis.nothing')]), '')
    section(t('analysis.section.blocked'), inState('blocked').map((u) => `- ${name(u.id)} – ${reasonOf(u.id)}`))
    section(t('analysis.section.ready'), inState('ready').map((u) => `- ${name(u.id)} – ${statusName(u.status)}`))
    section(
      t('analysis.section.waiting'),
      inState('waiting').map((u) => `- ${name(u.id)} – ${statusName(u.status)}, ${waitsFor(u.id)}`),
    )
    lines.push(...pathLines)
  } else {
    lines.push(
      ...pathLines,
      `## ${t('analysis.section.prerequisites')}`,
      '',
      ...(selection.unfinished.length > 0
        ? selection.unfinished.map(entry)
        : [selection.selectionFinished ? t('analysis.finishedHint') : t('analysis.empty.prerequisites')]),
      '',
    )
  }
  return lines.join('\n')
}
