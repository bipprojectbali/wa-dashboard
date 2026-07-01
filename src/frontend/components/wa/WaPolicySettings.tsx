import { Alert, Button, Card, Group, NumberInput, Stack, Switch, Text, Textarea, Title } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { TbDeviceFloppy, TbRestore } from 'react-icons/tb'
import { apiFetch } from '@/frontend/lib/apiFetch'
import type { PolicyEditable, WaPolicy } from './wa-policy.types'

interface Props {
  policy: WaPolicy
  canEdit: boolean
}

// Placeholder teks default balasan (dicerminkan dari DEFAULT_VERIFY_REPLY_MESSAGE di
// src/lib/wa-verify-reply.ts). Textarea kosong → server pakai default (pesan disimpan null).
const DEFAULT_REPLY_PLACEHOLDER = 'Nomor Anda berhasil terverifikasi. Terima kasih 🙏'

function toEditable(p: WaPolicy): PolicyEditable {
  return {
    allowFirstContact: p.allowFirstContact,
    maxPerMinute: p.maxPerMinute,
    maxPerHour: p.maxPerHour,
    maxPerDay: p.maxPerDay,
    minIntervalSeconds: p.minIntervalSeconds,
    perRecipientCooldownSeconds: p.perRecipientCooldownSeconds,
    requireAck: p.requireAck,
    verifyReplyEnabled: p.verifyReplyEnabled,
    verifyReplyMessage: p.verifyReplyMessage,
  }
}

export function WaPolicySettings({ policy, canEdit }: Props) {
  const qc = useQueryClient()
  const [form, setForm] = useState<PolicyEditable>(() => toEditable(policy))

  const save = useMutation({
    mutationFn: () => {
      // Teks balasan kosong → kirim null agar server memakai teks default (bisa dikembalikan).
      const trimmed = form.verifyReplyMessage?.trim()
      const payload = { ...form, verifyReplyMessage: trimmed ? trimmed : null }
      return apiFetch('/api/wa/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa', 'policy'] }),
  })

  const num = (key: keyof PolicyEditable, label: string, desc: string, min = 0) => (
    <NumberInput
      label={label}
      description={desc}
      value={form[key] as number}
      min={min}
      disabled={!canEdit}
      onChange={(v) => setForm((f) => ({ ...f, [key]: Number(v) || 0 }))}
    />
  )

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={5}>Setting & Option</Title>
          {!canEdit && (
            <Text size="xs" c="dimmed">
              Hanya SUPER_ADMIN yang bisa mengubah
            </Text>
          )}
        </Group>

        <Switch
          label="Izinkan kirim duluan (mode OTP) — berisiko tinggi"
          checked={form.allowFirstContact}
          disabled={!canEdit}
          color="orange"
          onChange={(e) => setForm((f) => ({ ...f, allowFirstContact: e.currentTarget.checked }))}
        />
        <Switch
          label="Wajib setujui kontrak sebelum kirim"
          checked={form.requireAck}
          disabled={!canEdit}
          onChange={(e) => setForm((f) => ({ ...f, requireAck: e.currentTarget.checked }))}
        />

        <Card withBorder padding="sm" bg="var(--mantine-color-default-hover)">
          <Stack gap="xs">
            <Switch
              label="Balas otomatis saat verifikasi berhasil"
              description="Nomor server membalas pesan user (aman: reply-to-inbound, lewat rate-limit)."
              checked={form.verifyReplyEnabled}
              disabled={!canEdit}
              color="teal"
              onChange={(e) => setForm((f) => ({ ...f, verifyReplyEnabled: e.currentTarget.checked }))}
            />
            <Textarea
              label="Teks balasan"
              description="Kosongkan untuk memakai teks default (yang bisa dikembalikan)."
              placeholder={DEFAULT_REPLY_PLACEHOLDER}
              value={form.verifyReplyMessage ?? ''}
              disabled={!canEdit || !form.verifyReplyEnabled}
              autosize
              minRows={2}
              maxRows={5}
              maxLength={500}
              onChange={(e) => setForm((f) => ({ ...f, verifyReplyMessage: e.currentTarget.value }))}
            />
            {canEdit && form.verifyReplyMessage != null && form.verifyReplyMessage.trim() !== '' && (
              <Group>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="gray"
                  leftSection={<TbRestore size={14} />}
                  onClick={() => setForm((f) => ({ ...f, verifyReplyMessage: null }))}
                >
                  Kembalikan ke default
                </Button>
              </Group>
            )}
          </Stack>
        </Card>

        <Group grow>
          {num('maxPerMinute', 'Maks / menit', 'Plafon pesan per menit', 1)}
          {num('maxPerHour', 'Maks / jam', 'Plafon pesan per jam', 1)}
          {num('maxPerDay', 'Maks / hari', 'Plafon pesan per hari', 1)}
        </Group>
        <Group grow>
          {num('minIntervalSeconds', 'Jeda minimum (detik)', 'Jeda antar pesan')}
          {num('perRecipientCooldownSeconds', 'Cooldown per nomor (detik)', 'Jeda kirim ke nomor sama')}
        </Group>

        {save.isError && (
          <Alert color="red" variant="light">
            {(save.error as Error).message}
          </Alert>
        )}
        {save.isSuccess && (
          <Alert color="green" variant="light">
            Kebijakan tersimpan.
          </Alert>
        )}

        {canEdit && (
          <Group>
            <Button leftSection={<TbDeviceFloppy size={16} />} onClick={() => save.mutate()} loading={save.isPending}>
              Simpan
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  )
}
