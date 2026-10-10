import { Handle, Position } from '@xyflow/react'
import type { HandleSide } from '../model/types'

const SIDES: readonly [HandleSide, Position][] = [
  ['top', Position.Top],
  ['right', Position.Right],
  ['bottom', Position.Bottom],
  ['left', Position.Left],
]

/**
 * The four connectors of an element. All are `source` handles: the canvas runs in loose
 * connection mode, so any connector can start or end an edge and the direction is simply
 * "where the drag began -> where it ended".
 */
export function NodeHandles() {
  return (
    <>
      {SIDES.map(([side, position]) => (
        <Handle key={side} id={side} className="node-handle" type="source" position={position} />
      ))}
    </>
  )
}
