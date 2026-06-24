import { Alert, Button, Group, Stack, TextInput } from '@mantine/core'
import { modals } from '@mantine/modals'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { TbDeviceFloppy } from 'react-icons/tb'
import { apiFetch } from '@/frontend/lib/apiFetch'
import type { VerifyConsumer } from './wa-verify.types'

// Form edit name + webhookUrl satu consumer. active dipertahankan apa adanya
// (toggle aktif punya kontrol sendiri di tabel).
function EditConsumerForm({ consumer }: { consumer: VerifyConsumer }) {
  const qc = useQueryClient()
  const [name, setName] = useState(consumer.name)
  const [webhookUrl, setWebhookUrl] = useState(consumer.webhookUrl ?? '')

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/api/wa/verify/consumers/${consumer.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, webhookUrl: webhookUrl || null, active: consumer.active }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa', 'verify', 'consumers'] })
      modals.closeAll()
    },
  })

  return (
    <Stack gap="sm">
      <TextInput label="Nama consumer" value={name} onChange={(e) => setName(e.currentTarget.value)} data-autofocus />
      <TextInput
        label="Webhook URL (opsional)"
        placeholder="https://app.example.com/wav-hook"
        description="Kosongkan untuk mode polling-only."
        value={webhookUrl}
        onChange={(e) => setWebhookUrl(e.currentTarget.value)}
      />
      {save.isError && (
        <Alert color="red" variant="light">
          {(save.error as Error).message}
        </Alert>
      )}
      <Group justify="flex-end">
        <Button variant="default" onClick={() => modals.closeAll()}>
          Batal
        </Button>
        <Button
          leftSection={<TbDeviceFloppy size={16} />}
          onClick={() => save.mutate()}
          loading={save.isPending}
          disabled={!name.trim()}
        >
          Simpan
        </Button>
      </Group>
    </Stack>
  )
}

export function openEditConsumerModal(consumer: VerifyConsumer) {
  modals.open({
    title: `Edit consumer — ${consumer.name}`,
    children: <EditConsumerForm consumer={consumer} />,
  })
}
