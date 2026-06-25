import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Code,
  CopyButton,
  Group,
  Image,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { TbBrandWhatsapp, TbCheck, TbCopy, TbLogin2 } from 'react-icons/tb'
import { apiFetch } from '@/frontend/lib/apiFetch'
import { appendLog } from '@/frontend/lib/sim-log'
import { SimEventLog } from './SimEventLog'
import type { SimLogEntry, SimStartResp, SimStatusResp } from './sim.types'

// Orchestrator simulasi login WAV. Meniru "halaman login" app eksternal: isi nomor →
// klik → buka WhatsApp dengan token terisi → operator kirim → poll sampai VERIFIED.
// Mengumpulkan & menampilkan log timeline tiap langkah (untuk developer).
export function SimLoginPanel() {
  const [phone, setPhone] = useState('')
  const [session, setSession] = useState<SimStartResp | null>(null)
  const [log, setLog] = useState<SimLogEntry[]>([])

  const addLog = (label: string, data?: unknown) => setLog((prev) => appendLog(prev, label, data))

  const start = useMutation({
    mutationFn: (expectedPhone: string) => {
      addLog('POST /api/wa/verify/sim/start', { expectedPhone })
      return apiFetch<SimStartResp>('/api/wa/verify/sim/start', {
        method: 'POST',
        body: JSON.stringify({ expectedPhone }),
      })
    },
    onSuccess: (data) => {
      setSession(data)
      setLog([])
      addLog('Token terbit', { id: data.id, token: data.token, expiresAt: data.expiresAt })
      addLog('Deep-link & QR siap', { waMeUrl: data.waMeUrl, sendTo: data.sendTo })
    },
    onError: (err) => addLog('Gagal start', { error: (err as Error).message }),
  })

  const poll = useQuery({
    queryKey: ['sim', 'status', session?.id],
    queryFn: async () => {
      const data = await apiFetch<SimStatusResp>(`/api/wa/verify/sim/${session!.id}`)
      addLog(`Poll → ${data.status}`, data)
      return data
    },
    enabled: !!session,
    refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? 3000 : false),
    staleTime: 0,
  })

  const status = poll.data?.status
  const reset = () => {
    setSession(null)
    setLog([])
  }

  return (
    <Stack gap="md" maw={760}>
      <div>
        <Title order={3}>Simulasi Login via WhatsApp</Title>
        <Text size="sm" c="dimmed">
          Menjalankan alur verifikasi nomor (WAV) end-to-end persis seperti app eksternal yang login. Pipeline yang
          dipakai 100% asli (proxy server-side) — datanya juga muncul di panel Requests <Code>/wa?tab=verify</Code>.
        </Text>
      </div>

      <Card withBorder padding="md">
        <Stack gap="sm">
          <Title order={5}>Halaman Login (simulasi)</Title>
          <TextInput
            label="Nomor yang akan login"
            description="Mode Login: server akan mencocokkan nomor pengirim dengan nomor ini."
            placeholder="cth: 6281234567890"
            value={phone}
            onChange={(e) => setPhone(e.currentTarget.value)}
            disabled={!!session}
          />
          {start.isError && (
            <Alert color="red" variant="light">
              {(start.error as Error).message}
            </Alert>
          )}
          {!session ? (
            <Button
              leftSection={<TbLogin2 size={18} />}
              onClick={() => start.mutate(phone.trim())}
              loading={start.isPending}
              disabled={!phone.trim()}
            >
              Login via WhatsApp
            </Button>
          ) : (
            <Button variant="light" color="gray" onClick={reset}>
              Mulai simulasi baru
            </Button>
          )}
        </Stack>
      </Card>

      {session && (
        <Card withBorder padding="md">
          <Stack gap="sm">
            <Group justify="space-between">
              <Title order={5}>Kirim token via WhatsApp</Title>
              <StatusBadge status={status} />
            </Group>

            <Alert color="blue" variant="light">
              Deep-link hanya <b>mengisi</b> teks token — WhatsApp/OS tak mengizinkan kirim otomatis. Operator tetap tap
              tombol kirim di WhatsApp.
            </Alert>

            <Group align="flex-start" gap="lg">
              {session.waMeUrl ? (
                <Box>
                  <Image
                    src={`/api/wa/verify/sim/${session.id}/qr`}
                    alt="QR deep-link WhatsApp"
                    w={200}
                    h={200}
                    fit="contain"
                  />
                </Box>
              ) : (
                <Alert color="orange" variant="light">
                  Nomor server verifikasi belum dikonfigurasi (<Code>WA_VERIFY_SERVER_NUMBER</Code>).
                </Alert>
              )}

              <Stack gap="xs" style={{ flex: 1 }}>
                <Text size="sm">{session.instruction}</Text>
                <Group gap="xs">
                  <Text size="sm" fw={500}>
                    Token:
                  </Text>
                  <Code>{session.token}</Code>
                  <CopyButton value={session.token}>
                    {({ copied, copy }) => (
                      <Button
                        size="compact-xs"
                        variant="light"
                        color={copied ? 'teal' : 'blue'}
                        leftSection={copied ? <TbCheck size={14} /> : <TbCopy size={14} />}
                        onClick={copy}
                      >
                        {copied ? 'Tersalin' : 'Salin'}
                      </Button>
                    )}
                  </CopyButton>
                </Group>
                {session.waMeUrl && (
                  <Button
                    component="a"
                    href={session.waMeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    leftSection={<TbBrandWhatsapp size={18} />}
                    color="green"
                    variant="light"
                    w="fit-content"
                  >
                    Buka di WhatsApp
                  </Button>
                )}
              </Stack>
            </Group>

            {status === 'VERIFIED' && (
              <Alert color="green" variant="light" title="Terverifikasi">
                Nomor pengirim cocok: <Code>{poll.data?.matchedPhone ?? '—'}</Code>
              </Alert>
            )}
            {status === 'EXPIRED' && (
              <Alert color="gray" variant="light" title="Kedaluwarsa">
                Token kedaluwarsa sebelum pesan diterima. Mulai simulasi baru.
              </Alert>
            )}
          </Stack>
        </Card>
      )}

      <SimEventLog entries={log} />
    </Stack>
  )
}

function StatusBadge({ status }: { status?: string }) {
  const color = status === 'VERIFIED' ? 'green' : status === 'EXPIRED' ? 'gray' : 'yellow'
  return (
    <Badge color={color} variant="light">
      {status ?? 'PENDING'}
    </Badge>
  )
}
