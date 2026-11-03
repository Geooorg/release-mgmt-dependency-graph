import { MarkerType, type Edge } from '@xyflow/react'
import { createTranslate, type Translate } from '../i18n/translate'
import { arrowHeadFor, getEdgeRoles, hasAnalysisRole } from '../model/edgeRoles'
import { getSize, pickSides, sortParentsFirst } from '../model/graph'
import { displayName, getColor, getContrastColor, getEdgeName, getName } from '../model/metadata'
import { joinNames, type ProjectAnalysis } from '../model/releaseAnalysis'
import { isSoftEdge } from '../model/softDependency'
import { resolveColor, resolveType } from '../model/typing'
import { NOTE_DEFAULT_COLOR } from '../model/types'
import type { Catalog, ModelEdge, ModelNode } from '../model/types'
import type { AppFlowNode } from './types'

export interface FlowUiState {
  selectedIds: ReadonlySet<string>
  connectSourceId: string | null
  dropTargetId: string | null
  /** Elements/edges of the highlighted dependency graph (empty = none). */
  dependencyNodeIds: ReadonlySet<string>
  dependencyEdgeIds: ReadonlySet<string>
  /** Elements that are part of a dependency cycle. */
  cycleNodeIds: ReadonlySet<string>
  /** Status and blockers of the project; undefined = no status marks. */
  analysis?: ProjectAnalysis
  /** Element flashing after a click in the analysis panel. */
  revealedId?: string | null
  /** Types of the project; undefined = none. */
  catalog?: Catalog
}

/** Colour of a known connection type; undefined = default blue. Selection, dependency and cycle colours win over it. */
export function edgeTypeColor(edge: ModelEdge, catalog: Catalog | undefined): string | undefined {
  const resolved = resolveType(edge.metadata ?? [], catalog?.edgeTypes ?? [])
  return resolved.state === 'known' ? resolved.def.color?.toLowerCase() : undefined
}

const EDGE_COLOR = '#2563eb'
const EDGE_COLOR_SELECTED = '#1e3a8a'
const EDGE_COLOR_DEPENDENCY = '#dc2626'
const EDGE_COLOR_CYCLE = '#9333ea'
const EDGE_COLOR_CYCLE_SELECTED = '#6b21a8'
const CYCLE_DASH = '6 4'
/** Soft (optional) edges are dotted: short dashes with round caps, spaced relative to the stroke width. */
const softDash = (width: number) => `1 ${width * 3}`
const NO_IDS: ReadonlySet<string> = new Set()
const DIMMED_OPACITY = 0.35

/** Model nodes -> React Flow nodes (parents first, sizes fixed from the model); tooltips are written in the language of `t`. */
export function toFlowNodes(
  nodes: readonly ModelNode[],
  ui: FlowUiState,
  t: Translate = createTranslate('de'),
): AppFlowNode[] {
  const names = new Map(nodes.map((n) => [n.id, displayName(n)]))
  const namesOf = (ids: readonly string[]) => ids.map((id) => names.get(id) ?? id.slice(0, 8))
  const { analysis } = ui

  // Red flag: status `blockiert` (a group: a member has it). It wins over the hourglass.
  const blockedTitle = (node: ModelNode): string | undefined => {
    if (!analysis?.blockedIds.has(node.id)) return undefined
    if (node.kind === 'group') {
      return t('node.blockedMembers', { names: joinNames(namesOf(analysis.blockedMembers.get(node.id) ?? [])) })
    }
    const reason = analysis.blockReasons.get(node.id)
    const title = reason === undefined ? t('analysis.blocked.noReason') : t('analysis.blocked.reason', { reason })
    const waiting = analysis.waitingFor.get(node.id) ?? []
    return waiting.length > 0 ? t('node.blockedAlsoWaiting', { title, names: joinNames(namesOf(waiting)) }) : title
  }

  // Hourglass: unfinished, not blocked, with an unfinished direct prerequisite (a group: a member waits).
  // Finished objects carry neither flag nor hourglass.
  const waitingTitle = (node: ModelNode): string | undefined => {
    if (!analysis?.waitingIds.has(node.id)) return undefined
    if (node.kind === 'group') {
      return t('node.waitingMembers', { names: joinNames(namesOf(analysis.waitingMembers.get(node.id) ?? [])) })
    }
    return t('analysis.waitingMark', { names: joinNames(namesOf(analysis.waitingFor.get(node.id) ?? [])) })
  }

  return sortParentsFirst(nodes).map((node) => {
    const { width, height } = getSize(node)
    // A note without a colour entry is sticky-note yellow; the others fall back to blue in the styles.
    const elementTypes = ui.catalog?.elementTypes ?? []
    const resolved = node.kind === 'node' ? resolveType(node.metadata, elementTypes) : ({ state: 'none' } as const)
    const color =
      (node.kind === 'node' ? resolveColor(node.metadata, elementTypes) : getColor(node.metadata)) ??
      (node.kind === 'note' ? NOTE_DEFAULT_COLOR : undefined)
    return {
      id: node.id,
      type: node.kind === 'group' ? 'group' : node.kind === 'note' ? 'note' : 'box',
      position: node.position,
      parentId: node.parentId,
      width,
      height,
      selected: ui.selectedIds.has(node.id),
      data: {
        id: node.id,
        name: getName(node.metadata),
        isConnectSource: ui.connectSourceId === node.id,
        isDropTarget: ui.dropTargetId === node.id,
        isDependency: ui.dependencyNodeIds.has(node.id),
        isInCycle: ui.cycleNodeIds.has(node.id),
        isRevealed: ui.revealedId === node.id,
        status: analysis?.statusById.get(node.id),
        statusRaw: analysis?.statusInfoById.get(node.id)?.raw,
        statusKnown: analysis?.statusInfoById.get(node.id)?.known,
        blockedTitle: blockedTitle(node),
        waitingTitle: waitingTitle(node),
        ...(resolved.state === 'known' && { typeName: resolved.def.name, icon: resolved.def.icon }),
        ...(resolved.state === 'unknown' && { typeUnknown: true }),
        color,
        textColor: color && getContrastColor(color),
      },
    } as AppFlowNode
  })
}

