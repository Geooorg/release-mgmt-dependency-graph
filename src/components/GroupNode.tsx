import type { CSSProperties } from 'react'
import { NodeResizer } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { GroupFlowNode } from '../flow/types'
import { GROUP_HEADER_HEIGHT, GROUP_MIN_SIZE } from '../model/types'
import { CycleBadge } from './CycleBadge'
import { NodeHandles } from './NodeHandles'
import { BlockedFlag, InconsistentMark } from './StatusMarks'
import './components.css'

export function GroupNode({ data, selected }: NodeProps<GroupFlowNode>) {
  const hasName = data.name.trim() !== ''
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
        {data.inconsistentTitle && <InconsistentMark title={data.inconsistentTitle} inline />}
        <span className={hasName ? 'group-node__label' : 'group-node__label group-node__label--empty'}>
          {hasName ? data.name : data.id.slice(0, 8)}
        </span>
      </div>
    </div>
  )
}
