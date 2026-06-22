import { Badge, Button, Card, Group, Select, Stack, Text, TextInput } from '@mantine/core'
import { TbPaperclip } from 'react-icons/tb'
import type { TicketDetail } from './types'

interface Props {
  evidence: TicketDetail['evidence']
  evidenceKind: string
  setEvidenceKind: (v: string) => void
  evidenceUrl: string
  setEvidenceUrl: (v: string) => void
  evidenceNote: string
  setEvidenceNote: (v: string) => void
  isPending: boolean
  onSubmit: (body: { kind: string; url: string; note?: string }) => void
}

export function EvidenceSection({
  evidence,
  evidenceKind,
  setEvidenceKind,
  evidenceUrl,
  setEvidenceUrl,
  evidenceNote,
  setEvidenceNote,
  isPending,
  onSubmit,
}: Props) {
  return (
    <Card withBorder padding="sm" radius="sm">
      <Text size="xs" c="dimmed" mb={6}>
        Evidence ({evidence.length})
      </Text>
      <Stack gap={4}>
        {evidence.length === 0 && (
          <Text size="xs" c="dimmed">
            No evidence attached
          </Text>
        )}
        {evidence.map((e) => (
          <Group key={e.id} gap="xs">
            <Badge size="xs" variant="outline">
              {e.kind}
            </Badge>
            <Text size="xs" ff="monospace" style={{ wordBreak: 'break-all' }}>
              {e.url}
            </Text>
            {e.note && (
              <Text size="xs" c="dimmed">
                — {e.note}
              </Text>
            )}
          </Group>
        ))}
      </Stack>
      <Group mt="sm" align="flex-end">
        <Select
          label="Kind"
          size="xs"
          value={evidenceKind}
          onChange={(v) => setEvidenceKind(v || 'screenshot')}
          data={['screenshot', 'commit', 'test_log', 'trace', 'other']}
          w={130}
        />
        <TextInput
          label="URL / path / hash"
          size="xs"
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <TextInput
          label="Note"
          size="xs"
          value={evidenceNote}
          onChange={(e) => setEvidenceNote(e.currentTarget.value)}
          w={180}
        />
        <Button
          size="xs"
          leftSection={<TbPaperclip size={14} />}
          disabled={!evidenceUrl.trim()}
          loading={isPending}
          onClick={() =>
            onSubmit({
              kind: evidenceKind,
              url: evidenceUrl.trim(),
              note: evidenceNote.trim() || undefined,
            })
          }
        >
          Attach
        </Button>
      </Group>
    </Card>
  )
}
