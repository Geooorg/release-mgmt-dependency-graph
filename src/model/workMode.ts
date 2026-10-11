import type { DependencyDirection } from './dependency'

/** `build`: edit the structure of the graph; `analyze`: release analysis, structure is locked. */
export type WorkMode = 'build' | 'analyze'

/** What the analysis mode draws in red: the critical path, a dependency direction of the selection, or nothing. */
export type Highlight = 'critical' | DependencyDirection | 'off'

/**
 * The tool of the build mode (mutually exclusive): `select` clicks select, `create` clicks on free
 * space add an object, `note` clicks on free space add a sticky note, `connect` clicks pick source
 * and target of a connection.
 */
export type Tool = 'select' | 'create' | 'note' | 'connect'

export const DEFAULT_TOOL: Tool = 'select'
export const DEFAULT_WORK_MODE: WorkMode = 'build'
export const DEFAULT_HIGHLIGHT: Highlight = 'critical'

/** Anything that is not a known mode (missing, corrupt or from a newer version) means `build`. */
export function parseWorkMode(value: unknown): WorkMode {
  return value === 'analyze' ? 'analyze' : DEFAULT_WORK_MODE
}
