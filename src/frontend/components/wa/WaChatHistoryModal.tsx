import { Alert, Box, Group, Loader, Modal, Paper, ScrollArea, Stack, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/frontend/lib/apiFetch'
import type { ChatMessage, ChatMessagesResponse } from './wa-messages.types'

function fmt(ms: number) {
  return new Date(ms).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
}

// Riwayat pesan satu chat (on-demand). Query enabled hanya saat chatId ada
// (modal terbuka) → tak menembak container saat tertutup.
export function WaChatHistoryModal({ chatId, onClose }: { chatId: string | null; onClose: () => void }) {
  const query = useQuery({
    queryKey: ['wa', 'messages', chatId],
    queryFn: () => apiFetch<ChatMessagesResponse>(`/api/wa/messages?chatId=${encodeURIComponent(chatId ?? '')}`),
    enabled: !!chatId,
    staleTime: 30_000,
  })

  const messages: ChatMessage[] = query.data?.messages ?? query.data?.result ?? []

  return (
    <Modal
      opened={!!chatId}
      onClose={onClose}
      title="Riwayat Pesan"
      size="lg"
      scrollAreaComponent={ScrollArea.Autosize}
    >
      {query.isLoading ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : query.isError ? (
        <Alert color="red" variant="light">
          {(query.error as Error)?.message ?? 'Gagal memuat riwayat pesan.'}
        </Alert>
      ) : messages.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          Tidak ada pesan pada chat ini.
        </Text>
      ) : (
        <Stack gap="xs">
          {messages.map((m, i) => (
            <Box
              key={typeof m.id === 'string' ? m.id : (m.id?._serialized ?? i)}
              style={{ alignSelf: m.fromMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}
            >
              <Paper withBorder p="xs" bg={m.fromMe ? 'var(--mantine-color-teal-light)' : undefined}>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {m.body || '—'}
                </Text>
                <Text size="xs" c="dimmed" ta="right" mt={2}>
                  {m.fromMe ? 'Anda' : (m.from ?? '')} ·{' '}
                  {typeof m.timestamp === 'number' ? fmt(m.timestamp * 1000) : ''}
                </Text>
              </Paper>
            </Box>
          ))}
        </Stack>
      )}
    </Modal>
  )
}
