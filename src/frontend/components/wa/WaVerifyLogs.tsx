import { ActionIcon, Alert, Badge, Card, Group, Loader, Stack, Table, Text, Title, Tooltip } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TbRefresh } from 'react-icons/tb'
import { apiFetch } from '@/frontend/lib/apiFetch'
import type { RequestsResponse, VerifyDelivery, VerifyRequestRow, VerifyStatus } from './wa-verify.types'

interface Props {
  canEdit: boolean
}

const STATUS_COLOR: Record<VerifyStatus, string> = {
  PENDING: 'yellow',
  VERIFIED: 'green',
  EXPIRED: 'gray',
}

const DELIVERY_COLOR: Record<VerifyDelivery, string> = {
  PENDING: 'yellow',
  DELIVERED: 'green',
  FAILED: 'red',
  DISABLED: 'gray',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
}

export function WaVerifyLogs({ canEdit }: Props) {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ['wa', 'verify', 'requests'],
    queryFn: () => apiFetch<RequestsResponse>('/api/wa/verify/requests'),
    staleTime: 10_000,
    refetchInterval: 30_000,
  })

  const replay = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/wa/verify/requests/${id}/replay`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa', 'verify', 'requests'] }),
  })

  const rows = query.data?.requests ?? []

  const canReplay = (r: VerifyRequestRow) =>
    canEdit && r.status === 'VERIFIED' && (r.deliveryStatus === 'FAILED' || r.deliveryStatus === 'PENDING')

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={5}>Request Verifikasi</Title>
          <Tooltip label="Muat ulang">
            <ActionIcon variant="subtle" color="gray" onClick={() => query.refetch()} loading={query.isFetching}>
              <TbRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {replay.isError && (
          <Alert color="red" variant="light">
            {(replay.error as Error).message}
          </Alert>
        )}

        {query.isLoading ? (
          <Loader />
        ) : rows.length === 0 ? (
          <Text size="sm" c="dimmed">
            Belum ada request.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={680}>
            <Table verticalSpacing="xs" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Consumer</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Nomor</Table.Th>
                  <Table.Th>Delivery</Table.Th>
                  <Table.Th>Dibuat</Table.Th>
                  {canEdit && <Table.Th>Aksi</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((r) => (
                  <Table.Tr key={r.id}>
                    <Table.Td>{r.consumer.name}</Table.Td>
                    <Table.Td>
                      <Badge color={STATUS_COLOR[r.status]} variant="light" size="sm">
                        {r.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{r.matchedPhone ?? <Text c="dimmed">—</Text>}</Table.Td>
                    <Table.Td>
                      <Badge color={DELIVERY_COLOR[r.deliveryStatus]} variant="light" size="sm">
                        {r.deliveryStatus}
                        {r.deliveryAttempts > 0 ? ` (${r.deliveryAttempts})` : ''}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{fmt(r.createdAt)}</Table.Td>
                    {canEdit && (
                      <Table.Td>
                        {canReplay(r) && (
                          <Tooltip label="Kirim ulang webhook">
                            <ActionIcon
                              variant="subtle"
                              color="blue"
                              onClick={() => replay.mutate(r.id)}
                              loading={replay.isPending}
                            >
                              <TbRefresh size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Stack>
    </Card>
  )
}
