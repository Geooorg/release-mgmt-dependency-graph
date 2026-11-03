import type { MessageKey } from '../i18n/messages'
import type { EdgeRole } from '../model/types'

/** Catalog keys of the display names and of the arrow meaning of each role. */
export const EDGE_ROLE_NAME_KEYS: Record<EdgeRole, MessageKey> = {
  sequence: 'types.role.sequence',
  dependency: 'types.role.dependency',
  flow: 'types.role.flow',
}

export const EDGE_ROLE_HINT_KEYS: Record<EdgeRole, MessageKey> = {
  sequence: 'types.role.sequence.hint',
  dependency: 'types.role.dependency.hint',
  flow: 'types.role.flow.hint',
}
