import { Badge, ScrollArea, Table, Text } from '@mantine/core'
import type { UnifiedMessage } from './wa-messages.types'

function fmt(ms: number) {
  return new Date(ms).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
}

// Tabel terpadu chat + inbound WAV. Baris source 'chat' (punya chatId) klik →
// drill-down riwayat; baris 'wav' read-only.
export function WaMessagesList({ rows, onOpenChat }: { rows: UnifiedMessage[]; onOpenChat: (chatId: string) => void }) {
  if (rows.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="xl">
        Tidak ada pesan yang cocok dengan filter.
      </Text>
    )
  }

  return (
    <ScrollArea h={420}>
      <Table stickyHeader highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={150}>Waktu</Table.Th>
            <Table.Th w={90}>Sumber</Table.Th>
            <Table.Th>Dari</Table.Th>
            <Table.Th>Pesan</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r) => {
            const clickable = r.source === 'chat' && !!r.chatId
            return (
              <Table.Tr
                key={r.id}
                style={clickable ? { cursor: 'pointer' } : undefined}
                onClick={clickable ? () => onOpenChat(r.chatId as string) : undefined}
              >
                <Table.Td>{fmt(r.time)}</Table.Td>
                <Table.Td>
                  <Badge size="sm" variant="light" color={r.source === 'chat' ? 'teal' : 'blue'}>
                    {r.source === 'chat' ? 'Chat' : 'WAV'}
                  </Badge>
                </Table.Td>
                <Table.Td>{r.from || '—'}</Table.Td>
                <Table.Td>
                  <Text size="sm" lineClamp={1}>
                    {r.text || '—'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )
          })}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  )
}
