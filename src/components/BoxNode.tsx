import type { CSSProperties } from 'react'
import type { NodeProps } from '@xyflow/react'
import type { BoxFlowNode } from '../flow/types'
import { NODE_SIZE } from '../model/types'
import { CycleBadge } from './CycleBadge'
import { NodeHandles } from './NodeHandles'
import { BlockedFlag, InconsistentMark, StatusMark } from './StatusMarks'
import './components.css'

export function BoxNode({ data, selected }: NodeProps<BoxFlowNode>) {
  const hasName = data.name.trim() !== ''
  const className = [
    'box-node',
    selected && 'box-node--selected',
    data.isConnectSource && 'box-node--connect-source',
    data.isDependency && 'box-node--dependency',
    data.isRevealed && 'box-node--revealed',
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
      {data.blockedTitle && <BlockedFlag title={data.blockedTitle} />}
      {data.inconsistentTitle && <InconsistentMark title={data.inconsistentTitle} />}
      {data.isInCycle && <CycleBadge />}
      <StatusMark status={data.status} raw={data.statusRaw} known={data.statusKnown} />
      <span className={hasName ? 'box-node__label' : 'box-node__label box-node__label--empty'}>
        {hasName ? data.name : data.id.slice(0, 8)}
      </span>
    </div>
  )
}
