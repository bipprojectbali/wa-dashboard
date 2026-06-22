import { ActionIcon, Badge, Group, SegmentedControl, Stack, Text, Tooltip } from '@mantine/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Background, Controls, type Edge, MarkerType, type Node, ReactFlow, ReactFlowProvider } from '@xyflow/react'
import { useEffect, useState } from 'react'
import { TbRefresh } from 'react-icons/tb'
import { apiFetch } from '@/frontend/lib/apiFetch'
import { LayoutSelector, storageKey, useFlowAutoSave } from '../layout'
import type { TestCoverageData } from '../shared'
import { testNodeTypes } from './nodeTypes'

function TestCoverageFlowInner() {
  const qc = useQueryClient()
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'test-coverage'],
    queryFn: () => apiFetch<TestCoverageData>('/api/admin/test-coverage'),
  })
  const [filter, setFilter] = useState('all')
  const flow = useFlowAutoSave(storageKey('test-coverage'))

  useEffect(() => {
    if (!data?.sourceFiles) return
    const filtered = filter === 'all' ? data.sourceFiles : data.sourceFiles.filter((f) => f.coverage === filter)
    const nodes: Node[] = []
    const edges: Edge[] = []

    filtered.forEach((f, i) => {
      nodes.push({ id: f.path, type: 'source', position: flow.loadPos?.[f.path] ?? { x: 0, y: i * 100 }, data: f })
    })

    const testSet = new Set<string>()
    for (const f of filtered) for (const t of f.testedBy) testSet.add(t)
    const tests = data.testFiles.filter((t) => testSet.has(t.path))
    tests.forEach((t, i) => {
      nodes.push({ id: t.path, type: 'test', position: flow.loadPos?.[t.path] ?? { x: 500, y: i * 100 }, data: t })
    })

    for (const t of tests) {
      for (const target of t.targets) {
        if (filtered.some((f) => f.path === target)) {
          edges.push({
            id: `test_${t.path}_${target}`,
            source: t.path,
            target,
            style: { stroke: 'var(--mantine-color-green-4)', strokeWidth: 1 },
            markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10 },
            animated: true,
          })
        }
      }
    }

    flow.setNodes(nodes)
    flow.setEdges(edges)
  }, [data, filter, flow.loadPos, flow.setNodes, flow.setEdges])

  if (isLoading)
    return (
      <Stack align="center" justify="center" mih={400}>
        <Text c="dimmed">Loading coverage...</Text>
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
        <SegmentedControl
          size="xs"
          value={filter}
          onChange={setFilter}
          data={[
            { label: `All (${data.summary.totalSource})`, value: 'all' },
            { label: `Covered (${data.summary.covered})`, value: 'covered' },
            { label: `Partial (${data.summary.partial})`, value: 'partial' },
            { label: `Uncovered (${data.summary.uncovered})`, value: 'uncovered' },
          ]}
        />
        <Badge
          size="sm"
          color={data.summary.coveragePercent >= 70 ? 'green' : data.summary.coveragePercent >= 40 ? 'yellow' : 'red'}
          variant="light"
        >
          {data.summary.coveragePercent}% coverage
        </Badge>
        <Text size="xs" c="dimmed">
          {data.summary.totalTests} test files
        </Text>
        <LayoutSelector layoutKey={storageKey('test-coverage')} onLayout={flow.relayout} />
        <Tooltip label="Reload">
          <ActionIcon
            variant="subtle"
            size="sm"
            loading={isFetching}
            onClick={() => qc.invalidateQueries({ queryKey: ['admin', 'test-coverage'] })}
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
          nodeTypes={testNodeTypes}
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

export function TestCoverageFlow() {
  return (
    <ReactFlowProvider>
      <TestCoverageFlowInner />
    </ReactFlowProvider>
  )
}
