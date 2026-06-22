import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Select,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { TbBug, TbChevronRight, TbPlus, TbRefresh } from 'react-icons/tb'
import { useSession } from '@/frontend/hooks/useAuth'
import { CreateTicketModal } from './tickets/CreateTicketModal'
import { TicketDetailModal } from './tickets/TicketDetailModal'
import { PRIORITY_COLOR, STATUS_COLOR, type TicketListItem, ticketApi } from './tickets/types'

export function TicketsPanel() {
  const { data } = useSession()
  const user = data?.user
  const role = user?.role
  const canCreate = role === 'QC' || role === 'ADMIN' || role === 'SUPER_ADMIN'
  const isQc = role === 'QC' || role === 'SUPER_ADMIN'

  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const {
    data: ticketsData,
    isLoading,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['tickets', statusFilter],
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ limit: '50' })
      if (statusFilter !== 'active' && statusFilter !== 'all') qs.set('status', statusFilter)
      if (pageParam) qs.set('cursor', pageParam)
      return ticketApi<{ tickets: TicketListItem[]; nextCursor?: string }>(`/api/tickets?${qs}`)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    refetchInterval: 15_000,
  })

  const allTickets = (ticketsData?.pages ?? []).flatMap((p: { tickets: TicketListItem[] }) => p.tickets)
  const tickets = allTickets.filter((t) => {
    if (statusFilter === 'active') return t.status !== 'CLOSED'
    return true
  })

  const createMut = useMutation({
    mutationFn: (body: { title: string; description: string; priority: string; route?: string }) =>
      ticketApi<{ ticket: TicketListItem }>('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      setCreateOpen(false)
    },
  })

  return (
    <Container size="xl" px={{ base: 0, sm: 'md' }}>
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Group gap="xs">
            <TbBug size={20} />
            <Title order={3} fz={{ base: 'lg', sm: 'xl' }}>
              Tickets
            </Title>
          </Group>
          <Group gap="xs" wrap="wrap">
            <Select
              size="xs"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v || 'active')}
              data={[
                { value: 'active', label: 'Active' },
                { value: 'all', label: 'All' },
                { value: 'OPEN', label: 'Open' },
                { value: 'IN_PROGRESS', label: 'In Progress' },
                { value: 'READY_FOR_QC', label: 'Ready for QC' },
                { value: 'REOPENED', label: 'Reopened' },
                { value: 'CLOSED', label: 'Closed' },
              ]}
              w={140}
            />
            <Tooltip label="Refresh">
              <ActionIcon variant="subtle" onClick={() => refetch()} loading={isFetching} size="sm">
                <TbRefresh size={15} />
              </ActionIcon>
            </Tooltip>
            {canCreate && (
              <Button size="xs" leftSection={<TbPlus size={13} />} onClick={() => setCreateOpen(true)}>
                New
              </Button>
            )}
          </Group>
        </Group>

        <Card withBorder padding={0} radius="md">
          <Table.ScrollContainer minWidth={560}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 100 }}>Status</Table.Th>
                  <Table.Th style={{ width: 85 }}>Priority</Table.Th>
                  <Table.Th>Title</Table.Th>
                  <Table.Th style={{ width: 120 }}>Reporter</Table.Th>
                  <Table.Th style={{ width: 60 }}>Activity</Table.Th>
                  <Table.Th style={{ width: 32 }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {isLoading && (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text ta="center" c="dimmed" py="md">
                        Loading…
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {!isLoading && tickets.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text ta="center" c="dimmed" py="md">
                        No tickets
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {tickets.map((t) => (
                  <Table.Tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setDetailId(t.id)}>
                    <Table.Td>
                      <Badge size="xs" color={STATUS_COLOR[t.status]} variant="light">
                        {t.status.replace(/_/g, ' ')}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" color={PRIORITY_COLOR[t.priority]} variant="outline">
                        {t.priority}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500} lineClamp={1}>
                        {t.title}
                      </Text>
                      {t.route && (
                        <Text size="xs" c="dimmed">
                          {t.route}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{t.reporter.name}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={3}>
                        <Badge size="xs" variant="default">
                          {t._count.comments}c
                        </Badge>
                        <Badge size="xs" variant="default">
                          {t._count.evidence}e
                        </Badge>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <TbChevronRight size={13} />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>

        {hasNextPage && (
          <Group justify="center">
            <Button variant="light" size="xs" onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
              Load more
            </Button>
          </Group>
        )}
      </Stack>

      <CreateTicketModal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(data) => createMut.mutate(data)}
        loading={createMut.isPending}
        error={createMut.error?.message}
      />

      {detailId && (
        <TicketDetailModal
          id={detailId}
          onClose={() => setDetailId(null)}
          canQc={isQc}
          canAdmin={role === 'ADMIN' || role === 'SUPER_ADMIN'}
        />
      )}
    </Container>
  )
}
