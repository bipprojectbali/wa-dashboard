import { Badge, Group, Stack, Text } from '@mantine/core'
import { Handle, Position } from '@xyflow/react'
import { METHOD_COLORS } from '../shared'

export function SessionUserNode({
  data,
}: {
  data: {
    userName: string
    userEmail: string
    userRole: string
    userBlocked: boolean
    isOnline: boolean
    sessionCount: number
    isExpired: boolean
  }
}) {
  const roleColor = data.userRole === 'SUPER_ADMIN' ? 'red' : data.userRole === 'ADMIN' ? 'orange' : 'blue'
  return (
    <div
      style={{
        padding: 8,
        borderRadius: 8,
        border: `2px solid var(--mantine-color-${data.userBlocked ? 'red' : roleColor}-6)`,
        background: 'var(--mantine-color-body)',
        minWidth: 180,
      }}
    >
      <Handle type="source" position={Position.Right} style={{ background: `var(--mantine-color-${roleColor}-6)` }} />
      <Group gap={6} mb={4}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: `var(--mantine-color-${data.isOnline ? 'green' : 'gray'}-6)`,
          }}
        />
        <Text size="xs" fw={700}>
          {data.userName}
        </Text>
      </Group>
      <Text size="xs" c="dimmed">
        {data.userEmail}
      </Text>
      <Group gap={4} mt={4}>
        <Badge size="xs" color={roleColor} variant="filled">
          {data.userRole}
        </Badge>
        {data.userBlocked && (
          <Badge size="xs" color="red" variant="filled">
            BLOCKED
          </Badge>
        )}
        <Badge size="xs" variant="light">
          {data.sessionCount} sessions
        </Badge>
      </Group>
    </div>
  )
}

export function RoleAccessNode({ data }: { data: { label: string; routes: string[]; color: string; count: number } }) {
  return (
    <div
      style={{
        padding: 8,
        borderRadius: 8,
        border: `2px solid var(--mantine-color-${data.color}-6)`,
        background: 'var(--mantine-color-body)',
        minWidth: 150,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: `var(--mantine-color-${data.color}-6)` }} />
      <Handle type="source" position={Position.Right} style={{ background: `var(--mantine-color-${data.color}-6)` }} />
      <Text size="xs" fw={700}>
        {data.label}
      </Text>
      <Badge size="xs" variant="light" color={data.color} mt={4}>
        {data.count} users
      </Badge>
      <Stack gap={2} mt={4}>
        {data.routes.map((r) => (
          <Text key={r} size="xs" c="dimmed" ff="monospace">
            {r}
          </Text>
        ))}
      </Stack>
    </div>
  )
}

export function EndpointHitNode({
  data,
}: {
  data: { method: string; path: string; hits: number; lastStatus: number; avgDuration: number }
}) {
  const statusColor = data.lastStatus >= 500 ? 'red' : data.lastStatus >= 400 ? 'yellow' : 'green'
  return (
    <div
      style={{
        padding: 8,
        borderRadius: 8,
        border: `2px solid var(--mantine-color-${statusColor}-6)`,
        background: 'var(--mantine-color-body)',
        minWidth: 200,
        boxShadow:
          data.hits > 0 ? `0 0 ${Math.min(data.hits * 2, 20)}px var(--mantine-color-${statusColor}-3)` : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: `var(--mantine-color-${statusColor}-6)` }} />
      <Group gap={6} mb={4}>
        <Badge size="xs" color={METHOD_COLORS[data.method] || 'gray'} variant="filled">
          {data.method}
        </Badge>
        <Text size="xs" fw={700} ff="monospace">
          {data.path}
        </Text>
      </Group>
      <Group gap={8}>
        <Badge size="xs" variant="light" color={statusColor}>
          {data.lastStatus || '—'}
        </Badge>
        <Text size="xs" c="dimmed">
          {data.hits} hits
        </Text>
        {data.avgDuration > 0 && (
          <Text size="xs" c="dimmed">
            {data.avgDuration}ms avg
          </Text>
        )}
      </Group>
    </div>
  )
}
