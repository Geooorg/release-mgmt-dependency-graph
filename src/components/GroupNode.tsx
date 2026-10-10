import type { CSSProperties } from 'react'
import { NodeResizer } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { GroupFlowNode } from '../flow/types'
import { GROUP_HEADER_HEIGHT, GROUP_MIN_SIZE } from '../model/types'
import { NodeHandles } from './NodeHandles'
import './components.css'

export function GroupNode({ data, selected }: NodeProps<GroupFlowNode>) {
  const hasName = data.name.trim() !== ''
  const className = [
    'group-node',
    data.isDropTarget && 'group-node--drop-target',
    data.isConnectSource && 'group-node--connect-source',
    data.isDependency && 'group-node--dependency',
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
      <div className="group-node__header" style={{ height: GROUP_HEADER_HEIGHT }}>
        <span className={hasName ? 'group-node__label' : 'group-node__label group-node__label--empty'}>
          {hasName ? data.name : data.id.slice(0, 8)}
        </span>
      </div>
    </div>
  )
}
