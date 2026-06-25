import { Stack, Text, Title } from '@mantine/core'
import { useSession } from '@/frontend/hooks/useAuth'
import { WaVerifyConsumers } from './WaVerifyConsumers'
import { WaVerifyGuide } from './WaVerifyGuide'
import { WaVerifyInbound } from './WaVerifyInbound'
import { WaVerifyLogs } from './WaVerifyLogs'

export function WaVerifyPanel() {
  const { data: session } = useSession()
  const isSuperAdmin = session?.user?.role === 'SUPER_ADMIN'

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
      <WaVerifyConsumers />
      <WaVerifyLogs canEdit={isSuperAdmin} />
      {isSuperAdmin && <WaVerifyInbound />}
    </Stack>
  )
}
