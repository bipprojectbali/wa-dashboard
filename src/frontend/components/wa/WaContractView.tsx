import { Alert, Badge, Button, Card, Group, List, Stack, Text, Title } from '@mantine/core'
import { modals } from '@mantine/modals'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { TbCheck, TbShieldCheck, TbX } from 'react-icons/tb'
import { apiFetch } from '@/frontend/lib/apiFetch'
import type { ContractSection } from './wa-policy.types'

interface Props {
  contract: { version: number; sections: ContractSection[] }
  ack: { version: number; at: string } | null
}

export function WaContractView({ contract, ack }: Props) {
  const qc = useQueryClient()
  const acked = ack != null && ack.version >= contract.version

  const ackMutation = useMutation({
    mutationFn: () => apiFetch('/api/wa/policy/ack', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa', 'policy'] }),
  })

  const revokeMutation = useMutation({
    mutationFn: () => apiFetch('/api/wa/policy/ack', { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa', 'policy'] }),
  })

  const confirmRevoke = () =>
    modals.openConfirmModal({
      title: 'Batalkan persetujuan kontrak?',
      children: (
        <Text size="sm">Setelah dibatalkan, pengiriman pesan akan diblokir sampai kamu menyetujui kontrak lagi.</Text>
      ),
      labels: { confirm: 'Batalkan persetujuan', cancel: 'Tidak jadi' },
      confirmProps: { color: 'red' },
      onConfirm: () => revokeMutation.mutate(),
    })

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={5}>Kontrak Sumpah Pengikat (v{contract.version})</Title>
          {acked ? (
            <Badge color="green" leftSection={<TbShieldCheck size={12} />}>
              Disetujui
            </Badge>
          ) : (
            <Badge color="red">Belum disetujui</Badge>
          )}
        </Group>

        {contract.sections.map((section) => (
          <div key={section.title}>
            <Text fw={600} size="sm" mb={4}>
              {section.title}
            </Text>
            <List size="sm" spacing={4}>
              {section.body.map((line) => (
                <List.Item key={line}>{line}</List.Item>
              ))}
            </List>
          </div>
        ))}

        {!acked && (
          <Alert color="yellow" variant="light">
            Kamu harus menyetujui kontrak versi terbaru sebelum bisa mengirim pesan.
          </Alert>
        )}
        {(ackMutation.isError || revokeMutation.isError) && (
          <Alert color="red" variant="light">
            {((ackMutation.error ?? revokeMutation.error) as Error).message}
          </Alert>
        )}

        <Group>
          <Button
            leftSection={<TbCheck size={16} />}
            onClick={() => ackMutation.mutate()}
            loading={ackMutation.isPending}
            disabled={acked}
            color="green"
          >
            {acked ? 'Sudah disetujui' : 'Saya setuju & paham risikonya'}
          </Button>
          {acked && (
            <Button
              variant="light"
              color="red"
              leftSection={<TbX size={16} />}
              onClick={confirmRevoke}
              loading={revokeMutation.isPending}
            >
              Batalkan persetujuan
            </Button>
          )}
          {acked && (
            <Text size="xs" c="dimmed">
              Disetujui {new Date(ack.at).toLocaleString('id-ID')}
            </Text>
          )}
        </Group>
      </Stack>
    </Card>
  )
}
