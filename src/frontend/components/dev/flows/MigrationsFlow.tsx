import { ActionIcon, Badge, Group, Stack, Text, Tooltip } from '@mantine/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Background, Controls, type Edge, MarkerType, type Node, ReactFlow, ReactFlowProvider } from '@xyflow/react'
import { useEffect } from 'react'
import { TbRefresh } from 'react-icons/tb'
import { apiFetch } from '@/frontend/lib/apiFetch'
import { LayoutSelector, storageKey, useFlowAutoSave } from '../layout'
import type { MigrationData } from '../shared'
import { migrationNodeTypes } from './nodeTypes'

function MigrationsFlowInner() {
  const qc = useQueryClient()
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'migrations'],
    queryFn: () => apiFetch<MigrationData>('/api/admin/migrations'),
  })
  const flow = useFlowAutoSave(storageKey('migrations'))

  useEffect(() => {
    if (!data?.migrations) return
    const nodes: Node[] = []
    const edges: Edge[] = []

    data.migrations.forEach((m, i) => {
      const id = `mig_${m.folder}`
      nodes.push({ id, type: 'migration', position: flow.loadPos?.[id] ?? { x: i * 320, y: 0 }, data: m })
      if (i > 0) {
        const prevId = `mig_${data.migrations[i - 1].folder}`
        edges.push({
          id: `mig_e_${i}`,
          source: prevId,
          target: id,
          label: `#${i + 1}`,
          labelStyle: { fontSize: 9 },
          style: { stroke: 'var(--mantine-color-orange-4)', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
          animated: true,
        })
      }
    })

    flow.setNodes(nodes)
    flow.setEdges(edges)
  }, [data, flow.loadPos, flow.setNodes, flow.setEdges])

  if (isLoading)
    return (
      <Stack align="center" justify="center" mih={400}>
        <Text c="dimmed">Loading migrations...</Text>
      </Stack>
    )
  if (!data)
    return (
      <Stack align="center" justify="center" mih={400}>
        <Text c="dimmed">No data</Text>
      </Stack>
    )

  return (
    <>
      <Group px="md" pb="xs" gap="sm">
        <Badge size="sm" color="orange" variant="light">
          {data.summary.totalMigrations} migrations
        </Badge>
        <Badge size="sm" variant="light">
          {data.summary.totalChanges} changes
        </Badge>
        {data.summary.firstMigration && (
          <Text size="xs" c="dimmed">
            From {new Date(data.summary.firstMigration).toLocaleDateString()} →{' '}
            {new Date(data.summary.lastMigration!).toLocaleDateString()}
          </Text>
        )}
        <LayoutSelector layoutKey={storageKey('migrations')} onLayout={flow.relayout} />
        <Tooltip label="Reload">
          <ActionIcon
            variant="subtle"
            size="sm"
            loading={isFetching}
            onClick={() => qc.invalidateQueries({ queryKey: ['admin', 'migrations'] })}
          >
            <TbRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={flow.nodes}
          edges={flow.edges}
          onNodesChange={flow.handleNodesChange}
          onEdgesChange={flow.onEdgesChange}
          onMoveEnd={flow.handleMoveEnd}
          nodeTypes={migrationNodeTypes}
          defaultViewport={flow.savedVp ?? undefined}
          fitView={!flow.savedVp}
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.05}
          maxZoom={5}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} />
          <Controls />
        </ReactFlow>
      </div>
    </>
  )
}

export function MigrationsFlow() {
  return (
    <ReactFlowProvider>
      <MigrationsFlowInner />
    </ReactFlowProvider>
  )
}
