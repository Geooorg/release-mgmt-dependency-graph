import type { CSSProperties } from 'react'
import { NodeResizer } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { GroupFlowNode } from '../flow/types'
import { GROUP_HEADER_HEIGHT, GROUP_MIN_SIZE } from '../model/types'
import { CycleBadge } from './CycleBadge'
import { NodeHandles } from './NodeHandles'
import { NodeName } from './NodeName'
import { BlockedFlag, WaitingMark } from './StatusMarks'
import './components.css'

export function GroupNode({ data, selected }: NodeProps<GroupFlowNode>) {
  const className = [
    'group-node',
    data.isDropTarget && 'group-node--drop-target',
    data.isConnectSource && 'group-node--connect-source',
    data.isDependency && 'group-node--dependency',
    data.isRevealed && 'group-node--revealed',
  ]
    .filter(Boolean)
    .join(' ')

  const style = { '--node-color': data.color, '--node-text': data.textColor } as CSSProperties

  return (
    <div className={className} style={style}>
      <NodeResizer
        isVisible={selected}
        minWidth={GROUP_MIN_SIZE.width}
        minHeight={GROUP_MIN_SIZE.height}
      />
      <NodeHandles />
      {data.isInCycle && <CycleBadge onGroup />}
      <div className="group-node__header" style={{ height: GROUP_HEADER_HEIGHT }}>
        {data.blockedTitle && <BlockedFlag title={data.blockedTitle} inline />}
        {data.waitingTitle && <WaitingMark title={data.waitingTitle} inline />}
        <NodeName id={data.id} name={data.name} className="group-node__label" />
      </div>
    </div>
  )
}
