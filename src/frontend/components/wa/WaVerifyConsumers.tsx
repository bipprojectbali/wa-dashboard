import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Code,
  Group,
  Loader,
  Pagination,
  SegmentedControl,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { TbEye, TbKey, TbPencil, TbPlus, TbTrash } from 'react-icons/tb'
import { apiFetch } from '@/frontend/lib/apiFetch'
import { useRowSelection } from '@/frontend/lib/wa-verify-selection'
import { openEditConsumerModal } from './WaVerifyConsumerEditModal'
import { showApiKeyModal, showCreatedModal, showSecretModal } from './WaVerifyConsumerModals'
import { WaVerifyToolbar } from './WaVerifyToolbar'
import {
  type ConsumersResponse,
  type CreatedConsumer,
  PAGE_SIZE,
  type RevealedSecret,
  type VerifyConsumer,
} from './wa-verify.types'

const QKEY = ['wa', 'verify', 'consumers']

export function WaVerifyConsumers() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch] = useDebouncedValue(search, 300)
  const [activeFilter, setActiveFilter] = useState('all')
  const [page, setPage] = useState(1)
  const selection = useRowSelection()

  // biome-ignore lint/correctness/useExhaustiveDependencies: filter changes reset pagination, values not read in body
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, activeFilter])

  const query = useQuery({
    queryKey: [...QKEY, { search: debouncedSearch, activeFilter, page }],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE) })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (activeFilter !== 'all') params.set('active', activeFilter)
      return apiFetch<ConsumersResponse>(`/api/wa/verify/consumers?${params}`)
    },
    placeholderData: (prev) => prev,
    staleTime: 10_000,
  })

  const consumers = query.data?.consumers ?? []
  const total = query.data?.total ?? 0
  const canEdit = query.data?.canEdit ?? false
  const pageIds = consumers.map((c) => c.id)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const invalidate = () => qc.invalidateQueries({ queryKey: QKEY })

  const create = useMutation({
    mutationFn: () =>
      apiFetch<CreatedConsumer>('/api/wa/verify/consumers', {
        method: 'POST',
        body: JSON.stringify({ name, webhookUrl: webhookUrl || null }),
      }),
    onSuccess: (data) => {
      setName('')
      setWebhookUrl('')
      invalidate()
      showCreatedModal(data)
    },
  })

  const regen = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ apiKey: string }>(`/api/wa/verify/consumers/${id}/regenerate-key`, { method: 'POST' }),
    onSuccess: (data) => {
      invalidate()
      showApiKeyModal(data.apiKey, 'API key baru')
    },
  })

  const reveal = useMutation({
    mutationFn: (c: VerifyConsumer) =>
      apiFetch<RevealedSecret>(`/api/wa/verify/consumers/${c.id}/reveal-secret`).then((d) => ({ name: c.name, ...d })),
    onSuccess: (data) => showSecretModal(data.name, data.webhookSecret),
  })

  const toggle = useMutation({
    mutationFn: (c: VerifyConsumer) =>
      apiFetch(`/api/wa/verify/consumers/${c.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: c.name, webhookUrl: c.webhookUrl, active: !c.active }),
      }),
    onSuccess: invalidate,
  })

  const bulkDelete = useMutation({
    mutationFn: (payload: { ids?: string[]; all?: boolean }) =>
      apiFetch<{ count: number }>('/api/wa/verify/consumers/bulk-delete', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      selection.clear()
      invalidate()
    },
  })

  const confirmRegen = (c: VerifyConsumer) =>
    modals.openConfirmModal({
      title: 'Buat key baru',
      children: (
        <Text size="sm">
          Buat API key baru untuk <b>{c.name}</b>? Key lama langsung tidak berlaku — app yang masih memakainya harus
          diperbarui. Key baru hanya ditampilkan sekali.
        </Text>
      ),
      labels: { confirm: 'Buat & salin', cancel: 'Batal' },
      confirmProps: { color: 'orange' },
      onConfirm: () => regen.mutate(c.id),
    })

  const confirmDeleteSelected = () =>
    modals.openConfirmModal({
      title: 'Hapus consumer terpilih',
      children: (
        <Text size="sm">
          Hapus <b>{selection.count}</b> consumer terpilih? Semua request verifikasinya ikut terhapus (cascade).
          Tindakan ini tak bisa dibatalkan.
        </Text>
      ),
      labels: { confirm: 'Hapus', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => bulkDelete.mutate({ ids: [...selection.selected] }),
    })

  const confirmDeleteAll = () =>
    modals.openConfirmModal({
      title: 'Hapus SEMUA consumer',
      children: (
        <Text size="sm">
          Hapus <b>seluruh {total}</b> consumer beserta semua request verifikasinya (cascade)? Semua app yang memakai
          WAV akan kehilangan akses. Tindakan ini tak bisa dibatalkan.
        </Text>
      ),
      labels: { confirm: 'Hapus semua', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => bulkDelete.mutate({ all: true }),
    })

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Title order={5}>Consumer Apps</Title>

        {canEdit && (
          <Group align="flex-end" gap="xs" wrap="wrap">
            <TextInput
              label="Nama consumer"
              placeholder="mis. app-login"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              style={{ flex: 1, minWidth: 160 }}
            />
            <TextInput
              label="Webhook URL (opsional)"
              placeholder="https://app.example.com/wav-hook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.currentTarget.value)}
              style={{ flex: 2, minWidth: 200 }}
            />
            <Button
              leftSection={<TbPlus size={16} />}
              onClick={() => create.mutate()}
              loading={create.isPending}
              disabled={!name.trim()}
            >
              Buat
            </Button>
          </Group>
        )}

        {create.isError && (
          <Alert color="red" variant="light">
            {(create.error as Error).message}
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
            <SegmentedControl
              size="xs"
              value={activeFilter}
              onChange={setActiveFilter}
              data={[
                { label: 'Semua', value: 'all' },
                { label: 'Aktif', value: 'true' },
                { label: 'Nonaktif', value: 'false' },
              ]}
            />
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
        ) : consumers.length === 0 ? (
          <Text size="sm" c="dimmed">
            {debouncedSearch || activeFilter !== 'all'
              ? 'Tak ada consumer yang cocok.'
              : 'Belum ada consumer terdaftar.'}
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={660}>
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
                  <Table.Th>Nama</Table.Th>
                  <Table.Th>Key Prefix</Table.Th>
                  <Table.Th>Webhook</Table.Th>
                  <Table.Th>Requests</Table.Th>
                  <Table.Th>Aktif</Table.Th>
                  {canEdit && <Table.Th>Aksi</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {consumers.map((c) => (
                  <Table.Tr key={c.id} bg={selection.isSelected(c.id) ? 'var(--mantine-color-blue-light)' : undefined}>
                    {canEdit && (
                      <Table.Td>
                        <Checkbox
                          size="xs"
                          checked={selection.isSelected(c.id)}
                          onChange={() => selection.toggleRow(c.id)}
                        />
                      </Table.Td>
                    )}
                    <Table.Td>{c.name}</Table.Td>
                    <Table.Td>
                      <Code fz="xs">{c.apiKeyPrefix}…</Code>
                    </Table.Td>
                    <Table.Td>
                      {c.webhookUrl ? (
                        <Badge color="blue" variant="light" size="sm">
                          push
                        </Badge>
                      ) : (
                        <Badge color="gray" variant="light" size="sm">
                          polling
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>{c._count.requests}</Table.Td>
                    <Table.Td>
                      <Switch
                        checked={c.active}
                        disabled={!canEdit || toggle.isPending}
                        size="sm"
                        onChange={() => toggle.mutate(c)}
                      />
                    </Table.Td>
                    {canEdit && (
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Tooltip label="Lihat webhook secret">
                            <ActionIcon
                              variant="subtle"
                              color="teal"
                              onClick={() => reveal.mutate(c)}
                              loading={reveal.isPending && reveal.variables?.id === c.id}
                            >
                              <TbEye size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Edit nama / webhook">
                            <ActionIcon variant="subtle" color="blue" onClick={() => openEditConsumerModal(c)}>
                              <TbPencil size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Buat & salin key baru (key lama batal)">
                            <ActionIcon
                              variant="subtle"
                              color="orange"
                              onClick={() => confirmRegen(c)}
                              loading={regen.isPending}
                            >
                              <TbKey size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Hapus">
                            <ActionIcon variant="subtle" color="red" onClick={() => bulkDelete.mutate({ ids: [c.id] })}>
                              <TbTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
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
