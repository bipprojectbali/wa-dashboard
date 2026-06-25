import {
  Badge,
  Card,
  Checkbox,
  Code,
  Group,
  Loader,
  Pagination,
  SegmentedControl,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { apiFetch } from '@/frontend/lib/apiFetch'
import { useRowSelection } from '@/frontend/lib/wa-verify-selection'
import { WaVerifyToolbar } from './WaVerifyToolbar'
import { type InboundResponse, PAGE_SIZE } from './wa-verify.types'

const QKEY = ['wa', 'verify', 'inbound']

function fmt(iso: string) {
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
}

// Raw inbound log (audit mentah) — SUPER_ADMIN saja. Nomor sudah ter-mask dari server.
export function WaVerifyInbound() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch] = useDebouncedValue(search, 300)
  const [matched, setMatched] = useState('all')
  const [page, setPage] = useState(1)
  const selection = useRowSelection()

  // biome-ignore lint/correctness/useExhaustiveDependencies: filter changes reset pagination, values not read in body
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, matched])

  const query = useQuery({
    queryKey: [...QKEY, { search: debouncedSearch, matched, page }],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE) })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (matched !== 'all') params.set('matched', matched)
      return apiFetch<InboundResponse>(`/api/wa/verify/inbound?${params}`)
    },
    placeholderData: (prev) => prev,
    staleTime: 10_000,
    refetchInterval: 30_000,
  })

  const rows = query.data?.inbound ?? []
  const total = query.data?.total ?? 0
  const pageIds = rows.map((r) => r.id)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const invalidate = () => qc.invalidateQueries({ queryKey: QKEY })

  const bulkDelete = useMutation({
    mutationFn: (payload: { ids?: string[]; all?: boolean }) =>
      apiFetch<{ count: number }>('/api/wa/verify/inbound/bulk-delete', {
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
      title: 'Hapus log terpilih',
      children: (
        <Text size="sm">
          Hapus <b>{selection.count}</b> log inbound terpilih? Tindakan ini tak bisa dibatalkan.
        </Text>
      ),
      labels: { confirm: 'Hapus', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => bulkDelete.mutate({ ids: [...selection.selected] }),
    })

  const confirmDeleteAll = () =>
    modals.openConfirmModal({
      title: 'Hapus SEMUA log inbound',
      children: (
        <Text size="sm">
          Hapus <b>seluruh {total}</b> log inbound mentah? Tindakan ini tak bisa dibatalkan.
        </Text>
      ),
      labels: { confirm: 'Hapus semua', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => bulkDelete.mutate({ all: true }),
    })

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Title order={5}>Log Inbound (mentah)</Title>
        <Text size="xs" c="dimmed">
          Setiap pesan masuk yang melewati listener verifikasi. Nomor ter-mask; token tak pernah disimpan utuh.
        </Text>

        <WaVerifyToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari nomor / token…"
          filters={
            <SegmentedControl
              size="xs"
              value={matched}
              onChange={setMatched}
              data={[
                { label: 'Semua', value: 'all' },
                { label: 'Cocok', value: 'true' },
                { label: 'Tidak', value: 'false' },
              ]}
            />
          }
          selectedCount={selection.count}
          total={total}
          canEdit
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
            {debouncedSearch || matched !== 'all' ? 'Tak ada log yang cocok.' : 'Belum ada log inbound.'}
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={620}>
            <Table verticalSpacing="xs" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={36}>
                    <Checkbox
                      size="xs"
                      checked={selection.allOnPageSelected(pageIds)}
                      indeterminate={selection.someOnPageSelected(pageIds) && !selection.allOnPageSelected(pageIds)}
                      onChange={() => selection.togglePage(pageIds)}
                    />
                  </Table.Th>
                  <Table.Th>Waktu</Table.Th>
                  <Table.Th>Dari</Table.Th>
                  <Table.Th>Token</Table.Th>
                  <Table.Th>Cocok</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((r) => (
                  <Table.Tr key={r.id} bg={selection.isSelected(r.id) ? 'var(--mantine-color-blue-light)' : undefined}>
                    <Table.Td>
                      <Checkbox
                        size="xs"
                        checked={selection.isSelected(r.id)}
                        onChange={() => selection.toggleRow(r.id)}
                      />
                    </Table.Td>
                    <Table.Td>{fmt(r.createdAt)}</Table.Td>
                    <Table.Td>
                      <Code fz="xs">{r.fromMasked}</Code>
                    </Table.Td>
                    <Table.Td>
                      {r.tokenFound ? <Code fz="xs">{r.tokenFound}</Code> : <Text c="dimmed">—</Text>}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={r.matched ? 'green' : 'gray'} variant="light" size="sm">
                        {r.matched ? 'ya' : 'tidak'}
                      </Badge>
                    </Table.Td>
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
