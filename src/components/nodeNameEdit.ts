import { createContext } from 'react'

export interface NodeNameEdit {
  /** A double click on a name starts the inline editor. Off while another tool needs the clicks. */
  enabled: boolean
  /** Called once with the changed name when the editor is confirmed. */
  onRename: (id: string, name: string) => void
}

/** Lets the node components rename themselves without knowing about the store. */
export const NodeNameEditContext = createContext<NodeNameEdit>({ enabled: false, onRename: () => {} })
