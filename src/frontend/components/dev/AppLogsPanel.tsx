import {
  ActionIcon,
  Badge,
  Card,
  Container,
  Group,
  Pagination,
  SegmentedControl,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { TbRefresh, TbTrash } from 'react-icons/tb'
import { apiFetch } from '@/frontend/lib/apiFetch'
import { type AppLogEntry, levelBadge, PAGE_SIZE } from './shared'

export function AppLogsPanel() {
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'logs', 'app', levelFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '200' })
      if (levelFilter !== 'all') params.set('level', levelFilter)
      return apiFetch<{ logs: AppLogEntry[] }>(`/api/admin/logs/app?${params}`)
    },
    refetchInterval: 5000,
  })

  const clearLogs = useMutation({
    mutationFn: () => apiFetch('/api/admin/logs/app', { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'logs', 'app'] }),
  })

  const logs = data?.logs ?? []
  const ordered = [...logs].reverse()
  const totalPages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedLogs = ordered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // biome-ignore lint/correctness/useExhaustiveDependencies: levelFilter is the intended trigger to reset pagination, not read in the effect body
  useEffect(() => {
    setPage(1)
  }, [levelFilter])

  return (
    <Container size="lg" px={{ base: 0, sm: 'md' }}>
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Group gap="sm">
            <Title order={3}>App Logs</Title>
            <Badge variant="light" color="gray" size="sm">
              redis
            </Badge>
          </Group>
          <Group gap="sm" wrap="wrap">
            <SegmentedControl
              size="xs"
              value={levelFilter}
              onChange={setLevelFilter}
              data={[
                { label: 'All', value: 'all' },
                { label: 'Info', value: 'info' },
                { label: 'Warn', value: 'warn' },
                { label: 'Error', value: 'error' },
              ]}
            />
            <Tooltip label="Clear all">
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={() => {
                  if (confirm('Hapus semua app logs?')) clearLogs.mutate()
                }}
                loading={clearLogs.isPending}
              >
                <TbTrash size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Refresh">
              <ActionIcon variant="subtle" color="gray" onClick={() => refetch()} loading={isFetching}>
                <TbRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <Card withBorder radius="md" p={0}>
          <Table.ScrollContainer minWidth={480}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={180}>Time</Table.Th>
                  <Table.Th w={70}>Level</Table.Th>
                  <Table.Th>Message</Table.Th>
                  <Table.Th>Detail</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {isLoading && (
                  <Table.Tr>
                    <Table.Td colSpan={4}>
                      <Text ta="center" c="dimmed" py="md">
                        Loading...
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {logs.length === 0 && !isLoading && (
                  <Table.Tr>
                    <Table.Td colSpan={4}>
                      <Text ta="center" c="dimmed" py="md">
                        Belum ada log
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {pagedLogs.map((log) => {
                  const badge = levelBadge[log.level] ?? levelBadge.info
                  return (
                    <Table.Tr key={log.id}>
                      <Table.Td>
                        <Text size="xs" ff="monospace" c="dimmed">
                          {new Date(log.timestamp).toLocaleString('id-ID', { hour12: false })}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={badge.color} variant="light" size="xs" tt="uppercase">
                          {log.level}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" ff="monospace">
                          {log.message}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed" ff="monospace">
                          {log.detail ?? '—'}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>

        {ordered.length > PAGE_SIZE && (
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, ordered.length)} of {ordered.length}
            </Text>
            <Pagination value={safePage} onChange={setPage} total={totalPages} size="sm" />
          </Group>
        )}
      </Stack>
    </Container>
  )
}
