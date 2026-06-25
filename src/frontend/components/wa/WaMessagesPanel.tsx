import { Alert, Badge, Button, Card, Group, Loader, Stack, TextInput, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { TbRefresh, TbSearch } from 'react-icons/tb'
import { apiFetch } from '@/frontend/lib/apiFetch'
import { filterMessages, mergeMessages } from '@/frontend/lib/wa-messages'
import { WaChatHistoryModal } from './WaChatHistoryModal'
import { WaMessagesList } from './WaMessagesList'
import { WaMessagesPollingInfo } from './WaMessagesPollingInfo'
import type { ChatRow, ChatsResponse, SupervisorState } from './wa-messages.types'
import type { InboundResponse } from './wa-verify.types'

// Orchestrator tab "Pesan": gabung daftar chat + inbound WAV, filter klien-side
// (search + rentang tanggal), kartu polling, dan drill-down riwayat per chat.
export function WaMessagesPanel() {
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [activeChatId, setActiveChatId] = useState<string | null>(null)

  const chats = useQuery({
    queryKey: ['wa', 'chats'],
    queryFn: () => apiFetch<ChatsResponse | ChatRow[]>('/api/wa/chats'),
    staleTime: 30_000,
  })
  const inbound = useQuery({
    queryKey: ['wa', 'verify', 'inbound'],
    queryFn: () => apiFetch<InboundResponse>('/api/wa/verify/inbound?limit=200'),
    staleTime: 30_000,
  })
  const supervisor = useQuery({
    queryKey: ['wa', 'verify', 'supervisor'],
    queryFn: () => apiFetch<SupervisorState>('/api/wa/verify/supervisor'),
    staleTime: 30_000,
  })

  const rows = useMemo(() => {
    const chatList = Array.isArray(chats.data) ? chats.data : (chats.data?.chats ?? [])
    return mergeMessages(chatList, inbound.data?.inbound ?? [])
  }, [chats.data, inbound.data])

  const filtered = useMemo(() => filterMessages(rows, { search, dateFrom, dateTo }), [rows, search, dateFrom, dateTo])

  const isLoading = chats.isLoading || inbound.isLoading
  const error = chats.error ?? inbound.error
  const refetchAll = () => {
    chats.refetch()
    inbound.refetch()
    supervisor.refetch()
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Pesan</Title>
        <Button
          variant="light"
          size="xs"
          leftSection={<TbRefresh size={14} />}
          onClick={refetchAll}
          loading={isLoading}
        >
          Muat ulang
        </Button>
      </Group>

      <WaMessagesPollingInfo state={supervisor.data} />

      <Card withBorder padding="md">
        <Stack gap="sm">
          <Group align="flex-end" gap="sm">
            <TextInput
              label="Cari"
              placeholder="Nama, nomor, atau isi pesan"
              leftSection={<TbSearch size={14} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <TextInput
              label="Dari tanggal"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.currentTarget.value)}
            />
            <TextInput
              label="Sampai tanggal"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.currentTarget.value)}
            />
            <Badge variant="light" size="lg">
              {filtered.length} / {rows.length}
            </Badge>
          </Group>

          {error ? (
            <Alert color="red" variant="light">
              {(error as Error)?.message ?? 'Gagal memuat daftar pesan.'}
            </Alert>
          ) : isLoading ? (
            <Group justify="center" py="xl">
              <Loader />
            </Group>
          ) : (
            <WaMessagesList rows={filtered} onOpenChat={setActiveChatId} />
          )}
        </Stack>
      </Card>

      <WaChatHistoryModal chatId={activeChatId} onClose={() => setActiveChatId(null)} />
    </Stack>
  )
}
