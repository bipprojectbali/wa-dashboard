import { Badge, Card, Code, Group, Stack, Text, Timeline, Title } from '@mantine/core'
import { TbActivity } from 'react-icons/tb'
import { fmtDuration } from '@/frontend/lib/sim-log'
import type { SimLogEntry } from './sim.types'

interface Props {
  entries: SimLogEntry[]
}

function fmtTime(at: number) {
  return new Date(at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// Timeline berstempel waktu tiap langkah simulasi + raw JSON per langkah + durasi total.
// Inilah "log untuk developer" — bukti tiap tahap pipeline dijalankan.
export function SimEventLog({ entries }: Props) {
  const total = entries.length >= 2 ? entries[entries.length - 1]!.at - entries[0]!.at : 0

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap="xs">
            <TbActivity size={18} />
            <Title order={5}>Log Timeline</Title>
          </Group>
          {entries.length >= 2 && (
            <Badge variant="light" color="gray">
              Durasi total: {fmtDuration(total)}
            </Badge>
          )}
        </Group>

        {entries.length === 0 ? (
          <Text size="sm" c="dimmed">
            Belum ada aktivitas. Mulai simulasi untuk merekam langkah.
          </Text>
        ) : (
          <Timeline active={entries.length} bulletSize={18} lineWidth={2}>
            {entries.map((e) => (
              <Timeline.Item key={`${e.at}-${e.label}`} title={e.label}>
                <Text size="xs" c="dimmed">
                  {fmtTime(e.at)}
                </Text>
                {e.data !== undefined && (
                  <Code block fz="xs" mt={4}>
                    {JSON.stringify(e.data, null, 2)}
                  </Code>
                )}
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Stack>
    </Card>
  )
}
