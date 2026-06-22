import { Badge, Group, Stack, Text } from '@mantine/core'
import { Handle, Position } from '@xyflow/react'
import { useState } from 'react'

export function MigrationNode({ data }: { data: { name: string; createdAt: string; changes: string[]; sql: string } }) {
  const [showSql, setShowSql] = useState(false)
  const date = new Date(data.createdAt).toLocaleDateString()
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 8,
        border: '1px solid var(--mantine-color-default-border)',
        background: 'var(--mantine-color-body)',
        minWidth: 220,
        maxWidth: 260,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: 'var(--mantine-color-orange-6)' }} />
      <Handle type="source" position={Position.Right} style={{ background: 'var(--mantine-color-orange-6)' }} />
      <Group gap={6} mb={4}>
        <Badge size="xs" color="orange" variant="filled">
          {date}
        </Badge>
      </Group>
      <Text size="xs" fw={700} ff="monospace" lineClamp={1}>
        {data.name}
      </Text>
      <Stack gap={2} mt={4}>
        {data.changes.map((c) => {
          const color = c.startsWith('CREATE')
            ? 'green'
            : c.startsWith('ALTER')
              ? 'yellow'
              : c.startsWith('DROP')
                ? 'red'
                : 'gray'
          return (
            <Badge key={c} size="xs" variant="light" color={color} ff="monospace">
              {c}
            </Badge>
          )
        })}
      </Stack>
      {data.sql && (
        <Text size="xs" c="blue" mt={4} style={{ cursor: 'pointer' }} onClick={() => setShowSql(!showSql)}>
          {showSql ? 'Hide SQL' : 'Show SQL'}
        </Text>
      )}
      {showSql && (
        <Text
          size="xs"
          ff="monospace"
          c="dimmed"
          mt={4}
          style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}
        >
          {data.sql}
        </Text>
      )}
    </div>
  )
}
