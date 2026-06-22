import { Badge, Group, Text } from '@mantine/core'
import { Handle, Position } from '@xyflow/react'
import { CATEGORY_COLORS, type EnvVar } from '../shared'

export function EnvVarNode({ data }: { data: EnvVar }) {
  return (
    <div
      style={{
        padding: 8,
        borderRadius: 8,
        border: `2px solid var(--mantine-color-${data.isSet ? 'green' : 'red'}-6)`,
        background: 'var(--mantine-color-body)',
        minWidth: 200,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: 'var(--mantine-color-green-6)' }} />
      <Handle type="source" position={Position.Right} style={{ background: 'var(--mantine-color-green-6)' }} />
      <Group gap={6} mb={4}>
        <Badge size="xs" color={data.required ? 'red' : 'gray'} variant="filled">
          {data.required ? 'required' : 'optional'}
        </Badge>
        <Badge size="xs" color={CATEGORY_COLORS[data.category] || 'gray'} variant="light">
          {data.category}
        </Badge>
      </Group>
      <Text size="xs" fw={700} ff="monospace">
        {data.name}
      </Text>
      <Text size="xs" c="dimmed">
        {data.description}
      </Text>
      <Group gap={6} mt={4}>
        <Badge size="xs" color={data.isSet ? 'green' : 'red'} variant="dot">
          {data.isSet ? 'set' : 'unset'}
        </Badge>
        {data.default && (
          <Text size="xs" c="dimmed">
            default: {data.default}
          </Text>
        )}
      </Group>
    </div>
  )
}

export function PackageNode({
  data,
}: {
  data: { name: string; version: string; type: string; category: string; usedBy: string[] }
}) {
  return (
    <div
      style={{
        padding: 8,
        borderRadius: 8,
        border: `1px solid var(--mantine-color-${data.type === 'runtime' ? 'green' : 'orange'}-6)`,
        background: 'var(--mantine-color-body)',
        minWidth: 180,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: 'var(--mantine-color-blue-6)' }} />
      <Handle type="source" position={Position.Right} style={{ background: 'var(--mantine-color-blue-6)' }} />
      <Group gap={6} mb={4}>
        <Badge size="xs" color={data.type === 'runtime' ? 'green' : 'orange'} variant="filled">
          {data.type}
        </Badge>
        <Badge size="xs" color={CATEGORY_COLORS[data.category] || 'gray'} variant="light">
          {data.category}
        </Badge>
      </Group>
      <Text size="xs" fw={700} ff="monospace">
        {data.name}
      </Text>
      <Text size="xs" c="dimmed">
        {data.version}
      </Text>
      {data.usedBy.length > 0 && (
        <Badge size="xs" variant="light" mt={4}>
          {data.usedBy.length} files
        </Badge>
      )}
    </div>
  )
}
