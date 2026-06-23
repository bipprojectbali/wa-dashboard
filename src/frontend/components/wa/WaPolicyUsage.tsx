import { Card, Group, Progress, Stack, Text, Title } from '@mantine/core'
import type { UsageSnapshot } from './wa-policy.types'

interface Props {
  usage: UsageSnapshot
}

function Bar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0
  const color = pct >= 100 ? 'red' : pct >= 80 ? 'orange' : 'teal'
  return (
    <Stack gap={4}>
      <Group justify="space-between">
        <Text size="sm">{label}</Text>
        <Text size="sm" c="dimmed">
          {used} / {max}
        </Text>
      </Group>
      <Progress value={pct} color={color} size="sm" />
    </Stack>
  )
}

export function WaPolicyUsage({ usage }: Props) {
  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Title order={5}>Pemakaian Kuota Kamu</Title>
        <Bar label="Per menit" used={usage.minute.used} max={usage.minute.max} />
        <Bar label="Per jam" used={usage.hour.used} max={usage.hour.max} />
        <Bar label="Per hari" used={usage.day.used} max={usage.day.max} />
      </Stack>
    </Card>
  )
}
