import { Alert, Loader, Stack, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/frontend/hooks/useAuth'
import { apiFetch } from '@/frontend/lib/apiFetch'
import { WaVerifyConsumers } from './WaVerifyConsumers'
import { WaVerifyGuide } from './WaVerifyGuide'
import { WaVerifyInbound } from './WaVerifyInbound'
import { WaVerifyLogs } from './WaVerifyLogs'
import type { ConsumersResponse } from './wa-verify.types'

export function WaVerifyPanel() {
  const { data: session } = useSession()
  const isSuperAdmin = session?.user?.role === 'SUPER_ADMIN'

  const query = useQuery({
    queryKey: ['wa', 'verify', 'consumers'],
    queryFn: () => apiFetch<ConsumersResponse>('/api/wa/verify/consumers'),
    staleTime: 10_000,
  })

  if (query.isLoading) return <Loader />
  if (query.isError || !query.data)
    return (
      <Alert color="red" variant="light">
        {(query.error as Error)?.message ?? 'Gagal memuat consumer.'}
      </Alert>
    )

  const { consumers, canEdit } = query.data

  return (
    <Stack gap="lg" maw={900}>
      <div>
        <Title order={4}>Verifikasi Nomor (Inbound)</Title>
        <Text size="sm" c="dimmed">
          User membuktikan kepemilikan nomor dengan mengirim token ke nomor server. Dashboard hanya menerima — aman dari
          kebijakan anti-ban OTP. Setiap consumer app terisolasi penuh.
        </Text>
      </div>
      <WaVerifyGuide />
      <WaVerifyConsumers consumers={consumers} canEdit={canEdit} />
      <WaVerifyLogs canEdit={canEdit} />
      {isSuperAdmin && <WaVerifyInbound />}
    </Stack>
  )
}