/**
 * Directed edges with an arrow at the target: blue, darker when selected, thick red when part of
 * the highlighted dependency graph. Edges in a cycle are purple and dashed; the dependency colour
 * wins over the cycle colour, the dashes stay. Soft (optional) edges are dotted instead, whatever
 * their colour. The accessible label is written in the language
 * of `t`. In the analysis mode, connections that no analysis uses are dimmed. Connectors are the ones the edge was drawn between; edges without stored connectors
 * (older files) get the facing sides.
 */
export function toFlowEdges(
  edges: readonly ModelEdge[],
  selectedIds: ReadonlySet<string>,
  dependencyIds: ReadonlySet<string>,
  nodes: readonly ModelNode[],
  cycleIds: ReadonlySet<string> = NO_IDS,
  t: Translate = createTranslate('de'),
  catalog?: Catalog,
  analyzing = false,
): Edge[] {
  const names = new Map(nodes.map((n) => [n.id, displayName(n)]))
  return edges.map((edge) => {
    const facing = edge.sourceHandle && edge.targetHandle ? undefined : pickSides(nodes, edge.source, edge.target)
    const selected = selectedIds.has(edge.id)
    const dependency = dependencyIds.has(edge.id)
    const cyclic = cycleIds.has(edge.id)
    const soft = isSoftEdge(edge)
    const roles = getEdgeRoles(edge, catalog)
    const open = arrowHeadFor(roles) === 'open'
    // Selected and highlighted connections stay readable; only the ones no analysis reads fade out.
    const dimmed = analyzing && !selected && !dependency && !hasAnalysisRole(roles)
    const width = dependency ? 6 : selected || cyclic ? 3 : 2
    const color = dependency
      ? EDGE_COLOR_DEPENDENCY
      : cyclic
        ? selected
          ? EDGE_COLOR_CYCLE_SELECTED
          : EDGE_COLOR_CYCLE
        : selected
          ? EDGE_COLOR_SELECTED
          : (edgeTypeColor(edge, catalog) ?? EDGE_COLOR)
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? facing?.sourceHandle,
      targetHandle: edge.targetHandle ?? facing?.targetHandle,
      selected,
      // React Flow's own default is an English sentence built from the raw ids.
      ariaLabel: t(soft ? 'flow.edge.label.soft' : 'flow.edge.label', {
        source: names.get(edge.source) ?? edge.source.slice(0, 8),
        target: names.get(edge.target) ?? edge.target.slice(0, 8),
      }),
      label: getEdgeName(edge) || undefined,
      labelStyle: { fill: color, fontWeight: 600, fontSize: 13, opacity: dimmed ? DIMMED_OPACITY : undefined },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 4,
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.92, stroke: color, strokeWidth: 1 },
      // Highlighted edges paint above everything else.
      zIndex: dependency ? 1000 : undefined,
      style: {
        stroke: color,
        strokeWidth: width,
        strokeDasharray: soft ? softDash(width) : cyclic ? CYCLE_DASH : undefined,
        strokeLinecap: soft ? 'round' : undefined,
        opacity: dimmed ? DIMMED_OPACITY : undefined,
      },
      markerEnd: {
        type: open ? MarkerType.Arrow : MarkerType.ArrowClosed,
        color,
        width: dependency ? 12 : 20,
        height: dependency ? 12 : 20,
        ...(open && { strokeWidth: 2 }),
      },
    }
  })
}
