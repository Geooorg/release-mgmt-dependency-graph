import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { BoxFlowNode } from '../flow/types'
import { NODE_SIZE } from '../model/types'
import './components.css'

export function BoxNode({ data, selected }: NodeProps<BoxFlowNode>) {
  const hasName = data.name.trim() !== ''
  const className = [
    'box-node',
    selected && 'box-node--selected',
    data.isConnectSource && 'box-node--connect-source',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className} style={{ width: NODE_SIZE.width, height: NODE_SIZE.height }}>
      <Handle className="node-handle" type="target" position={Position.Left} />
      <span className={hasName ? 'box-node__label' : 'box-node__label box-node__label--empty'}>
        {hasName ? data.name : data.id.slice(0, 8)}
      </span>
      <Handle className="node-handle" type="source" position={Position.Right} />
    </div>
  )
}
