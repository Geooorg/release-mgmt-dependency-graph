import type { CSSProperties } from 'react'
import type { NodeProps } from '@xyflow/react'
import type { BoxFlowNode } from '../flow/types'
import { NODE_SIZE } from '../model/types'
import { NodeHandles } from './NodeHandles'
import './components.css'

export function BoxNode({ data, selected }: NodeProps<BoxFlowNode>) {
  const hasName = data.name.trim() !== ''
  const className = [
    'box-node',
    selected && 'box-node--selected',
    data.isConnectSource && 'box-node--connect-source',
    data.isDependency && 'box-node--dependency',
  ]
    .filter(Boolean)
    .join(' ')
  const style = {
    width: NODE_SIZE.width,
    height: NODE_SIZE.height,
    '--node-color': data.color,
    '--node-text': data.textColor,
  } as CSSProperties

  return (
    <div className={className} style={style}>
      <NodeHandles />
      <span className={hasName ? 'box-node__label' : 'box-node__label box-node__label--empty'}>
        {hasName ? data.name : data.id.slice(0, 8)}
      </span>
    </div>
  )
}
