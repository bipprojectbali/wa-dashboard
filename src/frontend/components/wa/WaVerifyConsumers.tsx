import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Code,
  CopyButton,
  Group,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { TbCopy, TbCopyCheck, TbKey, TbPencil, TbPlus, TbTrash } from 'react-icons/tb'
import { apiFetch } from '@/frontend/lib/apiFetch'
import { openEditConsumerModal } from './WaVerifyConsumerEditModal'
import type { CreatedConsumer, VerifyConsumer } from './wa-verify.types'

interface Props {
  consumers: VerifyConsumer[]
  canEdit: boolean
}

// Modal yang menampilkan API key plaintext SEKALI — setelah ditutup tak bisa dilihat lagi.
function showApiKeyModal(apiKey: string, title: string) {
  modals.open({
    title,
    children: (
      <Stack gap="sm">
        <Alert color="orange" variant="light">
          Simpan key ini sekarang. Key plaintext hanya ditampilkan sekali dan tidak disimpan di server.
        </Alert>
        <Group gap="xs">
          <Code fz="sm" style={{ wordBreak: 'break-all', flex: 1 }}>
            {apiKey}
          </Code>
          <CopyButton value={apiKey}>
            {({ copied, copy }) => (
              <Button
                size="xs"
                variant="light"
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
    ),
  })
}

export function WaVerifyConsumers({ consumers, canEdit }: Props) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')

  const invalidate = () => qc.invalidateQueries({ queryKey: ['wa', 'verify', 'consumers'] })

  const create = useMutation({
    mutationFn: () =>
      apiFetch<CreatedConsumer>('/api/wa/verify/consumers', {
        method: 'POST',
        body: JSON.stringify({ name, webhookUrl: webhookUrl || null }),
      }),
    onSuccess: (data) => {
      setName('')
      setWebhookUrl('')
      invalidate()
      showApiKeyModal(data.apiKey, `API key untuk ${data.consumer.name}`)
    },
  })

  const regen = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ apiKey: string }>(`/api/wa/verify/consumers/${id}/regenerate-key`, { method: 'POST' }),
    onSuccess: (data) => {
      invalidate()
      showApiKeyModal(data.apiKey, 'API key baru')
    },
  })

  const toggle = useMutation({
    mutationFn: (c: VerifyConsumer) =>
      apiFetch(`/api/wa/verify/consumers/${c.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: c.name, webhookUrl: c.webhookUrl, active: !c.active }),
      }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/wa/verify/consumers/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  const confirmRegen = (c: VerifyConsumer) =>
    modals.openConfirmModal({
      title: 'Buat key baru',
      children: (
        <Text size="sm">
          Buat API key baru untuk <b>{c.name}</b>? Key lama langsung tidak berlaku — app yang masih memakainya harus
          diperbarui. Key baru hanya ditampilkan sekali.
        </Text>
      ),
      labels: { confirm: 'Buat & salin', cancel: 'Batal' },
      confirmProps: { color: 'orange' },
      onConfirm: () => regen.mutate(c.id),
    })

  const confirmDelete = (c: VerifyConsumer) =>
    modals.openConfirmModal({
      title: 'Hapus consumer',
      children: (
        <Text size="sm">
          Hapus consumer <b>{c.name}</b>? Semua request verifikasinya ikut terhapus (cascade). Tindakan ini tak bisa
          dibatalkan.
        </Text>
      ),
      labels: { confirm: 'Hapus', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => remove.mutate(c.id),
    })

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Title order={5}>Consumer Apps</Title>

        {canEdit && (
          <Group align="flex-end" gap="xs" wrap="wrap">
            <TextInput
              label="Nama consumer"
              placeholder="mis. app-login"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              style={{ flex: 1, minWidth: 160 }}
            />
            <TextInput
              label="Webhook URL (opsional)"
              placeholder="https://app.example.com/wav-hook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.currentTarget.value)}
              style={{ flex: 2, minWidth: 200 }}
            />
            <Button
              leftSection={<TbPlus size={16} />}
              onClick={() => create.mutate()}
              loading={create.isPending}
              disabled={!name.trim()}
            >
              Buat
            </Button>
          </Group>
        )}

        {create.isError && (
          <Alert color="red" variant="light">
            {(create.error as Error).message}
          </Alert>
        )}

        {consumers.length === 0 ? (
          <Text size="sm" c="dimmed">
            Belum ada consumer terdaftar.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={620}>
            <Table verticalSpacing="xs" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nama</Table.Th>
                  <Table.Th>Key Prefix</Table.Th>
                  <Table.Th>Webhook</Table.Th>
                  <Table.Th>Requests</Table.Th>
                  <Table.Th>Aktif</Table.Th>
                  {canEdit && <Table.Th>Aksi</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {consumers.map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td>{c.name}</Table.Td>
                    <Table.Td>
                      <Code fz="xs">{c.apiKeyPrefix}…</Code>
                    </Table.Td>
                    <Table.Td>
                      {c.webhookUrl ? (
                        <Badge color="blue" variant="light" size="sm">
                          push
                        </Badge>
                      ) : (
                        <Badge color="gray" variant="light" size="sm">
                          polling
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>{c._count.requests}</Table.Td>
                    <Table.Td>
                      <Switch
                        checked={c.active}
                        disabled={!canEdit || toggle.isPending}
                        size="sm"
                        onChange={() => toggle.mutate(c)}
                      />
                    </Table.Td>
                    {canEdit && (
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Tooltip label="Edit nama / webhook">
                            <ActionIcon variant="subtle" color="blue" onClick={() => openEditConsumerModal(c)}>
                              <TbPencil size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Buat & salin key baru (key lama batal)">
                            <ActionIcon
                              variant="subtle"
                              color="orange"
                              onClick={() => confirmRegen(c)}
                              loading={regen.isPending}
                            >
                              <TbKey size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Hapus">
                            <ActionIcon variant="subtle" color="red" onClick={() => confirmDelete(c)}>
                              <TbTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    )}
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
