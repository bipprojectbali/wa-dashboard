import { Badge, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import type { SupervisorState } from './wa-messages.types'

function fmtTime(ms: number | null) {
  if (!ms) return '—'
  return new Date(ms).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' })
}

// Kartu info polling capture WAV. "Informasi polling jika ada" → saat
// running:false / state null, tampilkan status idle (bukan error).
export function WaMessagesPollingInfo({ state }: { state: SupervisorState | undefined }) {
  const running = state?.running ?? false

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={5}>Polling Capture</Title>
          <Badge color={running ? 'green' : 'gray'} variant="light">
            {running ? 'aktif' : 'idle'}
          </Badge>
        </Group>
        {!state ? (
          <Text size="sm" c="dimmed">
            Status polling belum tersedia.
          </Text>
        ) : (
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
            <Field label="Nomor server" value={state.serverNumber ?? '—'} />
            <Field label="Session" value={state.sessionId ?? '—'} mono />
            <Field label="Interval" value={`${Math.round(state.pollIntervalMs / 1000)}s`} />
            <Field label="Poll terakhir" value={fmtTime(state.lastPollAt)} />
            <Field label="Watermark" value={fmtTime(state.watermark)} />
            <Field label="Error terakhir" value={state.lastError ?? '—'} error={!!state.lastError} />
          </SimpleGrid>
        )}
      </Stack>
    </Card>
  )
}

function Field({ label, value, mono, error }: { label: string; value: string; mono?: boolean; error?: boolean }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" ff={mono ? 'monospace' : undefined} c={error ? 'red' : undefined} truncate>
        {value}
      </Text>
    </div>
  )
}
