import { Badge, Group, Text } from '@mantine/core'
import { Handle, Position } from '@xyflow/react'
import { CATEGORY_COLORS, COVERAGE_COLORS } from '../shared'
import { openInEditor } from './nodeTypes.utils'

export function FileNode2({
  data,
}: {
  data: {
    path: string
    category: string
    lines: number
    exports: string[]
    imports: { from: string; names: string[] }[]
  }
}) {
  const name = data.path.split('/').pop() || data.path
  return (
    <button
      type="button"
      style={{
        padding: 8,
        borderRadius: 8,
        border: '1px solid var(--mantine-color-default-border)',
        background: 'var(--mantine-color-body)',
        minWidth: 180,
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
      }}
      onDoubleClick={() => openInEditor(data.path)}
      title="Double-click to open in editor"
    >
      <Handle type="target" position={Position.Left} style={{ background: 'var(--mantine-color-violet-6)' }} />
      <Handle type="source" position={Position.Right} style={{ background: 'var(--mantine-color-violet-6)' }} />
      <Group gap={6} mb={4}>
        <Badge size="xs" color={CATEGORY_COLORS[data.category] || 'gray'} variant="filled">
          {data.category}
        </Badge>
        <Text size="xs" fw={700} ff="monospace">
          {name}
        </Text>
      </Group>
      <Text size="xs" c="dimmed" ff="monospace">
        {data.path}
      </Text>
      <Group gap={8} mt={4}>
        <Text size="xs" c="dimmed">
          {data.lines} lines
        </Text>
        {data.exports.length > 0 && (
          <Badge size="xs" variant="light" color="green">
            {data.exports.length} exports
          </Badge>
        )}
        {data.imports.length > 0 && (
          <Badge size="xs" variant="light" color="blue">
            {data.imports.length} imports
          </Badge>
        )}
      </Group>
    </button>
  )
}

export function SourceNode({
  data,
}: {
  data: { path: string; lines: number; exports: string[]; coverage: string; testedBy: string[] }
}) {
  const name = data.path.split('/').pop() || data.path
  return (
    <button
      type="button"
      style={{
        padding: 8,
        borderRadius: 8,
        border: `2px solid var(--mantine-color-${COVERAGE_COLORS[data.coverage] || 'gray'}-6)`,
        background: 'var(--mantine-color-body)',
        minWidth: 180,
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
      }}
      onDoubleClick={() => openInEditor(data.path)}
      title="Double-click to open in editor"
    >
      <Handle type="target" position={Position.Right} style={{ background: 'var(--mantine-color-green-6)' }} />
      <Handle type="source" position={Position.Left} style={{ background: 'var(--mantine-color-green-6)' }} />
      <Group gap={6} mb={4}>
        <Badge size="xs" color={COVERAGE_COLORS[data.coverage] || 'gray'} variant="filled">
          {data.coverage}
        </Badge>
        <Text size="xs" fw={700} ff="monospace">
          {name}
        </Text>
      </Group>
      <Text size="xs" c="dimmed" ff="monospace">
        {data.path}
      </Text>
      <Group gap={8} mt={4}>
        <Text size="xs" c="dimmed">
          {data.lines} lines
        </Text>
        <Badge size="xs" variant="light" color="green">
          {data.exports.length} exports
        </Badge>
      </Group>
    </button>
  )
}

export function TestNodeComp({ data }: { data: { path: string; lines: number; type: string } }) {
  const name = data.path.split('/').pop() || data.path
  const typeColor = data.type === 'unit' ? 'blue' : data.type === 'integration' ? 'green' : 'violet'
  return (
    <button
      type="button"
      style={{
        padding: 8,
        borderRadius: 8,
        border: `1px solid var(--mantine-color-${typeColor}-6)`,
        background: 'var(--mantine-color-body)',
        minWidth: 180,
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
      }}
      onDoubleClick={() => openInEditor(data.path)}
      title="Double-click to open in editor"
    >
      <Handle type="target" position={Position.Left} style={{ background: `var(--mantine-color-${typeColor}-6)` }} />
      <Handle type="source" position={Position.Right} style={{ background: `var(--mantine-color-${typeColor}-6)` }} />
      <Group gap={6} mb={4}>
        <Badge size="xs" color={typeColor} variant="filled">
          {data.type}
        </Badge>
        <Text size="xs" fw={700} ff="monospace">
          {name}
        </Text>
      </Group>
      <Text size="xs" c="dimmed">
        {data.lines} lines
      </Text>
    </button>
  )
}
