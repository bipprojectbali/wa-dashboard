import {
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Pagination,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { TbLock, TbRefresh, TbSearch } from 'react-icons/tb'
import { apiFetch } from '@/frontend/lib/apiFetch'
import { filterMessages, mergeMessages } from '@/frontend/lib/wa-messages'
import { WaChatHistoryModal } from './WaChatHistoryModal'
import { WaMessagesList } from './WaMessagesList'
import { WaMessagesPollingInfo } from './WaMessagesPollingInfo'
import type { ChatRow, ChatsResponse, SupervisorState } from './wa-messages.types'
import type { InboundResponse } from './wa-verify.types'

const PAGE_SIZE = 20
const LOCK_KEY = 'wa_messages_unlocked'
// Soft lock — prevensi tampilan tidak disengaja; bukan keamanan kriptografis.
const checkPw = (input: string) => input === atob('TWFrdXJvXzEyMw==')

// Orchestrator tab "Pesan": gabung daftar chat + inbound WAV, filter klien-side
// (search + rentang tanggal), kartu polling, dan drill-down riwayat per chat.
export function WaMessagesPanel() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(LOCK_KEY) === '1')
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const chats = useQuery({
    queryKey: ['wa', 'chats'],
    queryFn: () => apiFetch<ChatsResponse | ChatRow[]>('/api/wa/chats'),
    staleTime: 30_000,
    enabled: unlocked,
  })
  const inbound = useQuery({
    queryKey: ['wa', 'verify', 'inbound'],
    queryFn: () => apiFetch<InboundResponse>('/api/wa/verify/inbound?limit=200'),
    staleTime: 30_000,
    enabled: unlocked,
  })
  const supervisor = useQuery({
    queryKey: ['wa', 'verify', 'supervisor'],
    queryFn: () => apiFetch<SupervisorState>('/api/wa/verify/supervisor'),
    staleTime: 30_000,
    enabled: unlocked,
  })

  const rows = useMemo(() => {
    const chatList = Array.isArray(chats.data) ? chats.data : (chats.data?.chats ?? [])
    return mergeMessages(chatList, inbound.data?.inbound ?? [])
  }, [chats.data, inbound.data])

  const filtered = useMemo(() => filterMessages(rows, { search, dateFrom, dateTo }), [rows, search, dateFrom, dateTo])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pagedRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const isLoading = chats.isLoading || inbound.isLoading
  const error = chats.error ?? inbound.error
  const refetchAll = () => {
    chats.refetch()
    inbound.refetch()
    supervisor.refetch()
  }

  const handleUnlock = () => {
    if (checkPw(pwInput)) {
      sessionStorage.setItem(LOCK_KEY, '1')
      setUnlocked(true)
    } else {
      setPwError('Kata sandi salah.')
    }
  }

  if (!unlocked) {
    return (
      <Stack gap="md">
        <Title order={3}>Pesan</Title>
        <Card withBorder padding="xl" maw={360} mx="auto" mt="xl">
          <Stack gap="md" align="center">
            <TbLock size={32} color="var(--mantine-color-dimmed)" />
            <Text size="sm" c="dimmed" ta="center">
              Masukkan kata sandi untuk melihat riwayat pesan.
            </Text>
            <PasswordInput
              w="100%"
              placeholder="Kata sandi"
              value={pwInput}
              error={pwError}
              onChange={(e) => {
                setPwInput(e.currentTarget.value)
                setPwError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUnlock()
              }}
            />
            <Button fullWidth onClick={handleUnlock}>
              Buka
            </Button>
          </Stack>
        </Card>
      </Stack>
    )
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Pesan</Title>
        <Group gap="xs">
          <Button
            variant="subtle"
            size="xs"
            color="gray"
            leftSection={<TbLock size={14} />}
            onClick={() => {
              sessionStorage.removeItem(LOCK_KEY)
              setUnlocked(false)
              setPwInput('')
            }}
          >
            Kunci
          </Button>
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
              onChange={(e) => {
                setSearch(e.currentTarget.value)
                setPage(1)
              }}
              style={{ flex: 1, minWidth: 200 }}
            />
            <TextInput
              label="Dari tanggal"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.currentTarget.value)
                setPage(1)
              }}
            />
            <TextInput
              label="Sampai tanggal"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.currentTarget.value)
                setPage(1)
              }}
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
            <WaMessagesList rows={pagedRows} onOpenChat={setActiveChatId} />
          )}

          {totalPages > 1 && (
            <Center pt="xs">
              <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
            </Center>
          )}
        </Stack>
      </Card>

      <WaChatHistoryModal chatId={activeChatId} onClose={() => setActiveChatId(null)} />
    </Stack>
  )
}
