import { ActionIcon, Badge, Card, Container, Group, Stack, Table, Text, Title, Tooltip } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TbTrash } from 'react-icons/tb'
import { useSession } from '@/frontend/hooks/useAuth'
import { apiFetch } from '@/frontend/lib/apiFetch'

interface WaSessionInfo {
  sessionId: string
  state: string | null
  connected: boolean
  phone: string | null
  name: string | null
  mappedUserId: string | null
  mappedUserEmail: string | null
  orphan: boolean
}

interface WaSessionsResponse {
  sessions: WaSessionInfo[]
  summary: { total: number; connected: number; orphan: number }
}

const WA_SESSIONS_KEY = ['admin', 'wa-sessions']

export function WaSessionsPanel() {
  const qc = useQueryClient()
  const session = useSession()
  const currentUserId = session.data?.user.id
  const { data, isLoading } = useQuery({
    queryKey: WA_SESSIONS_KEY,
    queryFn: () => apiFetch<WaSessionsResponse>('/api/admin/wa-sessions'),
    refetchInterval: 10_000,
  })

  const term = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/wa-sessions/${id}/terminate`, { method: 'POST' }),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Sesi diterminasi.' })
      qc.invalidateQueries({ queryKey: WA_SESSIONS_KEY })
    },
    onError: (e) => notifications.show({ color: 'red', message: e instanceof Error ? e.message : 'Gagal terminate' }),
  })

  const confirmTerminate = (s: WaSessionInfo) =>
    modals.openConfirmModal({
      title: 'Terminate sesi WA',
      children: (
        <Text size="sm">
          Logout + destroy sesi container{' '}
          <Text span fw={600}>
            {s.sessionId}
          </Text>
          {s.orphan ? ' (orphan)' : s.mappedUserEmail ? ` (${s.mappedUserEmail})` : ''}? Tindakan ini tidak bisa
          dibatalkan.
        </Text>
      ),
      labels: { confirm: 'Terminate', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => term.mutate(s.sessionId),
    })

  const sessions = data?.sessions ?? []
  const summary = data?.summary

  return (
    <Container size="lg" px={{ base: 0, sm: 'md' }}>
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={3}>WA Sessions</Title>
          <Group gap="xs">
            <Badge variant="light" size="lg">
              {summary?.total ?? 0} total
            </Badge>
            <Badge variant="light" size="lg" color="green">
              {summary?.connected ?? 0} connected
            </Badge>
            <Badge variant="light" size="lg" color="orange">
              {summary?.orphan ?? 0} orphan
            </Badge>
          </Group>
        </Group>

        <Card withBorder radius="md" p={0}>
          <Table.ScrollContainer minWidth={640}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Session ID</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Nomor</Table.Th>
                  <Table.Th>Nama</Table.Th>
                  <Table.Th>Mapped</Table.Th>
                  <Table.Th ta="right">Aksi</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {isLoading && (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text ta="center" c="dimmed" py="md">
                        Loading...
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {!isLoading && sessions.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text ta="center" c="dimmed" py="md">
                        Tidak ada sesi di container.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {sessions.map((s) => {
                  const isMine = s.sessionId === currentUserId
                  return (
                    <Table.Tr key={s.sessionId} bg={isMine ? 'var(--mantine-color-blue-light)' : undefined}>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <Tooltip label={s.sessionId} withArrow>
                            <Text size="sm" maw={160} truncate ff="monospace">
                              {s.sessionId}
                            </Text>
                          </Tooltip>
                          {isMine && (
                            <Badge color="blue" variant="filled" size="xs">
                              Sesi Anda
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={s.connected ? 'green' : 'gray'} variant="light">
                          {s.state ?? 'unknown'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{s.phone ?? <Text c="dimmed">—</Text>}</Table.Td>
                      <Table.Td>{s.name ?? <Text c="dimmed">—</Text>}</Table.Td>
                      <Table.Td>
                        {s.orphan ? (
                          <Badge color="orange" variant="light">
                            orphan
                          </Badge>
                        ) : (
                          <Text size="sm">{s.mappedUserEmail}</Text>
                        )}
                      </Table.Td>
                      <Table.Td ta="right">
                        <Tooltip label="Terminate" withArrow>
                          <ActionIcon color="red" variant="subtle" onClick={() => confirmTerminate(s)}>
                            <TbTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      </Stack>
    </Container>
  )
}
