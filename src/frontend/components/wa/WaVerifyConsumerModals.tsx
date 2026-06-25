import { Alert, Button, Code, CopyButton, Group, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { TbCopy, TbCopyCheck } from 'react-icons/tb'
import type { CreatedConsumer } from './wa-verify.types'

// Satu baris kredensial: nilai monospace + tombol salin.
export function SecretField({ label, value }: { label?: string; value: string }) {
  return (
    <Stack gap={4}>
      {label && (
        <Text size="xs" fw={600} c="dimmed">
          {label}
        </Text>
      )}
      <Group gap="xs">
        <Code fz="sm" style={{ wordBreak: 'break-all', flex: 1 }}>
          {value}
        </Code>
        <CopyButton value={value}>
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
  )
}

// Modal yang menampilkan API key plaintext SEKALI — setelah ditutup tak bisa dilihat lagi.
export function showApiKeyModal(apiKey: string, title: string) {
  modals.open({
    title,
    children: (
      <Stack gap="sm">
        <Alert color="orange" variant="light">
          Simpan key ini sekarang. Key plaintext hanya ditampilkan sekali dan tidak disimpan di server.
        </Alert>
        <SecretField value={apiKey} />
      </Stack>
    ),
  })
}

// Modal setelah create: API key (sekali) + webhook secret (bisa di-reveal ulang).
export function showCreatedModal(data: CreatedConsumer) {
  modals.open({
    title: `Kredensial untuk ${data.consumer.name}`,
    children: (
      <Stack gap="sm">
        <Alert color="orange" variant="light">
          API key plaintext hanya ditampilkan sekali dan tidak disimpan di server. Salin sekarang.
        </Alert>
        <SecretField label="API key" value={data.apiKey} />
        <SecretField label="Webhook secret (untuk verifikasi HMAC)" value={data.consumer.webhookSecret} />
        <Text size="xs" c="dimmed">
          Webhook secret bisa dilihat lagi kapan saja lewat tombol mata di tabel.
        </Text>
      </Stack>
    ),
  })
}

// Modal reveal webhook secret on-demand (secret disimpan plaintext, aman di-reveal ulang).
export function showSecretModal(name: string, secret: string) {
  modals.open({
    title: `Webhook secret — ${name}`,
    children: (
      <Stack gap="sm">
        <SecretField label="Webhook secret" value={secret} />
        <Text size="xs" c="dimmed">
          Pakai untuk memverifikasi header X-WAV-Signature pada webhook.
        </Text>
      </Stack>
    ),
  })
}
