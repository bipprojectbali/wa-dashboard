import { Alert, Card, Group, Loader, Stack, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/frontend/lib/apiFetch'

export interface AccountResp {
  success: boolean
  sessionInfo?: { pushname?: string; wid?: { user?: string }; platform?: string }
}

// Ringkasan akun WA (nama/nomor/platform) dari GET /api/wa/account. Dipakai
// bersama oleh tab Koneksi (konfirmasi sesi tertaut) dan tab Info Akun.
// Query key sama (['wa','account']) → TanStack Query dedup, tidak ada fetch ganda.
export function WaAccountSummary({ enabled = true }: { enabled?: boolean }) {
  const account = useQuery({
    queryKey: ['wa', 'account'],
    queryFn: () => apiFetch<AccountResp>('/api/wa/account'),
    staleTime: 60_000,
    enabled,
  })

  const info = account.data?.sessionInfo

  if (account.isError) {
    return (
      <Alert color="red" variant="light">
        {(account.error as Error).message}
      </Alert>
    )
  }

  return (
    <Card withBorder padding="md">
      {account.isLoading ? (
        <Loader size="sm" />
      ) : (
        <Stack gap={4}>
          <Group gap="xs">
            <Text size="sm" fw={600}>
              Nama:
            </Text>
            <Text size="sm">{info?.pushname ?? '—'}</Text>
          </Group>
          <Group gap="xs">
            <Text size="sm" fw={600}>
              Nomor:
            </Text>
            <Text size="sm">{info?.wid?.user ?? '—'}</Text>
          </Group>
          <Group gap="xs">
            <Text size="sm" fw={600}>
              Platform:
            </Text>
            <Text size="sm">{info?.platform ?? '—'}</Text>
          </Group>
        </Stack>
      )}
    </Card>
  )
}
