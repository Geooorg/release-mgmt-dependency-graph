import { getSize } from './graph'
import { GROUP_HEADER_HEIGHT, GROUP_PADDING } from './types'
import type { GraphContent, ModelNode } from './types'

/**
 * Makes the parent group of `memberId` large enough to hold the member, then does the same for that
 * group in its own parent, and so on up. A member that already lies inside the usable area of its
 * group (below the header) changes nothing. Otherwise the group grows just enough to leave
 * `GROUP_PADDING` around the member (below the header at the top); growing to the left or top moves
 * the group's origin and shifts its children the other way, so no element moves on screen.
 * Edges are untouched. Pure; returns the same reference when nothing has to grow.
 */
export function growGroupsToFit(content: GraphContent, memberId: string): GraphContent {
  let nodes = content.nodes
  let currentId: string | undefined = memberId
  while (currentId !== undefined) {
    const member: ModelNode | undefined = nodes.find((n) => n.id === currentId)
    const group = member?.parentId === undefined ? undefined : nodes.find((n) => n.id === member.parentId)
    if (member === undefined || group === undefined) break

    const grown = growGroup(nodes, group, member)
    if (grown === nodes) break
    nodes = grown
    currentId = group.id
  }
  return nodes === content.nodes ? content : { ...content, nodes }
}

function growGroup(nodes: ModelNode[], group: ModelNode, member: ModelNode): ModelNode[] {
  const { width, height } = getSize(group)
  const size = getSize(member)
  const { x, y } = member.position

  // The group's new edges in its current coordinate system (negative = grows to the left / top).
  const left = x < 0 ? x - GROUP_PADDING : 0
  const top = y < GROUP_HEADER_HEIGHT ? y - GROUP_HEADER_HEIGHT - GROUP_PADDING : 0
  const right = x + size.width > width ? x + size.width + GROUP_PADDING : width
  const bottom = y + size.height > height ? y + size.height + GROUP_PADDING : height
  if (left === 0 && top === 0 && right === width && bottom === height) return nodes

  return nodes.map((node) => {
    if (node.id === group.id) {
      return {
        ...node,
        position: { x: node.position.x + left, y: node.position.y + top },
        size: { width: right - left, height: bottom - top },
      }
    }
    if (node.parentId === group.id) {
      return { ...node, position: { x: node.position.x - left, y: node.position.y - top } }
    }
    return node
  })
}
