import { Text } from '@mantine/core'
import { Handle, Position } from '@xyflow/react'
import { EnvVarNode, PackageNode } from './nodeTypes.env'
import { FileNode2, SourceNode, TestNodeComp } from './nodeTypes.file'
import { MigrationNode } from './nodeTypes.migration'
import { RouteNode } from './nodeTypes.route'
import { EndpointHitNode, RoleAccessNode, SessionUserNode } from './nodeTypes.session'

export { EnvVarNode, PackageNode } from './nodeTypes.env'
export { FileNode2, SourceNode, TestNodeComp } from './nodeTypes.file'
export { MigrationNode } from './nodeTypes.migration'
export { RouteNode } from './nodeTypes.route'
export { EndpointHitNode, RoleAccessNode, SessionUserNode } from './nodeTypes.session'
export { openInEditor } from './nodeTypes.utils'

export function FlowNode({ data }: { data: { label: string; description?: string; color?: string; type?: string } }) {
  const isDiamond = data.type === 'decision'
  return (
    <div
      style={{
        padding: isDiamond ? 12 : 8,
        borderRadius: isDiamond ? 4 : 8,
        border: `2px solid var(--mantine-color-${data.color || 'blue'}-6)`,
        background: 'var(--mantine-color-body)',
        minWidth: isDiamond ? 120 : 160,
        textAlign: 'center',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: `var(--mantine-color-${data.color || 'blue'}-6)` }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: `var(--mantine-color-${data.color || 'blue'}-6)` }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: `var(--mantine-color-${data.color || 'blue'}-6)` }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        style={{ background: `var(--mantine-color-${data.color || 'blue'}-6)` }}
      />
      <Text size="xs" fw={700}>
        {data.label}
      </Text>
      {data.description && (
        <Text size="xs" c="dimmed">
          {data.description}
        </Text>
      )}
    </div>
  )
}

export const projectNodeTypes = { route: RouteNode, file: FileNode2, flow: FlowNode }
export const envNodeTypes = { envVar: EnvVarNode, file: FileNode2 }
export const testNodeTypes = { source: SourceNode, test: TestNodeComp }
export const depNodeTypes = { package: PackageNode, file: FileNode2 }
export const migrationNodeTypes = { migration: MigrationNode }
export const sessionNodeTypes = { sessionUser: SessionUserNode, roleAccess: RoleAccessNode }
export const liveNodeTypes = { endpoint: EndpointHitNode, flow: FlowNode }
