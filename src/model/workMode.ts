import type { DependencyDirection } from './dependency'

/** `build`: edit the structure of the graph; `analyze`: release analysis, structure is locked. */
export type WorkMode = 'build' | 'analyze'

/** What the analysis mode draws in red: the critical path, a dependency direction of the selection, or nothing. */
export type Highlight = 'critical' | DependencyDirection | 'off'

export const DEFAULT_WORK_MODE: WorkMode = 'build'
export const DEFAULT_HIGHLIGHT: Highlight = 'critical'

/** Anything that is not a known mode (missing, corrupt or from a newer version) means `build`. */
export function parseWorkMode(value: unknown): WorkMode {
  return value === 'analyze' ? 'analyze' : DEFAULT_WORK_MODE
}
