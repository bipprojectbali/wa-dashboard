import { Alert, Loader, Stack, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { TbAlertTriangle } from 'react-icons/tb'
import { apiFetch } from '@/frontend/lib/apiFetch'
import { WaContractView } from './WaContractView'
import { WaPolicySettings } from './WaPolicySettings'
import { WaPolicyUsage } from './WaPolicyUsage'
import type { PolicyResponse } from './wa-policy.types'

export function WaPolicyPanel() {
  const query = useQuery({
    queryKey: ['wa', 'policy'],
    queryFn: () => apiFetch<PolicyResponse>('/api/wa/policy'),
    staleTime: 10_000,
  })

  if (query.isLoading) return <Loader />
  if (query.isError || !query.data)
    return (
      <Alert color="red" variant="light">
        {(query.error as Error)?.message ?? 'Gagal memuat kebijakan.'}
      </Alert>
    )

  const { policy, usage, ack, contract, canEdit } = query.data

  return (
    <Stack gap="lg" maw={760}>
      <Title order={4}>Aturan & Kontrak WhatsApp</Title>
      {policy.allowFirstContact && (
        <Alert color="orange" variant="light" icon={<TbAlertTriangle size={18} />} title="Mode OTP aktif">
          "Izinkan kirim duluan" sedang menyala. Pengiriman ke nomor asing diperbolehkan — risiko ban naik signifikan.
          Matikan bila tidak sedang dipakai.
        </Alert>
      )}
      <WaContractView contract={contract} ack={ack} />
      <WaPolicyUsage usage={usage} />
      <WaPolicySettings key={policy.updatedAt} policy={policy} canEdit={canEdit} />
    </Stack>
  )
}
