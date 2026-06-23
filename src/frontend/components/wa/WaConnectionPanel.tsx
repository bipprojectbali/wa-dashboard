import { Alert, Badge, Button, Card, Group, Image, Stack, Text, Title } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { TbPlugConnected, TbRefresh, TbTrash } from 'react-icons/tb'
import { apiFetch } from '@/frontend/lib/apiFetch'

interface StatusResp {
  success: boolean
  state?: string | null
  message?: string
}

function stateColor(state?: string | null) {
  if (state === 'CONNECTED') return 'green'
  if (state === 'STARTING' || state === 'PAIRING') return 'yellow'
  return 'gray'
}

export function WaConnectionPanel({ wsReady }: { wsReady: boolean }) {
  const qc = useQueryClient()
  const [qrNonce, setQrNonce] = useState(0)

  const status = useQuery({
    queryKey: ['wa', 'status'],
    queryFn: () => apiFetch<StatusResp>('/api/wa/session/status'),
    // Fallback polling when the container WS bridge is not pushing events.
    refetchInterval: wsReady ? false : 3000,
  })

  const connected = status.data?.state === 'CONNECTED'
  const needsQr = !connected

  const onSettled = () => {
    qc.invalidateQueries({ queryKey: ['wa', 'status'] })
    setQrNonce((n) => n + 1)
  }
  const start = useMutation({ mutationFn: () => apiFetch('/api/wa/session/start', { method: 'POST' }), onSettled })
  const restart = useMutation({ mutationFn: () => apiFetch('/api/wa/session/restart', { method: 'POST' }), onSettled })
  const terminate = useMutation({
    mutationFn: () => apiFetch('/api/wa/session/terminate', { method: 'POST' }),
    onSettled,
  })

  const errorMsg =
    (status.error as Error | undefined)?.message ??
    (start.error as Error | undefined)?.message ??
    (restart.error as Error | undefined)?.message ??
    (terminate.error as Error | undefined)?.message

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={4}>Koneksi WhatsApp</Title>
        <Badge color={stateColor(status.data?.state)} size="lg" variant="light">
          {status.data?.state ?? status.data?.message ?? 'unknown'}
        </Badge>
      </Group>

      {errorMsg && (
        <Alert color="red" variant="light" title="Gagal menghubungi WhatsApp API">
          {errorMsg}
        </Alert>
      )}

      {!wsReady && (
        <Alert color="yellow" variant="light" title="Realtime tidak aktif">
          WebSocket ke container belum tersedia — status di-refresh via polling tiap 3 detik.
        </Alert>
      )}

      <Group>
        <Button
          leftSection={<TbPlugConnected size={16} />}
          onClick={() => start.mutate()}
          loading={start.isPending}
          disabled={connected}
        >
          Start
        </Button>
        <Button
          variant="light"
          leftSection={<TbRefresh size={16} />}
          onClick={() => restart.mutate()}
          loading={restart.isPending}
        >
          Restart
        </Button>
        <Button
          color="red"
          variant="light"
          leftSection={<TbTrash size={16} />}
          onClick={() => terminate.mutate()}
          loading={terminate.isPending}
        >
          Terminate
        </Button>
      </Group>

      {needsQr && (
        <Card withBorder padding="md">
          <Stack align="center" gap="sm">
            <Text size="sm" c="dimmed">
              Scan QR di WhatsApp → Perangkat Tertaut
            </Text>
            <Image
              src={`/api/wa/session/qr/image?n=${qrNonce}`}
              alt="WhatsApp QR"
              w={260}
              h={260}
              fit="contain"
              fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"
            />
            <Button variant="subtle" size="xs" onClick={() => setQrNonce((n) => n + 1)}>
              Refresh QR
            </Button>
          </Stack>
        </Card>
      )}
    </Stack>
  )
}
