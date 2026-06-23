import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  CopyButton,
  Group,
  Image,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { TbCopy, TbCopyCheck, TbPlugConnected, TbRefresh, TbTrash } from 'react-icons/tb'
import { apiFetch } from '@/frontend/lib/apiFetch'
import { type PairingResp, pairingCodeOrThrow } from '@/frontend/lib/wa-pairing'

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
  const [pairMethod, setPairMethod] = useState<'qr' | 'phone'>('qr')
  const [phoneNumber, setPhoneNumber] = useState('')

  const status = useQuery({
    queryKey: ['wa', 'status'],
    queryFn: () => apiFetch<StatusResp>('/api/wa/session/status'),
    // Selama belum CONNECTED (fase scan/pairing) selalu poll 3s: transisi ke
    // CONNECTED bisa terjadi tanpa event WS final yang memicu invalidate, jadi
    // mengandalkan WS saja membuat QR macet. Setelah CONNECTED, andalkan WS
    // bila ready; jatuh ke polling bila WS mati.
    refetchInterval: (query) => (query.state.data?.state === 'CONNECTED' ? (wsReady ? false : 3000) : 3000),
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
  // Throw on the container's HTTP-200 { success: false } marker so the failure
  // surfaces in pairing.error instead of silently yielding no code.
  const pairing = useMutation({
    mutationFn: async (phone: string) => {
      const data = await apiFetch<PairingResp>('/api/wa/session/pairing-code', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phone }),
      })
      return pairingCodeOrThrow(data)
    },
  })
  const pairingCode = pairing.data ?? null

  const errorMsg =
    (status.error as Error | undefined)?.message ??
    (start.error as Error | undefined)?.message ??
    (restart.error as Error | undefined)?.message ??
    (terminate.error as Error | undefined)?.message ??
    (pairing.error as Error | undefined)?.message

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
            <SegmentedControl
              value={pairMethod}
              onChange={(v) => setPairMethod(v as 'qr' | 'phone')}
              data={[
                { label: 'Scan QR', value: 'qr' },
                { label: 'Nomor HP', value: 'phone' },
              ]}
            />

            {pairMethod === 'qr' ? (
              <>
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
              </>
            ) : (
              <Stack gap="sm" w="100%" maw={360}>
                <Text size="sm" c="dimmed" ta="center">
                  Masukkan nomor HP (format internasional, mis. 628123456789) untuk dapat kode pairing.
                </Text>
                <Group gap="xs" wrap="nowrap" align="flex-end">
                  <TextInput
                    style={{ flex: 1 }}
                    label="Nomor HP"
                    placeholder="628123456789"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.currentTarget.value.replace(/[^\d]/g, ''))}
                    inputMode="numeric"
                  />
                  <Button
                    onClick={() => pairing.mutate(phoneNumber)}
                    loading={pairing.isPending}
                    disabled={phoneNumber.length < 8}
                  >
                    Minta Kode
                  </Button>
                </Group>

                {pairingCode && (
                  <Alert color="green" variant="light" title="Masukkan kode ini di WhatsApp">
                    <Stack gap="xs" align="center">
                      <Text size="xs" c="dimmed" ta="center">
                        WhatsApp → Perangkat Tertaut → Tautkan dengan nomor telepon
                      </Text>
                      <Group gap="xs" align="center">
                        <Code fz="lg" fw={700}>
                          {pairingCode}
                        </Code>
                        <CopyButton value={pairingCode}>
                          {({ copied, copy }) => (
                            <Button
                              size="xs"
                              variant="subtle"
                              color={copied ? 'teal' : 'blue'}
                              leftSection={copied ? <TbCopyCheck size={14} /> : <TbCopy size={14} />}
                              onClick={copy}
                            >
                              {copied ? 'Tersalin' : 'Salin'}
                            </Button>
                          )}
                        </CopyButton>
                      </Group>
                    </Stack>
                  </Alert>
                )}
              </Stack>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  )
}
