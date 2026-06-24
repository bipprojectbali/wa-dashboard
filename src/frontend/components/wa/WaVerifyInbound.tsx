import { ActionIcon, Badge, Card, Code, Group, Loader, Stack, Table, Text, Title, Tooltip } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { TbRefresh } from 'react-icons/tb'
import { apiFetch } from '@/frontend/lib/apiFetch'
import type { InboundResponse } from './wa-verify.types'

function fmt(iso: string) {
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
}

// Raw inbound log (audit mentah) — SUPER_ADMIN saja. Nomor sudah ter-mask dari server.
export function WaVerifyInbound() {
  const query = useQuery({
    queryKey: ['wa', 'verify', 'inbound'],
    queryFn: () => apiFetch<InboundResponse>('/api/wa/verify/inbound'),
    staleTime: 10_000,
    refetchInterval: 30_000,
  })

  const rows = query.data?.inbound ?? []

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={5}>Log Inbound (mentah)</Title>
          <Tooltip label="Muat ulang">
            <ActionIcon variant="subtle" color="gray" onClick={() => query.refetch()} loading={query.isFetching}>
              <TbRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Text size="xs" c="dimmed">
          Setiap pesan masuk yang melewati listener verifikasi. Nomor ter-mask; token tak pernah disimpan utuh.
        </Text>

        {query.isLoading ? (
          <Loader />
        ) : rows.length === 0 ? (
          <Text size="sm" c="dimmed">
            Belum ada log inbound.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={620}>
            <Table verticalSpacing="xs" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Waktu</Table.Th>
                  <Table.Th>Dari</Table.Th>
                  <Table.Th>Token</Table.Th>
                  <Table.Th>Cocok</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((r) => (
                  <Table.Tr key={r.id}>
                    <Table.Td>{fmt(r.createdAt)}</Table.Td>
                    <Table.Td>
                      <Code fz="xs">{r.fromMasked}</Code>
                    </Table.Td>
                    <Table.Td>
                      {r.tokenFound ? <Code fz="xs">{r.tokenFound}</Code> : <Text c="dimmed">—</Text>}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={r.matched ? 'green' : 'gray'} variant="light" size="sm">
                        {r.matched ? 'ya' : 'tidak'}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Stack>
    </Card>
  )
}
