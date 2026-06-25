import {
  ActionIcon,
  Alert,
  Badge,
  Card,
  Checkbox,
  Group,
  Loader,
  Pagination,
  Select,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { TbRefresh } from 'react-icons/tb'
import { apiFetch } from '@/frontend/lib/apiFetch'
import { useRowSelection } from '@/frontend/lib/wa-verify-selection'
import { WaVerifyToolbar } from './WaVerifyToolbar'
import {
  PAGE_SIZE,
  type RequestsResponse,
  type VerifyDelivery,
  type VerifyRequestRow,
  type VerifyStatus,
} from './wa-verify.types'

interface Props {
  canEdit: boolean
}

const QKEY = ['wa', 'verify', 'requests']

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
  const [search, setSearch] = useState('')
  const [debouncedSearch] = useDebouncedValue(search, 300)
  const [status, setStatus] = useState('all')
  const [delivery, setDelivery] = useState('all')
  const [page, setPage] = useState(1)
  const selection = useRowSelection()

  // biome-ignore lint/correctness/useExhaustiveDependencies: filter changes reset pagination, values not read in body
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, status, delivery])

  const query = useQuery({
    queryKey: [...QKEY, { search: debouncedSearch, status, delivery, page }],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE) })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (status !== 'all') params.set('status', status)
      if (delivery !== 'all') params.set('delivery', delivery)
      return apiFetch<RequestsResponse>(`/api/wa/verify/requests?${params}`)
    },
    placeholderData: (prev) => prev,
    staleTime: 10_000,
    refetchInterval: 30_000,
  })

  const rows = query.data?.requests ?? []
  const total = query.data?.total ?? 0
  const pageIds = rows.map((r) => r.id)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const invalidate = () => qc.invalidateQueries({ queryKey: QKEY })

  const replay = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/wa/verify/requests/${id}/replay`, { method: 'POST' }),
    onSuccess: invalidate,
  })

  const bulkDelete = useMutation({
    mutationFn: (payload: { ids?: string[]; all?: boolean }) =>
      apiFetch<{ count: number }>('/api/wa/verify/requests/bulk-delete', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      selection.clear()
      invalidate()
    },
  })

  const confirmDeleteSelected = () =>
    modals.openConfirmModal({
      title: 'Hapus request terpilih',
      children: (
        <Text size="sm">
          Hapus <b>{selection.count}</b> request verifikasi terpilih? Tindakan ini tak bisa dibatalkan.
        </Text>
      ),
      labels: { confirm: 'Hapus', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => bulkDelete.mutate({ ids: [...selection.selected] }),
    })

  const confirmDeleteAll = () =>
    modals.openConfirmModal({
      title: 'Hapus SEMUA request',
      children: (
        <Text size="sm">
          Hapus <b>seluruh {total}</b> request verifikasi? Tindakan ini tak bisa dibatalkan.
        </Text>
      ),
      labels: { confirm: 'Hapus semua', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => bulkDelete.mutate({ all: true }),
    })

  const canReplay = (r: VerifyRequestRow) =>
    canEdit && r.status === 'VERIFIED' && (r.deliveryStatus === 'FAILED' || r.deliveryStatus === 'PENDING')

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Title order={5}>Request Verifikasi</Title>

        {replay.isError && (
          <Alert color="red" variant="light">
            {(replay.error as Error).message}
          </Alert>
        )}
        {bulkDelete.isError && (
          <Alert color="red" variant="light">
            {(bulkDelete.error as Error).message}
          </Alert>
        )}

        <WaVerifyToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari nama consumer…"
          filters={
            <>
              <Select
                size="xs"
                w={140}
                value={status}
                onChange={(v) => setStatus(v ?? 'all')}
                data={[
                  { label: 'Semua status', value: 'all' },
                  { label: 'PENDING', value: 'PENDING' },
                  { label: 'VERIFIED', value: 'VERIFIED' },
                  { label: 'EXPIRED', value: 'EXPIRED' },
                ]}
              />
              <Select
                size="xs"
                w={150}
                value={delivery}
                onChange={(v) => setDelivery(v ?? 'all')}
                data={[
                  { label: 'Semua delivery', value: 'all' },
                  { label: 'PENDING', value: 'PENDING' },
                  { label: 'DELIVERED', value: 'DELIVERED' },
                  { label: 'FAILED', value: 'FAILED' },
                  { label: 'DISABLED', value: 'DISABLED' },
                ]}
              />
            </>
          }
          selectedCount={selection.count}
          total={total}
          canEdit={canEdit}
          onDeleteSelected={confirmDeleteSelected}
          onDeleteAll={confirmDeleteAll}
          onRefresh={() => query.refetch()}
          refreshing={query.isFetching}
          deleting={bulkDelete.isPending}
        />

        {query.isLoading ? (
          <Loader />
        ) : rows.length === 0 ? (
          <Text size="sm" c="dimmed">
            {debouncedSearch || status !== 'all' || delivery !== 'all'
              ? 'Tak ada request yang cocok.'
              : 'Belum ada request.'}
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={680}>
            <Table verticalSpacing="xs" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  {canEdit && (
                    <Table.Th w={36}>
                      <Checkbox
                        size="xs"
                        checked={selection.allOnPageSelected(pageIds)}
                        indeterminate={selection.someOnPageSelected(pageIds) && !selection.allOnPageSelected(pageIds)}
                        onChange={() => selection.togglePage(pageIds)}
                      />
                    </Table.Th>
                  )}
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
                  <Table.Tr key={r.id} bg={selection.isSelected(r.id) ? 'var(--mantine-color-blue-light)' : undefined}>
                    {canEdit && (
                      <Table.Td>
                        <Checkbox
                          size="xs"
                          checked={selection.isSelected(r.id)}
                          onChange={() => selection.toggleRow(r.id)}
                        />
                      </Table.Td>
                    )}
                    <Table.Td>{r.consumer.name}</Table.Td>
                    <Table.Td>
                      <Badge color={STATUS_COLOR[r.status]} variant="light" size="sm">
                        {r.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{r.matchedPhone ?? <Text c="dimmed">—</Text>}</Table.Td>
                    <Table.Td>
                      {r.status === 'VERIFIED' ? (
                        <Badge color={DELIVERY_COLOR[r.deliveryStatus]} variant="light" size="sm">
                          {r.deliveryStatus}
                          {r.deliveryAttempts > 0 ? ` (${r.deliveryAttempts})` : ''}
                        </Badge>
                      ) : (
                        <Text c="dimmed">—</Text>
                      )}
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

        {total > PAGE_SIZE && (
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} dari {total}
            </Text>
            <Pagination value={page} onChange={setPage} total={totalPages} size="sm" />
          </Group>
        )}
      </Stack>
    </Card>
  )
}
