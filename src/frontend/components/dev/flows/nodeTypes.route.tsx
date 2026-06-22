import { Badge, Group, Text } from '@mantine/core'
import { Handle, Position } from '@xyflow/react'
import { AUTH_COLORS, CATEGORY_COLORS, METHOD_COLORS } from '../shared'

export function RouteNode({
  data,
}: {
  data: { method: string; path: string; auth: string; category: string; description: string }
}) {
  return (
    <div
      style={{
        padding: 8,
        borderRadius: 8,
        border: '1px solid var(--mantine-color-default-border)',
        background: 'var(--mantine-color-body)',
        minWidth: 220,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: 'var(--mantine-color-blue-6)' }} />
      <Handle type="source" position={Position.Right} style={{ background: 'var(--mantine-color-blue-6)' }} />
      <Group gap={6} mb={4}>
        <Badge size="xs" color={METHOD_COLORS[data.method] || 'gray'} variant="filled">
          {data.method}
        </Badge>
        <Text size="xs" fw={700} ff="monospace">
          {data.path}
        </Text>
      </Group>
      <Text size="xs" c="dimmed" lineClamp={1}>
        {data.description}
      </Text>
      <Group gap={4} mt={4}>
        <Badge size="xs" variant="dot" color={AUTH_COLORS[data.auth] || 'gray'}>
          {data.auth}
        </Badge>
        <Badge size="xs" variant="light" color={CATEGORY_COLORS[data.category] || 'gray'}>
          {data.category}
        </Badge>
      </Group>
    </div>
  )
}
